#!/bin/bash
# Build installers for Mac and Windows
# Run from project root: ./build-installers.sh

set -e

echo "Installing dependencies..."
npm install

echo "Building main process..."
node ./node_modules/typescript/bin/tsc -p tsconfig.main.json

echo "Building React app..."
node ./node_modules/vite/bin/vite build

echo "Creating installers (Mac + Windows)..."
npx electron-builder --mac --win

# Copy installers to flat Installers/ folder for easy access
mkdir -p Installers
cp -f Installers/win/*.exe Installers/ 2>/dev/null || true
cp -f Installers/mac/*.pkg Installers/ 2>/dev/null || true
cp -f Installers/mac/*.dmg Installers/ 2>/dev/null || true

# Add instructions
cat > Installers/README.txt << 'EOF'
Equipment Inventory - Installers
================================

Double-click the installer for your computer:

  Windows:  Equipment Inventory Setup 1.0.0.exe
  Mac:      Equipment Inventory-1.0.0.pkg

The installation will create shortcuts and install the app.
When complete, the app will open automatically.
EOF

echo ""
echo "Done! Open the Installers folder and double-click an installer:"
echo "  Installers/Equipment Inventory Setup 1.0.0.exe  (Windows)"
echo "  Installers/Equipment Inventory-1.0.0.pkg       (Mac)"
