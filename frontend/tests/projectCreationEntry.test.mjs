import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('independent project creation lives in Task Center, not the project-data sidebar', () => {
  const sidebar = readFileSync(path.join(frontendRoot, 'src/workspace/ProjectSidebar.tsx'), 'utf8');
  const taskCenter = readFileSync(path.join(frontendRoot, 'src/workspace/TaskCenter.tsx'), 'utf8');
  assert.doesNotMatch(sidebar, /新建项目/);
  assert.doesNotMatch(sidebar, /workspace-project-add/);
  assert.match(taskCenter, /新建独立项目/);
  assert.match(taskCenter, /导入旧版试验项目/);
});
