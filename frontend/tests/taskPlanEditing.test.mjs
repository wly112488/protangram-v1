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

const baseTask = {
  id: 'task-1',
  title: '任务',
  projectId: 'project-1',
  status: '进行中',
  planConfirmed: true,
  requirements: [
    { id: 'item-a', text: '分析数据', status: '已满足' },
    { id: 'item-b', text: '校准模型', status: '待完成', dependsOnIds: ['item-a'] },
  ],
};

test('adding or editing a task item reopens plan review without losing other item data', async () => {
  const { addTaskRequirement, updateTaskRequirement } = await loadTypeScriptModule('src/workspace/taskPlanModel.ts');
  const added = addTaskRequirement(baseTask, { id: 'item-c', text: '补充验证', status: '待完成', capability: 'experimentDesign' });
  const edited = updateTaskRequirement(added, 'item-b', { text: '复核模型可信性', capability: 'digitalTwin' });

  assert.equal(added.planConfirmed, false);
  assert.equal(edited.planConfirmed, false);
  assert.equal(edited.requirements[1].text, '复核模型可信性');
  assert.equal(edited.requirements[1].status, '待完成');
  assert.deepEqual(edited.requirements[1].dependsOnIds, ['item-a']);
  assert.equal(baseTask.requirements[1].text, '校准模型');
});

test('changing a satisfied task-item description reopens that item for completion', async () => {
  const { updateTaskRequirement } = await loadTypeScriptModule('src/workspace/taskPlanModel.ts');
  const task = {
    ...baseTask,
    requirements: [{ ...baseTask.requirements[0], artifactRefs: [{ projectId: 'project-1', artifactId: 'artifact-1', addedAt: 'now' }] }],
  };
  const updated = updateTaskRequirement(task, 'item-a', { text: '补充分析并判断风险', capability: 'dataAnalysis' });

  assert.equal(updated.requirements[0].status, '待完成');
  assert.deepEqual(updated.requirements[0].artifactRefs, []);
  assert.equal(task.requirements[0].status, '已满足');
});

test('deleting a task item also removes its dependency references and reopens review', async () => {
  const { removeTaskRequirement } = await loadTypeScriptModule('src/workspace/taskPlanModel.ts');
  const updated = removeTaskRequirement(baseTask, 'item-a');

  assert.equal(updated.planConfirmed, false);
  assert.deepEqual(updated.requirements.map((item) => item.id), ['item-b']);
  assert.deepEqual(updated.requirements[0].dependsOnIds, []);
  assert.equal(baseTask.requirements.length, 2);
});

test('top-level module navigation keeps the task but does not inherit a focused task item', async () => {
  const { createTopLevelNavigationSession } = await loadTypeScriptModule('src/workspace/businessSessionModel.ts');
  const session = createTopLevelNavigationSession({
    mode: 'task', taskId: 'task-1', targetProjectId: 'project-1', taskItemId: 'item-a',
  });

  assert.deepEqual(session, { mode: 'task', taskId: 'task-1', targetProjectId: 'project-1' });
});

test('task-linked project overview identifies project analysis as separate from task-item execution', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/workspace/ProjectOverview.tsx'), 'utf8');

  assert.match(source, /独立于任务事项/);
  assert.match(source, /结果仅保存到项目/);
  assert.match(source, /关联到任务事项/);
});

test('task plan exposes add, edit, and remove controls for human review', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/workspace/TaskWorkbench.tsx'), 'utf8');

  assert.match(source, /补充任务事项/);
  assert.match(source, /编辑事项/);
  assert.match(source, /删除事项/);
});
