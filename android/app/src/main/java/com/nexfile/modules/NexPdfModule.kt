package com.nexfile.modules

import android.app.Activity
import android.content.Intent
import android.graphics.*
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.media.ExifInterface
import android.net.Uri
import android.os.ParcelFileDescriptor
import android.provider.MediaStore
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.*
import java.util.Locale

class NexPdfModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "NexPdf"

    private val ioExecutor = java.util.concurrent.Executors.newFixedThreadPool(2)

    private var cameraPromise: Promise? = null
    private var currentCameraPhotoFile: File? = null

    private var pickPromise: Promise? = null

    companion object {
        private const val REQUEST_CAMERA = 9101
        private const val REQUEST_PICK_IMAGE = 9102
    }

    @ReactMethod
    fun launchCameraScan(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        cameraPromise = promise
        try {
            val cameraIntent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
            val photoFile = File(reactContext.cacheDir, "scan_${System.currentTimeMillis()}.jpg")
            currentCameraPhotoFile = photoFile

            val photoUri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                photoFile
            )
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_GRANT_WRITE_URI_PERMISSION)

            activity.startActivityForResult(cameraIntent, REQUEST_CAMERA)
        } catch (e: Exception) {
            cameraPromise = null
            promise.reject("CAMERA_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun pickImageScan(promise: Promise) {
        val activity = reactContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "Current activity is null")
            return
        }

        pickPromise = promise
        try {
            val pickIntent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI).apply {
                type = "image/*"
            }
            activity.startActivityForResult(pickIntent, REQUEST_PICK_IMAGE)
        } catch (e: Exception) {
            pickPromise = null
            promise.reject("PICK_ERROR", e.message, e)
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == REQUEST_CAMERA) {
            val promise = cameraPromise
            cameraPromise = null

            if (resultCode == Activity.RESULT_OK) {
                val file = currentCameraPhotoFile
                if (file != null && file.exists() && file.length() > 0) {
                    promise?.resolve(file.absolutePath)
                } else {
                    val uri = data?.data
                    if (uri != null) {
                        val path = copyUriToCache(uri)
                        promise?.resolve(path)
                    } else {
                        promise?.resolve(null)
                    }
                }
            } else {
                promise?.resolve(null)
            }
            return
        }

        if (requestCode == REQUEST_PICK_IMAGE) {
            val promise = pickPromise
            pickPromise = null

            if (resultCode == Activity.RESULT_OK && data != null && data.data != null) {
                try {
                    val path = copyUriToCache(data.data!!)
                    promise?.resolve(path)
                } catch (e: Exception) {
                    promise?.reject("COPY_ERROR", e.message, e)
                }
            } else {
                promise?.resolve(null)
            }
            return
        }
    }

    override fun onNewIntent(intent: Intent) {}

    private fun copyUriToCache(uri: Uri): String {
        val file = File(reactContext.cacheDir, "picked_doc_${System.currentTimeMillis()}.jpg")
        reactContext.contentResolver.openInputStream(uri)?.use { input ->
            FileOutputStream(file).use { output ->
                input.copyTo(output)
            }
        }
        return file.absolutePath
    }

    @ReactMethod
    fun getPdfPageCount(filePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "PDF file not found: $filePath")
                    return@execute
                }

                val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val pageCount = renderer.pageCount
                renderer.close()
                pfd.close()

                promise.resolve(pageCount)
            } catch (e: Exception) {
                promise.reject("PDF_PAGE_COUNT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun renderPageToImage(filePath: String, pageIndex: Int, destImagePath: String, quality: Int, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(filePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "PDF file not found: $filePath")
                    return@execute
                }

                val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)

                if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
                    renderer.close()
                    pfd.close()
                    promise.reject("INVALID_PAGE_INDEX", "Page index $pageIndex is out of bounds (count: ${renderer.pageCount})")
                    return@execute
                }

                val page = renderer.openPage(pageIndex)
                val width = page.width * 2 // 2x for sharp rendering
                val height = page.height * 2

                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(bitmap)
                canvas.drawColor(Color.WHITE)

                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                page.close()
                renderer.close()
                pfd.close()

                val destFile = File(destImagePath)
                destFile.parentFile?.mkdirs()

                FileOutputStream(destFile).use { out ->
                    bitmap.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(10, 100), out)
                }
                bitmap.recycle()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("RENDER_PAGE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun createPdfFromImages(imagePaths: ReadableArray, destPdfPath: String, quality: Int, promise: Promise) {
        ioExecutor.execute {
            try {
                val document = PdfDocument()

                for (i in 0 until imagePaths.size()) {
                    val imgPath = imagePaths.getString(i) ?: continue
                    val imgFile = File(imgPath)
                    if (!imgFile.exists()) continue

                    val rawBitmap = BitmapFactory.decodeFile(imgFile.absolutePath) ?: continue

                    // Correct EXIF rotation if needed
                    val exif = try { ExifInterface(imgFile.absolutePath) } catch (e: Exception) { null }
                    val orientation = exif?.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                        ?: ExifInterface.ORIENTATION_NORMAL

                    val matrix = Matrix()
                    when (orientation) {
                        ExifInterface.ORIENTATION_ROTATE_90 -> matrix.postRotate(90f)
                        ExifInterface.ORIENTATION_ROTATE_180 -> matrix.postRotate(180f)
                        ExifInterface.ORIENTATION_ROTATE_270 -> matrix.postRotate(270f)
                    }

                    val bitmap = if (!matrix.isIdentity) {
                        val rotated = Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, matrix, true)
                        rawBitmap.recycle()
                        rotated
                    } else {
                        rawBitmap
                    }

                    // Standard A4 aspect: 595 x 842 points
                    val pageInfo = PdfDocument.PageInfo.Builder(595, 842, i + 1).create()
                    val page = document.startPage(pageInfo)
                    val canvas = page.canvas

                    // Scale bitmap to fit page with margins
                    val margin = 20f
                    val availableWidth = 595f - (margin * 2)
                    val availableHeight = 842f - (margin * 2)

                    val scale = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height)
                    val scaledW = bitmap.width * scale
                    val scaledH = bitmap.height * scale

                    val left = margin + (availableWidth - scaledW) / 2f
                    val top = margin + (availableHeight - scaledH) / 2f

                    val destRect = RectF(left, top, left + scaledW, top + scaledH)
                    val paint = Paint(Paint.FILTER_BITMAP_FLAG)
                    canvas.drawBitmap(bitmap, null, destRect, paint)

                    document.finishPage(page)
                    bitmap.recycle()
                }

                val destFile = File(destPdfPath)
                destFile.parentFile?.mkdirs()

                FileOutputStream(destFile).use { fos ->
                    document.writeTo(fos)
                }
                document.close()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("CREATE_PDF_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun addWatermarkToPdf(sourcePdfPath: String, destPdfPath: String, watermarkText: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePdfPath)
                if (!sourceFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Source PDF not found")
                    return@execute
                }

                val pfd = ParcelFileDescriptor.open(sourceFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val document = PdfDocument()

                for (i in 0 until renderer.pageCount) {
                    val page = renderer.openPage(i)
                    val bitmap = Bitmap.createBitmap(page.width, page.height, Bitmap.Config.ARGB_8888)
                    val canvas = Canvas(bitmap)
                    canvas.drawColor(Color.WHITE)

                    page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                    page.close()

                    // Draw Watermark
                    val paint = Paint().apply {
                        color = Color.argb(60, 200, 30, 30) // Semi-transparent red
                        textSize = 48f
                        isAntiAlias = true
                        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                        textAlign = Paint.Align.CENTER
                    }

                    canvas.save()
                    canvas.rotate(-45f, bitmap.width / 2f, bitmap.height / 2f)
                    canvas.drawText(watermarkText, bitmap.width / 2f, bitmap.height / 2f, paint)
                    canvas.restore()

                    val pageInfo = PdfDocument.PageInfo.Builder(bitmap.width, bitmap.height, i + 1).create()
                    val pdfPage = document.startPage(pageInfo)
                    pdfPage.canvas.drawBitmap(bitmap, 0f, 0f, null)
                    document.finishPage(pdfPage)

                    bitmap.recycle()
                }

                renderer.close()
                pfd.close()

                val destFile = File(destPdfPath)
                destFile.parentFile?.mkdirs()
                FileOutputStream(destFile).use { fos ->
                    document.writeTo(fos)
                }
                document.close()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("WATERMARK_ERROR", e.message, e)
            }
        }
    }
}
