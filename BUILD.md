# How to Build Equipment Inventory

## Prerequisites

- **Node.js** 18 or newer
- **npm**
- All dependencies installed (`npm install`)

## Build for Current Platform

```bash
cd equipment-inventory
npm install
npm run build
```

This compiles the main process, builds the React app, and creates installers in the `release/` folder.

## Platform-Specific Builds

### macOS

```bash
npm run build:mac
```

Produces:

- `release/mac/Equipment Inventory-x.x.x.pkg` — Installer (double-click to install)
- `release/mac/Equipment Inventory-x.x.x.dmg` — Disk image (drag app to Applications)
- `release/mac/Equipment Inventory-x.x.x.zip` — Portable (extract and run from anywhere)

### Windows

```bash
npm run build:win
```

Produces:

- `release/win/Equipment Inventory Setup x.x.x.exe` — One-click installer (run to install)

## Build Output Structure

After building, the **Installers** folder (in the project root) contains:

```
Installers/
├── Equipment Inventory Setup 1.0.0.exe   ← Windows: double-click to install
├── Equipment Inventory-1.0.0.pkg        ← Mac: double-click to install
├── Equipment Inventory-1.0.0.dmg        ← Mac: drag to Applications
└── README.txt                           ← Instructions for users
```

Users open the Installers folder and double-click the file for their platform.

## Build Steps (What `npm run build` Does)

1. **Main process**: `tsc -p tsconfig.main.json` → compiles `main/*.ts` to `dist/main/`
2. **Renderer**: `vite build` → builds React app to `dist/renderer/`
3. **Packaging**: `electron-builder` → creates installers from `dist/`

## Build for Both Mac and Windows

### Option 1: npm script

```bash
npm install
npm run build:all
```

### Option 2: Build scripts

**On Mac/Linux:**
```bash
./build-installers.sh
```

**On Windows (Command Prompt):**
```cmd
build-installers.bat
```

This creates:
- **macOS**: `release/mac/Equipment Inventory-1.0.0.pkg` (installer) and `.dmg` (drag-to-install)
- **Windows**: `release/win/Equipment Inventory Setup 1.0.0.exe` (one-click installer)

> **Note**: Building Windows installers on Mac works with electron-builder. If you encounter issues, build Windows installers on a Windows machine using `npm run build:win`.

## Building for Another Platform

Electron Builder can cross-compile in some cases, but for best results:

- Build **macOS** installers on a Mac
- Build **Windows** installers on Windows (or use CI like GitHub Actions)

## Version Number

Update the version in `package.json` before building for release:

```json
{
  "name": "equipment-inventory",
  "version": "1.0.0",
  ...
}
```

## Installer Behavior

Both installers behave like commercial software: double-click the installer, run through the setup, and the app is installed with shortcuts and ready to use.

### Windows (Setup.exe)
- **One-click install**: Run the installer, it installs to Program Files, no wizard steps
- **Desktop shortcut**: Created automatically
- **Start Menu shortcut**: Created in Start Menu
- **Run after install**: App launches automatically when installation completes
- **Uninstall**: Settings → Apps → Equipment Inventory → Uninstall

### Mac (PKG)
- **Traditional installer**: Double-click the .pkg, follow the installer, click Install
- **Run after install**: App opens automatically when the installer finishes
- **Uninstall**: Drag "Equipment Inventory" from Applications to Trash

### Mac (DMG)
- Alternative: Open DMG, drag app to Applications folder (no auto-launch)

### Mac (ZIP - Portable)
- Extract the zip, double-click the app to run from anywhere (Desktop, Downloads, etc.)—no install needed

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `better-sqlite3` build fails | Ensure you have build tools (Xcode on Mac, Visual Studio Build Tools on Windows) |
| `electron-builder` fails | Run `npm install` and ensure `dist/main/` and `dist/renderer/` exist |
| App won't start after install | Check that antivirus isn't blocking it; try the portable build |
| **Mac PKG: "The installation failed"** | Use the **DMG** instead: open `Equipment Inventory-x.x.x.dmg`, drag the app to Applications. The PKG installer can fail on unsigned builds. If you must use PKG, ensure the app is code-signed and notarized with an Apple Developer account. |
| **Windows: "Not compatible with this PC"** | Build on Mac produces ARM64 by default. The config forces x64 for Intel/AMD PCs. Rebuild with `npm run build:win` to get a compatible installer. |
| **Windows: Installer runs but exe is missing** | Windows Defender often quarantines unsigned Electron apps. Check **Windows Security → Virus & threat protection → Protection history** → restore "Equipment Inventory.exe" if found. Add an exclusion for `C:\Program Files (x86)\Equipment Inventory` (or `Program Files`). **Alternative:** Use the **portable** build (`Equipment Inventory 1.0.0.exe`) — run it directly, no install needed. |
