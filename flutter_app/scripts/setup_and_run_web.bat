@echo off
setlocal enabledelayedexpansion

where flutter >nul 2>nul
if errorlevel 1 (
  echo [ERREUR] Flutter n'est pas disponible dans le PATH.
  exit /b 1
)

echo === Installation des dependances Gazavba Flutter ===
flutter pub get
if errorlevel 1 (
  echo [ERREUR] flutter pub get a echoue.
  exit /b 1
)

echo === Lancement de Gazavba sur le web (Chrome) ===
flutter run -d chrome --web-renderer html --target lib/main.dart %*
