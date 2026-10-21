import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('workspace sidebar groups workbench sessions, projects and formal tasks', () => {
  const sidebar = readFileSync(path.join(frontendRoot, 'src/workspace/BusinessSidebar.tsx'), 'utf8');
  assert.match(sidebar, /工作台/);
  assert.match(sidebar, /最近会话/);
  assert.match(sidebar, /项目/);
  assert.match(sidebar, /正式任务/);
  assert.match(sidebar, /搜索会话/);
  assert.match(sidebar, /新建项目/);
  assert.match(sidebar, /trials\/new\?projectId/);
  assert.match(sidebar, /business-object-tree/);
  assert.match(sidebar, /物理对象/);
});

test('recent-session plus creates a session instead of opening trial creation', () => {
  const sidebar = readFileSync(path.join(frontendRoot, 'src/workspace/BusinessSidebar.tsx'), 'utf8');
  assert.match(sidebar, /aria-label="新建会话"/);
  assert.match(sidebar, /createSession\(\{ title: '新会话' \}\)/);
  assert.match(sidebar, /openSession\([^,]+, 'doe'\)/);
  assert.match(sidebar, /getSessionPath\([^,]+, 'doe'\)/);
  assert.doesNotMatch(sidebar, /const startSession = \(\) => open\('\/trials\/new'\)/);
});
