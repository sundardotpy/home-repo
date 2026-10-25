import java.util.Properties

// The household database is built into the app, so the phone never asks for it.
// First found wins: -PhomerepoDb=…, homerepo.db in android/local.properties, then
// DATABASE_URL in the repo's .env. Both files are gitignored, so the credential
// never enters git; it does ship inside the APK.
val householdDb: String = (findProperty("homerepoDb") as String?)
    ?: rootProject.file("local.properties").takeIf { it.exists() }
        ?.let { file -> Properties().apply { file.inputStream().use { load(it) } }.getProperty("homerepo.db") }
    ?: rootProject.file("../.env").takeIf { it.exists() }?.readLines()
        ?.firstOrNull { it.startsWith("DATABASE_URL=") }?.substringAfter("=")?.trim()?.trim('"')
    ?: ""

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
    // Navigation 3 back-stack keys are @Serializable so the stack survives rotation.
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "app.homerepo"
    // The newest libraries need compile SDK 37.2; targetSdk stays 36 until runtime behaviour is checked.
    compileSdk {
        version = release(37) { minorApiLevel = 2 }
    }

    defaultConfig {
        applicationId = "app.homerepo"
        minSdk = 29
        targetSdk = 36
        versionCode = 2
        versionName = "2.0"
        buildConfigField("String", "DB_URL", "\"" + householdDb.replace("\\", "\\\\").replace("\"", "\\\"") + "\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_21
        targetCompatibility = JavaVersion.VERSION_21
        isCoreLibraryDesugaringEnabled = true
    }
    kotlin {
        // Build with JDK 21 whatever JDK runs Gradle (JDK 27's jlink breaks the Android SDK).
        jvmToolchain(21)
        compilerOptions {
            jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_21)
        }
    }
    buildFeatures {
        compose = true
        buildConfig = true
    }
}

dependencies {
    implementation(platform("androidx.compose:compose-bom:2026.09.00"))
    implementation("androidx.compose.material3:material3")
    // Navigation bar on phones, rail on wider windows, chosen by window size.
    implementation("androidx.compose.material3:material3-adaptive-navigation-suite")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.core:core-ktx:1.19.1")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.11.0")
    implementation("androidx.navigation3:navigation3-runtime:1.2.0")
    implementation("androidx.navigation3:navigation3-ui:1.2.0")
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-core:1.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.11.0")
    // The Postgres wire protocol, straight from the phone — same database the
    // server uses, no API layer in between (the user's call, per the spec).
    implementation("org.postgresql:postgresql:42.7.14")
    // QR / barcode scanning for printed labels.
    implementation("com.journeyapps:zxing-android-embedded:4.3.0") { isTransitive = false }
    implementation("com.google.zxing:core:3.5.4")
    testImplementation("junit:junit:4.13.2")
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}
