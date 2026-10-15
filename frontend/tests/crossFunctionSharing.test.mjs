import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { build } from 'esbuild';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};
const bundle = await build({
  stdin: { contents: "export * from './src/workspace/physicalBusinessContext'; export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/sessionStore'; export * from './src/workspace/sessionModel'; export * from './src/workspace/projectStore';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const physical = api.usePhysicalObjectStore;
const sessions = api.useSessionStore;
const projects = api.useProjectStore;

beforeEach(() => {
  physical.setState({ objects: [] });
  projects.setState({ projects: [], activeProjectId: null });
  sessions.setState({ sessions: [], activeSessionId: null });
  memory.clear();
});

const fixture = () => {
  const store = physical.getState();
  const familyId = store.addRoot({ name: '电涵道风扇', type: '涵道风扇' });
  const make = () => {
    const physicalObjectId = store.addConfiguration(familyId, { name: '同名构型' });
    store.addField(physicalObjectId, 'parameters', { name: '直径', value: '120', unit: 'mm', form: '单值' });
    const experimentId = store.addExperiment(physicalObjectId, { name: '同名试验', category: '性能与功能类', parameters: [] });
    const trialId = store.addConcreteTrial(experimentId, { name: '同名具体试验', loadSpectrum: '载荷谱 01' });
    const testRecordId = store.addTrialRecord(trialId, { name: '同名记录' });
    return { physicalObjectId, experimentId, trialId, testRecordId };
  };
  return { a: make(), b: make(), familyId };
};

test('professional entry identity ignores capability, names and task-book association', () => {
  const { a, b } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '来源 A');
  const projectId = sessions.getState().getWorkspaceSession(id).targetProjectId;
  for (const capability of ['analysis', 'digitalTwin', 'virtualCondition', 'report']) {
    sessions.getState().openSession(id, capability);
    assert.equal(sessions.getState().ensurePhysicalSession({ ...a, physicalObjectName: '改名后', taskBookId: 'book-2' }, '来源 A'), id);
    assert.equal(sessions.getState().getWorkspaceSession(id).targetProjectId, projectId);
  }
  assert.equal(sessions.getState().sessions.length, 1);
  assert.equal(sessions.getState().sessions.find(item => item.id === id).businessScope.taskBookId, 'book-2');
  assert.notEqual(sessions.getState().ensurePhysicalSession(b, '来源 B'), id);
  assert.equal(sessions.getState().sessions.length, 2);
});

test('shared source resolves current parameters without copying or crossing records', () => {
  const { a, b } = fixture();
  const before = physical.getState().objects;
  const legacyScope = { ...a, trialId: undefined, trialName: undefined };
  assert.equal(api.resolvePhysicalSource(before, legacyScope).trial.id, a.trialId);
  assert.equal(api.physicalSourcePath(before, legacyScope).includes(`trialId=${a.trialId}`), true);
  assert.equal(api.samePhysicalSource(legacyScope, a), true);
  const originalRecord = api.resolvePhysicalSource(before, a).record;
  const fieldId = api.resolvePhysicalSource(before, a).configuration.parameters[0].id;
  physical.getState().updateField(a.physicalObjectId, 'parameters', fieldId, { name: '直径', value: '125', unit: 'mm', form: '单值' });
  const after = physical.getState().objects;
  assert.equal(api.resolvePhysicalSource(after, a).configuration.parameters[0].value, '125');
  assert.equal(api.resolvePhysicalSource(after, a).record, originalRecord);
  assert.equal(api.resolvePhysicalSource(after, b).configuration.parameters[0].value, '120');
  assert.equal(api.resolvePhysicalSource(after, { ...a, testRecordId: b.testRecordId }).missing, true);
  assert.equal(api.physicalSourcePath(after, { ...a, testRecordId: 'deleted' }), undefined);
});

test('explicit record and trial IDs never fall back and a renamed configuration keeps source identity', () => {
  const { a, b } = fixture();
  const scope = { ...a, experimentName: '旧名称' };
  const id = sessions.getState().ensurePhysicalSession(scope, '专业工作');
  physical.getState().updateExperiment(a.experimentId, { name: '试验布置新名称', description: '更正说明' });
  const context = sessions.getState().getWorkspaceSession(id);
  assert.equal(context.experimentName, '试验布置新名称');
  assert.equal(context.testRecordId, a.testRecordId);
  assert.equal(context.trialId, a.trialId);
  assert.equal(sessions.getState().ensurePhysicalSession(scope, '继续工作'), id);
  const objects = physical.getState().objects;
  for (const badScope of [{ ...a, testRecordId: 'missing' }, { ...a, testRecordId: '' }, { ...a, trialId: 'missing' }, { ...a, testRecordId: b.testRecordId }]) {
    const source = api.resolvePhysicalSource(objects, badScope);
    assert.equal(source.missing, true);
    assert.equal(source.record, undefined);
    assert.equal(api.physicalSourcePath(objects, badScope), undefined);
  }
  assert.equal(api.resolvePhysicalSource(objects, a).record.id, a.testRecordId);
});

test('same-source legacy artifacts remain references and explicit provenance wins over project membership', () => {
  const { a, b } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '来源 A');
  const currentProjectId = sessions.getState().getWorkspaceSession(id).targetProjectId;
  const old = sessions.getState().createSession({ title: '旧分析空间', businessScope: a });
  const oldProjectId = sessions.getState().getWorkspaceSession(old).targetProjectId;
  const saved = projects.getState().addArtifact(oldProjectId, { type: 'analysis', source: '试验数据分析', title: '旧分析', summary: '', payload: {} });
  projects.getState().addArtifact(currentProjectId, { type: 'analysis', source: '试验数据分析', title: '来源 B', summary: '', payload: { sourceScope: b } });
  const shared = api.getSourceArtifacts(projects.getState().projects, sessions.getState().sessions, a);
  assert.deepEqual(shared.map(item => item.id), [saved.id]);
  assert.equal(shared[0].projectId, oldProjectId);
  assert.equal(projects.getState().projects.find(item => item.id === currentProjectId).artifacts.length, 1);
});

test('cross-source handoff cannot clear drafts or import another model calibration', () => {
  const { a, b } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '来源 A');
  sessions.getState().updateDraft(id, 'virtualCondition', 'config', { speedMax: 5000 });
  const snapshot = structuredClone(sessions.getState().sessions.find(item => item.id === id));
  const foreign = { source: 'digitalTwin', workspaceSession: { ...sessions.getState().getWorkspaceSession(id), ...b }, artifactIds: ['b-calibration'], model: { modelId: 'engine-v2.1', modelName: '模型', version: 'V9.9', trustedRange: '来源 B', calibrationData: { source: 'B' } } };
  sessions.getState().setHandoff(id, 'virtualCondition', foreign, true);
  assert.deepEqual(sessions.getState().sessions.find(item => item.id === id), snapshot);
  const resolved = api.resolveSessionHandoff(sessions.getState().getWorkspaceSession(id), undefined, foreign);
  assert.equal(resolved.model, undefined);
  assert.equal(resolved.workspaceSession.testRecordId, a.testRecordId);
});

