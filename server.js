/**
 * Root JS entry for hosts that require a concrete file (e.g. Hostinger "Entry file: server.js").
 * Runs the TypeScript server with Node's `tsx` import hook (same as `npm run start`).
 */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const entry = path.join(root, 'server', 'index.ts');

const child = spawn(process.execPath, ['--import', 'tsx', entry], {
  stdio: 'inherit',
  cwd: root,
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
