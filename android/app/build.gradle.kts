import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing: keystore.properties (NOT committed) or env VS_KEYSTORE / VS_KEYSTORE_PASSWORD / VS_KEY_ALIAS / VS_KEY_PASSWORD
val ksProps = Properties().apply {
    val f = rootProject.file("keystore.properties")
    if (f.exists()) f.inputStream().use { load(it) }
}
fun ks(key: String, env: String): String? = (ksProps.getProperty(key) ?: System.getenv(env))?.takeIf { it.isNotBlank() }

// The shared UI lives in ../web (same files as the Windows app). Copy it into the APK assets at build time.
val webOut = layout.buildDirectory.dir("generated/webassets")
val copyWeb by tasks.registering(Copy::class) {
    from(rootProject.file("../web"))
    into(webOut.map { it.dir("web") })
}

android {
    namespace = "com.filmyfather.vidyutsewa"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.filmyfather.vidyutsewa"
        minSdk = 21
        targetSdk = 34
        versionCode = 6
        versionName = "1.1.3"
    }

    signingConfigs {
        create("release") {
            val path = ks("storeFile", "VS_KEYSTORE")
            if (path != null) {
                storeFile = file(path)
                storePassword = ks("storePassword", "VS_KEYSTORE_PASSWORD")
                keyAlias = ks("keyAlias", "VS_KEY_ALIAS") ?: "vidyutsewa"
                keyPassword = ks("keyPassword", "VS_KEY_PASSWORD")
                enableV1Signing = true   // old Android (5-6) needs the JAR signature
                enableV2Signing = true
                enableV3Signing = true
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
            if (ks("storeFile", "VS_KEYSTORE") != null) signingConfig = signingConfigs.getByName("release")
        }
    }
    sourceSets["main"].assets.srcDir(webOut)
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    testOptions { unitTests.isReturnDefaultValues = true }
    dependenciesInfo { includeInApk = false; includeInBundle = false }
    packaging { resources { excludes += setOf("META-INF/**", "kotlin/**", "DebugProbesKt.bin") } }
}

tasks.named("preBuild") { dependsOn(copyWeb) }

dependencies {
    implementation("androidx.core:core:1.13.1")
    implementation("androidx.work:work-runtime:2.9.1")
    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
}