test('explicit calibration adoption is persisted as a patch and leaves other capabilities untouched', () => {
  const { a } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '来源 A');
  sessions.getState().updateDraft(id, 'analysis', 'config', { sensitivity: '低' });
  sessions.getState().updateDraft(id, 'virtualCondition', 'config', { speedMax: 4000 });
  sessions.getState().setHandoff(id, 'virtualCondition', {
    source: 'digitalTwin', workspaceSession: sessions.getState().getWorkspaceSession(id), artifactIds: ['calibration-1'],
    model: { modelId: 'engine-v2.1', modelName: '模型', version: 'V2.8', trustedRange: '手工确认范围', calibrationData: { resultMode: 'demo', measuredFile: 'shared.csv' } },
  }, true);
  sessions.getState().reloadFromStorage();
  const current = sessions.getState().sessions.find(item => item.id === id);
  assert.equal(current.drafts.overview.modelLibrary, undefined);
  assert.equal(current.drafts.overview.modelUpdates['engine-v2.1'].version, 'V2.8');
  assert.equal(current.drafts.overview.modelUpdates['engine-v2.1'].modelName, undefined);
  assert.deepEqual(current.drafts.analysis.config, { sensitivity: '低' });
  assert.equal(current.drafts.virtualCondition.config, undefined);
  assert.equal(api.resolvePhysicalSource(physical.getState().objects, a).record.rawFiles.length, 0);
});

