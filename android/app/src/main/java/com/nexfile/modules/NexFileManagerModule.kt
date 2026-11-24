package com.nexfile.modules

import android.Manifest
import android.app.WallpaperManager
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.ApplicationInfo
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorMatrix
import android.graphics.ColorMatrixColorFilter
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.RadialGradient
import android.graphics.Rect
import android.app.PictureInPictureParams
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.drawable.BitmapDrawable
import android.graphics.pdf.PdfRenderer
import android.media.AudioManager
import android.media.MediaMetadataRetriever
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.ParcelFileDescriptor
import android.os.StatFs
import android.provider.MediaStore
import android.provider.Settings
import android.util.Rational
import android.webkit.MimeTypeMap
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.*
import java.security.MessageDigest
import java.util.*

class NexFileManagerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexFileManager"

    private val ioExecutor = java.util.concurrent.Executors.newFixedThreadPool(4)
    private val thumbnailExecutor = java.util.concurrent.Executors.newFixedThreadPool(2)

    private fun getFastMimeType(ext: String): String {
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "mp3" -> "audio/mpeg"
            "pdf" -> "application/pdf"
            "txt", "log" -> "text/plain"
            "apk" -> "application/vnd.android.package-archive"
            "zip" -> "application/zip"
            "rar" -> "application/x-rar-compressed"
            "7z" -> "application/x-7z-compressed"
            "doc", "docx" -> "application/msword"
            "xls", "xlsx" -> "application/vnd.ms-excel"
            "ppt", "pptx" -> "application/vnd.ms-powerpoint"
            "" -> "*/*"
            else -> {
                val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
                mime ?: "*/*"
            }
        }
    }

    private data class FileInfoEntry(
        val file: File,
        val name: String,
        val size: Long,
        val lastModified: Long,
        val mimeType: String,
        val parentFolder: String,
        val extension: String,
        var duration: Long = 0L,
        var width: Int = 0,
        var height: Int = 0
    )

    @ReactMethod
    fun checkAllFilesPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                promise.resolve(Environment.isExternalStorageManager())
            } else {
                val granted = ContextCompat.checkSelfPermission(
                    reactContext,
                    Manifest.permission.READ_EXTERNAL_STORAGE
                ) == PackageManager.PERMISSION_GRANTED
                promise.resolve(granted)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun requestAllFilesPermission(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                try {
                    val intent = Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION).apply {
                        data = Uri.parse("package:${reactContext.packageName}")
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(intent)
                    promise.resolve(true)
                } catch (e: Exception) {
                    val fallbackIntent = Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    reactContext.startActivity(fallbackIntent)
                    promise.resolve(true)
                }
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.reject("PERMISSION_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getStorageVolumes(promise: Promise) {
        try {
            val array = Arguments.createArray()

            // Primary Internal Storage
            val internalRoot = Environment.getExternalStorageDirectory()
            val internalMap = Arguments.createMap().apply {
                putString("id", "internal")
                putString("name", "Internal Storage")
                putString("path", internalRoot.absolutePath)
                putBoolean("isRemovable", false)
                putBoolean("isPrimary", true)

                val stat = StatFs(internalRoot.path)
                val blockSize = stat.blockSizeLong
                val totalBlocks = stat.blockCountLong
                val availableBlocks = stat.availableBlocksLong

                putDouble("totalBytes", (totalBlocks * blockSize).toDouble())
                putDouble("freeBytes", (availableBlocks * blockSize).toDouble())
                putDouble("usedBytes", ((totalBlocks - availableBlocks) * blockSize).toDouble())
            }
            array.pushMap(internalMap)

            // Secondary / SD Card detection if available
            val externalDirs = reactContext.getExternalFilesDirs(null)
            if (externalDirs != null && externalDirs.size > 1) {
                for (i in 1 until externalDirs.size) {
                    val file = externalDirs[i] ?: continue
                    val rootPath = file.absolutePath.split("/Android")[0]
                    val sdRoot = File(rootPath)
                    if (sdRoot.exists()) {
                        val stat = StatFs(sdRoot.path)
                        val sdMap = Arguments.createMap().apply {
                            putString("id", "sdcard_$i")
                            putString("name", "SD Card")
                            putString("path", sdRoot.absolutePath)
                            putBoolean("isRemovable", true)
                            putBoolean("isPrimary", false)
                            putDouble("totalBytes", (stat.blockCountLong * stat.blockSizeLong).toDouble())
                            putDouble("freeBytes", (stat.availableBlocksLong * stat.blockSizeLong).toDouble())
                            putDouble("usedBytes", ((stat.blockCountLong - stat.availableBlocksLong) * stat.blockSizeLong).toDouble())
                        }
                        array.pushMap(sdMap)
                    }
                }
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("STORAGE_VOLUMES_ERROR", e.message, e)
        }
    }

    private fun scanDirectory(
        dir: File,
        currentDepth: Int,
        maxDepth: Int,
        outMap: MutableMap<String, FileInfoEntry>,
        maxEntries: Int
    ) {
        if (currentDepth > maxDepth || outMap.size >= maxEntries) return
        val children = dir.listFiles() ?: return

        for (child in children) {
            if (outMap.size >= maxEntries) return
            val childName = child.name

            // Ignore hidden files, trash, and cache folders
            if (childName.startsWith(".") ||
                childName.equals("cache", ignoreCase = true) ||
                childName.equals(".thumbnails", ignoreCase = true) ||
                childName.equals(".trash", ignoreCase = true) ||
                childName.equals(".trash-storage", ignoreCase = true) ||
                childName.equals("Databases", ignoreCase = true) ||
                childName.equals("Backups", ignoreCase = true)
            ) {
                continue
            }

            if (child.isDirectory) {
                // If it is Android, only scan Android/media (for WhatsApp etc.), skip Android/data and Android/obb
                if (childName.equals("Android", ignoreCase = true)) {
                    val mediaDir = File(child, "media")
                    if (mediaDir.exists() && mediaDir.isDirectory) {
                        scanDirectory(mediaDir, currentDepth + 1, maxDepth, outMap, maxEntries)
                    }
                    continue
                }
                if (childName.equals("data", ignoreCase = true) || childName.equals("obb", ignoreCase = true)) {
                    continue
                }
                scanDirectory(child, currentDepth + 1, maxDepth, outMap, maxEntries)
            } else if (child.isFile) {
                val ext = getFileExtension(childName)
                if (isJunkOrSystemFile(child, childName, ext)) {
                    continue
                }
                val canonical = try { child.canonicalPath } catch (e: Exception) { child.absolutePath }
                if (!outMap.containsKey(canonical)) {
                    val parentFile = child.parentFile
                    val parentFolder = if (parentFile != null) {
                        if (parentFile.absolutePath == "/storage/emulated/0" || parentFile.name == "0") {
                            "Internal Storage"
                        } else {
                            parentFile.name
                        }
                    } else {
                        ""
                    }

                    outMap[canonical] = FileInfoEntry(
                        file = child,
                        name = childName,
                        size = child.length(),
                        lastModified = child.lastModified(),
                        mimeType = getMimeType(child),
                        parentFolder = parentFolder,
                        extension = ext
                    )
                }
            }
        }
    }

    @ReactMethod
    fun getRecentFiles(limit: Int, promise: Promise) {
        ioExecutor.execute {
            try {
                val fileMap = LinkedHashMap<String, FileInfoEntry>()
                val maxLimit = if (limit <= 0) 300 else limit

                // 1. Filesystem scan of Internal Storage root and directories (finds all PDFs, TXT, HTML, DOCX, APKs)
                val internalRoot = Environment.getExternalStorageDirectory()
                if (internalRoot != null && internalRoot.exists() && internalRoot.canRead()) {
                    scanDirectory(
                        dir = internalRoot,
                        currentDepth = 0,
                        maxDepth = 3,
                        outMap = fileMap,
                        maxEntries = 2500
                    )
                }

                // 2. Query MediaStore to supplement any additional media or files
                try {
                    val uri = MediaStore.Files.getContentUri("external")
                    val projection = arrayOf(
                        MediaStore.Files.FileColumns.DATA,
                        MediaStore.Files.FileColumns.DISPLAY_NAME,
                        MediaStore.Files.FileColumns.SIZE,
                        MediaStore.Files.FileColumns.DATE_MODIFIED,
                        MediaStore.Files.FileColumns.MIME_TYPE
                    )
                    val sortOrder = "${MediaStore.Files.FileColumns.DATE_MODIFIED} DESC"
                    val cursor = reactContext.contentResolver.query(uri, projection, null, null, sortOrder)

                    cursor?.use {
                        val dataIndex = it.getColumnIndex(MediaStore.Files.FileColumns.DATA)
                        val nameIndex = it.getColumnIndex(MediaStore.Files.FileColumns.DISPLAY_NAME)
                        val sizeIndex = it.getColumnIndex(MediaStore.Files.FileColumns.SIZE)
                        val dateIndex = it.getColumnIndex(MediaStore.Files.FileColumns.DATE_MODIFIED)
                        val mimeIndex = it.getColumnIndex(MediaStore.Files.FileColumns.MIME_TYPE)

                        var count = 0
                        while (it.moveToNext() && count < 1000) {
                            val filePath = if (dataIndex != -1) it.getString(dataIndex) else null
                            if (filePath.isNullOrEmpty()) continue

                            val file = File(filePath)
                            if (!file.exists() || file.isDirectory || file.isHidden || file.name.startsWith(".")) continue

                            val canonical = try { file.canonicalPath } catch (e: Exception) { file.absolutePath }
                            if (!fileMap.containsKey(canonical)) {
                                val fileName = if (nameIndex != -1 && !it.getString(nameIndex).isNullOrEmpty()) {
                                    it.getString(nameIndex)
                                } else {
                                    file.name
                                }
                                val ext = getFileExtension(fileName)
                                if (isJunkOrSystemFile(file, fileName, ext)) {
                                    continue
                                }

                                val size = if (sizeIndex != -1) it.getLong(sizeIndex) else file.length()
                                val lastModified = if (dateIndex != -1) it.getLong(dateIndex) * 1000L else file.lastModified()
                                val mimeType = if (mimeIndex != -1 && !it.getString(mimeIndex).isNullOrEmpty()) {
                                    it.getString(mimeIndex)
                                } else {
                                    getMimeType(file)
                                }

                                val parentFile = file.parentFile
                                val parentFolder = if (parentFile != null) {
                                    if (parentFile.absolutePath == "/storage/emulated/0" || parentFile.name == "0") {
                                        "Internal Storage"
                                    } else {
                                        parentFile.name
                                    }
                                } else {
                                    ""
                                }

                                fileMap[canonical] = FileInfoEntry(
                                    file = file,
                                    name = fileName,
                                    size = size,
                                    lastModified = lastModified,
                                    mimeType = mimeType,
                                    parentFolder = parentFolder,
                                    extension = ext
                                )
                            }
                            count++
                        }
                    }
                } catch (ignored: Exception) {
                }

                // 3. Sort descending by last modified and take top items
                val sortedList = fileMap.values.sortedByDescending { it.lastModified }
                val topFiles = sortedList.take(maxLimit)

                val fileList = Arguments.createArray()
                for (item in topFiles) {
                    val ext = item.extension
                    var thumbUri: String? = null
                    if (arrayOf("jpg", "jpeg", "png", "webp", "gif", "heic", "bmp").contains(ext)) {
                        thumbUri = "file://${item.file.absolutePath}"
                    }

                    val map = Arguments.createMap().apply {
                        putString("id", item.file.absolutePath)
                        putString("name", item.name)
                        putString("path", item.file.absolutePath)
                        putBoolean("isDirectory", false)
                        putDouble("size", item.size.toDouble())
                        putDouble("lastModified", item.lastModified.toDouble())
                        putString("extension", ext)
                        putString("mimeType", item.mimeType)
                        putBoolean("isHidden", false)
                        putString("parentFolder", item.parentFolder)
                        if (thumbUri != null) {
                            putString("thumbnailUri", thumbUri)
                        }
                    }
                    fileList.pushMap(map)
                }

                promise.resolve(fileList)
            } catch (e: Exception) {
                promise.reject("RECENT_FILES_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getAllImages(promise: Promise) {
        ioExecutor.execute {
            try {
                val imageMap = LinkedHashMap<String, FileInfoEntry>()

                // 1. Query MediaStore Images (Fast query across all photo buckets)
                try {
                    val uri = MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                    val projection = arrayOf(
                        MediaStore.Images.Media.DATA,
                        MediaStore.Images.Media.DISPLAY_NAME,
                        MediaStore.Images.Media.SIZE,
                        MediaStore.Images.Media.DATE_MODIFIED,
                        MediaStore.Images.Media.MIME_TYPE,
                        MediaStore.Images.Media.BUCKET_DISPLAY_NAME
                    )
                    val sortOrder = "${MediaStore.Images.Media.DATE_MODIFIED} DESC"
                    val cursor = reactContext.contentResolver.query(uri, projection, null, null, sortOrder)

                    cursor?.use {
                        val dataIndex = it.getColumnIndex(MediaStore.Images.Media.DATA)
                        val nameIndex = it.getColumnIndex(MediaStore.Images.Media.DISPLAY_NAME)
                        val sizeIndex = it.getColumnIndex(MediaStore.Images.Media.SIZE)
                        val dateIndex = it.getColumnIndex(MediaStore.Images.Media.DATE_MODIFIED)
                        val mimeIndex = it.getColumnIndex(MediaStore.Images.Media.MIME_TYPE)
                        val bucketIndex = it.getColumnIndex(MediaStore.Images.Media.BUCKET_DISPLAY_NAME)

                        while (it.moveToNext()) {
                            val filePath = if (dataIndex != -1) it.getString(dataIndex) else null
                            if (filePath.isNullOrEmpty()) continue

                            val file = File(filePath)
                            if (!file.exists() || file.isDirectory || file.isHidden) continue

                            val canonical = try { file.canonicalPath } catch (e: Exception) { file.absolutePath }
                            if (!imageMap.containsKey(canonical)) {
                                val fileName = if (nameIndex != -1 && !it.getString(nameIndex).isNullOrEmpty()) {
                                    it.getString(nameIndex)
                                } else {
                                    file.name
                                }
                                val size = if (sizeIndex != -1) it.getLong(sizeIndex) else file.length()
                                val lastModified = if (dateIndex != -1) it.getLong(dateIndex) * 1000L else file.lastModified()
                                val mimeType = if (mimeIndex != -1 && !it.getString(mimeIndex).isNullOrEmpty()) {
                                    it.getString(mimeIndex)
                                } else {
                                    getMimeType(file)
                                }

                                val bucketName = if (bucketIndex != -1 && !it.getString(bucketIndex).isNullOrEmpty()) {
                                    it.getString(bucketIndex)
                                } else {
                                    file.parentFile?.name ?: "Pictures"
                                }

                                val ext = getFileExtension(fileName)
                                imageMap[canonical] = FileInfoEntry(
                                    file = file,
                                    name = fileName,
                                    size = size,
                                    lastModified = lastModified,
                                    mimeType = mimeType,
                                    parentFolder = bucketName,
                                    extension = ext
                                )
                            }
                        }
                    }
                } catch (e: Exception) {
                }

                // 2. Direct directory scan of primary image folders to catch any unindexed pictures
                val imgDirs = arrayOf(
                    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "Camera"),
                    File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "Screenshots"),
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES),
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    File(Environment.getExternalStorageDirectory(), "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Images")
                )
                val imgExts = arrayOf("jpg", "jpeg", "png", "webp", "gif", "heic", "bmp")

                for (dir in imgDirs) {
                    if (dir.exists() && dir.isDirectory) {
                        val files = dir.listFiles() ?: continue
                        for (f in files) {
                            if (f.isFile && !f.isHidden && !f.name.startsWith(".")) {
                                val ext = getFileExtension(f.name)
                                if (imgExts.contains(ext)) {
                                    val canonical = try { f.canonicalPath } catch (e: Exception) { f.absolutePath }
                                    if (!imageMap.containsKey(canonical)) {
                                        imageMap[canonical] = FileInfoEntry(
                                            file = f,
                                            name = f.name,
                                            size = f.length(),
                                            lastModified = f.lastModified(),
                                            mimeType = getMimeType(f),
                                            parentFolder = dir.name,
                                            extension = ext
                                        )
                                    }
                                }
                            }
                        }
                    }
                }

                // 3. Sort by last modified descending
                val sortedList = imageMap.values.sortedByDescending { it.lastModified }
                val array = Arguments.createArray()

                for (item in sortedList) {
                    val map = Arguments.createMap().apply {
                        putString("id", item.file.absolutePath)
                        putString("name", item.name)
                        putString("path", item.file.absolutePath)
                        putBoolean("isDirectory", false)
                        putDouble("size", item.size.toDouble())
                        putDouble("lastModified", item.lastModified.toDouble())
                        putString("extension", item.extension)
                        putString("mimeType", item.mimeType)
                        putBoolean("isHidden", false)
                        putString("parentFolder", item.parentFolder)
                        putString("thumbnailUri", "file://${item.file.absolutePath}")
                    }
                    array.pushMap(map)
                }

                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("GET_IMAGES_ERROR", e.message, e)
            }
        }
    }

    private fun scanVideosInDirectory(
        dir: File,
        currentDepth: Int,
        maxDepth: Int,
        vidExts: Set<String>,
        outMap: MutableMap<String, FileInfoEntry>
    ) {
        if (currentDepth > maxDepth || !dir.exists() || !dir.isDirectory) return
        val children = dir.listFiles() ?: return

        for (child in children) {
            val childName = child.name
            if (childName.startsWith(".") ||
                childName.equals("cache", ignoreCase = true) ||
                childName.equals(".trash", ignoreCase = true) ||
                childName.equals(".thumbnails", ignoreCase = true)
            ) {
                continue
            }

            if (child.isDirectory) {
                if (childName.equals("data", ignoreCase = true) || childName.equals("obb", ignoreCase = true)) {
                    continue
                }
                scanVideosInDirectory(child, currentDepth + 1, maxDepth, vidExts, outMap)
            } else if (child.isFile) {
                val ext = getFileExtension(childName).lowercase()
                if (vidExts.contains(ext)) {
                    val canonical = try { child.canonicalPath } catch (e: Exception) { child.absolutePath }
                    if (!outMap.containsKey(canonical)) {
                        val parentFile = child.parentFile
                        var parentFolder = parentFile?.name ?: "Videos"
                        if (parentFolder.equals("0", ignoreCase = true) ||
                            parentFolder.equals("emulated", ignoreCase = true) ||
                            child.parentFile?.absolutePath == "/storage/emulated/0"
                        ) {
                            parentFolder = "Internal Storage"
                        } else if (parentFolder.equals("Sent", ignoreCase = true) || parentFolder.equals("Private", ignoreCase = true)) {
                            val grandParent = parentFile?.parentFile?.name
                            if (!grandParent.isNullOrEmpty() && grandParent.contains("WhatsApp", ignoreCase = true)) {
                                parentFolder = grandParent
                            }
                        } else if (parentFolder.endsWith(".mkv", ignoreCase = true) || parentFolder.endsWith(".mp4", ignoreCase = true)) {
                            val grandParent = parentFile?.parentFile?.name
                            parentFolder = if (!grandParent.isNullOrEmpty() && grandParent != "0") grandParent else parentFolder.substringBeforeLast(".")
                        }

                        outMap[canonical] = FileInfoEntry(
                            file = child,
                            name = childName,
                            size = child.length(),
                            lastModified = child.lastModified(),
                            mimeType = getMimeType(child),
                            parentFolder = parentFolder,
                            extension = ext
                        )
                    }
                }
            }
        }
    }

    @ReactMethod
    fun getAllVideos(promise: Promise) {
        ioExecutor.execute {
            try {
                val videoMap = LinkedHashMap<String, FileInfoEntry>()
                val vidExts = setOf("mp4", "mkv", "webm", "avi", "3gp", "mov", "flv", "ts", "m4v", "wmv", "mpg", "mpeg")

                // Step 0: Pre-fetch video metadata (duration, width, height) from MediaStore
                val mediaStoreMeta = HashMap<String, Triple<Long, Int, Int>>()
                try {
                    val uri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    val projection = arrayOf(
                        MediaStore.Video.Media.DATA,
                        MediaStore.Video.Media.DURATION,
                        MediaStore.Video.Media.WIDTH,
                        MediaStore.Video.Media.HEIGHT
                    )
                    val cursor = reactContext.contentResolver.query(uri, projection, null, null, null)
                    cursor?.use {
                        val dataIndex = it.getColumnIndex(MediaStore.Video.Media.DATA)
                        val durIndex = it.getColumnIndex(MediaStore.Video.Media.DURATION)
                        val widthIndex = it.getColumnIndex(MediaStore.Video.Media.WIDTH)
                        val heightIndex = it.getColumnIndex(MediaStore.Video.Media.HEIGHT)

                        while (it.moveToNext()) {
                            val filePath = if (dataIndex != -1) it.getString(dataIndex) else null
                            if (!filePath.isNullOrEmpty()) {
                                val dur = if (durIndex != -1) it.getLong(durIndex) else 0L
                                val w = if (widthIndex != -1) it.getInt(widthIndex) else 0
                                val h = if (heightIndex != -1) it.getInt(heightIndex) else 0
                                mediaStoreMeta[filePath] = Triple(dur, w, h)
                                try {
                                    val canonical = File(filePath).canonicalPath
                                    mediaStoreMeta[canonical] = Triple(dur, w, h)
                                } catch (ignored: Exception) {}
                            }
                        }
                    }
                } catch (ignored: Exception) {}

                // 1. Direct targeted deep scan of major video storage locations:
                val storageRoot = Environment.getExternalStorageDirectory()
                if (storageRoot != null && storageRoot.exists()) {
                    // DCIM (Snapchat, Camera, Screenrecorder, etc.)
                    val dcim = File(storageRoot, "DCIM")
                    if (dcim.exists()) scanVideosInDirectory(dcim, 0, 5, vidExts, videoMap)

                    // Download (including movie subfolders like Ramayana...mkv)
                    val download = File(storageRoot, "Download")
                    if (download.exists()) scanVideosInDirectory(download, 0, 5, vidExts, videoMap)

                    // Movies
                    val movies = File(storageRoot, "Movies")
                    if (movies.exists()) scanVideosInDirectory(movies, 0, 5, vidExts, videoMap)

                    // Pictures
                    val pictures = File(storageRoot, "Pictures")
                    if (pictures.exists()) scanVideosInDirectory(pictures, 0, 5, vidExts, videoMap)

                    // WhatsApp Media
                    val waMedia = File(storageRoot, "Android/media/com.whatsapp/WhatsApp/Media/WhatsApp Video")
                    if (waMedia.exists()) scanVideosInDirectory(waMedia, 0, 5, vidExts, videoMap)

                    // Telegram Media
                    val tgMedia = File(storageRoot, "Android/media/org.telegram.messenger")
                    if (tgMedia.exists()) scanVideosInDirectory(tgMedia, 0, 6, vidExts, videoMap)

                    // Android/media in general
                    val androidMedia = File(storageRoot, "Android/media")
                    if (androidMedia.exists()) scanVideosInDirectory(androidMedia, 0, 7, vidExts, videoMap)

                    // Whole internal storage
                    scanVideosInDirectory(storageRoot, 0, 4, vidExts, videoMap)
                }

                // Attach pre-fetched metadata to files found via filesystem scan
                for ((canonical, entry) in videoMap) {
                    val meta = mediaStoreMeta[canonical] ?: mediaStoreMeta[entry.file.absolutePath]
                    if (meta != null) {
                        entry.duration = meta.first
                        entry.width = meta.second
                        entry.height = meta.third
                    }
                }

                // 2. Query MediaStore Videos to supplement any indexed items
                try {
                    val uri = MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                    val projection = arrayOf(
                        MediaStore.Video.Media.DATA,
                        MediaStore.Video.Media.DISPLAY_NAME,
                        MediaStore.Video.Media.SIZE,
                        MediaStore.Video.Media.DATE_MODIFIED,
                        MediaStore.Video.Media.MIME_TYPE,
                        MediaStore.Video.Media.BUCKET_DISPLAY_NAME,
                        MediaStore.Video.Media.DURATION,
                        MediaStore.Video.Media.WIDTH,
                        MediaStore.Video.Media.HEIGHT
                    )
                    val sortOrder = "${MediaStore.Video.Media.DATE_MODIFIED} DESC"
                    val cursor = reactContext.contentResolver.query(uri, projection, null, null, sortOrder)

                    cursor?.use {
                        val dataIndex = it.getColumnIndex(MediaStore.Video.Media.DATA)
                        val nameIndex = it.getColumnIndex(MediaStore.Video.Media.DISPLAY_NAME)
                        val sizeIndex = it.getColumnIndex(MediaStore.Video.Media.SIZE)
                        val dateIndex = it.getColumnIndex(MediaStore.Video.Media.DATE_MODIFIED)
                        val mimeIndex = it.getColumnIndex(MediaStore.Video.Media.MIME_TYPE)
                        val bucketIndex = it.getColumnIndex(MediaStore.Video.Media.BUCKET_DISPLAY_NAME)
                        val durIndex = it.getColumnIndex(MediaStore.Video.Media.DURATION)
                        val widthIndex = it.getColumnIndex(MediaStore.Video.Media.WIDTH)
                        val heightIndex = it.getColumnIndex(MediaStore.Video.Media.HEIGHT)

                        while (it.moveToNext()) {
                            val filePath = if (dataIndex != -1) it.getString(dataIndex) else null
                            if (filePath.isNullOrEmpty()) continue

                            val file = File(filePath)
                            if (file.name.startsWith(".")) continue

                            val canonical = try { file.canonicalPath } catch (e: Exception) { file.absolutePath }
                            val dur = if (durIndex != -1) it.getLong(durIndex) else 0L
                            val w = if (widthIndex != -1) it.getInt(widthIndex) else 0
                            val h = if (heightIndex != -1) it.getInt(heightIndex) else 0

                            if (!videoMap.containsKey(canonical)) {
                                val fileName = if (nameIndex != -1 && !it.getString(nameIndex).isNullOrEmpty()) {
                                    it.getString(nameIndex)
                                } else {
                                    file.name
                                }
                                val size = if (sizeIndex != -1) it.getLong(sizeIndex) else if (file.exists()) file.length() else 0L
                                val lastModified = if (dateIndex != -1) it.getLong(dateIndex) * 1000L else if (file.exists()) file.lastModified() else System.currentTimeMillis()
                                val mimeType = if (mimeIndex != -1 && !it.getString(mimeIndex).isNullOrEmpty()) {
                                    it.getString(mimeIndex)
                                } else {
                                    getMimeType(file)
                                }

                                var bucketName = if (bucketIndex != -1 && !it.getString(bucketIndex).isNullOrEmpty()) {
                                    it.getString(bucketIndex)
                                } else {
                                    file.parentFile?.name ?: "Videos"
                                }
                                if (bucketName.endsWith(".mkv", ignoreCase = true) || bucketName.endsWith(".mp4", ignoreCase = true)) {
                                    val gp = file.parentFile?.parentFile?.name
                                    bucketName = if (!gp.isNullOrEmpty() && gp != "0") gp else bucketName.substringBeforeLast(".")
                                }

                                val ext = getFileExtension(fileName)
                                videoMap[canonical] = FileInfoEntry(
                                    file = file,
                                    name = fileName,
                                    size = size,
                                    lastModified = lastModified,
                                    mimeType = mimeType,
                                    parentFolder = bucketName,
                                    extension = ext,
                                    duration = dur,
                                    width = w,
                                    height = h
                                )
                            } else {
                                val entry = videoMap[canonical]
                                if (entry != null && entry.duration == 0L && dur > 0L) {
                                    entry.duration = dur
                                    entry.width = w
                                    entry.height = h
                                }
                            }
                        }
                    }
                } catch (e: Exception) {
                }

                // 3. Fallback extraction using MediaMetadataRetriever for unindexed videos (up to 40 items)
                var fallbackCount = 0
                for (entry in videoMap.values) {
                    if (entry.duration == 0L && fallbackCount < 40) {
                        fallbackCount++
                        try {
                            val retriever = MediaMetadataRetriever()
                            retriever.setDataSource(entry.file.absolutePath)
                            val dStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                            val wStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                            val hStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                            retriever.release()
                            val d = dStr?.toLongOrNull() ?: 0L
                            val w = wStr?.toIntOrNull() ?: 0
                            val h = hStr?.toIntOrNull() ?: 0
                            if (d > 0) entry.duration = d
                            if (w > 0) entry.width = w
                            if (h > 0) entry.height = h
                        } catch (ignored: Exception) {}
                    }
                }

                // 4. Sort descending by lastModified by default
                val sortedList = videoMap.values.sortedByDescending { it.lastModified }
                val array = Arguments.createArray()

                for (item in sortedList) {
                    val map = Arguments.createMap().apply {
                        putString("id", item.file.absolutePath)
                        putString("name", item.name)
                        putString("path", item.file.absolutePath)
                        putBoolean("isDirectory", false)
                        putDouble("size", item.size.toDouble())
                        putDouble("lastModified", item.lastModified.toDouble())
                        putString("extension", item.extension)
                        putString("mimeType", item.mimeType)
                        putBoolean("isHidden", false)
                        putString("parentFolder", item.parentFolder)
                        putString("thumbnailUri", "file://${item.file.absolutePath}")
                        putDouble("duration", item.duration.toDouble())
                        putInt("width", item.width)
                        putInt("height", item.height)
                    }
                    array.pushMap(map)
                }

                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("GET_VIDEOS_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun getVideoMetadata(filePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
                val file = File(cleanPath)
                if (!file.exists()) {
                    val emptyMap = Arguments.createMap().apply {
                        putDouble("duration", 0.0)
                        putInt("width", 0)
                        putInt("height", 0)
                    }
                    promise.resolve(emptyMap)
                    return@execute
                }
                val retriever = MediaMetadataRetriever()
                retriever.setDataSource(cleanPath)
                val dStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                val wStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)
                val hStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)
                retriever.release()

                val map = Arguments.createMap().apply {
                    putDouble("duration", dStr?.toLongOrNull()?.toDouble() ?: 0.0)
                    putInt("width", wStr?.toIntOrNull() ?: 0)
                    putInt("height", hStr?.toIntOrNull() ?: 0)
                }
                promise.resolve(map)
            } catch (e: Exception) {
                val emptyMap = Arguments.createMap().apply {
                    putDouble("duration", 0.0)
                    putInt("width", 0)
                    putInt("height", 0)
                }
                promise.resolve(emptyMap)
            }
        }
    }

    @ReactMethod
    fun getThumbnail(filePath: String, promise: Promise) {
        thumbnailExecutor.execute {
            try {
                val file = File(filePath)
                if (!file.exists() || file.isDirectory) {
                    promise.resolve(null)
                    return@execute
                }

                val ext = getFileExtension(file.name)

                // 1. Image: direct file URI instantly, 0 disk I/O
                if (arrayOf("jpg", "jpeg", "png", "webp", "gif", "heic", "bmp").contains(ext)) {
                    promise.resolve("file://${file.absolutePath}")
                    return@execute
                }

                val thumbDir = File(reactContext.cacheDir, "thumbnails")
                if (!thumbDir.exists()) thumbDir.mkdirs()

                val thumbFile = File(thumbDir, "thumb_${file.name.hashCode()}_${file.lastModified() / 1000}.jpg")
                if (thumbFile.exists()) {
                    promise.resolve("file://${thumbFile.absolutePath}")
                    return@execute
                }

                // 2. Video: fast thumbnail (120x120, 70% quality)
                if (arrayOf("mp4", "mkv", "mov", "webm", "avi", "3gp", "flv").contains(ext)) {
                    val retriever = MediaMetadataRetriever()
                    try {
                        retriever.setDataSource(file.absolutePath)
                        val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                        val durationMs = durationStr?.toLongOrNull() ?: 2000L
                        val targetUs = (durationMs / 2) * 1000L

                        val bitmap = retriever.getFrameAtTime(targetUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                            ?: retriever.getFrameAtTime(1000000L, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)

                        if (bitmap != null) {
                            val scaled = Bitmap.createScaledBitmap(bitmap, 120, 120, false)
                            FileOutputStream(thumbFile).use { out ->
                                scaled.compress(Bitmap.CompressFormat.JPEG, 70, out)
                            }
                            if (scaled != bitmap) scaled.recycle()
                            bitmap.recycle()
                            promise.resolve("file://${thumbFile.absolutePath}")
                            return@execute
                        }
                    } catch (ignored: Exception) {
                    } finally {
                        try { retriever.release() } catch (ignored: Exception) {}
                    }
                }

                // 3. PDF: first page render
                if (ext == "pdf") {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                        var pfd: ParcelFileDescriptor? = null
                        var renderer: PdfRenderer? = null
                        try {
                            pfd = ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY)
                            renderer = PdfRenderer(pfd)
                            if (renderer.pageCount > 0) {
                                val page = renderer.openPage(0)
                                val width = 120
                                val height = Math.max(1, (120 * page.height) / page.width)
                                val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
                                page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                                page.close()

                                FileOutputStream(thumbFile).use { out ->
                                    bitmap.compress(Bitmap.CompressFormat.JPEG, 70, out)
                                }
                                bitmap.recycle()
                                promise.resolve("file://${thumbFile.absolutePath}")
                                return@execute
                            }
                        } catch (ignored: Exception) {
                        } finally {
                            try { renderer?.close() } catch (ignored: Exception) {}
                            try { pfd?.close() } catch (ignored: Exception) {}
                        }
                    }
                }

                // 4. APK: App icon
                if (ext == "apk") {
                    try {
                        val pm = reactContext.packageManager
                        val pkgInfo = pm.getPackageArchiveInfo(file.absolutePath, 0)
                        if (pkgInfo != null && pkgInfo.applicationInfo != null) {
                            val appInfo = pkgInfo.applicationInfo!!
                            appInfo.sourceDir = file.absolutePath
                            appInfo.publicSourceDir = file.absolutePath
                            val drawable = pm.getApplicationIcon(appInfo)

                            val bitmap = if (drawable is BitmapDrawable) {
                                drawable.bitmap
                            } else {
                                val bmp = Bitmap.createBitmap(
                                    Math.max(1, drawable.intrinsicWidth),
                                    Math.max(1, drawable.intrinsicHeight),
                                    Bitmap.Config.ARGB_8888
                                )
                                val canvas = Canvas(bmp)
                                drawable.setBounds(0, 0, canvas.width, canvas.height)
                                drawable.draw(canvas)
                                bmp
                            }

                            val apkThumb = File(thumbDir, "apk_${file.name.hashCode()}.png")
                            FileOutputStream(apkThumb).use { out ->
                                bitmap.compress(Bitmap.CompressFormat.PNG, 80, out)
                            }
                            promise.resolve("file://${apkThumb.absolutePath}")
                            return@execute
                        }
                    } catch (ignored: Exception) {
                    }
                }

                promise.resolve(null)
            } catch (e: Exception) {
                promise.resolve(null)
            }
        }
    }

    @ReactMethod
    fun listFiles(dirPath: String, showHidden: Boolean, promise: Promise) {
        ioExecutor.execute {
            try {
                val targetDir = File(dirPath)
                if (!targetDir.exists() || !targetDir.isDirectory) {
                    promise.reject("DIR_NOT_FOUND", "Directory does not exist or is not a directory: $dirPath")
                    return@execute
                }

                val files = targetDir.listFiles()
                val array = Arguments.createArray()
                if (files == null) {
                    promise.resolve(array)
                    return@execute
                }

                for (file in files) {
                    val name = file.name
                    val isHiddenFile = name.startsWith(".")
                    if (!showHidden && isHiddenFile) continue

                    val isDir = file.isDirectory
                    val ext = if (isDir) "" else getFileExtension(name)
                    val map = Arguments.createMap().apply {
                        putString("name", name)
                        putString("path", file.absolutePath)
                        putBoolean("isDirectory", isDir)
                        putBoolean("isHidden", isHiddenFile)
                        putDouble("size", if (isDir) 0.0 else file.length().toDouble())
                        putDouble("lastModified", file.lastModified().toDouble())
                        putString("extension", ext)
                        putString("mimeType", if (isDir) "inode/directory" else getFastMimeType(ext))
                        putBoolean("canRead", true)
                        putBoolean("canWrite", true)
                        putInt("itemCount", -1)
                    }
                    array.pushMap(map)
                }

                promise.resolve(array)
            } catch (e: Exception) {
                promise.reject("LIST_FILES_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun createDirectory(parentPath: String, dirName: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val newDir = File(parentPath, dirName)
                if (newDir.exists()) {
                    promise.reject("ALREADY_EXISTS", "Directory already exists")
                    return@execute
                }
                val success = newDir.mkdirs()
                if (success) {
                    promise.resolve(newDir.absolutePath)
                } else {
                    promise.reject("CREATE_DIR_FAILED", "Failed to create directory")
                }
            } catch (e: Exception) {
                promise.reject("CREATE_DIR_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun createFile(parentPath: String, fileName: String, content: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(parentPath, fileName)
                if (file.exists()) {
                    promise.reject("ALREADY_EXISTS", "File already exists")
                    return@execute
                }
                val parent = file.parentFile
                if (parent != null && !parent.exists()) {
                    parent.mkdirs()
                }
                file.writeText(content)
                MediaScannerConnection.scanFile(
                    reactContext,
                    arrayOf(file.absolutePath),
                    null,
                    null
                )
                promise.resolve(file.absolutePath)
            } catch (e: Exception) {
                promise.reject("CREATE_FILE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun renameItem(path: String, newName: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(path)
                if (!file.exists()) {
                    promise.reject("NOT_FOUND", "Item not found")
                    return@execute
                }
                val parent = file.parentFile
                val newFile = File(parent, newName)
                if (newFile.exists()) {
                    promise.reject("TARGET_EXISTS", "Target name already exists")
                    return@execute
                }
                val success = file.renameTo(newFile)
                if (success) {
                    promise.resolve(newFile.absolutePath)
                } else {
                    promise.reject("RENAME_FAILED", "Could not rename file")
                }
            } catch (e: Exception) {
                promise.reject("RENAME_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun deleteItem(path: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(path)
                if (!file.exists()) {
                    promise.resolve(true)
                    return@execute
                }
                val success = deleteRecursive(file)
                if (success) {
                    promise.resolve(true)
                } else {
                    promise.reject("DELETE_FAILED", "Could not delete item")
                }
            } catch (e: Exception) {
                promise.reject("DELETE_ERROR", e.message, e)
            }
        }
    }

    private fun deleteRecursive(fileOrDirectory: File): Boolean {
        if (fileOrDirectory.isDirectory) {
            val children = fileOrDirectory.listFiles()
            if (children != null) {
                for (child in children) {
                    val success = deleteRecursive(child)
                    if (!success) return false
                }
            }
        }
        return fileOrDirectory.delete()
    }

    @ReactMethod
    fun copyItem(sourcePath: String, destinationDirPath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val source = File(sourcePath)
                val destDir = File(destinationDirPath)
                if (!source.exists()) {
                    promise.reject("SOURCE_NOT_FOUND", "Source does not exist")
                    return@execute
                }
                if (!destDir.exists()) destDir.mkdirs()

                val target = File(destDir, source.name)
                copyRecursive(source, target)
                try {
                    MediaScannerConnection.scanFile(
                        reactContext,
                        arrayOf(target.absolutePath),
                        null,
                        null
                    )
                } catch (_: Exception) {}
                promise.resolve(target.absolutePath)
            } catch (e: Exception) {
                promise.reject("COPY_ERROR", e.message, e)
            }
        }
    }

    private fun copyRecursive(source: File, target: File) {
        if (source.isDirectory) {
            if (!target.exists()) target.mkdirs()
            val files = source.listFiles() ?: return
            for (f in files) {
                copyRecursive(f, File(target, f.name))
            }
        } else {
            FileInputStream(source).channel.use { inChannel ->
                FileOutputStream(target).channel.use { outChannel ->
                    val size = inChannel.size()
                    var transferred = 0L
                    while (transferred < size) {
                        val count = inChannel.transferTo(transferred, size - transferred, outChannel)
                        if (count <= 0) break
                        transferred += count
                    }
                }
            }
            target.setLastModified(source.lastModified())
        }
    }

    @ReactMethod
    fun moveItem(sourcePath: String, destinationDirPath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val source = File(sourcePath)
                val destDir = File(destinationDirPath)
                if (!source.exists()) {
                    promise.reject("SOURCE_NOT_FOUND", "Source does not exist")
                    return@execute
                }
                if (!destDir.exists()) destDir.mkdirs()

                val target = File(destDir, source.name)
                val moved = source.renameTo(target)
                if (moved) {
                    try {
                        MediaScannerConnection.scanFile(
                            reactContext,
                            arrayOf(source.absolutePath, target.absolutePath),
                            null,
                            null
                        )
                    } catch (_: Exception) {}
                    promise.resolve(target.absolutePath)
                } else {
                    // Fallback copy + delete for cross-volume / partition moves
                    copyRecursive(source, target)
                    deleteRecursive(source)
                    try {
                        MediaScannerConnection.scanFile(
                            reactContext,
                            arrayOf(source.absolutePath, target.absolutePath),
                            null,
                            null
                        )
                    } catch (_: Exception) {}
                    promise.resolve(target.absolutePath)
                }
            } catch (e: Exception) {
                promise.reject("MOVE_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun calculateChecksum(filePath: String, algorithm: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(filePath)
                if (!file.exists() || file.isDirectory) {
                    promise.reject("INVALID_FILE", "Target is not a valid file")
                    return@execute
                }

                val algo = if (algorithm.equals("SHA256", ignoreCase = true) || algorithm.equals("SHA-256", ignoreCase = true)) {
                    "SHA-256"
                } else {
                    "MD5"
                }

                val digest = MessageDigest.getInstance(algo)
                FileInputStream(file).use { fis ->
                    val buffer = ByteArray(8192)
                    var bytesRead: Int
                    while (fis.read(buffer).also { bytesRead = it } != -1) {
                        digest.update(buffer, 0, bytesRead)
                    }
                }

                val hashBytes = digest.digest()
                val hexString = StringBuilder()
                for (b in hashBytes) {
                    val hex = Integer.toHexString(0xff and b.toInt())
                    if (hex.length == 1) hexString.append('0')
                    hexString.append(hex)
                }

                promise.resolve(hexString.toString())
            } catch (e: Exception) {
                promise.reject("CHECKSUM_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun openFile(filePath: String, mimeType: String?, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("NOT_FOUND", "File does not exist")
                return
            }

            val uri: Uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file
            )

            val type = if (mimeType.isNullOrEmpty() || mimeType == "*/*") getMimeType(file) else mimeType
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, type)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_FILE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openWith(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("NOT_FOUND", "File does not exist")
                return
            }
            val uri: Uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file
            )
            val type = getMimeType(file)
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, type)
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            val chooser = Intent.createChooser(intent, "Open with...").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("OPEN_WITH_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun shareFiles(filePaths: ReadableArray, promise: Promise) {
        try {
            val uris = ArrayList<Uri>()
            for (i in 0 until filePaths.size()) {
                val path = filePaths.getString(i) ?: continue
                val file = File(path)
                if (file.exists()) {
                    val uri = FileProvider.getUriForFile(
                        reactContext,
                        "${reactContext.packageName}.fileprovider",
                        file
                    )
                    uris.add(uri)
                }
            }
            if (uris.isEmpty()) {
                promise.reject("NO_FILES", "No valid files to share")
                return
            }
            val intent = if (uris.size == 1) {
                Intent(Intent.ACTION_SEND).apply {
                    type = getMimeType(File(filePaths.getString(0) ?: ""))
                    putExtra(Intent.EXTRA_STREAM, uris[0])
                }
            } else {
                Intent(Intent.ACTION_SEND_MULTIPLE).apply {
                    type = "*/*"
                    putParcelableArrayListExtra(Intent.EXTRA_STREAM, uris)
                }
            }
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            val chooser = Intent.createChooser(intent, "Share via").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(chooser)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SHARE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setAsWallpaper(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ERR_NOT_FOUND", "File does not exist")
                return
            }
            val bitmap = BitmapFactory.decodeFile(file.absolutePath)
            if (bitmap == null) {
                promise.reject("ERR_DECODE", "Failed to decode image bitmap")
                return
            }
            val wm = WallpaperManager.getInstance(reactContext)
            wm.setBitmap(bitmap)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_WALLPAPER", e.message, e)
        }
    }

    @ReactMethod
    fun openGoogleLens(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ERR_NOT_FOUND", "File does not exist")
                return
            }

            val uri: Uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file
            )

            // Try standard Google Lens package
            val lensIntent = Intent(Intent.ACTION_SEND).apply {
                type = "image/*"
                putExtra(Intent.EXTRA_STREAM, uri)
                setPackage("com.google.ar.lens")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            val pm = reactContext.packageManager
            if (lensIntent.resolveActivity(pm) != null) {
                reactContext.startActivity(lensIntent)
                promise.resolve(true)
                return
            }

            // Fallback: Google Search app
            val gsaIntent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "image/*")
                setPackage("com.google.android.googlequicksearchbox")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            if (gsaIntent.resolveActivity(pm) != null) {
                reactContext.startActivity(gsaIntent)
                promise.resolve(true)
                return
            }

            // Neither Google Lens nor Google app found -> resolve false
            promise.resolve(false)
        } catch (e: Exception) {
            promise.reject("ERR_LENS", e.message, e)
        }
    }

    @ReactMethod
    fun saveEditedImage(sourcePath: String, destPath: String, options: ReadableMap, promise: Promise) {
        try {
            val srcFile = File(sourcePath)
            if (!srcFile.exists()) {
                promise.reject("ERR_NOT_FOUND", "Source file does not exist")
                return
            }

            var bitmap = BitmapFactory.decodeFile(srcFile.absolutePath)
            if (bitmap == null) {
                promise.reject("ERR_DECODE", "Failed to decode source image")
                return
            }

            // 1. Matrix transformations: rotation, flip, straighten
            val totalRotation = (if (options.hasKey("rotation")) options.getDouble("rotation") else 0.0) +
                    (if (options.hasKey("straighten")) options.getDouble("straighten") else 0.0)
            val flipH = if (options.hasKey("flipH")) options.getBoolean("flipH") else false
            val flipV = if (options.hasKey("flipV")) options.getBoolean("flipV") else false

            val matrix = Matrix()
            if (flipH) matrix.postScale(-1f, 1f, bitmap.width / 2f, bitmap.height / 2f)
            if (flipV) matrix.postScale(1f, -1f, bitmap.width / 2f, bitmap.height / 2f)
            if (totalRotation != 0.0) {
                matrix.postRotate(totalRotation.toFloat(), bitmap.width / 2f, bitmap.height / 2f)
            }

            var transformedBitmap = Bitmap.createBitmap(bitmap, 0, 0, bitmap.width, bitmap.height, matrix, true)
            if (transformedBitmap != bitmap) {
                bitmap.recycle()
                bitmap = transformedBitmap
            }

            // 2. Crop if specified
            if (options.hasKey("crop")) {
                val cropMap = options.getMap("crop")
                if (cropMap != null && cropMap.hasKey("width") && cropMap.hasKey("height")) {
                    val cropXNorm = if (cropMap.hasKey("x")) cropMap.getDouble("x") else 0.0
                    val cropYNorm = if (cropMap.hasKey("y")) cropMap.getDouble("y") else 0.0
                    val cropWNorm = cropMap.getDouble("width")
                    val cropHNorm = cropMap.getDouble("height")

                    val startX = Math.max(0, (cropXNorm * bitmap.width).toInt())
                    val startY = Math.max(0, (cropYNorm * bitmap.height).toInt())
                    val cropW = Math.min(bitmap.width - startX, Math.max(1, (cropWNorm * bitmap.width).toInt()))
                    val cropH = Math.min(bitmap.height - startY, Math.max(1, (cropHNorm * bitmap.height).toInt()))

                    val cropped = Bitmap.createBitmap(bitmap, startX, startY, cropW, cropH)
                    if (cropped != bitmap) {
                        bitmap.recycle()
                        bitmap = cropped
                    }
                }
            }

            // 3. Resize if specified
            if (options.hasKey("resizeWidth") && options.hasKey("resizeHeight")) {
                val rw = options.getInt("resizeWidth")
                val rh = options.getInt("resizeHeight")
                if (rw > 0 && rh > 0 && (rw != bitmap.width || rh != bitmap.height)) {
                    val scaled = Bitmap.createScaledBitmap(bitmap, rw, rh, true)
                    if (scaled != bitmap) {
                        bitmap.recycle()
                        bitmap = scaled
                    }
                }
            }

            // 4. Color adjustments & Filter via ColorMatrix
            val brightness = if (options.hasKey("brightness")) options.getDouble("brightness").toFloat() else 0f
            val contrast = if (options.hasKey("contrast")) options.getDouble("contrast").toFloat() else 0f
            val saturation = if (options.hasKey("saturation")) options.getDouble("saturation").toFloat() else 0f
            val temperature = if (options.hasKey("temperature")) options.getDouble("temperature").toFloat() else 0f
            val tint = if (options.hasKey("tint")) options.getDouble("tint").toFloat() else 0f
            val filterName = if (options.hasKey("filter")) options.getString("filter") ?: "none" else "none"

            val needsColorMatrix = brightness != 0f || contrast != 0f || saturation != 0f ||
                    temperature != 0f || tint != 0f || filterName != "none"

            val resultBitmap = Bitmap.createBitmap(bitmap.width, bitmap.height, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(resultBitmap)
            val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)

            if (needsColorMatrix) {
                val cm = ColorMatrix()

                val satScale = Math.max(0f, 1f + (saturation / 100f))
                cm.setSaturation(satScale)

                val c = Math.max(0.1f, 1f + (contrast / 100f))
                val t = 128f * (1f - c)
                val contrastMatrix = ColorMatrix(floatArrayOf(
                    c, 0f, 0f, 0f, t + brightness * 2.55f,
                    0f, c, 0f, 0f, t + brightness * 2.55f,
                    0f, 0f, c, 0f, t + brightness * 2.55f,
                    0f, 0f, 0f, 1f, 0f
                ))
                cm.postConcat(contrastMatrix)

                val tempShift = temperature * 1.2f
                val tintShift = tint * 1.2f
                val tempMatrix = ColorMatrix(floatArrayOf(
                    1f, 0f, 0f, 0f, tempShift,
                    0f, 1f, 0f, 0f, -tintShift,
                    0f, 0f, 1f, 0f, -tempShift + tintShift,
                    0f, 0f, 0f, 1f, 0f
                ))
                cm.postConcat(tempMatrix)

                when (filterName) {
                    "vintage" -> {
                        val filterMatrix = ColorMatrix(floatArrayOf(
                            0.9f, 0f, 0f, 0f, 40f,
                            0f, 0.8f, 0f, 0f, 20f,
                            0f, 0f, 0.6f, 0f, 0f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(filterMatrix)
                    }
                    "mono" -> {
                        val monoMatrix = ColorMatrix()
                        monoMatrix.setSaturation(0f)
                        cm.postConcat(monoMatrix)
                    }
                    "cinematic" -> {
                        val cineMatrix = ColorMatrix(floatArrayOf(
                            1.1f, 0f, 0f, 0f, 10f,
                            0f, 1.0f, 0f, 0f, 15f,
                            0f, 0f, 1.2f, 0f, 30f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(cineMatrix)
                    }
                    "warm" -> {
                        val warmMatrix = ColorMatrix(floatArrayOf(
                            1.15f, 0f, 0f, 0f, 25f,
                            0f, 1.05f, 0f, 0f, 10f,
                            0f, 0f, 0.9f, 0f, -15f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(warmMatrix)
                    }
                    "sepia" -> {
                        val sepiaMatrix = ColorMatrix(floatArrayOf(
                            0.393f, 0.769f, 0.189f, 0f, 0f,
                            0.349f, 0.686f, 0.168f, 0f, 0f,
                            0.272f, 0.534f, 0.131f, 0f, 0f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(sepiaMatrix)
                    }
                    "vivid" -> {
                        val vividMatrix = ColorMatrix()
                        vividMatrix.setSaturation(1.5f)
                        cm.postConcat(vividMatrix)
                    }
                    "dramatic" -> {
                        val dramaticMatrix = ColorMatrix(floatArrayOf(
                            1.3f, 0f, 0f, 0f, -25f,
                            0f, 1.3f, 0f, 0f, -25f,
                            0f, 0f, 1.3f, 0f, -25f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(dramaticMatrix)
                    }
                    "cool" -> {
                        val coolMatrix = ColorMatrix(floatArrayOf(
                            0.9f, 0f, 0f, 0f, -10f,
                            0f, 1.0f, 0f, 0f, 0f,
                            0f, 0f, 1.25f, 0f, 30f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        cm.postConcat(coolMatrix)
                    }
                    "noir" -> {
                        val noirSat = ColorMatrix()
                        noirSat.setSaturation(0f)
                        val noirContrast = ColorMatrix(floatArrayOf(
                            1.45f, 0f, 0f, 0f, -35f,
                            0f, 1.45f, 0f, 0f, -35f,
                            0f, 0f, 1.45f, 0f, -35f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        noirSat.postConcat(noirContrast)
                        cm.postConcat(noirSat)
                    }
                    "silvertone" -> {
                        val silverSat = ColorMatrix()
                        silverSat.setSaturation(0.08f)
                        val silverMatrix = ColorMatrix(floatArrayOf(
                            1.1f, 0f, 0f, 0f, 15f,
                            0f, 1.15f, 0f, 0f, 20f,
                            0f, 0f, 1.25f, 0f, 30f,
                            0f, 0f, 0f, 1f, 0f
                        ))
                        silverSat.postConcat(silverMatrix)
                        cm.postConcat(silverSat)
                    }
                }

                paint.colorFilter = ColorMatrixColorFilter(cm)
            }

            canvas.drawBitmap(bitmap, 0f, 0f, paint)
            bitmap.recycle()

            // 5. Vignette overlay if specified
            val vignette = if (options.hasKey("vignette")) options.getDouble("vignette").toFloat() else 0f
            if (vignette > 0f) {
                val cx = resultBitmap.width / 2f
                val cy = resultBitmap.height / 2f
                val radius = Math.max(cx, cy)
                val alpha = Math.min(255, (vignette * 2.2f).toInt())
                val vignetteShader = RadialGradient(
                    cx, cy, radius,
                    intArrayOf(Color.TRANSPARENT, Color.argb(alpha, 0, 0, 0)),
                    floatArrayOf(0.5f, 1f),
                    Shader.TileMode.CLAMP
                )
                val vPaint = Paint()
                vPaint.shader = vignetteShader
                canvas.drawRect(0f, 0f, resultBitmap.width.toFloat(), resultBitmap.height.toFloat(), vPaint)
            }

            // 6. Text Overlay if provided
            if (options.hasKey("textOverlay")) {
                val text = options.getString("textOverlay") ?: ""
                if (text.isNotBlank()) {
                    val textColorHex = if (options.hasKey("textColor")) options.getString("textColor") ?: "#FFFFFF" else "#FFFFFF"
                    val textSize = if (options.hasKey("textSize")) options.getDouble("textSize").toFloat() else 42f

                    val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                        color = try { Color.parseColor(textColorHex) } catch (e: Exception) { Color.WHITE }
                        this.textSize = textSize * (resultBitmap.width / 500f)
                        textAlign = Paint.Align.CENTER
                        setShadowLayer(8f, 2f, 2f, Color.argb(180, 0, 0, 0))
                    }
                    val x = resultBitmap.width / 2f
                    val y = resultBitmap.height * 0.85f
                    canvas.drawText(text, x, y, textPaint)
                }
            }

            // 7. Save to destination file with chosen format and quality
            val destFile = File(destPath)
            destFile.parentFile?.mkdirs()

            val formatStr = if (options.hasKey("format")) options.getString("format")?.lowercase(Locale.ROOT) ?: "jpg" else "jpg"
            val quality = if (options.hasKey("quality")) options.getInt("quality").coerceIn(10, 100) else 90

            val compressFormat = when (formatStr) {
                "png" -> Bitmap.CompressFormat.PNG
                "webp" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                    Bitmap.CompressFormat.WEBP_LOSSY
                } else {
                    @Suppress("DEPRECATION")
                    Bitmap.CompressFormat.WEBP
                }
                else -> Bitmap.CompressFormat.JPEG
            }

            FileOutputStream(destFile).use { out ->
                resultBitmap.compress(compressFormat, quality, out)
            }
            resultBitmap.recycle()

            MediaScannerConnection.scanFile(
                reactContext,
                arrayOf(destFile.absolutePath),
                arrayOf(if (formatStr == "png") "image/png" else "image/jpeg"),
                null
            )

            val resultMap = Arguments.createMap().apply {
                putBoolean("success", true)
                putString("path", destFile.absolutePath)
                putString("name", destFile.name)
                putDouble("size", destFile.length().toDouble())
            }
            promise.resolve(resultMap)
        } catch (e: Exception) {
            promise.reject("ERR_SAVE_IMAGE", e.message, e)
        }
    }

    @ReactMethod
    fun getImageDimensions(filePath: String, promise: Promise) {
        try {
            val file = File(filePath)
            if (!file.exists()) {
                promise.reject("ERR_NOT_FOUND", "File does not exist")
                return
            }
            val options = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(file.absolutePath, options)
            val map = Arguments.createMap().apply {
                putInt("width", options.outWidth)
                putInt("height", options.outHeight)
                putString("mimeType", options.outMimeType ?: "image/jpeg")
            }
            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("ERR_DIMENSIONS", e.message, e)
        }
    }

    private val ALLOWED_RECENT_EXTENSIONS = setOf(
        // Images
        "jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "avif", "svg", "raw", "cr2", "nef", "dng", "arw",
        // Videos
        "mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "3gp", "m4v", "ts",
        // Audio
        "mp3", "wav", "aac", "flac", "ogg", "m4a", "wma", "opus", "mid", "amr",
        // Documents (PDF, Word, Excel, PPT, Text, HTML, XML, CSV, etc.)
        "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "csv", "rtf", "html", "htm", "json", "xml", "md", "epub",
        // Archives & Packages
        "apk", "xapk", "apks", "zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "tgz"
    )

    private fun isJunkOrSystemFile(file: File, name: String, ext: String): Boolean {
        val lowerName = name.lowercase(Locale.ROOT)
        val lowerExt = ext.lowercase(Locale.ROOT)
        val path = file.absolutePath.lowercase(Locale.ROOT)

        // Hidden files
        if (lowerName.startsWith(".")) return true

        // WhatsApp crypt files (crypt, crypt12, crypt14, crypt15, etc.)
        if (lowerExt.startsWith("crypt") || lowerName.contains(".crypt")) return true

        // Databases, backups, thumbnails directories (excluding user media)
        if (path.contains("/databases/") || path.contains("/databases") ||
            path.contains("/backups/") || path.contains("/backups") ||
            path.contains("/.thumbnails")
        ) {
            if (!path.contains("/whatsapp/media") && !path.contains("/whatsapp business/media")) {
                return true
            }
        }

        // Database and log extensions
        if (lowerExt == "db" || lowerExt == "db-wal" || lowerExt == "db-shm" ||
            lowerExt == "sqlite" || lowerExt == "sqlite3" || lowerExt == "realm" ||
            lowerExt == "log" || lowerExt == "trace"
        ) {
            return true
        }

        // Temporary and system junk files
        if (lowerExt == "tmp" || lowerExt == "temp" || lowerExt == "cache" ||
            lowerExt == "dat" || lowerExt == "bin" || lowerExt == "nomedia" ||
            lowerExt == "bak" || lowerExt == "backup" || lowerExt == "dump" ||
            lowerExt == "dmp" || lowerExt == "stackdump" || lowerExt == "idx" ||
            lowerExt == "part" || lowerExt == "crdownload" || lowerExt == "dex" ||
            lowerExt == "class"
        ) {
            return true
        }

        // msgstore database backups
        if (lowerName.startsWith("msgstore") || lowerName.startsWith("chatsettingsbackup") || lowerName.startsWith("wa.db")) {
            return true
        }

        // Must be in allowed extensions list
        if (!ALLOWED_RECENT_EXTENSIONS.contains(lowerExt)) {
            return true
        }

        return false
    }

    @ReactMethod
    fun setScreenBrightness(brightness: Double, promise: Promise) {
        try {
            reactContext.currentActivity?.runOnUiThread {
                val window = reactContext.currentActivity?.window
                if (window != null) {
                    val lp = window.attributes
                    lp.screenBrightness = brightness.toFloat().coerceIn(0.01f, 1.0f)
                    window.attributes = lp
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            } ?: promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getScreenBrightness(promise: Promise) {
        try {
            val window = reactContext.currentActivity?.window
            val br = window?.attributes?.screenBrightness ?: -1f
            if (br < 0) {
                val sysBr = Settings.System.getInt(reactContext.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128)
                promise.resolve(sysBr / 255.0)
            } else {
                promise.resolve(br.toDouble())
            }
        } catch (e: Exception) {
            promise.resolve(0.5)
        }
    }

    @ReactMethod
    fun setDeviceVolume(volumePercent: Double, promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            val target = (volumePercent * maxVol).toInt().coerceIn(0, maxVol)
            audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getDeviceVolume(promise: Promise) {
        try {
            val audioManager = reactContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
            val curVol = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
            val maxVol = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
            promise.resolve(curVol.toDouble() / maxVol.toDouble())
        } catch (e: Exception) {
            promise.resolve(0.5)
        }
    }

    @ReactMethod
    fun captureVideoFrame(filePath: String, timeMs: Double, promise: Promise) {
        try {
            val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(cleanPath)
            val frame = retriever.getFrameAtTime((timeMs * 1000).toLong(), MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            if (frame != null) {
                val destDir = File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "NexFile")
                if (!destDir.exists()) destDir.mkdirs()
                val destFile = File(destDir, "VID_CAPTURE_${System.currentTimeMillis()}.jpg")
                val out = FileOutputStream(destFile)
                frame.compress(Bitmap.CompressFormat.JPEG, 95, out)
                out.flush()
                out.close()
                MediaScannerConnection.scanFile(reactContext, arrayOf(destFile.absolutePath), arrayOf("image/jpeg"), null)
                promise.resolve(destFile.absolutePath)
            } else {
                promise.reject("CAPTURE_FAILED", "Could not extract video frame")
            }
        } catch (e: Exception) {
            promise.reject("CAPTURE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun getVideoThumbnailAt(filePath: String, timeMs: Double, promise: Promise) {
        try {
            val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
            val retriever = MediaMetadataRetriever()
            retriever.setDataSource(cleanPath)
            val frame = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                retriever.getScaledFrameAtTime((timeMs * 1000).toLong(), MediaMetadataRetriever.OPTION_CLOSEST_SYNC, 240, 135)
            } else {
                val raw = retriever.getFrameAtTime((timeMs * 1000).toLong(), MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
                if (raw != null) Bitmap.createScaledBitmap(raw, 240, 135, true) else null
            }
            if (frame != null) {
                val cacheDir = File(reactContext.cacheDir, "seek_thumbs")
                if (!cacheDir.exists()) cacheDir.mkdirs()
                val destFile = File(cacheDir, "seek_thumb.jpg")
                val out = FileOutputStream(destFile)
                frame.compress(Bitmap.CompressFormat.JPEG, 70, out)
                out.flush()
                out.close()
                promise.resolve("file://${destFile.absolutePath}")
            } else {
                promise.resolve(null)
            }
        } catch (e: Exception) {
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun enterPipMode(aspectRatioNum: Int, aspectRatioDen: Int, promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.currentActivity?.runOnUiThread {
                    try {
                        val num = if (aspectRatioNum <= 0) 16 else aspectRatioNum
                        val den = if (aspectRatioDen <= 0) 9 else aspectRatioDen
                        val rational = Rational(num, den)
                        val params = PictureInPictureParams.Builder()
                            .setAspectRatio(rational)
                            .build()
                        val success = reactContext.currentActivity?.enterPictureInPictureMode(params) ?: false
                        promise.resolve(success)
                    } catch (e: Exception) {
                        promise.resolve(false)
                    }
                } ?: promise.resolve(false)
            } else {
                promise.resolve(false)
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun openWithSystemPlayer(filePath: String, promise: Promise) {
        try {
            val cleanPath = if (filePath.startsWith("file://")) filePath.substring(7) else filePath
            val file = File(cleanPath)
            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.provider",
                file
            )
            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "video/*")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(Intent.createChooser(intent, "Play Video with...").apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            })
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("PLAY_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun setScreenOrientation(orientation: String, promise: Promise) {
        try {
            reactContext.currentActivity?.runOnUiThread {
                val act = reactContext.currentActivity
                if (act != null) {
                    when (orientation.lowercase(Locale.ROOT)) {
                        "landscape" -> act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                        "portrait" -> act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                        "sensor" -> act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR
                        else -> act.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    }
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            } ?: promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun savePreference(key: String, value: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("nexfile_prefs", Context.MODE_PRIVATE)
            prefs.edit().putString(key, value).commit()
            if (key == "NEX_VAULT_PIN_HASH" && value.isNotEmpty()) {
                try {
                    val vaultDir = File(android.os.Environment.getExternalStorageDirectory(), ".vault")
                    if (!vaultDir.exists()) vaultDir.mkdirs()
                    val hashFile = File(vaultDir, ".vault_pin_hash")
                    hashFile.writeText(value)
                } catch (ignored: Exception) {}
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun getPreference(key: String, defaultValue: String, promise: Promise) {
        try {
            val prefs = reactContext.getSharedPreferences("nexfile_prefs", Context.MODE_PRIVATE)
            var v = prefs.getString(key, null)
            if (key == "NEX_VAULT_PIN_HASH") {
                if (v.isNullOrEmpty()) {
                    try {
                        val hashFile = File(android.os.Environment.getExternalStorageDirectory(), ".vault/.vault_pin_hash")
                        if (hashFile.exists()) {
                            val diskHash = hashFile.readText().trim()
                            if (diskHash.isNotEmpty()) {
                                v = diskHash
                                prefs.edit().putString(key, diskHash).commit()
                            }
                        }
                    } catch (ignored: Exception) {}
                } else {
                    try {
                        val vaultDir = File(android.os.Environment.getExternalStorageDirectory(), ".vault")
                        if (!vaultDir.exists()) vaultDir.mkdirs()
                        val hashFile = File(vaultDir, ".vault_pin_hash")
                        if (!hashFile.exists()) {
                            hashFile.writeText(v)
                        }
                    } catch (ignored: Exception) {}
                }
            }
            promise.resolve(v ?: defaultValue)
        } catch (e: Exception) {
            promise.resolve(defaultValue)
        }
    }

    @ReactMethod
    fun setImmersiveMode(enable: Boolean, promise: Promise) {
        try {
            reactContext.currentActivity?.runOnUiThread {
                val act = reactContext.currentActivity
                if (act != null) {
                    val decorView = act.window.decorView
                    if (enable) {
                        decorView.systemUiVisibility = (
                            android.view.View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                            or android.view.View.SYSTEM_UI_FLAG_FULLSCREEN
                            or android.view.View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                            or android.view.View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        )
                    } else {
                        decorView.systemUiVisibility = android.view.View.SYSTEM_UI_FLAG_VISIBLE
                    }
                    promise.resolve(true)
                } else {
                    promise.resolve(false)
                }
            } ?: promise.resolve(false)
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun isBiometricAvailable(promise: Promise) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val biometricManager = reactContext.getSystemService(Context.BIOMETRIC_SERVICE) as? android.hardware.biometrics.BiometricManager
                if (biometricManager != null) {
                    val res = biometricManager.canAuthenticate(android.hardware.biometrics.BiometricManager.Authenticators.BIOMETRIC_WEAK)
                    promise.resolve(res == android.hardware.biometrics.BiometricManager.BIOMETRIC_SUCCESS)
                    return
                }
            }
            promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
        } catch (_: Exception) {
            promise.resolve(false)
        }
    }

    @ReactMethod
    fun authenticateBiometric(title: String, subtitle: String, promise: Promise) {
        try {
            val activity = reactContext.currentActivity
            if (activity == null) {
                promise.resolve(false)
                return
            }
            activity.runOnUiThread {
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                        val cancellationSignal = android.os.CancellationSignal()
                        val executor = ContextCompat.getMainExecutor(activity)
                        val prompt = android.hardware.biometrics.BiometricPrompt.Builder(activity)
                            .setTitle(if (title.isNotEmpty()) title else "Private Vault")
                            .setSubtitle(if (subtitle.isNotEmpty()) subtitle else "Authenticate using your fingerprint")
                            .setNegativeButton("Cancel", executor) { _, _ ->
                                try { promise.resolve(false) } catch (_: Exception) {}
                            }
                            .build()

                        var resolved = false
                        prompt.authenticate(cancellationSignal, executor, object : android.hardware.biometrics.BiometricPrompt.AuthenticationCallback() {
                            override fun onAuthenticationSucceeded(result: android.hardware.biometrics.BiometricPrompt.AuthenticationResult?) {
                                super.onAuthenticationSucceeded(result)
                                if (!resolved) {
                                    resolved = true
                                    try { promise.resolve(true) } catch (_: Exception) {}
                                }
                            }

                            override fun onAuthenticationError(errorCode: Int, errString: CharSequence?) {
                                super.onAuthenticationError(errorCode, errString)
                                if (!resolved) {
                                    resolved = true
                                    try { promise.resolve(false) } catch (_: Exception) {}
                                }
                            }

                            override fun onAuthenticationFailed() {
                                super.onAuthenticationFailed()
                            }
                        })
                    } else {
                        promise.resolve(false)
                    }
                } catch (e: Exception) {
                    try { promise.resolve(false) } catch (_: Exception) {}
                }
            }
        } catch (e: Exception) {
            promise.resolve(false)
        }
    }

    private fun getFileExtension(name: String): String {
        val lastDot = name.lastIndexOf('.')
        return if (lastDot >= 0 && lastDot < name.length - 1) {
            name.substring(lastDot + 1).lowercase(Locale.ROOT)
        } else {
            ""
        }
    }

    private fun getMimeType(file: File): String {
        if (file.isDirectory) return "inode/directory"
        val ext = getFileExtension(file.name)
        val defaultMime = when (ext) {
            "pdf" -> "application/pdf"
            "txt", "log" -> "text/plain"
            "html", "htm" -> "text/html"
            "json" -> "application/json"
            "xml" -> "application/xml"
            "csv" -> "text/csv"
            "doc" -> "application/msword"
            "docx" -> "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            "xls" -> "application/vnd.ms-excel"
            "xlsx" -> "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            "ppt" -> "application/vnd.ms-powerpoint"
            "pptx" -> "application/vnd.openxmlformats-officedocument.presentationml.presentation"
            "apk" -> "application/vnd.android.package-archive"
            "zip" -> "application/zip"
            "rar" -> "application/x-rar-compressed"
            "7z" -> "application/x-7z-compressed"
            "epub" -> "application/epub+zip"
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "webm" -> "video/webm"
            "mp3" -> "audio/mpeg"
            "flac" -> "audio/flac"
            "wav" -> "audio/wav"
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "webp" -> "image/webp"
            "gif" -> "image/gif"
            else -> null
        }
        if (defaultMime != null) return defaultMime

        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
        return mime ?: "*/*"
    }
}

