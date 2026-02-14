#!/usr/bin/env node
/**
 * Copies built installers to flat Installers/ folder for easy user access.
 * Run automatically after electron-builder (postbuild).
 */
const fs = require('fs');
const path = require('path');

const installersDir = path.join(__dirname, '..', 'Installers');
const winDir = path.join(installersDir, 'win');
const macDir = path.join(installersDir, 'mac');

function copyFiles(srcDir, ext) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir).filter((f) => f.endsWith(ext));
  for (const file of files) {
    fs.copyFileSync(path.join(srcDir, file), path.join(installersDir, file));
  }
}

if (fs.existsSync(installersDir)) {
  copyFiles(winDir, '.exe');
  copyFiles(macDir, '.pkg');
  copyFiles(macDir, '.dmg');
  copyFiles(macDir, '.zip');

  const readme = `Equipment Inventory - Installers
================================

Windows:
  - Equipment Inventory Setup 1.0.0.exe  (installer - creates shortcuts)
  - Equipment Inventory 1.0.0.exe         (portable - run directly, no install)

Mac:
  - Equipment Inventory-1.0.0.dmg        (drag app to Applications - recommended)
  - Equipment Inventory-1.0.0.zip        (portable - extract and run from anywhere)
  - Equipment Inventory-1.0.0.pkg       (installer - may fail on unsigned builds)

If Windows Defender removes the installed app, use the portable .exe instead.
`;
  fs.writeFileSync(path.join(installersDir, 'README.txt'), readme);

  console.log('\nInstallers ready in Installers/ folder - double-click to install.');
}
