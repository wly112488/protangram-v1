import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';
import { build } from 'esbuild';

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

test('task PDF roundtrips through the real file API contract and rejects a failed database upload', async () => {
  const bundle = await build({ entryPoints: [path.join(frontendRoot, 'src/workspace/taskBookStorage.ts')], bundle: true, write: false, platform: 'node', format: 'esm' });
  const { saveTaskBookFile, loadTaskBookFile } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
  const originalFetch = globalThis.fetch;
  let stored;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, '/api/workspace/files/taskbook-task-1');
    if (options?.method === 'POST') {
      assert.equal(options.body.get('taskId'), 'task-1');
      stored = options.body.get('file');
      return Response.json({ success: true, data: { id: 'taskbook-task-1' } });
    }
    return stored ? new Response(stored, { headers: { 'Content-Type': 'application/pdf', 'X-Workspace-File-Revision': '1' } }) : new Response(null, { status: 404 });
  };
  try {
    await saveTaskBookFile('task-1', new File(['%PDF-1.7 exact bytes'], '任务书.pdf', { type: 'application/pdf' }));
    assert.equal(await (await loadTaskBookFile('task-1')).text(), '%PDF-1.7 exact bytes');
    globalThis.fetch = async () => Response.json({ success: false, error: 'database unavailable' }, { status: 503 });
    await assert.rejects(saveTaskBookFile('task-1', new Blob(['pdf'])), /无法确认原任务书附件版本/);
  } finally { globalThis.fetch = originalFetch; }
});
