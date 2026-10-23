import { build } from 'esbuild';

export class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

export async function loadWorkspace(exports, options = {}) {
  const bundle = await build({ stdin: { contents: exports, resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent', ...options });
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}
