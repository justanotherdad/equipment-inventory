/**
 * Production entry (e.g. Hostinger "Entry file: server.js").
 * Loads dist-server/index.js (esbuild bundle). If missing — runs `npm run build`
 * (some hosts only run install, or hide a custom build command).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.dirname(fileURLToPath(import.meta.url));
const bundle = path.join(root, 'dist-server', 'index.js');

if (!fs.existsSync(bundle)) {
  console.error('[server.js] dist-server/index.js missing — running npm run build ...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error('[server.js] npm run build failed');
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(bundle)) {
  console.error('[server.js] dist-server/index.js still missing after build');
  process.exit(1);
}

await import(pathToFileURL(bundle).href);
