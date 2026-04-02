/**
 * CommonJS production entry for hosts whose Node runner loads the entry with require()
 * (e.g. some LiteSpeed setups). Loads the ESM bundle via dynamic import().
 * hPanel: set Entry file to server.cjs
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const root = __dirname;
const bundle = path.join(root, 'dist-server', 'index.js');

if (!fs.existsSync(bundle)) {
  console.error('[server.cjs] dist-server/index.js missing — running npm run build ...');
  const result = spawnSync('npm', ['run', 'build'], {
    cwd: root,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.status !== 0) {
    console.error('[server.cjs] npm run build failed');
    process.exit(result.status ?? 1);
  }
}

if (!fs.existsSync(bundle)) {
  console.error('[server.cjs] dist-server/index.js still missing after build');
  process.exit(1);
}

import(pathToFileURL(bundle).href).catch((err) => {
  console.error(err);
  process.exit(1);
});
