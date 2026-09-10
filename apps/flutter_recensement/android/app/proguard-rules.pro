# MorphoSmart SDK — classes lookées par JNI (ne pas shrinker)
-keep class com.morpho.** { *; }
-keepclassmembers class com.morpho.** { *; }
-keep class com.morpho.morphosmart.sdk.** { *; }
-keep class com.morpho.android.usb.** { *; }
-dontwarn com.morpho.**
