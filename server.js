/**
 * Single-process entry for PaaS hosts (e.g. Hostinger "Entry file: server.js").
 * Avoids spawning a child Node process — some platforms only proxy to PID 1.
 */
import { tsImport } from 'tsx/esm/api';

await tsImport('./server/index.ts', import.meta.url);
