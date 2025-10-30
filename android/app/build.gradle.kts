plugins {
    id("com.android.application")
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "com.example.my_fixed_app"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    defaultConfig {
        // ✅ Mets ici ton applicationId final si besoin
        applicationId = "com.example.my_fixed_app"

        // Ces valeurs viennent de l’extension Flutter (gardées comme dans ton template)
        minSdk = flutter.minSdkVersion   // Assure-toi que ça vaut au moins 21
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // ✅ Java 17 + désugaring activée
    compileOptions {
        // Active la désugaring pour supporter les APIs Java 8+ utilisées par certaines libs
        isCoreLibraryDesugaringEnabled = true

        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildTypes {
        release {
            // TODO: remplace par ta vraie signature pour les builds release
            signingConfig = signingConfigs.getByName("debug")
            // Optionnel: active minify si tu veux
            // isMinifyEnabled = true
            // proguardFiles(
            //     getDefaultProguardFile("proguard-android-optimize.txt"),
            //     "proguard-rules.pro"
            // )
        }
    }
}

flutter {
    source = "../.."
}

dependencies {
    // ✅ Bibliothèque de désugaring (obligatoire si isCoreLibraryDesugaringEnabled = true)
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.0.4")

    // Tes autres dépendances "implementation(...)" viendront ici si besoin
    // Exemple (optionnel, seulement si tu utilises Multidex avec minSdk < 21) :
    // implementation("androidx.multidex:multidex:2.0.1")
}
