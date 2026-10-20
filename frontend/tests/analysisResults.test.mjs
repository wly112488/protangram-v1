import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { build } from 'esbuild';

const memory = new Map();
globalThis.localStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
const bundle = await build({ stdin: { contents: "export * from './src/pages/report/workspaceReportModel'; export * from './src/workspace/resultNaming'; export * from './src/workspace/analysisResultModel'; export * from './src/workspace/professionalContext'; export * from './src/services/predictionPreview'; export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/projectStore'; export * from './src/workspace/sessionStore';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const physical = api.usePhysicalObjectStore, projects = api.useProjectStore, sessions = api.useSessionStore;
beforeEach(() => { memory.clear(); physical.setState({ objects: [] }); projects.setState({ projects: [], activeProjectId: null }); sessions.setState({ sessions: [], activeSessionId: null, saveError: null }); });
function fixture() {
  const store = physical.getState();
  const category = store.addRoot({ name: '涵道风扇', type: '涵道风扇' });
  const physicalObjectId = store.addConfiguration(category, { name: '风扇 A' });
  const experimentId = store.addExperiment(physicalObjectId, { name: '构型 A', parameters: [{ id: 'angle', name: '安装角', value: '15', form: '单值' }] });
  const trialId = store.addConcreteTrial(experimentId, { name: '性能试验', loadSpectrum: 'LS-01' });
  const otherTrialId = store.addConcreteTrial(experimentId, { name: '另一试验', loadSpectrum: 'LS-02' });
  const first = store.addTrialRecord(trialId, {}), second = store.addTrialRecord(trialId, {});
  for (const recordId of [first, second]) store.addRawFile(trialId, recordId, { id: `csv-${recordId}`, name: `${recordId}.csv`, headers: ['time', 'speed'], rowCount: 2, mimeType: 'text/csv', size: 30, addedAt: '' });
  const scope = { physicalObjectId, experimentId, trialId };
  const trial = () => physical.getState().objects[0].configurations[0].experiments[0].trials[0];
  const save = (recordId, type, results) => {
    const source = { ...scope, testRecordId: recordId };
    const sessionId = sessions.getState().ensurePhysicalSession(source, '专业工作');
    return projects.getState().addArtifact(sessions.getState().getWorkspaceSession(sessionId).targetProjectId, { type, title: type, source: type, summary: '已保存分析', payload: { sourceScope: source, sourceContext: api.captureResultContext(physical.getState().objects, source), results } });
  };
  return { store, scope, first, second, trial, save, otherTrialId };
}
test('record results and shared results reference the exact same charts, tables and professional objects', () => {
  const f = fixture();
  f.store.saveChart(f.scope.trialId, f.first, { name: '转速曲线', rawFileId: `csv-${f.first}`, xField: 'time', yField: 'speed', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
  f.store.saveTable(f.scope.trialId, f.second, { name: '转速数据表', rawFileId: `csv-${f.second}`, fields: ['time', 'speed'], startRow: 0, endRow: 0 });
  const metric = { id: 'peak', kind: 'metric', name: '峰值转速', value: 3200, unit: 'rpm' };
  const artifact = f.save(f.second, 'analysis', [metric]);
  const artifacts = api.getTrialArtifacts(projects.getState().projects, sessions.getState().sessions, f.scope, f.trial());
  const all = api.collectAnalysisResults(f.trial(), artifacts);
  const own = api.collectAnalysisResults(f.trial(), [artifact], f.second);
  assert.deepEqual(all.map(result => result.kind), ['chart', 'table', 'metric']);
  assert.equal(all[0].chart, f.trial().charts[0]);
  assert.equal(all[1].table, own[0].table);
  assert.equal(all[2].result, own[1].result);
  assert.equal(own[1].artifact, artifact);
  assert.equal(f.trial().charts.length, 1);
  assert.equal(f.trial().records[0].charts, undefined);
});
test('context is inherited, saved artifacts survive session deletion and refresh, and sources never cross trials or executions', async () => {
  const f = fixture();
  const result = f.save(f.first, 'analysis', [{ id: 'curve', kind: 'chart', name: '趋势', option: { series: [{ type: 'line', data: [1, 2, 3] }] } }]);
  assert.equal(result.payload.sourceContext.loadSpectrum, 'LS-01');
  assert.equal(result.payload.sourceContext.configurationParameters[0].value, '15');
  assert.deepEqual(result.payload.sourceContext.rawFiles.map(file => file.id), [`csv-${f.first}`]);
  sessions.getState().deleteSession(sessions.getState().sessions[0].id);
  await projects.persist.rehydrate();
  const current = projects.getState().projects;
  assert.equal(api.getTrialArtifacts(current, [], { ...f.scope, testRecordId: f.first }, f.trial()).length, 1);
  assert.equal(api.getTrialArtifacts(current, [], { ...f.scope, testRecordId: f.second }, f.trial()).length, 0);
  assert.equal(api.getTrialArtifacts(current, [], { ...f.scope, trialId: f.otherTrialId }, { ...f.trial(), id: f.otherTrialId, records: [] }).length, 0);
  assert.equal(api.collectAnalysisResults(f.trial(), api.getTrialArtifacts(current, [], f.scope, f.trial()))[0].result.option.series[0].data[2], 3);
  assert.throws(() => api.captureResultContext(physical.getState().objects, { ...f.scope, testRecordId: 'deleted' }), /失效/);
});
test('saving the same result again updates its identity without making another shared object', () => {
  const f = fixture();
  const artifact = f.save(f.first, 'analysis', [{ id: 'metric', name: '转速', kind: 'metric', value: 10 }]);
  const updated = projects.getState().addArtifact(artifact.projectId, { ...artifact, payload: { ...artifact.payload, results: [{ id: 'metric', name: '转速', kind: 'metric', value: 20 }] } });
  assert.equal(updated.id, artifact.id);
  assert.equal(updated.createdAt, artifact.createdAt);
  const saved = projects.getState().projects[0].artifacts;
  assert.equal(saved.length, 1);
  assert.equal(saved[0].payload.results[0].value, 20);
});
test('legacy results retain their data without displaying a title-only chart as a real plot', () => {
  const legacy = { id: 'old', projectId: 'p', type: 'analysis', title: '旧分析', summary: '旧结论', payload: { charts: [{ id: 'placeholder', title: '未存数据的图' }], anomalies: [{ event: '温升', level: '高' }], conclusion: '温度偏高' } };
  const results = api.artifactResults(legacy);
  assert.deepEqual(results.map(result => result.kind), ['table', 'metric']);
  assert.equal(results[0].rows[0].event, '温升');
  assert.equal(results[1].value, '温度偏高');
  const design = api.artifactResults({ ...legacy, type: 'design', payload: { factors: [{ name: '转速', levels: [1000, 2000] }] } });
  assert.equal(design[0].kind, 'table');
  assert.equal(design[0].rows[0].levels, '[1000,2000]');
});
test('prediction archive accepts only saved results and retains computed provenance in the common table structure', () => {
  const reference = { physicalObjectId: 'device', experimentId: 'setup', physicalObjectName: '风扇', experimentName: '构型' };
  const task = { taskId: 'task-1', service: 'virtualCondition', saved: true, resultMode: 'computed', model: { modelId: 'model', modelName: '推力模型', version: 'v1', sourceConfiguration: reference, inputFields: [{ key: 'speed', label: '转速', unit: 'rpm' }] }, inputs: { speed: 2000 }, targetConfiguration: reference, result: { summary: '计算完成', columns: [{ key: 'thrust', label: '推力', unit: 'N' }], rows: [{ thrust: 20 }] } };
  const artifact = api.predictionArtifactInput(task);
  assert.equal(artifact.payload.resultMode, 'computed');
  assert.equal(artifact.payload.results[0].kind, 'table');
  assert.equal(artifact.payload.results[0].rows, task.result.rows);
  assert.match(artifact.payload.results[0].basis.join('；'), /转速：2000 rpm/);
  assert.equal(api.predictionArtifactInput(task).id, artifact.id);
  assert.throws(() => api.predictionArtifactInput({ ...task, saved: false }), /尚未确认保存/);
});

test('professional sources inherit the exact execution CSV and all shared results without crossing trials or copying objects', () => {
  const f = fixture();
  const artifact = f.save(f.second, 'analysis', [{ id: 'peak', name: '峰值', kind: 'metric', value: 20 }]);
  const objects = physical.getState().objects, before = structuredClone(objects);
  const source = api.getProfessionalSources(objects, projects.getState().projects, sessions.getState().sessions, { ...f.scope, testRecordId: f.first });
  assert.deepEqual(source.rawFiles.map(file => file.sourceRecordId), [f.first]);
  assert.equal(source.results[0].artifact, artifact);
  assert.equal(source.results[0].result, artifact.payload.results[0]);
  const context = api.professionalDataContext(source);
  assert.equal(context.scope.testRecordId, f.first);
  assert.equal(context.loadSpectrum, 'LS-01');
  assert.equal(context.records[0].loadSpectrum, 'LS-01');
  assert.equal(context.configurationParameters[0].value, '15');
  assert.equal(context.results[0].sourceRecordId, f.second);
  assert.equal(context.results[0].artifactRef.artifactId, artifact.id);
  assert.deepEqual(context.results.map(result => result.key), source.results.map(result => result.key));
  assert.deepEqual(physical.getState().objects, before);
  const trialContext = api.professionalDataContext(api.getProfessionalSources(objects, projects.getState().projects, sessions.getState().sessions, f.scope));
  assert.deepEqual(trialContext.rawFiles.map(file => file.sourceRecordId), [f.first, f.second]);
  const other = api.getProfessionalSources(objects, projects.getState().projects, sessions.getState().sessions, { ...f.scope, trialId: f.otherTrialId });
  assert.equal(other.results.length, 0);
  assert.throws(() => api.professionalDataContext(api.getProfessionalSources(objects, [], [], { ...f.scope, testRecordId: 'missing' })), /来源不可用/);
});

test('existing design references and object-level inputs remain available inside professional functions', () => {
  const f = fixture();
  const projectId = projects.getState().createProject({ name: '已有设计' });
  const design = projects.getState().addArtifact(projectId, { type: 'design', title: '已引用方案', source: 'DOE设计', summary: '已登记试验方案', payload: { designMethod: '因子设计', factors: [{ name: '转速', lowLevel: '1000', highLevel: '3000' }] } });
  f.store.updateConcreteTrial(f.scope.trialId, { designArtifactRef: { projectId, artifactId: design.id } });
  const data = api.professionalDataContext(api.getProfessionalSources(physical.getState().objects, projects.getState().projects, [], { ...f.scope, testRecordId: f.first }));
  assert.equal(data.results[0].artifactRef.artifactId, design.id);
  assert.equal(data.results[0].kind, 'table');
});


test('frontend preview persists in the existing shared structure with demo provenance and a single identity', async () => {
  const f = fixture();
  const context = api.professionalDataContext(api.getProfessionalSources(physical.getState().objects, [], [], { ...f.scope, testRecordId: f.first }));
  const task = await api.runPredictionPreview({ requestId: 'preview-1', service: 'digitalTwin', targetConfiguration: { physicalObjectId: f.scope.physicalObjectId, experimentId: f.scope.experimentId, physicalObjectName: '风扇 A', experimentName: '构型 A', objectParameters: [], configurationParameters: [] }, context, inputs: { speed: 3500 } }, new AbortController().signal);
  const confirmed = await api.savePredictionPreview(task, new AbortController().signal);
  const input = api.predictionArtifactInput(confirmed);
  assert.equal(input.payload.resultMode, 'demo'); assert.equal(input.payload.resultNature, 'digitalTwin');
  assert.equal(input.payload.model, undefined); assert.equal(input.payload.csvData, undefined);
  assert.match(input.payload.results[0].basis.join('；'), /前端演示数据/);
  const sessionId = sessions.getState().ensurePhysicalSession(context.scope, '前端演示');
  const projectId = sessions.getState().getWorkspaceSession(sessionId).targetProjectId;
  const payload = { ...input.payload, sourceScope: context.scope };
  const artifact = projects.getState().addArtifact(projectId, { ...input, payload });
  projects.getState().addArtifact(projectId, { ...input, payload });
  await projects.persist.rehydrate();
  const results = api.getTrialArtifacts(projects.getState().projects, sessions.getState().sessions, context.scope, f.trial());
  assert.equal(results.length, 1); assert.equal(results[0].id, artifact.id);
  assert.equal(results[0].payload.results[0].rows[0].thrust, 18.2);
  assert.equal(api.collectAnalysisResults(f.trial(), results)[0].kind, 'table');
});


test('result names are unique across every execution and professional function of one trial', () => {
  const f = fixture();
  f.store.saveChart(f.scope.trialId, f.first, { name: '转速曲线', rawFileId: `csv-${f.first}`, xField: 'time', yField: 'speed', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
  const artifact = f.save(f.second, 'analysis', [{ id: 'metric', name: '峰值', kind: 'metric', value: 20 }]);
  const existing = api.collectAnalysisResults(f.trial(), [artifact]);
  assert.throws(() => api.assertUniqueResultNames([{ name: ' 转速曲线 ' }], existing), /重名/);
  assert.throws(() => api.assertUniqueResultNames([{ name: '峰值' }], existing), /重名/);
  assert.doesNotThrow(() => api.assertUniqueResultNames([{ name: '峰值' }], existing, { projectId: artifact.projectId, artifactId: artifact.id }));
  assert.throws(() => api.assertUniqueResultNames([{ name: '新成果' }, { name: ' 新成果 ' }], existing), /重名/);
  assert.throws(() => api.assertUniqueResultNames([{ name: '   ' }], existing), /名称/);
  assert.throws(() => api.assertUniqueResultNames([{ name: ' speed curve ' }], [{ key: 'legacy', kind: 'metric', name: 'Speed Curve' }]), /重名/);
});

test('cross-record upstream results carry the original CSV references into professional context', () => {
  const f = fixture();
  const artifact = f.save(f.second, 'analysis', [{ id: 'metric', name: '峰值', kind: 'metric', value: 20 }]);
  const sources = api.getProfessionalSources(physical.getState().objects, projects.getState().projects, sessions.getState().sessions, { ...f.scope, testRecordId: f.first });
  const context = api.professionalDataContext(sources);
  assert.deepEqual(context.rawFiles.map(file => file.sourceRecordId), [f.first, f.second]);
  assert.equal(context.rawFiles[1].id, artifact.payload.sourceContext.rawFiles[0].id);
  assert.equal(context.results[0].data, artifact.payload.results[0]);
  assert.equal(context.results[0].sourceScope.testRecordId, f.second);
});


test('database report definitions override legacy metadata and retain references to original evidence after reload', async () => {
  const f = fixture();
  const evidence = f.save(f.first, 'analysis', [{ id: 'metric', name: '峰值', kind: 'metric', value: 20 }]);
  const definition = { id: 'report-1', name: '试验报告', workspaceProjectId: evidence.projectId, artifactRefs: [{ projectId: evidence.projectId, artifactId: evidence.id }], chartRefs: [], status: 'draft', tagBindings: {} };
  projects.getState().addArtifact(evidence.projectId, { id: definition.id, type: 'report', title: definition.name, source: '报告生成', summary: '草稿', payload: { reportDefinition: definition } });
  const reports = api.getWorkspaceReports(projects.getState().projects, [{ ...definition, name: '浏览器旧名称' }]);
  assert.equal(reports.length, 1);
  assert.equal(reports[0], definition);
  assert.equal(reports[0].artifactRefs, definition.artifactRefs);
  await projects.persist.rehydrate();
  const restored = api.getWorkspaceReports(projects.getState().projects);
  assert.equal(restored[0].name, '试验报告');
  const reference = restored[0].artifactRefs[0];
  const original = projects.getState().projects.find(project => project.id === reference.projectId).artifacts.find(artifact => artifact.id === reference.artifactId);
  assert.equal(original.payload.results[0].value, 20);
  assert.equal(restored[0].results, undefined);
  assert.equal(restored[0].artifactCopies, undefined);
});

test('report artifact selection distinguishes identical artifact IDs across projects', () => {
  const firstArtifact = { projectId: 'project-a', id: 'legacy-result', payload: { value: 10 } };
  const secondArtifact = { projectId: 'project-b', id: 'legacy-result', payload: { value: 20 } };
  const artifacts = [firstArtifact, secondArtifact];
  assert.deepEqual(api.selectReportArtifacts(artifacts, [api.reportArtifactSelectionKey(firstArtifact)]), [firstArtifact]);
  assert.equal(api.selectReportArtifacts(artifacts, [api.reportArtifactSelectionKey(secondArtifact)])[0], secondArtifact);
  assert.equal(firstArtifact.id, secondArtifact.id);
});

test('report chart selection distinguishes identical chart IDs across execution records', () => {
  const reference = { physicalObjectId: 'object', experimentId: 'setup', trialId: 'trial', chartId: 'legacy-chart' };
  const firstChart = { reference: { ...reference, testRecordId: 'record-a' }, chart: { id: 'legacy-chart', data: [1] } };
  const secondChart = { reference: { ...reference, testRecordId: 'record-b' }, chart: { id: 'legacy-chart', data: [2] } };
  const charts = [firstChart, secondChart];
  assert.deepEqual(api.selectReportCharts(charts, [api.reportChartSelectionKey(firstChart.reference)]), [firstChart]);
  assert.equal(api.selectReportCharts(charts, [api.reportChartSelectionKey(secondChart.reference)])[0], secondChart);
  assert.deepEqual(api.selectReportCharts(charts, charts.map(chart => api.reportChartSelectionKey(chart.reference))), charts);
  assert.equal(firstChart.reference.chartId, secondChart.reference.chartId);
});
