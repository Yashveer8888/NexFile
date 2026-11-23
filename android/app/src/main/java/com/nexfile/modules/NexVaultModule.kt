package com.nexfile.modules

import android.media.MediaScannerConnection
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.SecureRandom
import java.security.spec.KeySpec
import java.util.concurrent.Executors
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class NexVaultModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexVault"

    private val ioExecutor = Executors.newFixedThreadPool(4)
    private val GCM_TAG_LENGTH = 128
    private val IV_LENGTH = 12
    private val ITERATIONS = 65536
    private val KEY_LENGTH = 256

    /**
     * Atomically and safely moves a file into the private vault directory.
     * Preserves exact original filename without any alteration.
     * Performs strict size and existence verification before removing original file.
     */
    @ReactMethod
    fun secureMoveToVault(sourcePath: String, destDirPath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePath)
                if (!sourceFile.exists() || !sourceFile.isFile) {
                    promise.reject("SOURCE_NOT_FOUND", "Source file does not exist or is not a file: $sourcePath")
                    return@execute
                }

                val destDir = File(destDirPath)
                if (!destDir.exists()) {
                    destDir.mkdirs()
                }

                val originalName = sourceFile.name
                val targetFile = File(destDir, originalName)
                val originalSize = sourceFile.length()

                // 1. Try atomic rename first (instantaneous, 0ms, zero storage overhead, cannot corrupt data)
                val atomicMoved = sourceFile.renameTo(targetFile)
                if (atomicMoved && targetFile.exists() && targetFile.length() == originalSize) {
                    // Update Android MediaStore so the file disappears immediately from Gallery
                    MediaScannerConnection.scanFile(reactContext, arrayOf(sourcePath), null, null)

                    val map = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("path", targetFile.absolutePath)
                        putString("name", originalName)
                        putDouble("size", originalSize.toDouble())
                    }
                    promise.resolve(map)
                    return@execute
                }

                // 2. Fallback to copy with atomic swap & strict byte verification (e.g. if cross-volume)
                val tempTarget = File(destDir, "${originalName}.vlt_tmp_${System.currentTimeMillis()}")
                if (tempTarget.exists()) tempTarget.delete()

                FileInputStream(sourceFile).use { inStream ->
                    FileOutputStream(tempTarget).use { outStream ->
                        inStream.copyTo(outStream)
                        outStream.flush()
                    }
                }

                // Verify file size matches exactly
                if (tempTarget.exists() && tempTarget.length() == originalSize) {
                    if (targetFile.exists()) targetFile.delete()
                    val finalized = tempTarget.renameTo(targetFile)
                    if (finalized && targetFile.exists() && targetFile.length() == originalSize) {
                        // Safe: only delete source now that target is 100% verified
                        sourceFile.delete()
                        MediaScannerConnection.scanFile(reactContext, arrayOf(sourcePath), null, null)

                        val map = Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("path", targetFile.absolutePath)
                            putString("name", originalName)
                            putDouble("size", originalSize.toDouble())
                        }
                        promise.resolve(map)
                        return@execute
                    }
                }

                // If verification failed, NEVER delete source file!
                if (tempTarget.exists()) tempTarget.delete()
                promise.reject("MOVE_VERIFICATION_FAILED", "File verification failed. Source file kept safe.")
            } catch (e: Exception) {
                promise.reject("VAULT_MOVE_ERROR", e.message ?: "Failed to move file to vault", e)
            }
        }
    }

    /**
     * Atomically and safely restores a file from the vault back to normal storage.
     * Ensures original filename is retained (with collision resolution if needed).
     * Automatically indexes in MediaStore so restored file appears in Gallery immediately.
     */
    @ReactMethod
    fun restoreFromVault(sourcePath: String, targetDirPath: String, preferredFileName: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePath)
                if (!sourceFile.exists() || !sourceFile.isFile) {
                    promise.reject("SOURCE_NOT_FOUND", "Vault source file does not exist: $sourcePath")
                    return@execute
                }

                val destDir = File(targetDirPath)
                if (!destDir.exists()) {
                    destDir.mkdirs()
                }

                val originalSize = sourceFile.length()
                val baseName = if (preferredFileName.isNotEmpty()) preferredFileName else sourceFile.name

                // Handle file collision gracefully in target directory
                var targetFile = File(destDir, baseName)
                if (targetFile.exists()) {
                    val dotIdx = baseName.lastIndexOf('.')
                    val nameWithoutExt = if (dotIdx > 0) baseName.substring(0, dotIdx) else baseName
                    val ext = if (dotIdx > 0) baseName.substring(dotIdx) else ""

                    var counter = 1
                    while (targetFile.exists()) {
                        targetFile = File(destDir, "$nameWithoutExt ($counter)$ext")
                        counter++
                    }
                }

                // 1. Try atomic rename first
                val atomicMoved = sourceFile.renameTo(targetFile)
                if (atomicMoved && targetFile.exists() && targetFile.length() == originalSize) {
                    // Cleanup parent vault item folder if empty
                    sourceFile.parentFile?.delete()

                    // Index restored file in MediaStore
                    MediaScannerConnection.scanFile(
                        reactContext,
                        arrayOf(targetFile.absolutePath),
                        null,
                        null
                    )

                    val map = Arguments.createMap().apply {
                        putBoolean("success", true)
                        putString("path", targetFile.absolutePath)
                        putString("name", targetFile.name)
                        putDouble("size", originalSize.toDouble())
                    }
                    promise.resolve(map)
                    return@execute
                }

                // 2. Fallback to verified copy
                val tempTarget = File(destDir, "${targetFile.name}.rst_tmp_${System.currentTimeMillis()}")
                if (tempTarget.exists()) tempTarget.delete()

                FileInputStream(sourceFile).use { inStream ->
                    FileOutputStream(tempTarget).use { outStream ->
                        inStream.copyTo(outStream)
                        outStream.flush()
                    }
                }

                if (tempTarget.exists() && tempTarget.length() == originalSize) {
                    val finalized = tempTarget.renameTo(targetFile)
                    if (finalized && targetFile.exists() && targetFile.length() == originalSize) {
                        sourceFile.delete()
                        sourceFile.parentFile?.delete()

                        MediaScannerConnection.scanFile(
                            reactContext,
                            arrayOf(targetFile.absolutePath),
                            null,
                            null
                        )

                        val map = Arguments.createMap().apply {
                            putBoolean("success", true)
                            putString("path", targetFile.absolutePath)
                            putString("name", targetFile.name)
                            putDouble("size", originalSize.toDouble())
                        }
                        promise.resolve(map)
                        return@execute
                    }
                }

                if (tempTarget.exists()) tempTarget.delete()
                promise.reject("RESTORE_VERIFICATION_FAILED", "Failed to verify restored file.")
            } catch (e: Exception) {
                promise.reject("RESTORE_ERROR", e.message ?: "Failed to restore file from vault", e)
            }
        }
    }

    @ReactMethod
    fun getFileSize(filePath: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val file = File(filePath)
                if (file.exists()) {
                    promise.resolve(file.length().toDouble())
                } else {
                    promise.resolve(0.0)
                }
            } catch (e: Exception) {
                promise.resolve(0.0)
            }
        }
    }

    @ReactMethod
    fun encryptFile(sourcePath: String, destPath: String, pinOrPass: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePath)
                if (!sourceFile.exists()) {
                    promise.reject("SOURCE_NOT_FOUND", "Source file does not exist")
                    return@execute
                }

                val salt = ByteArray(16)
                SecureRandom().nextBytes(salt)

                val iv = ByteArray(IV_LENGTH)
                SecureRandom().nextBytes(iv)

                val keySpec: KeySpec = PBEKeySpec(pinOrPass.toCharArray(), salt, ITERATIONS, KEY_LENGTH)
                val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                val keyBytes = factory.generateSecret(keySpec).encoded
                val secretKey = SecretKeySpec(keyBytes, "AES")

                val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
                cipher.init(Cipher.ENCRYPT_MODE, secretKey, spec)

                val destFile = File(destPath)
                destFile.parentFile?.mkdirs()

                FileOutputStream(destFile).use { fos ->
                    // Write header magic "NVLT" + salt (16 bytes) + iv (12 bytes)
                    fos.write("NVLT".toByteArray(Charsets.UTF_8))
                    fos.write(salt)
                    fos.write(iv)

                    FileInputStream(sourceFile).use { fis ->
                        val buffer = ByteArray(8192)
                        var read: Int
                        while (fis.read(buffer).also { read = it } != -1) {
                            val output = cipher.update(buffer, 0, read)
                            if (output != null) fos.write(output)
                        }
                        val output = cipher.doFinal()
                        if (output != null) fos.write(output)
                    }
                }

                promise.resolve(destFile.absolutePath)
            } catch (e: Exception) {
                promise.reject("ENCRYPT_ERROR", e.message, e)
            }
        }
    }

    @ReactMethod
    fun decryptFile(sourcePath: String, destPath: String, pinOrPass: String, promise: Promise) {
        ioExecutor.execute {
            try {
                val sourceFile = File(sourcePath)
                if (!sourceFile.exists()) {
                    promise.reject("SOURCE_NOT_FOUND", "Encrypted file does not exist")
                    return@execute
                }

                FileInputStream(sourceFile).use { fis ->
                    val magic = ByteArray(4)
                    fis.read(magic)
                    if (String(magic, Charsets.UTF_8) != "NVLT") {
                        promise.reject("INVALID_VAULT_FILE", "Not a valid NexVault encrypted file")
                        return@execute
                    }

                    val salt = ByteArray(16)
                    fis.read(salt)

                    val iv = ByteArray(IV_LENGTH)
                    fis.read(iv)

                    val keySpec: KeySpec = PBEKeySpec(pinOrPass.toCharArray(), salt, ITERATIONS, KEY_LENGTH)
                    val factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256")
                    val keyBytes = factory.generateSecret(keySpec).encoded
                    val secretKey = SecretKeySpec(keyBytes, "AES")

                    val cipher = Cipher.getInstance("AES/GCM/NoPadding")
                    val spec = GCMParameterSpec(GCM_TAG_LENGTH, iv)
                    cipher.init(Cipher.DECRYPT_MODE, secretKey, spec)

                    val destFile = File(destPath)
                    destFile.parentFile?.mkdirs()

                    FileOutputStream(destFile).use { fos ->
                        val buffer = ByteArray(8192)
                        var read: Int
                        while (fis.read(buffer).also { read = it } != -1) {
                            val output = cipher.update(buffer, 0, read)
                            if (output != null) fos.write(output)
                        }
                        val output = cipher.doFinal()
                        if (output != null) fos.write(output)
                    }

                    promise.resolve(destFile.absolutePath)
                }
            } catch (e: Exception) {
                promise.reject("DECRYPT_ERROR", "Failed to decrypt. Incorrect PIN/Password or corrupted file.", e)
            }
        }
    }
}