test('record chart references resolve independent configurations and never cross sources', () => {
  const { a, b } = fixture();
  physical.getState().addRawFile(a.trialId, a.testRecordId, { id: 'csv-1', name: 'shared.csv', mimeType: 'text/csv', size: 30, addedAt: '', headers: ['time', 'thrust'], rowCount: 3 });
  const input = { name: '推力', rawFileId: 'csv-1', xField: 'time', yField: 'thrust', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#000000', smooth: false };
  const chartA = physical.getState().saveChart(a.trialId, a.testRecordId, input);
  const chartB = physical.getState().saveChart(a.trialId, a.testRecordId, { ...input, name: '修正推力', scale: 2 });
  const reference = { ...a, chartId: chartA };
  physical.getState().saveChart(a.trialId, a.testRecordId, { ...input, scale: 0 }, chartA);
  const objects = physical.getState().objects;
  assert.equal(api.resolveRecordChart(objects, reference).chart.scale, 0);
  assert.equal(api.resolveRecordChart(objects, { ...a, chartId: chartB }).chart.scale, 2);
  assert.equal(api.resolveRecordChart(objects, { ...b, chartId: chartA }), undefined);
  assert.equal(api.resolveRecordChart(objects, reference).rawFile.id, 'csv-1');
  assert.ok(!JSON.stringify(reference).includes('headers'));
});

test('known legacy demo results stay demo while manually configured DOE stays configuration', () => {
  const artifact = (type, source, payload = {}) => ({ id: 'a', projectId: 'p', type, title: '', summary: '', source, payload, createdAt: '', updatedAt: '' });
  assert.equal(api.isDemoArtifact(artifact('calibration', '试验数字孪生')), true);
  assert.equal(api.isDemoArtifact(artifact('analysis', '试验数据分析')), true);
  assert.equal(api.isDemoArtifact(artifact('virtualCondition', '虚拟工况扩展')), true);
  assert.equal(api.artifactResultMode(artifact('design', 'DOE设计', { designMethod: '两水平全因子' })), 'configuration');
  assert.equal(api.artifactResultMode(artifact('analysis', '人工分析')), 'unknown');
  assert.equal(api.artifactResultMode(artifact('analysis', '试验数据分析', { resultMode: 'computed' })), 'computed');
});

test('a design artifact can supply a new experiment by reference without making another record or dataset', () => {
  const { a } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '设计');
  const projectId = sessions.getState().getWorkspaceSession(id).targetProjectId;
  const design = projects.getState().addArtifact(projectId, { type: 'design', source: 'DOE设计', title: '手工方案', summary: '2 次试验', payload: { designMethod: '两水平', resultMode: 'configuration', sourceScope: a } });
  const experimentId = physical.getState().addExperiment(a.physicalObjectId, { name: '后续试验', category: '性能与功能类', parameters: [], designArtifactRef: { projectId, artifactId: design.id } });
  const source = api.resolvePhysicalSource(physical.getState().objects, { physicalObjectId: a.physicalObjectId, experimentId });
  assert.deepEqual(source.experiment.designArtifactRef, { projectId, artifactId: design.id });
  assert.equal(source.record, undefined);
  assert.equal(projects.getState().projects.find(item => item.id === projectId).datasets.length, 0);
  assert.equal(api.resolvePhysicalSource(physical.getState().objects, a).record.id, a.testRecordId);
});


test('task association follows the concrete trial and sibling executions keep independent sessions and report references', () => {
  const { a } = fixture();
  const id = sessions.getState().ensurePhysicalSession(a, '第一次');
  physical.getState().updateConcreteTrial(a.trialId, { taskBookId: 'new-book' });
  assert.equal(sessions.getState().getWorkspaceSession(id).taskBookId, 'new-book');
  const next = physical.getState().addTrialRecord(a.trialId, { name: '第二次' });
  const b = { ...a, testRecordId: next };
  const secondSession = sessions.getState().ensurePhysicalSession(b, '第二次');
  assert.notEqual(secondSession, id); assert.equal(api.samePhysicalSource(a, b), false);
  physical.getState().addRawFile(a.trialId, a.testRecordId, { id: 'first-csv', name: 'first.csv', headers: ['x','y'], rowCount: 2 });
  const chartId = physical.getState().saveChart(a.trialId, a.testRecordId, { name: '旧报告图表', rawFileId: 'first-csv', xField: 'x', yField: 'y', chartType: 'line', scale: 1, offset: 0 });
  const legacyReportRef = { physicalObjectId: a.physicalObjectId, experimentId: a.experimentId, testRecordId: a.testRecordId, chartId };
  assert.equal(api.resolveRecordChart(physical.getState().objects, legacyReportRef).chart.id, chartId);
  assert.equal(api.resolveRecordChart(physical.getState().objects, { ...legacyReportRef, testRecordId: next }), undefined);
  physical.getState().updateConcreteTrial(a.trialId, { taskBookId: undefined });
  assert.equal(sessions.getState().getWorkspaceSession(id).taskBookId, undefined);
});
