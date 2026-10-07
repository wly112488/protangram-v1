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

test('mock AI completes empty report sections from linked task artifacts and preserves authored text', async () => {
  const { createMockAiTaskReport } = await loadTypeScriptModule('src/workspace/taskReportAiModel.ts');
  const task = {
    id: 'task-1', title: '高转速分析', sourceName: '任务书.pdf', projectId: 'project-1', status: '进行中',
    requirements: [{ id: 'item-1', text: '识别高转速异常', status: '已满足', artifactRefs: [{ projectId: 'project-1', artifactId: 'artifact-1', addedAt: 'now' }] }],
    reportDraft: { status: 'draft', updatedAt: 'now', sections: [
      { id: 'task-background', title: '任务背景与目标', body: '用户已写的背景', artifactRefs: [] },
      { id: 'task-analysis', title: '分析过程与结果', body: '', artifactRefs: [] },
      { id: 'task-conclusion', title: '结论与建议', body: '', artifactRefs: [] },
    ] },
  };
  const result = createMockAiTaskReport(task, [{
    projectId: 'project-1', artifactId: 'artifact-1', title: '高转速异常分析', source: '试验数据分析', summary: '发现温度异常区间',
  }], '2026-10-07T00:00:00.000Z');

  assert.equal(result.sections[0].body, '用户已写的背景');
  assert.match(result.sections[1].body, /发现温度异常区间/);
  assert.deepEqual(result.sections[1].artifactRefs.map((item) => item.artifactId), ['artifact-1']);
  const json = JSON.parse(result.structuredJson);
  assert.equal(json.task.id, 'task-1');
  assert.equal(json.sources[0].artifactId, 'artifact-1');
  assert.equal(json.sections[0].content, '用户已写的背景');
  assert.equal(result.aiCompletedAt, '2026-10-07T00:00:00.000Z');
});

test('task report workflow stays in TaskWorkbench and does not navigate to legacy report generation', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/workspace/TaskWorkbench.tsx'), 'utf8');
  assert.match(source, /AI根据成果补全报告/);
  assert.match(source, /结构化 JSON/);
  assert.doesNotMatch(source, /navigate\(`\/report\/create\?taskId=/);
});
