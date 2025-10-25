@echo off
setlocal enabledelayedexpansion

:: Ensure Flutter is in PATH before running this script.
where flutter >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Flutter n'est pas disponible dans le PATH.
  echo Ajoutez Flutter au PATH puis relancez ce script.
  exit /b 1
)

echo === Installation des dependances Gazavba Flutter ===
flutter pub get
if errorlevel 1 (
  echo [ERREUR] flutter pub get a echoue.
  exit /b 1
)

echo === Nettoyage eventuel des anciens builds ===
flutter clean >nul 2>nul

echo === Lancement de l'application sur un appareil Android ===
flutter run -d emulator-5554 --target lib/main.dart %*
