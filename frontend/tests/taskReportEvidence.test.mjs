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

test('manual task-item satisfaction requires a note or linked artifact and keeps evidence when reopened', async () => {
  const { satisfyTaskRequirement, reopenTaskRequirement } = await loadTypeScriptModule('src/workspace/taskPlanModel.ts');
  const task = {
    id: 'task-1', title: '任务', projectId: 'project-1', status: '进行中',
    requirements: [{ id: 'item-1', text: '确认已有资料覆盖要求', status: '待完成' }],
  };

  assert.equal(satisfyTaskRequirement(task, 'item-1', '').requirements[0].status, '待完成');
  const satisfied = satisfyTaskRequirement(task, 'item-1', '已核对 2026 年试验记录，覆盖目标工况');
  assert.equal(satisfied.requirements[0].status, '已满足');
  assert.equal(satisfied.requirements[0].satisfactionNote, '已核对 2026 年试验记录，覆盖目标工况');

  const withArtifact = {
    ...task,
    requirements: [{ ...task.requirements[0], artifactRefs: [{ projectId: 'project-1', artifactId: 'artifact-1', addedAt: 'now' }] }],
  };
  assert.equal(satisfyTaskRequirement(withArtifact, 'item-1', '').requirements[0].status, '已满足');
  const reopened = reopenTaskRequirement(satisfied, 'item-1');
  assert.equal(reopened.requirements[0].status, '待完成');
  assert.equal(reopened.requirements[0].satisfactionNote, undefined);
  assert.equal(task.requirements[0].status, '待完成');
});

test('editing requirement text clears its prior satisfaction evidence', async () => {
  const { updateTaskRequirement } = await loadTypeScriptModule('src/workspace/taskPlanModel.ts');
  const task = {
    id: 'task-1', title: '任务', projectId: 'project-1', status: '进行中', planConfirmed: true,
    requirements: [{ id: 'item-1', text: '旧要求', status: '已满足', satisfactionNote: '依据说明' }],
  };
  const updated = updateTaskRequirement(task, 'item-1', { text: '新要求', capability: undefined });
  assert.equal(updated.requirements[0].status, '待完成');
  assert.equal(updated.requirements[0].satisfactionNote, undefined);
});

test('task report project selection is restricted to the associated project', async () => {
  const { resolveTaskReportProjectId } = await loadTypeScriptModule('src/pages/report/taskReportModel.ts');
  assert.equal(resolveTaskReportProjectId({ projectId: 'project-1' }, ['project-1', 'project-2']), 'project-1');
  assert.equal(resolveTaskReportProjectId({ projectId: 'missing' }, ['project-1', 'project-2']), null);
});

test('report warning counts unfinished task items but excludes the report item being generated', async () => {
  const { countUnmetTaskItems } = await loadTypeScriptModule('src/pages/report/taskReportModel.ts');
  const requirements = [
    { id: 'analysis', status: '待完成' },
    { id: 'report', status: '待完成' },
    { id: 'done', status: '已满足' },
  ];
  assert.equal(countUnmetTaskItems(requirements, 'report'), 1);
  assert.equal(countUnmetTaskItems(requirements), 2);
});

test('task report and final report controls distinguish drafting, generation, and task completion', () => {
  const createSource = readFileSync(path.join(frontendRoot, 'src/pages/report/ReportCreate.tsx'), 'utf8');
  const generateSource = readFileSync(path.join(frontendRoot, 'src/pages/report/ReportGenerate.tsx'), 'utf8');
  const workbenchSource = readFileSync(path.join(frontendRoot, 'src/workspace/TaskWorkbench.tsx'), 'utf8');
  assert.match(createSource, /任务报告配置/);
  assert.match(generateSource, /仍有任务事项未满足/);
  assert.match(generateSource, /不会自动标记任务完成/);
  assert.match(workbenchSource, /报告草稿/);
  assert.doesNotMatch(workbenchSource, /现有资料已满足此事项<\/Checkbox>/);
});

test('task workbench uses explicit evidence confirmation and separates taskbook source from the plan', () => {
  const source = readFileSync(path.join(frontendRoot, 'src/workspace/TaskWorkbench.tsx'), 'utf8');
  assert.match(source, /确认事项已满足/);
  assert.match(source, /满足依据/);
  assert.match(source, /任务书原文/);
  assert.match(source, /打开原始任务书 PDF/);
});
