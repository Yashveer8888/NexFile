package com.nexfile.modules

import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream

class NexAppManagerModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "NexAppManager"

    @ReactMethod
    fun getInstalledApps(includeSystemApps: Boolean, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val packages = pm.getInstalledPackages(0)
            val array = Arguments.createArray()

            for (pkg in packages) {
                val appInfo = pkg.applicationInfo ?: continue
                val isSystem = (appInfo.flags and ApplicationInfo.FLAG_SYSTEM) != 0

                if (!includeSystemApps && isSystem) continue

                val map = Arguments.createMap().apply {
                    putString("packageName", pkg.packageName)
                    putString("appName", pm.getApplicationLabel(appInfo).toString())
                    putString("versionName", pkg.versionName ?: "1.0")
                    putInt("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pkg.longVersionCode.toInt() else pkg.versionCode)
                    putBoolean("isSystemApp", isSystem)
                    putString("sourceDir", appInfo.sourceDir)
                    putDouble("firstInstallTime", pkg.firstInstallTime.toDouble())
                    putDouble("lastUpdateTime", pkg.lastUpdateTime.toDouble())

                    val apkFile = File(appInfo.sourceDir)
                    putDouble("size", if (apkFile.exists()) apkFile.length().toDouble() else 0.0)
                }
                array.pushMap(map)
            }

            promise.resolve(array)
        } catch (e: Exception) {
            promise.reject("GET_APPS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun inspectApkFile(apkPath: String, promise: Promise) {
        try {
            val file = File(apkPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK file not found: $apkPath")
                return
            }

            val pm = reactContext.packageManager
            val pkgInfo = pm.getPackageArchiveInfo(apkPath, PackageManager.GET_PERMISSIONS)
            if (pkgInfo == null) {
                promise.reject("INVALID_APK", "Unable to parse APK package metadata")
                return
            }

            val appInfo = pkgInfo.applicationInfo
            if (appInfo != null) {
                appInfo.sourceDir = apkPath
                appInfo.publicSourceDir = apkPath
            }

            val map = Arguments.createMap().apply {
                putString("packageName", pkgInfo.packageName)
                putString("appName", if (appInfo != null) pm.getApplicationLabel(appInfo).toString() else (file.nameWithoutExtension))
                putString("versionName", pkgInfo.versionName ?: "1.0")
                putInt("versionCode", if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) pkgInfo.longVersionCode.toInt() else pkgInfo.versionCode)
                putInt("targetSdkVersion", appInfo?.targetSdkVersion ?: 30)
                putDouble("size", file.length().toDouble())
                putString("path", file.absolutePath)

                val permArray = Arguments.createArray()
                pkgInfo.requestedPermissions?.forEach { permArray.pushString(it) }
                putArray("permissions", permArray)
            }

            promise.resolve(map)
        } catch (e: Exception) {
            promise.reject("INSPECT_APK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun launchApp(packageName: String, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val launchIntent = pm.getLaunchIntentForPackage(packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactContext.startActivity(launchIntent)
                promise.resolve(true)
            } else {
                promise.reject("LAUNCH_FAILED", "Application has no launchable Activity")
            }
        } catch (e: Exception) {
            promise.reject("LAUNCH_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun openAppSettings(packageName: String, promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                data = Uri.fromParts("package", packageName, null)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("APP_SETTINGS_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun installApk(apkPath: String, promise: Promise) {
        try {
            val file = File(apkPath)
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "APK file not found")
                return
            }

            val uri = FileProvider.getUriForFile(
                reactContext,
                "${reactContext.packageName}.fileprovider",
                file
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }

            reactContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("INSTALL_APK_ERROR", e.message, e)
        }
    }

    @ReactMethod
    fun backupAppApk(packageName: String, destDirPath: String, promise: Promise) {
        try {
            val pm = reactContext.packageManager
            val pkg = pm.getPackageInfo(packageName, 0)
            val appInfo = pkg.applicationInfo
            if (appInfo == null || appInfo.sourceDir == null) {
                promise.reject("SOURCE_NOT_FOUND", "Source APK does not exist")
                return
            }
            val sourceApk = File(appInfo.sourceDir)

            if (!sourceApk.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source APK does not exist")
                return
            }

            val destDir = File(destDirPath)
            if (!destDir.exists()) destDir.mkdirs()

            val appLabel = pm.getApplicationLabel(appInfo).toString().replace(" ", "_")
            val targetApk = File(destDir, "${appLabel}_v${pkg.versionName ?: "1.0"}.apk")

            FileInputStream(sourceApk).use { inStream ->
                FileOutputStream(targetApk).use { outStream ->
                    inStream.copyTo(outStream)
                }
            }

            promise.resolve(targetApk.absolutePath)
        } catch (e: Exception) {
            promise.reject("BACKUP_ERROR", e.message, e)
        }
    }
}

