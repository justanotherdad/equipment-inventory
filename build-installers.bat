@echo off
REM Build installers for Mac and Windows
REM Run from project root: build-installers.bat

echo Installing dependencies...
call npm install

echo Building main process...
call npx tsc -p tsconfig.main.json

echo Building React app...
call npx vite build

echo Creating installers (Mac + Windows)...
call npx electron-builder --mac --win

REM Copy installers to flat Installers folder for easy access
if exist "Installers\win\*.exe" copy /Y "Installers\win\*.exe" "Installers\"
if exist "Installers\mac\*.pkg" copy /Y "Installers\mac\*.pkg" "Installers\"
if exist "Installers\mac\*.dmg" copy /Y "Installers\mac\*.dmg" "Installers\"

echo.
echo Done! Double-click an installer to begin:
echo   Installers\Equipment Inventory Setup 1.0.0.exe  (Windows)
echo   Installers\Equipment Inventory-1.0.0.pkg        (Mac)
pause


Rebuilding the installers on a Mac:
sudo rm -rf /Users/davefletes/equipment-inventory/Installers/mac-arm64npm 
run build:mac
Enter your Mac password when prompted. After that, the build should complete.