import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { build } from 'esbuild';

const memory = new Map();
globalThis.localStorage = {
  getItem: (key) => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage };
const bundle = await build({
  stdin: { contents: "export { useSessionStore } from './src/workspace/sessionStore'; export { useProjectStore } from './src/workspace/projectStore'; export { useTaskStore } from './src/workspace/taskStore'; export * from './src/workspace/sessionModel'; export * from './src/workspace/businessSessionModel'; export * from './src/workspace/taskArtifactAssociation'; export * from './src/workspace/sessionSidebarModel'; export * from './src/workspace/experimentTemplateModel'; export * from './src/workspace/projectTrialModel';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const { useSessionStore: sessions, useProjectStore: projects } = api;

test('a task association keeps the organizational project visible without duplicating its task sessions', () => {
  const task = { id: 'task-1', title: '正式验证', projectId: 'task-project', status: '进行中' };
  const taskProject = { id: 'task-project' };
  const ordinaryProject = { id: 'ordinary-project' };
  const taskSession = { id: 'task-session', taskId: task.id, projectId: task.projectId, capability: 'task', title: task.title, updatedAt: '2026-01-02', archived: false };
  const capabilitySession = { ...taskSession, id: 'task-capability-session', capability: 'analysis', title: '数据分析会话' };
  const content = api.getSessionSidebarContent([taskProject, ordinaryProject], [taskSession, capabilitySession], [task], '', false);

  assert.deepEqual(content.visibleProjects.map(project => project.id), ['task-project', 'ordinary-project']);
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

test('session navigation follows creation source rather than a later project association', () => {
  const taskShell = { id: 'task-shell', taskId: 'task-1', capability: 'task', title: '正式任务', updatedAt: '2026-01-03', archived: false };
  const taskAnalysis = { ...taskShell, id: 'task-analysis', capability: 'analysis', title: '任务数据分析' };
  const projectSession = { id: 'project-session', projectId: 'project-1', creationSource: 'project', capability: 'analysis', title: '项目会话', updatedAt: '2026-01-04', archived: false };
  const standalone = { id: 'standalone', projectId: 'project-1', creationSource: 'standalone', capability: 'analysis', title: '独立会话后来关联项目', updatedAt: '2026-01-05', archived: false };

  const sessions = [taskShell, taskAnalysis, projectSession, standalone];
  const content = api.getSessionSidebarContent([{ id: 'project-1', name: '项目一' }], sessions, [], '', false);
  assert.deepEqual(api.getRecentSessionsForHome(sessions).map(session => session.id), ['standalone']);
  assert.deepEqual(content.independentSessions.map(session => session.id), ['standalone']);

  const created = api.useSessionStore.getState().createSession({ title: '先独立创建' });
  api.useSessionStore.getState().moveSession(created, 'project-1');
  const moved = api.useSessionStore.getState().sessions.find(session => session.id === created);
  assert.equal(moved.creationSource, 'standalone');
  assert.ok(api.getRecentSessionsForHome([moved]).some(session => session.id === created));
  const projectCreated = api.useSessionStore.getState().ensureProjectSession('project-2');
  assert.equal(api.useSessionStore.getState().sessions.find(session => session.id === projectCreated).creationSource, 'project');
});

test('session entry skips the redundant overview and opens the proper workbench', () => {
  assert.equal(api.getSessionEntryPath({ id: 'new-session' }), '/sessions/new-session');
  assert.equal(api.getSessionEntryPath({ id: 'trial-session', businessScope: { trialId: 'trial-1' } }), '/sessions/trial-session/doe');
  assert.equal(api.getSessionEntryPath({ id: 'task-session', taskId: 'task / 1' }), '/sessions/task-session/tasks/task%20%2F%201');
});

test('a legacy session without a concrete trial retains access to its saved resources', () => {
  const id = sessions.getState().createSession({ title: '全新实验' });
  const created = sessions.getState().sessions.find(session => session.id === id);

  assert.equal(api.getSessionEntryPath(created), `/sessions/${created.id}`);
  assert.equal(created.drafts.doe, undefined);
  assert.notEqual(created.storageProjectId, created.projectId);
});

test('project and task sessions carry the concrete trial source created in context', () => {
  projects.getState().createProject({ id: 'task-project', name: '任务项目' });
  const task = { id: 'task-context', title: '任务上下文试验', projectId: 'task-project' };
  const scope = { physicalObjectId: 'fan-1', experimentId: 'setup-1', trialId: 'trial-1', taskBookId: task.id };
  const taskSessionId = sessions.getState().ensureTaskSession(task, scope);
  const taskSession = sessions.getState().sessions.find(item => item.id === taskSessionId);
  assert.equal(taskSession.taskId, task.id);
  assert.equal(taskSession.storageProjectId, task.projectId);
  assert.deepEqual(taskSession.businessScope, scope);

  const projectSessionId = sessions.getState().ensureProjectSession('project-1', { ...scope, taskBookId: undefined });
  const projectSession = sessions.getState().sessions.find(item => item.id === projectSessionId);
  assert.equal(projectSession.storageProjectId, 'project-1');
  assert.deepEqual(projectSession.businessScope, { ...scope, taskBookId: undefined });
});

test('template experiment creation clones its starting DOE draft into a separate session', () => {
  const template = {
    id: 'doe-template-source',
    name: '高温转速试验',
    designMethod: '创建两水平因子设计',
    factorCount: 1,
    factors: ['转速'],
    responses: ['推力'],
    factorSettings: [{ name: '转速', type: '连续', lowLevel: '6000', highLevel: '8000', levels: ['6000', '8000'] }],
  };
  const initialDrafts = { doe: { startingTemplate: template } };
  const firstId = sessions.getState().createSession({ title: '高温转速试验副本 A', initialDrafts });
  const secondId = sessions.getState().createSession({ title: '高温转速试验副本 B', initialDrafts });
  const first = sessions.getState().sessions.find(session => session.id === firstId);
  const second = sessions.getState().sessions.find(session => session.id === secondId);

  assert.deepEqual(first.drafts.doe?.startingTemplate, template);
  assert.notEqual(first.storageProjectId, second.storageProjectId);
  template.factorSettings[0].levels[0] = '9000';
  assert.equal(first.drafts.doe?.startingTemplate?.factorSettings[0].levels[0], '6000');
  sessions.getState().updateDraft(firstId, 'doe', 'startingTemplate', { ...first.drafts.doe?.startingTemplate, name: '副本 A 修改' });
  assert.equal(sessions.getState().sessions.find(session => session.id === secondId).drafts.doe?.startingTemplate?.name, '高温转速试验');
});

test('DOE template loading preserves legacy templates and carries saved configuration into a detached draft', () => {
  const legacyTemplate = {
    id: 'legacy-doe-template',
    name: '旧模板',
    designMethod: '创建两水平因子设计',
    factorCount: 1,
    factors: ['转速'],
    responses: ['推力'],
  };
  const fullTemplate = {
    ...legacyTemplate,
    id: 'configured-doe-template',
    name: '完整模板',
    factorSettings: [{ name: '转速', type: '连续', lowLevel: '6000', highLevel: '8000', levels: ['6000', '8000'] }],
    levelCount: 2,
    replicateCount: 4,
  };
  localStorage.setItem(api.DOE_TEMPLATE_STORAGE_KEY, JSON.stringify([legacyTemplate, fullTemplate, null]));

  const loaded = api.loadDoeTemplates();
  const draft = api.createDoeTemplateSessionDraft(loaded[1]);

  assert.equal(loaded.length, 2);
  assert.deepEqual(loaded[0].factorSettings, undefined);
  assert.equal(draft.doe.startingTemplate.factorSettings[0].levels[0], '6000');
  draft.doe.startingTemplate.factorSettings[0].levels[0] = '9000';
  assert.equal(loaded[1].factorSettings[0].levels[0], '6000');
});

test('new experiment entry offers blank and existing-template paths into the same DOE workbench', () => {
  const sidebarSource = readFileSync(new URL('../src/workspace/SessionSidebar.tsx', import.meta.url), 'utf8');
  const designSource = readFileSync(new URL('../src/pages/experiment/design/IntelligentExperimentDesign.tsx', import.meta.url), 'utf8');
  const functionBarSource = readFileSync(new URL('../src/workbench/FunctionBar.tsx', import.meta.url), 'utf8');

  assert.match(sidebarSource, /全新创建/);
  assert.match(sidebarSource, /基于模板创建/);
  assert.match(sidebarSource, /loadDoeTemplates/);
  assert.match(sidebarSource, /initialDrafts/);
  assert.match(sidebarSource, /open\(getSessionPath\(id, 'doe'\)\)/);
  assert.match(designSource, /startingTemplate/);
  assert.match(functionBarSource, /initialTemplate/);
});

test('DOE methods share the intelligent experiment design capability and legacy routes resume there', () => {
  assert.equal(api.getSessionPath('new-session', 'doeMethods'), '/sessions/new-session/doe');
  assert.equal(api.getCapabilityFromPath('/sessions/new-session/doe-design'), 'doe');
  assert.equal(api.getSessionPath('new-session', 'doe'), '/sessions/new-session/doe');
  assert.equal(api.getCapabilityFromPath('/sessions/new-session/doe'), 'doe');
  assert.equal(api.getSessionResumePath({ id: 'legacy-session', capability: 'doeMethods' }), '/sessions/legacy-session/doe');
  assert.equal(api.sessionCapabilities.filter(item => item.key === 'doe' || item.key === 'doeMethods').length, 1);
});

test('DOE keeps business design methods and preparation without a model choice or model confirmation gate', () => {
  const designSource = readFileSync(new URL('../src/pages/experiment/design/IntelligentExperimentDesign.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(designSource, /ModelChoiceStrip|confirmed\.model|选择适用模型/);
  assert.match(designSource, /displayMode="doe-design"/);
  assert.match(designSource, /label: '试验配置'/);
  assert.match(designSource, /label: '约束'/);
});

test('session sidebar separates navigation sections and exposes collapsible section and tree controls', () => {
  const sidebarSource = readFileSync(new URL('../src/workspace/SessionSidebar.tsx', import.meta.url), 'utf8');
  const styleSource = readFileSync(new URL('../src/workspace/sessionWorkspace.css', import.meta.url), 'utf8');

  assert.match(sidebarSource, /session-section-toggle/);
  assert.match(sidebarSource, /RightOutlined/);
  assert.match(sidebarSource, /aria-expanded=\{sectionExpanded\./);
  assert.match(styleSource, /session-nav-section--separated/);
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

test('different concrete trials in one project keep separate sessions and their original source scopes', () => {
  const projectId = projects.getState().createProject({ name: '多个载荷谱的项目' });
  const a = { physicalObjectId: 'fan', experimentId: 'setup', trialId: 'trial-a', trialName: '试验 A' };
  const b = { ...a, trialId: 'trial-b', trialName: '试验 B' };
  const first = sessions.getState().ensureProjectSession(projectId, a);
  const second = sessions.getState().ensureProjectSession(projectId, b);
  assert.notEqual(first, second);
  assert.equal(sessions.getState().sessions.find(session => session.id === first).businessScope.trialId, 'trial-a');
  assert.equal(sessions.getState().ensureProjectSession(projectId, a), first);
  assert.equal(sessions.getState().getWorkspaceSession(second).targetProjectId, projectId);
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

test('deleting the last project session preserves trial membership without copying trial data', () => {
  const projectId = projects.getState().createProject({ name: '删除会话后保留试验' });
  const scope = { physicalObjectId: 'fan-delete', experimentId: 'setup-delete', trialId: 'trial-delete' };
  const id = sessions.getState().ensureProjectSession(projectId, scope);
  sessions.getState().updateDraft(id, 'doe', 'notes', '待删除的草稿');
  const trial = { id: scope.trialId, name: '保留试验', records: [], charts: [] };
  const objects = [{ id: 'category-delete', configurations: [{ id: scope.physicalObjectId, name: '风扇', experiments: [{ id: scope.experimentId, name: '构型', trials: [trial] }] }] }];
  sessions.getState().deleteSession(id);
  sessions.getState().reloadFromStorage();
  assert.equal(sessions.getState().sessions.some(item => item.id === id), false);
  const entries = api.getProjectTrialEntries(projectId, objects, projects.getState().projects, sessions.getState().sessions);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].trial, trial);
  const recreated = sessions.getState().ensureProjectSession(projectId, scope);
  assert.notEqual(recreated, id);
  assert.equal(sessions.getState().sessions.find(item => item.id === recreated).drafts.doe, undefined);
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
