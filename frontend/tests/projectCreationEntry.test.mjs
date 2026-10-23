import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {loadWorkspace,MemoryStorage} from './helpers/workspaceTest.mjs';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

test('workspace sidebar groups workbench sessions, projects and formal tasks', () => {
  const sidebar = readFileSync(path.join(frontendRoot, 'src/workspace/BusinessSidebar.tsx'), 'utf8');
  assert.match(sidebar, /工作台/);
  assert.match(sidebar, /最近会话/);
  assert.match(sidebar, /项目/);
  assert.match(sidebar, /正式任务/);
  assert.match(sidebar, /搜索会话/);
  assert.match(sidebar, /新建项目/);
  assert.match(sidebar, /projectWorkspacePath\(project.id\)/);
  assert.match(sidebar, /business-object-tree/);
  assert.match(sidebar, /物理对象/);
});

test('a generic work session is valid without creating a concrete trial', async () => {
  globalThis.localStorage=new MemoryStorage();
  const {useSessionStore:s,usePhysicalObjectStore:p}=await loadWorkspace("export * from './src/workspace/sessionStore';export * from './src/workspace/physicalObjectStore';");
  const before=structuredClone(p.getState().objects);
  const id=s.getState().createSession({title:'通用绘图'});
  const session=s.getState().sessions.find(item=>item.id===id);
  assert.equal(session.businessScope,undefined);
  assert.ok(session.storageProjectId);
  assert.deepEqual(p.getState().objects,before);
});
