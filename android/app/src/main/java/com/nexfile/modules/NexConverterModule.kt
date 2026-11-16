package com.nexfile.modules

import android.graphics.*
import android.graphics.pdf.PdfDocument
import com.facebook.react.bridge.*
import java.io.*

class NexConverterModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexConverter"

    @ReactMethod
    fun convertTextToPdf(textContent: String, destPdfPath: String, title: String, promise: Promise) {
        try {
            val document = PdfDocument()
            val pageWidth = 595
            val pageHeight = 842
            val margin = 40f
            val lineHeight = 20f
            val textPaint = Paint().apply {
                color = Color.BLACK
                textSize = 12f
                isAntiAlias = true
            }
            val titlePaint = Paint().apply {
                color = Color.rgb(26, 115, 232)
                textSize = 18f
                typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
                isAntiAlias = true
            }

            val lines = textContent.split("\n")
            var currentY = margin + 30f
            var pageNumber = 1

            var pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
            var page = document.startPage(pageInfo)
            var canvas = page.canvas

            if (title.isNotEmpty()) {
                canvas.drawText(title, margin, margin + 10f, titlePaint)
                canvas.drawLine(margin, margin + 18f, pageWidth - margin, margin + 18f, textPaint)
            }

            for (line in lines) {
                if (currentY + lineHeight > pageHeight - margin) {
                    document.finishPage(page)
                    pageNumber++
                    pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                    page = document.startPage(pageInfo)
                    canvas = page.canvas
                    currentY = margin
                }

                // Wrap text if needed
                val maxChars = 75
                if (line.length > maxChars) {
                    var remaining = line
                    while (remaining.isNotEmpty()) {
                        val chunkLength = Math.min(maxChars, remaining.length)
                        val chunk = remaining.substring(0, chunkLength)
                        canvas.drawText(chunk, margin, currentY, textPaint)
                        currentY += lineHeight
                        remaining = remaining.substring(chunkLength)

                        if (currentY + lineHeight > pageHeight - margin) {
                            document.finishPage(page)
                            pageNumber++
                            pageInfo = PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageNumber).create()
                            page = document.startPage(pageInfo)
                            canvas = page.canvas
                            currentY = margin
                        }
                    }
                } else {
                    canvas.drawText(line, margin, currentY, textPaint)
                    currentY += lineHeight
                }
            }

            document.finishPage(page)

            val destFile = File(destPdfPath)
            destFile.parentFile?.mkdirs()
            FileOutputStream(destFile).use { fos ->
                document.writeTo(fos)
            }
            document.close()

            promise.resolve(destFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("TXT_TO_PDF_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun applyDocumentFilter(imagePath: String, destPath: String, filterType: String, promise: Promise) {
        try {
            val file = File(imagePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Source image not found")
                return
            }

            val original = BitmapFactory.decodeFile(file.absolutePath)
            val filtered = Bitmap.createBitmap(original.width, original.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(filtered)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG)

            when (filterType.lowercase()) {
                "grayscale" -> {
                    val colorMatrix = ColorMatrix().apply { setSaturation(0f) }
                    paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
                    canvas.drawBitmap(original, 0f, 0f, paint)
                }
                "bw", "blackwhite" -> {
                    // High-contrast B&W threshold
                    val colorMatrix = ColorMatrix(floatArrayOf(
                        3f, 3f, 3f, 0f, -255f,
                        3f, 3f, 3f, 0f, -255f,
                        3f, 3f, 3f, 0f, -255f,
                        0f, 0f, 0f, 1f, 0f
                    ))
                    paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
                    canvas.drawBitmap(original, 0f, 0f, paint)
                }
                "color", "magic_color" -> {
                    // Document enhancement: boost contrast and saturation
                    val colorMatrix = ColorMatrix().apply {
                        setSaturation(1.3f)
                    }
                    paint.colorFilter = ColorMatrixColorFilter(colorMatrix)
                    canvas.drawBitmap(original, 0f, 0f, paint)
                }
                else -> {
                    // Original
                    canvas.drawBitmap(original, 0f, 0f, paint)
                }
            }

            val destFile = File(destPath)
            destFile.parentFile?.mkdirs()

            FileOutputStream(destFile).use { out ->
                filtered.compress(Bitmap.CompressFormat.JPEG, 90, out)
            }

            original.recycle()
            filtered.recycle()

            promise.resolve(destFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("FILTER_ERROR", e.message, e)
        }
    }
}

