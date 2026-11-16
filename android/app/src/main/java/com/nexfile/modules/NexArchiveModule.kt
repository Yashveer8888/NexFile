package com.nexfile.modules

import com.facebook.react.bridge.*
import java.io.*
import java.util.zip.*

class NexArchiveModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexArchive"

    @ReactMethod
    fun listArchiveContents(archivePath: String, promise: Promise) {
        try {
            val file = File(archivePath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "Archive file does not exist: $archivePath")
                return
            }

            val array = Arguments.createArray()
            ZipFile(file).use { zip ->
                val entries = zip.entries()
                while (entries.hasMoreElements()) {
                    val entry = entries.nextElement()
                    val map = Arguments.createMap().apply {
                        putString("name", entry.name)
                        putBoolean("isDirectory", entry.isDirectory)
                        putDouble("size", entry.size.toDouble())
                        putDouble("compressedSize", entry.compressedSize.toDouble())
                        putDouble("time", entry.time.toDouble())
                        putDouble("crc", entry.crc.toDouble())
                    }
                    array.pushMap(map)
                }
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("LIST_ARCHIVE_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun createZipArchive(
        sourcePaths: ReadableArray,
        destZipPath: String,
        compressionLevel: Int, // 0 = none, 1 = fastest, 9 = best
        promise: Promise
    ) {
        try {
            val destFile = File(destZipPath)
            destFile.parentFile?.mkdirs()

            val level = compressionLevel.coerceIn(0, 9)

            FileOutputStream(destFile).use { fos ->
                BufferedOutputStream(fos).use { bos ->
                    ZipOutputStream(bos).use { zos ->
                        zos.setLevel(level)

                        for (i in 0 until sourcePaths.size()) {
                            val path = sourcePaths.getString(i) ?: continue
                            val srcFile = File(path)
                            if (!srcFile.exists()) continue

                            addToZip(srcFile, "", zos)
                        }
                    }
                }
            }

            promise.resolve(destFile.absolutePath)
        } catch (e: Exception) {
            promise.reject("CREATE_ARCHIVE_ERROR", e.message, e)
        }
    }

    private fun addToZip(file: File, parentPath: String, zos: ZipOutputStream) {
        val entryName = if (parentPath.isEmpty()) file.name else "$parentPath/${file.name}"

        if (file.isDirectory) {
            val dirEntry = ZipEntry("$entryName/")
            zos.putNextEntry(dirEntry)
            zos.closeEntry()

            val children = file.listFiles() ?: return
            for (child in children) {
                addToZip(child, entryName, zos)
            }
        } else {
            val entry = ZipEntry(entryName)
            entry.time = file.lastModified()
            zos.putNextEntry(entry)

            FileInputStream(file).use { fis ->
                val buffer = ByteArray(8192)
                var read: Int
                while (fis.read(buffer).also { read = it } != -1) {
                    zos.write(buffer, 0, read)
                }
            }
            zos.closeEntry()
        }
    }

    @ReactMethod
    fun extractArchive(
        archivePath: String,
        destDirPath: String,
        selectedEntries: ReadableArray?,
        promise: Promise
    ) {
        try {
            val archiveFile = File(archivePath)
            if (!archiveFile.exists()) {
                promise.reject("FILE_NOT_FOUND", "Archive file does not exist")
                return
            }

            val destDir = File(destDirPath)
            if (!destDir.exists()) destDir.mkdirs()

            val filterSet = HashSet<String>()
            if (selectedEntries != null && selectedEntries.size() > 0) {
                for (i in 0 until selectedEntries.size()) {
                    selectedEntries.getString(i)?.let { filterSet.add(it) }
                }
            }

            val extractedPaths = Arguments.createArray()

            ZipInputStream(BufferedInputStream(FileInputStream(archiveFile))).use { zis ->
                var entry: ZipEntry? = zis.nextEntry
                val buffer = ByteArray(8192)

                while (entry != null) {
                    val entryName = entry.name

                    // Check if entry or its parent is in filter list
                    if (filterSet.isEmpty() || filterSet.contains(entryName)) {
                        val outFile = File(destDir, entryName)

                        // Path traversal guard
                        if (!outFile.canonicalPath.startsWith(destDir.canonicalPath)) {
                            throw SecurityException("Zip entry is trying to escape target dir: $entryName")
                        }

                        if (entry.isDirectory) {
                            outFile.mkdirs()
                        } else {
                            outFile.parentFile?.mkdirs()
                            FileOutputStream(outFile).use { fos ->
                                var count: Int
                                while (zis.read(buffer).also { count = it } != -1) {
                                    fos.write(buffer, 0, count)
                                }
                            }
                            extractedPaths.pushString(outFile.absolutePath)
                        }
                    }

                    zis.closeEntry()
                    entry = zis.nextEntry
                }
            }

            promise.resolve(extractedPaths)
        } catch (e: Exception) {
            promise.reject("EXTRACT_ARCHIVE_ERROR", e.message, e)
        }
    }
}

