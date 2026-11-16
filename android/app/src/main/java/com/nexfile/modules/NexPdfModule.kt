package com.nexfile.modules

import android.graphics.*
import android.graphics.pdf.PdfDocument
import android.graphics.pdf.PdfRenderer
import android.os.ParcelFileDescriptor
import com.facebook.react.bridge.*
import java.io.*
import java.util.Locale

class NexPdfModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexPdf"

    @ReactMethod
    fun getPdfPageCount(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "PDF file not found: $filePath")
                return
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

    @ReactMethod
    fun renderPageToImage(filePath: String, pageIndex: Int, destImagePath: String, quality: Int, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "PDF file not found: $filePath")
                return
            }

            val pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
            val renderer = PdfRenderer(pfd)

            if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
                renderer.close()
                pfd.close()
                promise.reject("INVALID_PAGE_INDEX", "Page index $pageIndex is out of bounds (count: ${renderer.pageCount})")
                return
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

    @ReactMethod
    fun createPdfFromImages(imagePaths: ReadableArray, destPdfPath: String, quality: Int, promise: Promise) {
        try {
            val document = PdfDocument()

            for (i in 0 until imagePaths.size()) {
                val imgPath = imagePaths.getString(i) ?: continue
                val imgFile = File(imgPath)
                if (!imgFile.exists()) continue

                val bitmap = BitmapFactory.decodeFile(imgFile.absolutePath) ?: continue

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

    @ReactMethod
    fun addWatermarkToPdf(sourcePdfPath: String, destPdfPath: String, watermarkText: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePdfPath)
            if (!sourceFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Source PDF not found")
                return
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

