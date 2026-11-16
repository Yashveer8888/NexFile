package com.nexfile.modules

import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.SecureRandom
import java.security.spec.KeySpec
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class NexVaultModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexVault"

    private val GCM_TAG_LENGTH = 128
    private val IV_LENGTH = 12
    private val ITERATIONS = 65536
    private val KEY_LENGTH = 256

    @ReactMethod
    fun encryptFile(sourcePath: String, destPath: String, pinOrPass: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source file does not exist")
                return
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

    @ReactMethod
    fun decryptFile(sourcePath: String, destPath: String, pinOrPass: String, promise: Promise) {
        try {
            val sourceFile = File(sourcePath)
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Encrypted file does not exist")
                return
            }

            FileInputStream(sourceFile).use { fis ->
                val magic = ByteArray(4)
                fis.read(magic)
                if (String(magic, Charsets.UTF_8) != "NVLT") {
                    promise.reject("INVALID_VAULT_FILE", "Not a valid NexVault encrypted file")
                    return
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

