# ==============================================================================
# NexFile ProGuard / R8 Optimization & Keep Rules
# ==============================================================================

# React Native & Hermes Core Keep Rules
-keep class com.facebook.react.** { *; }
-keep class com.facebook.jni.** { *; }
-keep class com.facebook.hermes.** { *; }
-keepclassmembers class * {
    @com.facebook.react.bridge.ReactMethod *;
    @com.facebook.react.bridge.ReactContextBaseJavaModule *;
    @com.facebook.react.uimanager.annotations.ReactProp *;
    @com.facebook.react.uimanager.annotations.ReactPropGroup *;
}

# NexFile Custom Native Modules & Package
-keep class com.nexfile.** { *; }
-keepclassmembers class com.nexfile.** {
    public <init>(...);
    @com.facebook.react.bridge.ReactMethod <methods>;
}

# Android Jetpack, Security & Biometrics
-keep class androidx.biometric.** { *; }
-keep class androidx.security.crypto.** { *; }
-keep class androidx.core.content.FileProvider { *; }
-keep class androidx.documentfile.provider.** { *; }

# OkHttp & Networking
-dontwarn okhttp3.**
-dontwarn okio.**
-keepattributes Signature
-keepattributes *Annotation*
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

# Lucide Icons & Vector Assets
-keep class com.horcrux.svg.** { *; }

# Clean build warnings
-dontwarn javax.annotation.**
-dontwarn org.checkerframework.**
-dontwarn com.google.errorprone.annotations.**
