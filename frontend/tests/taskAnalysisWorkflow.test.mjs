import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { build } from 'esbuild';
const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const bundle = await build({ stdin: { contents: "export * from './src/workspace/taskAnalysisModel'; export * from './src/workspace/taskTrialWorkflow'; export { usePhysicalObjectStore } from './src/workspace/physicalObjectStore'; export { useProjectStore } from './src/workspace/projectStore'; export { useSessionStore } from './src/workspace/sessionStore'; export { useTaskStore } from './src/workspace/taskStore'; export * from './src/workspace/sessionSidebarModel';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { usePhysicalObjectStore: physical, useProjectStore: projects, useTaskStore: tasks, useSessionStore: sessions } = api;
beforeEach(() => { memory.clear(); physical.setState({ objects: [] }); projects.setState({ projects: [], activeProjectId: null }); tasks.setState({ tasks: [] }); sessions.setState({ sessions: [], activeSessionId: null, saveError: null }); });
function fixture() {
  const p = physical.getState(), category = p.addRoot({ name: '风扇类别', type: '风扇' });
  const object = p.addConfiguration(category, { name: '风扇甲' });
  const config = p.addExperiment(object, { name: '构型甲', parameters: [] });
  return { category, object, config };
}
test('analysis pre-fills explicit source values and uniquely matches existing objects without creating business records', () => {
  const f = fixture();
  const preview = api.createTaskAnalysisPreview('验证任务书.txt', '试验名称：静推力试验\n物理对象：风扇甲\n试验构型：构型甲\n载荷谱：LS-01', physical.getState().objects);
  assert.equal(preview.trialDrafts[0].name, '静推力试验');
  assert.equal(preview.trialDrafts[0].physicalObjectId, f.object);
  assert.equal(preview.trialDrafts[0].experimentId, f.config);
  assert.equal(preview.trialDrafts[0].loadSpectrum, 'LS-01');
  assert.equal(preview.requirements.length, 5);
  assert.equal(sessions.getState().sessions.length, 0);
  assert.equal(physical.getState().objects[0].configurations[0].experiments[0].trials.length, 0);
});
test('unknown object, configuration and load spectrum stay empty instead of inventing values', () => {
  fixture();
  const preview = api.createTaskAnalysisPreview('未知任务书.pdf', '', physical.getState().objects);
  assert.equal(preview.trialDrafts[0].physicalObjectId, undefined);
  assert.equal(preview.trialDrafts[0].experimentId, undefined);
  assert.equal(preview.trialDrafts[0].loadSpectrum, '');
});

test('ambiguous matches stay unresolved rather than choosing the first physical object', () => {
  const f = fixture();
  physical.getState().addConfiguration(f.category, { name: '风扇乙' });
  const preview = api.createTaskAnalysisPreview('任务书.txt', '风扇甲、风扇乙', physical.getState().objects);
  assert.equal(preview.trialDrafts[0].physicalObjectId, undefined);
});
test('confirmed task trials are idempotent, hidden while working, and published only after valid completion', () => {
  const f = fixture();
  const preview = api.createTaskAnalysisPreview('任务书.txt', '试验名称：静推力试验\n风扇甲 构型甲\n载荷谱：LS-01', physical.getState().objects);
  const taskId = tasks.getState().createTask({ title: preview.title, projectId: '', requirementTexts: [] });
  tasks.getState().setAnalysisPlan(taskId, preview.requirements, preview.trialDrafts);
  const draft = preview.trialDrafts[0];
  const values = { name: draft.name, loadSpectrum: draft.loadSpectrum, physicalObjectId: f.object, experimentId: f.config };
  const id = api.confirmTaskTrialDraft(taskId, draft.id, values);
  assert.equal(api.confirmTaskTrialDraft(taskId, draft.id, values), id);
  assert.equal(sessions.getState().sessions.length, 1);
  assert.equal(sessions.getState().sessions[0].projectId, undefined);
  assert.deepEqual(api.getRecentSessionsForHome(sessions.getState().sessions), []);
  const req = preview.requirements[0];
  assert.throws(() => api.completeTaskRequirement(taskId, req.id, ''), /完成依据/);
  assert.deepEqual(api.getRecentSessionsForHome(sessions.getState().sessions), []);
  api.completeTaskRequirement(taskId, req.id, '已复核分析结论');
  assert.equal(api.getRecentSessionsForHome(sessions.getState().sessions)[0].id, id);
  assert.equal(tasks.getState().tasks[0].requirements[0].status, '已满足');
  assert.equal(api.getTaskProgress(tasks.getState().tasks[0]).completed, 1);
  assert.equal(physical.getState().objects[0].configurations[0].experiments[0].trials.length, 1);
  physical.getState().updateConcreteTrial(sessions.getState().sessions[0].businessScope.trialId, { taskBookId: 'other-task' });
  assert.throws(() => api.completeTaskRequirement(taskId, preview.requirements[1].id, '不能使用其他任务的试验'), /关联已变化/);
});

test('missing required template data does not create a trial or session', () => {
  const f = fixture();
  const preview = api.createTaskAnalysisPreview('任务书.pdf', '', physical.getState().objects);
  const taskId = tasks.getState().createTask({ title: preview.title, projectId: '', requirementTexts: [] });
  tasks.getState().setAnalysisPlan(taskId, preview.requirements, preview.trialDrafts);
  assert.throws(() => api.confirmTaskTrialDraft(taskId, preview.trialDrafts[0].id, { name: '试验', loadSpectrum: ' ', physicalObjectId: f.object, experimentId: f.config }), /载荷谱/);
  assert.equal(sessions.getState().sessions.length, 0);
  assert.equal(physical.getState().objects[0].configurations[0].experiments[0].trials.length, 0);
});
