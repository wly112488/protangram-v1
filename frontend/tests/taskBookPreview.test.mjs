import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const frontendRoot = fileURLToPath(new URL('..', import.meta.url));

const loadTypeScriptModule = async (relativePath) => {
  const source = readFileSync(path.join(frontendRoot, relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
};

test('task-book references resolve a single page or an inclusive page range', async () => {
  const { parseTaskBookPageRange } = await loadTypeScriptModule('src/workspace/taskBookPreviewModel.ts');

  assert.deepEqual(parseTaskBookPageRange('第 2 页 · 工作目标第 1 条'), { startPage: 2, endPage: 2 });
  assert.deepEqual(parseTaskBookPageRange('第 3 页到第 5 页 · 交付要求'), { startPage: 3, endPage: 5 });
  assert.deepEqual(parseTaskBookPageRange('第4页至6页'), { startPage: 4, endPage: 6 });
  assert.equal(parseTaskBookPageRange('工作目标第 1 条'), null);
});

test('task workbench opens the cited original PDF in a right-side viewer', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/workspace/TaskWorkbench.tsx'), 'utf8');

  assert.match(source, /任务书原文/);
  assert.match(source, /<Drawer[\s\S]*placement="right"/);
  assert.match(source, /<iframe[\s\S]*sourcePdfUrl/);
  assert.match(source, /模拟定位/);
});

test('task creation persists the selected PDF so it can be reopened later', () => {
  const centerSource = readFileSync(path.join(frontendRoot, 'src/workspace/TaskCenter.tsx'), 'utf8');
  const storageSource = readFileSync(path.join(frontendRoot, 'src/workspace/taskBookStorage.ts'), 'utf8');

  assert.match(centerSource, /saveTaskBookFile\(taskId, taskBookFile\)/);
  assert.match(storageSource, /indexedDB\.open/);
  assert.match(storageSource, /loadTaskBookFile/);
});
