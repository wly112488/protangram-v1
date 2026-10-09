import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
const bundle = await build({
  stdin: { contents: "export { useSessionStore } from './src/workspace/sessionStore'; export { useProjectStore } from './src/workspace/projectStore'; export { useTaskStore } from './src/workspace/taskStore'; export * from './src/workspace/sessionModel'; export * from './src/workspace/businessSessionModel'; export * from './src/workspace/taskArtifactAssociation'; export * from './src/workspace/sessionSidebarModel';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { useSessionStore: sessions, useProjectStore: projects } = api;

test('sidebar keeps formal-task projects and their task sessions under the task entry', () => {
  const task = { id: 'task-1', title: '正式验证', projectId: 'task-project', status: '进行中' };
  const taskProject = { id: 'task-project' };
  const ordinaryProject = { id: 'ordinary-project' };
  const taskSession = { id: 'task-session', taskId: task.id, projectId: task.projectId, capability: 'task', title: task.title, updatedAt: '2026-01-02', archived: false };
  const capabilitySession = { ...taskSession, id: 'task-capability-session', capability: 'analysis', title: '数据分析会话' };
  const content = api.getSessionSidebarContent([taskProject, ordinaryProject], [taskSession, capabilitySession], [task], '', false);

  assert.deepEqual(content.visibleProjects.map(project => project.id), ['ordinary-project']);
  assert.deepEqual(content.independentSessions, []);
  assert.equal(api.getTaskNavigationSession([taskSession, capabilitySession], task.id).id, capabilitySession.id);
});

test('sidebar task entries respect search and the archive view', () => {
  const active = { id: 'task-active', title: '风扇验证', projectId: 'p1', status: '进行中' };
  const archived = { id: 'task-archived', title: '泵体验证', projectId: 'p2', status: '已归档' };
  const activeContent = api.getSessionSidebarContent([], [], [active, archived], '风扇', false);
  const archivedContent = api.getSessionSidebarContent([], [], [active, archived], '', true);

  assert.deepEqual(activeContent.visibleTasks.map(task => task.id), ['task-active']);
  assert.deepEqual(archivedContent.visibleTasks.map(task => task.id), ['task-archived']);
});

test('workbench recent activity omits the formal-task shell session', () => {
  const taskShell = { id: 'task-shell', taskId: 'task-1', capability: 'task', title: '正式任务', updatedAt: '2026-01-03', archived: false };
  const taskAnalysis = { ...taskShell, id: 'task-analysis', capability: 'analysis', title: '任务数据分析' };
  const independent = { ...taskShell, id: 'independent', taskId: undefined, capability: 'overview', title: '独立研究' };

  assert.deepEqual(api.getRecentSessionsForHome([taskShell, taskAnalysis, independent]).map(session => session.id), ['task-analysis', 'independent']);
});

test('independent sessions own separate artifact spaces without changing active organizational project', () => {
  const group = projects.getState().createProject({ name: '研究项目' });
  const a = sessions.getState().createSession({ title: '独立分析 A' });
  const b = sessions.getState().createSession({ title: '独立分析 B' });
  const contextA = sessions.getState().getWorkspaceSession(a);
  const contextB = sessions.getState().getWorkspaceSession(b);
  assert.notEqual(contextA.targetProjectId, contextB.targetProjectId);
  assert.equal(contextA.sessionId, a);
  assert.equal(sessions.getState().sessions.find(s => s.id === a).projectId, undefined);
  assert.equal(projects.getState().activeProjectId, group);
  assert.equal(projects.getState().projects.find(p => p.id === contextA.targetProjectId).sessionOwnerId, a);
});

test('drafts remain separated by session and capability and restore after rehydration', async () => {
  const a = sessions.getState().createSession({ title: 'A' });
  const b = sessions.getState().createSession({ title: 'B' });
  sessions.getState().updateDraft(a, 'analysis', 'config', { metrics: ['温度'] });
  sessions.getState().updateDraft(b, 'analysis', 'config', { metrics: ['压力'] });
  sessions.getState().updateDraft(a, 'doe', 'config', { runs: 12 });
  const snapshot = new Map(memory);
  sessions.setState({ sessions: [] });
  memory.clear();
  snapshot.forEach((value, key) => memory.set(key, value));
  sessions.getState().reloadFromStorage();
  assert.deepEqual(sessions.getState().sessions.find(s => s.id === a).drafts.analysis.config, { metrics: ['温度'] });
  assert.deepEqual(sessions.getState().sessions.find(s => s.id === b).drafts.analysis.config, { metrics: ['压力'] });
  assert.deepEqual(sessions.getState().sessions.find(s => s.id === a).drafts.doe.config, { runs: 12 });
});

test('moving sessions into a project preserves draft and artifact ownership', () => {
  const group = projects.getState().createProject({ name: '同一个项目' });
  const a = sessions.getState().createSession({ title: '校准' });
  const b = sessions.getState().createSession({ title: '分析' });
  const backing = sessions.getState().getWorkspaceSession(a).targetProjectId;
  sessions.getState().updateDraft(a, 'digitalTwin', 'params', { speed: 7800 });
  sessions.getState().moveSession(a, group);
  sessions.getState().moveSession(b, group);
  assert.equal(sessions.getState().getWorkspaceSession(a).targetProjectId, backing);
  assert.equal(sessions.getState().sessions.filter(s => s.projectId === group).length, 2);
  assert.deepEqual(sessions.getState().sessions.find(s => s.id === a).drafts.digitalTwin.params, { speed: 7800 });
});

test('formal task sessions reuse existing task artifacts and are idempotent', () => {
  const projectId = projects.getState().createProject({ name: '正式任务数据' });
  const a = sessions.getState().ensureTaskSession({ id: 'task-test', title: '任务', projectId });
  const b = sessions.getState().ensureTaskSession({ id: 'task-test', title: '任务', projectId });
  assert.equal(a, b);
  assert.deepEqual(sessions.getState().getWorkspaceSession(a), { mode: 'task', taskId: 'task-test', targetProjectId: projectId, sessionId: a });
});

test('continuing an existing project reuses its artifact space without replacing it', () => {
  const projectId = projects.getState().createProject({ name: '已有报告项目' });
  projects.getState().addArtifact(projectId, { type: 'analysisResult', title: '原有分析', source: 'dataAnalysis', summary: '报告来源', payload: {} });
  sessions.getState().createSession({ title: '另一项工作' });
  const id = sessions.getState().ensureProjectSession(projectId);
  assert.equal(sessions.getState().getWorkspaceSession(id).targetProjectId, projectId);
  assert.equal(sessions.getState().ensureProjectSession(projectId), id);
  assert.equal(projects.getState().projects.find(project => project.id === projectId).artifacts.length, 1);
});

test('session navigation preserves all legacy task item context', () => {
  assert.equal(api.getSessionPath('s 1', 'digitalTwin'), '/sessions/s%201/digital-twin');
  assert.equal(api.getSessionResourcesPath?.('s 1'), '/sessions/s%201/resources');
  assert.equal(api.getCapabilityFromPath('/sessions/s-1/virtual-condition'), 'virtualCondition');
  assert.equal(api.getLegacySessionPath('/report/generate/r-1', 's-1'), '/sessions/s-1/report/generate/r-1');
  const input = { mode: 'task', taskId: 't', targetProjectId: 'p', taskItemId: 'i', professionalProjectId: 'work', sessionId: 's' };
  assert.equal(api.normalizeBusinessSession(input, ['p'], { t: 'p' }, { t: ['i'] }, { t: ['work'] }).sessionId, 's');
  assert.equal(api.createTopLevelNavigationSession(input).sessionId, 's');
  assert.match(api.createTaskContextSearch(input), /sessionId=s/);
});

test('storage failure is surfaced instead of reporting saved', () => {
  const original = localStorage.setItem;
  localStorage.setItem = () => { throw new Error('quota exceeded'); };
  const id = sessions.getState().createSession({ title: '存储失败' });
  assert.ok(sessions.getState().saveError);
  assert.ok(sessions.getState().sessions.some(s => s.id === id));
  localStorage.setItem = original;
  sessions.getState().renameSession(id, '重试保存');
  assert.equal(sessions.getState().saveError, null);
});

test('opening capability tabs retains useful inputs but clears focused execution', () => {
  const context = { mode: 'task', taskId: 't', targetProjectId: 'p', sessionId: 's' };
  const saved = { source: 'dataAnalysis', autoExecute: true, data: { dataName: 'input.csv' }, workspaceSession: { ...context, taskItemId: 'item' } };
  const result = api.resolveSessionHandoff(context, saved, { workspaceSession: context });
  assert.equal(result.autoExecute, false);
  assert.equal(result.workspaceSession.taskItemId, undefined);
  assert.equal(result.data.dataName, 'input.csv');
  assert.equal(api.resolveSessionHandoff(context, saved, saved).workspaceSession.taskItemId, 'item');
  assert.notEqual(api.getSessionDraftKey('config', { ...context, taskItemId: 'first' }), api.getSessionDraftKey('config', { ...context, taskItemId: 'second' }));
});

test('explicit cross-capability handoff resets destination draft and keeps other work', () => {
  const id = sessions.getState().createSession();
  sessions.getState().updateDraft(id, 'doe', 'config', { maxRuns: 12 });
  sessions.getState().updateDraft(id, 'doe', 'generated', true);
  sessions.getState().updateDraft(id, 'doe', 'assistantHistory', { conversation: ['保留对话'] });
  sessions.getState().updateDraft(id, 'analysis', 'config', { metrics: ['压力'] });
  sessions.getState().setHandoff(id, 'doe', { source: 'dataAnalysis', validation: { recommendedRuns: 5 } }, true);
  const current = sessions.getState().sessions.find(s => s.id === id);
  assert.equal(current.drafts.doe.config, undefined);
  assert.equal(current.drafts.doe.generated, undefined);
  assert.deepEqual(current.drafts.doe.assistantHistory, { conversation: ['保留对话'] });
  assert.deepEqual(current.drafts.analysis.config, { metrics: ['压力'] });
});

test('deleting a session removes its persisted conversation but preserves referenced artifact space', () => {
  const id = sessions.getState().createSession({ title: '删除会话' });
  const backing = sessions.getState().getWorkspaceSession(id).targetProjectId;
  sessions.getState().deleteSession(id);
  sessions.getState().reloadFromStorage();
  assert.equal(sessions.getState().sessions.some(session => session.id === id), false);
  assert.equal(sessions.getState().activeSessionId, null);
  assert.ok(projects.getState().projects.some(project => project.id === backing));
});

test('project rename and archive preserve nested sessions and restore original project status', () => {
  const projectId = projects.getState().createProject({ name: '研究分组', status: '已完成' });
  const id = sessions.getState().createSession({ projectId });
  projects.getState().renameProject(projectId, '重命名分组');
  projects.getState().archiveProject(projectId, true);
  assert.equal(projects.getState().projects.find(project => project.id === projectId).archived, true);
  assert.equal(sessions.getState().sessions.find(session => session.id === id).archived, false);
  projects.getState().archiveProject(projectId, false);
  const restored = projects.getState().projects.find(project => project.id === projectId);
  assert.equal(restored.name, '重命名分组');
  assert.equal(restored.status, '已完成');
});

test('deleting a project group removes its sessions and preserves unrelated sessions', () => {
  const projectId = projects.getState().createProject({ name: '待删除分组' });
  const nested = sessions.getState().createSession({ projectId });
  const independent = sessions.getState().createSession();
  sessions.getState().deleteProjectGroup(projectId);
  assert.equal(projects.getState().projects.some(project => project.id === projectId), false);
  assert.equal(sessions.getState().sessions.some(session => session.id === nested), false);
  assert.ok(sessions.getState().sessions.some(session => session.id === independent));
});

test('project deletion cannot remove the artifact space still used by a session in another group', () => {
  const projectId = projects.getState().createProject({ name: '原有成果空间' });
  const other = projects.getState().createProject({ name: '另一个分组' });
  const id = sessions.getState().ensureProjectSession(projectId);
  sessions.getState().moveSession(id, other);
  assert.equal(sessions.getState().deleteProjectGroup(projectId), false);
  assert.ok(projects.getState().projects.some(project => project.id === projectId));
  assert.equal(sessions.getState().getWorkspaceSession(id).targetProjectId, projectId);
});

test('project deletion protects formal task ownership and cross-project evidence references', () => {
  const owner = projects.getState().createProject({ name: '正式任务项目' });
  const source = projects.getState().createProject({ name: '跨项目证据' });
  const tasks = api.useTaskStore;
  const taskId = tasks.getState().createDemoTask({ projectId: owner });
  assert.equal(sessions.getState().deleteProjectGroup(owner), false);
  const task = tasks.getState().tasks.find(item => item.id === taskId);
  const ref = { projectId: source, artifactId: 'source-artifact', addedAt: new Date().toISOString() };
  const evidenceCases = [
    { ...task, artifactRefs: [ref] },
    { ...task, requirements: [{ ...task.requirements[0], artifactRefs: [ref] }] },
    { ...task, reportDraft: { ...task.reportDraft, sections: [{ id: 'section', artifactRefs: [ref] }] } },
    { ...task, professionalProjects: [{ id: 'professional', artifactRefs: [ref] }] },
    { ...task, reportDraft: { ...task.reportDraft, formalReportArtifact: ref } },
  ];
  for (const referenced of evidenceCases) {
    tasks.setState({ tasks: [referenced] });
    assert.equal(sessions.getState().deleteProjectGroup(source), false);
    assert.ok(projects.getState().projects.some(project => project.id === source));
  }
});

test('free task work preserves overall scope unless an item is explicitly selected', () => {
  const projectId = projects.getState().createProject({ name: '事项关联' });
  const tasks = api.useTaskStore;
  const taskId = tasks.getState().createDemoTask({ projectId });
  const task = tasks.getState().tasks.find(item => item.id === taskId);
  const session = { mode: 'task', taskId, targetProjectId: projectId };
  const reference = { projectId, artifactId: 'task-overall' };
  assert.equal(api.recordTaskBusinessArtifact(session, reference), 'task');
  assert.equal(tasks.getState().tasks.find(item => item.id === taskId).requirements[0].artifactRefs?.length ?? 0, 0);
  const focusedRef = { projectId, artifactId: 'selected-item' };
  api.recordTaskBusinessArtifact(session, focusedRef, task.requirements[0].id);
  const updated = tasks.getState().tasks.find(item => item.id === taskId).requirements[0];
  assert.equal(updated.status, '待确认');
  assert.ok(updated.artifactRefs.some(item => item.artifactId === focusedRef.artifactId));
  assert.notEqual(tasks.getState().tasks.find(item => item.id === taskId).status, '已完成');
});

test('focused task entry wins over free association and preserves satisfied evidence', () => {
  const tasks = api.useTaskStore;
  const projectId = projects.getState().createProject({ name: '指定事项' });
  const taskId = tasks.getState().createDemoTask({ projectId });
  const task = tasks.getState().tasks.find(item => item.id === taskId);
  tasks.getState().setRequirementStatus(taskId, task.requirements[0].id, '已满足');
  api.recordTaskBusinessArtifact({ mode: 'task', taskId, targetProjectId: projectId, taskItemId: task.requirements[0].id }, { projectId, artifactId: 'focused' }, task.requirements[1].id);
  const updated = tasks.getState().tasks.find(item => item.id === taskId);
  assert.equal(updated.requirements[0].status, '已满足');
  assert.ok(updated.requirements[0].artifactRefs.some(item => item.artifactId === 'focused'));
  assert.equal(updated.requirements[1].artifactRefs?.length ?? 0, 0);
});
