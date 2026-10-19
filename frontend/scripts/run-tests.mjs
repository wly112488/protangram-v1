import { readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Discover both model/store tests and colocated report tests without shell globs.
const root = fileURLToPath(new URL('..', import.meta.url));
const files = [];
for (const directory of ['tests', 'src']) {
  for (const entry of await readdir(path.join(root, directory), { recursive: true })) {
    if (/\.test\.(mjs|ts)$/.test(entry)) files.push(path.join(directory, entry));
  }
}
files.sort();
if (!files.length) throw new Error('No regression tests discovered');
console.log(`Running ${files.length} test files`);
const result = spawnSync(process.execPath, ['--experimental-strip-types', '--test', ...files], {
  cwd: root,
  stdio: 'inherit',
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
