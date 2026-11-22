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
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import java.io.*
import java.util.Locale

class NexPdfModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String = "NexPdf"

    private val ioExecutor = java.util.concurrent.Executors.newFixedThreadPool(3)

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

    // =========================================================================
    // 1. SMART IMAGE PROCESSING, 4-POINT PERSPECTIVE CROP & COLOR FILTERS
    // =========================================================================
    @ReactMethod
    fun processDocumentImage(sourcePath: String, destPath: String, options: ReadableMap, promise: Promise) {
        ioExecutor.execute {
            try {
                val srcFile = File(sourcePath)
                if (!srcFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Source document image not found: $sourcePath")
                    return@execute
                }

                val rawBitmap = BitmapFactory.decodeFile(srcFile.absolutePath)
                    ?: throw Exception("Could not decode image at $sourcePath")

                // Handle EXIF Rotation
                val orientation = try {
                    val exif = ExifInterface(srcFile.absolutePath)
                    exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL)
                } catch (e: Exception) {
                    ExifInterface.ORIENTATION_NORMAL
                }

                val exifMatrix = Matrix()
                when (orientation) {
                    ExifInterface.ORIENTATION_ROTATE_90 -> exifMatrix.postRotate(90f)
                    ExifInterface.ORIENTATION_ROTATE_180 -> exifMatrix.postRotate(180f)
                    ExifInterface.ORIENTATION_ROTATE_270 -> exifMatrix.postRotate(270f)
                }

                var baseBitmap = if (!exifMatrix.isIdentity) {
                    val rotated = Bitmap.createBitmap(rawBitmap, 0, 0, rawBitmap.width, rawBitmap.height, exifMatrix, true)
                    rawBitmap.recycle()
                    rotated
                } else {
                    rawBitmap
                }

                // Additional user rotation (90, 180, 270)
                val manualRotation = if (options.hasKey("rotation")) options.getInt("rotation") else 0
                if (manualRotation != 0) {
                    val rotMatrix = Matrix().apply { postRotate(manualRotation.toFloat()) }
                    val rotated = Bitmap.createBitmap(baseBitmap, 0, 0, baseBitmap.width, baseBitmap.height, rotMatrix, true)
                    baseBitmap.recycle()
                    baseBitmap = rotated
                }

                // 4-Point Perspective Crop if provided
                if (options.hasKey("crop")) {
                    val crop = options.getMap("crop")
                    if (crop != null && crop.hasKey("tlX")) {
                        val w = baseBitmap.width.toFloat()
                        val h = baseBitmap.height.toFloat()

                        val tlX = crop.getDouble("tlX").toFloat() * w
                        val tlY = crop.getDouble("tlY").toFloat() * h
                        val trX = crop.getDouble("trX").toFloat() * w
                        val trY = crop.getDouble("trY").toFloat() * h
                        val brX = crop.getDouble("brX").toFloat() * w
                        val brY = crop.getDouble("brY").toFloat() * h
                        val blX = crop.getDouble("blX").toFloat() * w
                        val blY = crop.getDouble("blY").toFloat() * h

                        val srcCorners = floatArrayOf(tlX, tlY, trX, trY, brX, brY, blX, blY)

                        val topWidth = Math.hypot((trX - tlX).toDouble(), (trY - tlY).toDouble()).toFloat()
                        val bottomWidth = Math.hypot((brX - blX).toDouble(), (brY - blY).toDouble()).toFloat()
                        val targetW = Math.max(topWidth, bottomWidth).coerceAtLeast(100f)

                        val leftHeight = Math.hypot((blX - tlX).toDouble(), (blY - tlY).toDouble()).toFloat()
                        val rightHeight = Math.hypot((brX - trX).toDouble(), (brY - trY).toDouble()).toFloat()
                        val targetH = Math.max(leftHeight, rightHeight).coerceAtLeast(100f)

                        val dstCorners = floatArrayOf(0f, 0f, targetW, 0f, targetW, targetH, 0f, targetH)

                        val warpMatrix = Matrix()
                        if (warpMatrix.setPolyToPoly(srcCorners, 0, dstCorners, 0, 4)) {
                            val warped = Bitmap.createBitmap(targetW.toInt(), targetH.toInt(), Bitmap.Config.ARGB_8888)
                            val canvas = Canvas(warped)
                            val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
                            canvas.drawBitmap(baseBitmap, warpMatrix, paint)
                            baseBitmap.recycle()
                            baseBitmap = warped
                        }
                    }
                }

                // Apply Filters & Adjustments
                val filterType = if (options.hasKey("filter")) options.getString("filter") ?: "magic_color" else "magic_color"
                val brightness = if (options.hasKey("brightness")) options.getDouble("brightness").toFloat() else 0f
                val contrast = if (options.hasKey("contrast")) options.getDouble("contrast").toFloat() else 0f

                val processed = applyFilterToBitmap(baseBitmap, filterType, brightness, contrast)
                if (processed != baseBitmap) {
                    baseBitmap.recycle()
                }

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()

                val quality = if (options.hasKey("quality")) options.getInt("quality").coerceIn(30, 100) else 90
                FileOutputStream(destFile).use { out ->
                    processed.compress(Bitmap.CompressFormat.JPEG, quality, out)
                }
                processed.recycle()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("PROCESS_IMAGE_ERROR", e.message, e)
            }
        }
    }

    private fun applyFilterToBitmap(src: Bitmap, filter: String, brightness: Float, contrast: Float): Bitmap {
        val result = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(result)
        val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)

        val cm = ColorMatrix()

        when (filter.lowercase()) {
            "grayscale" -> {
                cm.setSaturation(0f)
                applyBrightnessContrast(cm, brightness, contrast)
                paint.colorFilter = ColorMatrixColorFilter(cm)
                canvas.drawBitmap(src, 0f, 0f, paint)
            }
            "bw", "black_and_white" -> {
                // High-contrast document binarization
                cm.setSaturation(0f)
                val c = 2.0f + (contrast / 50f)
                val t = -128f * (c - 1f) + (brightness * 2f)
                val bwMatrix = ColorMatrix(floatArrayOf(
                    c, c, c, 0f, t,
                    c, c, c, 0f, t,
                    c, c, c, 0f, t,
                    0f, 0f, 0f, 1f, 0f
                ))
                cm.postConcat(bwMatrix)
                paint.colorFilter = ColorMatrixColorFilter(cm)
                canvas.drawBitmap(src, 0f, 0f, paint)
            }
            "magic_color", "auto_enhance" -> {
                // Deepens dark text, whitens paper background, cleans up noise
                val c = 1.35f + (contrast / 100f)
                val b = 25f + brightness
                val t = -128f * (c - 1f) + b
                val magicMatrix = ColorMatrix(floatArrayOf(
                    c, 0f, 0f, 0f, t,
                    0f, c, 0f, 0f, t,
                    0f, 0f, c, 0f, t,
                    0f, 0f, 0f, 1f, 0f
                ))
                cm.set(magicMatrix)
                paint.colorFilter = ColorMatrixColorFilter(cm)
                canvas.drawBitmap(src, 0f, 0f, paint)
            }
            "lighten", "shadow_removal" -> {
                // Brightens dark shadows while retaining text clarity
                val c = 1.15f + (contrast / 100f)
                val b = 45f + brightness
                val t = -128f * (c - 1f) + b
                val lightenMatrix = ColorMatrix(floatArrayOf(
                    c, 0f, 0f, 0f, t,
                    0f, c, 0f, 0f, t,
                    0f, 0f, c, 0f, t,
                    0f, 0f, 0f, 1f, 0f
                ))
                cm.set(lightenMatrix)
                paint.colorFilter = ColorMatrixColorFilter(cm)
                canvas.drawBitmap(src, 0f, 0f, paint)
            }
            else -> {
                // Original / Photo mode
                if (brightness != 0f || contrast != 0f) {
                    applyBrightnessContrast(cm, brightness, contrast)
                    paint.colorFilter = ColorMatrixColorFilter(cm)
                }
                canvas.drawBitmap(src, 0f, 0f, paint)
            }
        }

        return result
    }

    private fun applyBrightnessContrast(cm: ColorMatrix, brightness: Float, contrast: Float) {
        val scale = (contrast + 100f) / 100f
        val translate = (-128f * (scale - 1f)) + (brightness * 1.5f)
        val matrix = ColorMatrix(floatArrayOf(
            scale, 0f, 0f, 0f, translate,
            0f, scale, 0f, 0f, translate,
            0f, 0f, scale, 0f, translate,
            0f, 0f, 0f, 1f, 0f
        ))
        cm.postConcat(matrix)
    }

    // =========================================================================
    // 2. ID CARD DUAL-SIDE STITCHING (Front + Back on single A4)
    // =========================================================================
    @ReactMethod
    fun combineIdCardSides(frontImagePath: String, backImagePath: String, destImagePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val frontBitmap = BitmapFactory.decodeFile(frontImagePath)
                    ?: throw Exception("Could not load front side image")
                val backBitmap = BitmapFactory.decodeFile(backImagePath)
                    ?: throw Exception("Could not load back side image")

                // High-resolution A4 canvas: 1240 x 1754 px
                val a4Width = 1240
                val a4Height = 1754
                val canvasBitmap = Bitmap.createBitmap(a4Width, a4Height, Bitmap.Config.ARGB_8888)
                val canvas = Canvas(canvasBitmap)
                canvas.drawColor(Color.WHITE)

                val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)

                // Header Badge
                val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.rgb(30, 41, 59)
                    textSize = 34f
                    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                    textAlign = Paint.Align.CENTER
                }

                val subTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.rgb(100, 116, 139)
                    textSize = 22f
                    textAlign = Paint.Align.CENTER
                }

                canvas.drawText("IDENTITY CARD / PASSPORT SCAN", a4Width / 2f, 90f, textPaint)
                canvas.drawText("Official Document Record • NexFile Secure Scan", a4Width / 2f, 130f, subTextPaint)

                // Target card dimensions on A4: ~1000 x 630 px (Standard ID ratio ~ 1.58)
                val cardW = 980f
                val cardH = 620f
                val cornerRadius = 24f
                val marginX = (a4Width - cardW) / 2f

                // Border Paint
                val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    style = Paint.Style.STROKE
                    strokeWidth = 3f
                    color = Color.rgb(203, 213, 225)
                }

                val badgeBg = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.rgb(241, 245, 249)
                }
                val badgeText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.rgb(15, 23, 42)
                    textSize = 20f
                    typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                }

                // 1. Draw Front Card
                val frontTop = 190f
                val frontRect = RectF(marginX, frontTop, marginX + cardW, frontTop + cardH)
                canvas.drawRoundRect(frontRect, cornerRadius, cornerRadius, borderPaint)

                // Draw "FRONT SIDE" tag
                val tagRect1 = RectF(marginX + 20f, frontTop + 16f, marginX + 180f, frontTop + 54f)
                canvas.drawRoundRect(tagRect1, 10f, 10f, badgeBg)
                canvas.drawText("FRONT SIDE", marginX + 36f, frontTop + 42f, badgeText)

                val scaledFront = Bitmap.createScaledBitmap(frontBitmap, (cardW - 40).toInt(), (cardH - 80).toInt(), true)
                canvas.drawBitmap(scaledFront, marginX + 20f, frontTop + 65f, paint)
                scaledFront.recycle()
                frontBitmap.recycle()

                // 2. Draw Back Card
                val backTop = 940f
                val backRect = RectF(marginX, backTop, marginX + cardW, backTop + cardH)
                canvas.drawRoundRect(backRect, cornerRadius, cornerRadius, borderPaint)

                // Draw "BACK SIDE" tag
                val tagRect2 = RectF(marginX + 20f, backTop + 16f, marginX + 175f, backTop + 54f)
                canvas.drawRoundRect(tagRect2, 10f, 10f, badgeBg)
                canvas.drawText("BACK SIDE", marginX + 36f, backTop + 42f, badgeText)

                val scaledBack = Bitmap.createScaledBitmap(backBitmap, (cardW - 40).toInt(), (cardH - 80).toInt(), true)
                canvas.drawBitmap(scaledBack, marginX + 20f, backTop + 65f, paint)
                scaledBack.recycle()
                backBitmap.recycle()

                // Footer note
                val footerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.rgb(148, 163, 184)
                    textSize = 20f
                    textAlign = Paint.Align.CENTER
                }
                canvas.drawText("Verified Scanned Document Copy", a4Width / 2f, 1670f, footerPaint)

                val destFile = File(destImagePath)
                destFile.parentFile?.mkdirs()
                FileOutputStream(destFile).use { out ->
                    canvasBitmap.compress(Bitmap.CompressFormat.JPEG, 92, out)
                }
                canvasBitmap.recycle()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("COMBINE_ID_ERROR", e.message, e)
            }
        }
    }

    // =========================================================================
    // 3. OFFLINE OCR (IMAGE-TO-TEXT) USING ML KIT
    // =========================================================================
    @ReactMethod
    fun extractTextFromImage(imagePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(imagePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Image file not found: $imagePath")
                    return@execute
                }

                val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                    ?: throw Exception("Could not load bitmap for OCR")

                val image = InputImage.fromBitmap(bitmap, 0)
                val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

                val result = Tasks.await(recognizer.process(image))
                bitmap.recycle()

                val extracted = result.text
                if (extracted.isNullOrBlank()) {
                    promise.resolve("No legible text detected on this document.")
                } else {
                    promise.resolve(extracted)
                }
            } catch (e: Exception) {
                promise.reject("OCR_ERROR", e.message, e)
            }
        }
    }

    // =========================================================================
    // 4. QR CODE & BARCODE SCANNER USING ML KIT
    // =========================================================================
    @ReactMethod
    fun scanQrOrBarcode(imagePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(imagePath)
                if (!file.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Image file not found: $imagePath")
                    return@execute
                }

                val bitmap = BitmapFactory.decodeFile(file.absolutePath)
                    ?: throw Exception("Could not load bitmap for barcode scanning")

                val image = InputImage.fromBitmap(bitmap, 0)
                val scanner = BarcodeScanning.getClient()

                val barcodes = Tasks.await(scanner.process(image))
                bitmap.recycle()

                if (barcodes.isNotEmpty()) {
                    val first = barcodes[0]
                    val response = WritableNativeMap().apply {
                        putString("displayValue", first.displayValue ?: first.rawValue ?: "")
                        putString("rawValue", first.rawValue ?: "")
                        putInt("format", first.format)
                        putInt("valueType", first.valueType)
                    }
                    promise.resolve(response)
                } else {
                    promise.resolve(null)
                }
            } catch (e: Exception) {
                promise.reject("BARCODE_SCAN_ERROR", e.message, e)
            }
        }
    }

    // =========================================================================
    // 5. ADVANCED MULTI-PAGE PDF CREATION WITH WATERMARK, SIGNATURE & ANNOTATIONS
    // =========================================================================
    @ReactMethod
    fun createPdfFromImages(imagePaths: ReadableArray, destPdfPath: String, quality: Int, promise: Promise) {
        createPdfAdvanced(imagePaths, destPdfPath, null, quality, promise)
    }

    @ReactMethod
    fun createPdfWithAdvancedOptions(
        imagePaths: ReadableArray,
        destPdfPath: String,
        options: ReadableMap?,
        promise: Promise
    ) {
        val quality = if (options != null && options.hasKey("quality")) options.getInt("quality") else 90
        createPdfAdvanced(imagePaths, destPdfPath, options, quality, promise)
    }

    private fun createPdfAdvanced(
        imagePaths: ReadableArray,
        destPdfPath: String,
        options: ReadableMap?,
        quality: Int,
        promise: Promise
    ) {
        ioExecutor.execute {
            try {
                val document = PdfDocument()

                // Standard Page Sizes in PostScript points (72 points per inch)
                val pageSizeName = options?.getString("pageSize")?.uppercase(Locale.ROOT) ?: "A4"
                val (pageWidth, pageHeight) = when (pageSizeName) {
                    "LETTER" -> Pair(612, 792)
                    "LEGAL" -> Pair(612, 1008)
                    "IDCARD" -> Pair(420, 595)
                    else -> Pair(595, 842) // A4 default
                }

                val watermarkText = options?.getString("watermarkText")
                val signaturePath = options?.getString("signaturePath")
                val signaturePage = if (options?.hasKey("signaturePage") == true) options.getInt("signaturePage") else 0

                var signatureBitmap: Bitmap? = null
                if (!signaturePath.isNullOrEmpty()) {
                    val sigFile = File(signaturePath)
                    if (sigFile.exists()) {
                        signatureBitmap = BitmapFactory.decodeFile(sigFile.absolutePath)
                    }
                }

                for (i in 0 until imagePaths.size()) {
                    val imgPath = imagePaths.getString(i) ?: continue
                    val imgFile = File(imgPath)
                    if (!imgFile.exists()) continue

                    val rawBitmap = BitmapFactory.decodeFile(imgFile.absolutePath) ?: continue

                    // EXIF Rotation
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

                    val pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, i + 1).create()
                    val page = document.startPage(pageInfo)
                    val canvas = page.canvas

                    val margin = 16f
                    val availableWidth = pageWidth.toFloat() - (margin * 2)
                    val availableHeight = pageHeight.toFloat() - (margin * 2)

                    val scale = Math.min(availableWidth / bitmap.width, availableHeight / bitmap.height)
                    val scaledW = bitmap.width * scale
                    val scaledH = bitmap.height * scale

                    val left = margin + (availableWidth - scaledW) / 2f
                    val top = margin + (availableHeight - scaledH) / 2f

                    val destRect = RectF(left, top, left + scaledW, top + scaledH)
                    val paint = Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG)
                    canvas.drawBitmap(bitmap, null, destRect, paint)

                    // Draw Signature if applicable on this page
                    if (signatureBitmap != null && (signaturePage == i || signaturePage == -1)) {
                        val sigWidth = 140f
                        val sigHeight = 70f
                        val sigLeft = left + scaledW - sigWidth - 20f
                        val sigTop = top + scaledH - sigHeight - 20f
                        val sigRect = RectF(sigLeft, sigTop, sigLeft + sigWidth, sigTop + sigHeight)
                        canvas.drawBitmap(signatureBitmap, null, sigRect, paint)
                    }

                    // Draw Watermark if specified
                    if (!watermarkText.isNullOrEmpty()) {
                        val wmPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                            color = Color.argb(45, 180, 20, 20) // Semi-transparent
                            textSize = 42f
                            typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                            textAlign = Paint.Align.CENTER
                        }
                        canvas.save()
                        canvas.rotate(-45f, pageWidth / 2f, pageHeight / 2f)
                        canvas.drawText(watermarkText, pageWidth / 2f, pageHeight / 2f, wmPaint)
                        canvas.restore()
                    }

                    document.finishPage(page)
                    bitmap.recycle()
                }

                signatureBitmap?.recycle()

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

    // =========================================================================
    // 6. MERGE & SPLIT PDFS
    // =========================================================================
    @ReactMethod
    fun mergePdfs(pdfPaths: ReadableArray, destPdfPath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val document = PdfDocument()
                var totalPageCount = 0

                for (i in 0 until pdfPaths.size()) {
                    val p = pdfPaths.getString(i) ?: continue
                    val file = File(p)
                    if (!file.exists()) continue

                    val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                    val renderer = PdfRenderer(pfd)

                    for (pageIdx in 0 until renderer.pageCount) {
                        totalPageCount++
                        val rendererPage = renderer.openPage(pageIdx)
                        val w = rendererPage.width
                        val h = rendererPage.height

                        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(bitmap)
                        canvas.drawColor(Color.WHITE)
                        rendererPage.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        rendererPage.close()

                        val pageInfo = PdfDocument.PageInfo.Builder(w, h, totalPageCount).create()
                        val pdfPage = document.startPage(pageInfo)
                        pdfPage.canvas.drawBitmap(bitmap, 0f, 0f, null)
                        document.finishPage(pdfPage)
                        bitmap.recycle()
                    }

                    renderer.close()
                    pfd.close()
                }

                val destFile = File(destPdfPath)
                destFile.parentFile?.mkdirs()
                FileOutputStream(destFile).use { fos ->
                    document.writeTo(fos)
                }
                document.close()

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("MERGE_PDF_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun splitPdf(sourcePdfPath: String, pageIndices: ReadableArray, destPdfPath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePdfPath)
                if (!sourceFile.exists()) {
                    promise.reject("FILE_NOT_FOUND", "Source PDF not found: $sourcePdfPath")
                    return@execute
                }

                val targetPages = HashSet<Int>()
                for (i in 0 until pageIndices.size()) {
                    targetPages.add(pageIndices.getInt(i))
                }

                val pfd = ParcelFileDescriptor.open(sourceFile, ParcelFileDescriptor.MODE_READ_ONLY)
                val renderer = PdfRenderer(pfd)
                val document = PdfDocument()

                var outPageNumber = 0
                for (i in 0 until renderer.pageCount) {
                    if (targetPages.contains(i)) {
                        outPageNumber++
                        val page = renderer.openPage(i)
                        val w = page.width
                        val h = page.height

                        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        val canvas = Canvas(bitmap)
                        canvas.drawColor(Color.WHITE)
                        page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        page.close()

                        val pageInfo = PdfDocument.PageInfo.Builder(w, h, outPageNumber).create()
                        val pdfPage = document.startPage(pageInfo)
                        pdfPage.canvas.drawBitmap(bitmap, 0f, 0f, null)
                        document.finishPage(pdfPage)
                        bitmap.recycle()
                    }
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
                promise.reject("SPLIT_PDF_ERROR", e.message, e)
            }
        }
    }

    // =========================================================================
    // 7. GET PAGE COUNT & RENDER PAGE TO IMAGE
    // =========================================================================
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
                    promise.reject("INVALID_PAGE_INDEX", "Page index $pageIndex is out of bounds")
                    return@execute
                }

                val page = renderer.openPage(pageIndex)
                val width = page.width * 2
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
    fun addWatermarkToPdf(sourcePdfPath: String, destPdfPath: String, watermarkText: String, promise: Promise) {
        val options = WritableNativeMap().apply {
            putString("watermarkText", watermarkText)
        }
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

                    val paint = Paint().apply {
                        color = Color.argb(55, 200, 30, 30)
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
