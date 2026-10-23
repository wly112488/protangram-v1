import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { build } from 'esbuild';

const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const bundle = await build({ stdin: { contents: "export * from './src/workspace/taskTrialModel'; export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/projectStore'; export * from './src/workspace/taskStore'; export * from './src/workspace/physicalBusinessContext';", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'node', format: 'esm', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const physical = api.usePhysicalObjectStore, projects = api.useProjectStore, tasks = api.useTaskStore;
beforeEach(() => { storage.clear(); physical.setState({ objects: [] }); projects.setState({ projects: [], activeProjectId: null }); tasks.setState({ tasks: [] }); });
function fixture() {
  const store = physical.getState();
  const category = store.addRoot({ name: '涵道风扇', type: '涵道风扇' });
  const objectA = store.addConfiguration(category, { name: '风扇 A' }), objectB = store.addConfiguration(category, { name: '风扇 B' });
  const setupA = store.addExperiment(objectA, { name: '布置 A', parameters: [] }), setupB = store.addExperiment(objectB, { name: '布置 B', parameters: [] });
  const project1 = projects.getState().createProject({ name: '任务1', status: '进行中' }), project2 = projects.getState().createProject({ name: '任务2', status: '进行中' });
  const task1 = tasks.getState().createTask({ title: '任务1', projectId: project1, requirementTexts: [] }), task2 = tasks.getState().createTask({ title: '任务2', projectId: project2, requirementTexts: [] });
  const trialA = store.addConcreteTrial(setupA, { name: 'A试验', loadSpectrum: '谱A', taskBookId: task1 }), trialB = store.addConcreteTrial(setupB, { name: 'B试验', loadSpectrum: '谱B', taskBookId: task1 });
  const other = store.addConcreteTrial(setupA, { name: '其他任务', loadSpectrum: '谱C', taskBookId: task2 }), independent = store.addConcreteTrial(setupA, { name: '自主试验', loadSpectrum: '谱D' });
  const first = store.addTrialRecord(trialA, {}), second = store.addTrialRecord(trialA, {}), third = store.addTrialRecord(trialB, {});
  store.addTrialRecord(other, {}); store.addTrialRecord(independent, {});
  for (const [trialId, recordId] of [[trialA, first], [trialA, second], [trialB, third]]) {
    store.addRawFile(trialId, recordId, { id: `csv-${recordId}`, name: 'data.csv', mimeType: 'text/csv', size: 1, addedAt: '', headers: ['x', 'y'], rowCount: 2 });
    store.saveChart(trialId, recordId, { name: recordId === second ? '第二次图表' : '同名图表', rawFileId: `csv-${recordId}`, xField: 'x', yField: 'y', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
  }
  const scope = { physicalObjectId: objectA, experimentId: setupA, trialId: trialA, testRecordId: first };
  const resultProject = projects.getState().createProject({ name: '独立专业成果空间', status: '进行中' });
  const artifact = projects.getState().addArtifact(resultProject, { type: 'analysis', title: 'A实际成果', source: '手工分析', summary: '已保存成果', payload: { resultMode: 'computed', sourceScope: scope } });
  return { category, objectA, objectB, setupA, setupB, trialA, trialB, task1, task2, first, second, third, artifact, scope };
}
const entries = taskId => api.getTaskTrials(physical.getState().objects, projects.getState().projects, [], taskId);

test('trial-scoped results appear in TASK/report before records exist and never become another trial record',()=>{
  const f=fixture();
  const trialId=physical.getState().addConcreteTrial(f.setupA,{name:'零记录模型试验',loadSpectrum:'',taskBookId:f.task1});
  const scope={physicalObjectId:f.objectA,experimentId:f.setupA,trialId};
  const projectId=projects.getState().createProject({name:'试验模型成果',status:'进行中'});
  const result=projects.getState().addArtifact(projectId,{type:'calibration',title:'试验模型演示',source:'数字孪生',summary:'演示',payload:{resultMode:'demo',sourceScope:scope}});
  const projected=entries(f.task1), sources=api.getTaskTrialSources(projected);
  assert.equal(sources.artifacts.filter(item=>item.id===result.id).length,1);
  assert.ok(api.getTaskReportArtifacts(tasks.getState().tasks.find(t=>t.id===f.task1),projected,projects.getState().projects).some(item=>item.id===result.id));
  assert.equal(projected.find(entry=>entry.trial.id===trialId).records.length,0);
  physical.getState().addTrialRecord(trialId,{});
  assert.equal(api.getTaskTrialSources(entries(f.task1)).artifacts.filter(item=>item.id===result.id).length,1);
  tasks.getState().addArtifactToReport(f.task1,{projectId,artifactId:result.id});
  physical.getState().updateConcreteTrial(trialId,{taskBookId:f.task2});
  assert.equal(api.getTaskReportArtifacts(tasks.getState().tasks.find(t=>t.id===f.task1),entries(f.task1),projects.getState().projects).some(item=>item.id===result.id),false);
});

test('association candidates include component-owned autonomous trials and preserve exact parent identity',()=>{
  const f=fixture(),s=physical.getState();
  const rotor=s.addComponent(f.objectA,{name:'转子'}),setup=s.addExperiment(rotor,{name:'部件内部试验容器',category:'internal:cfg-trials',parameters:[]});
  const trial=s.addConcreteTrial(setup,{name:'转子自主试验',loadSpectrum:''});
  const candidate=api.getAutonomousTrials(physical.getState().objects).find(item=>item.trial.id===trial);
  assert.equal(candidate.object.id,rotor);assert.equal(candidate.category.id,f.category);assert.equal(candidate.configuration.id,setup);
  s.updateConcreteTrial(trial,{taskBookId:f.task1});
  assert.equal(api.getAutonomousTrials(physical.getState().objects).some(item=>item.trial.id===trial),false);
  assert.equal(entries(f.task1).find(item=>item.trial.id===trial).object.id,rotor);
});

test('task overview groups devices and configurations and counts actual records, files and cross-project results', () => {
  const f = fixture(), related = entries(f.task1), groups = api.groupTaskTrials(related), sources = api.getTaskTrialSources(related);
  assert.equal(related.length, 2); assert.equal(groups.length, 2); assert.equal(groups[0].configurations.length, 1);
  assert.deepEqual(related[0].records.map(item => item.record.id), [f.first, f.second]);
  assert.equal(sources.records, 3); assert.equal(sources.files, 3); assert.equal(sources.charts.length, 3);
  assert.equal(sources.artifacts[0].id, f.artifact.id); assert.equal(sources.artifacts.length, 1);
  assert.equal(entries('').length, 0); assert.equal(entries('missing').length, 0);
});
test('all report chart references resolve the original device, trial and execution even with identical chart names', () => {
  const f = fixture(), sources = api.getTaskTrialSources(entries(f.task1));
  assert.equal(new Set(sources.charts.map(item => api.recordChartKey(item.reference))).size, 3);
  for (const { reference, chart } of sources.charts) {
    const source = api.resolveRecordChart(physical.getState().objects, reference);
    assert.equal(source.chart.id, chart.id); assert.equal(source.record.id, reference.testRecordId); assert.equal(source.trial.id, reference.trialId);
  }
});
test('different trial configurations of one device remain separate inside a task summary', () => {
  const f = fixture();
  const setup = physical.getState().addExperiment(f.objectA, { name: '另一套布置', parameters: [] });
  const trial = physical.getState().addConcreteTrial(setup, { name: '补充试验', loadSpectrum: '谱E', taskBookId: f.task1 });
  physical.getState().addTrialRecord(trial, {});
  const groups = api.groupTaskTrials(entries(f.task1));
  assert.equal(groups.length, 2); assert.equal(groups[0].configurations.length, 2);
  assert.equal(groups[0].configurations[0].entries[0].trial.id, f.trialA);
  assert.equal(groups[0].configurations[1].entries[0].trial.id, trial);
  assert.equal(api.getTaskTrialSources(entries(f.task1)).records, 4);
});
test('independent CFG groups do not expose or merge their shared compatibility container',()=>{
  const f=fixture(),store=physical.getState();
  const internal=store.addExperiment(f.objectA,{name:'兼容容器',category:'internal:cfg-trials',parameters:[]});
  const a=store.addConcreteTrial(internal,{name:'CFG A 试验',cfgId:'cfg-a',taskBookId:f.task1});
  const b=store.addConcreteTrial(internal,{name:'CFG B 试验',cfgId:'cfg-b',taskBookId:f.task1});
  const cfgs=[{id:'cfg-a',name:'组合 A',members:[]},{id:'cfg-b',name:'组合 B',members:[]}];
  const groups=api.groupTaskTrials(entries(f.task1).filter(entry=>[a,b].includes(entry.trial.id)),cfgs);
  assert.equal(groups[0].configurations.length,2);
  assert.deepEqual(groups[0].configurations.map(item=>item.displayName),['组合 A','组合 B']);
  assert.ok(groups[0].configurations.every(item=>item.configuration.id===internal));
  assert.equal(api.groupTaskTrials(entries(f.task1).filter(entry=>entry.trial.id===a),[])[0].configurations[0].displayName,'CFG 来源已失效');
});
test('reassignment updates both task projections without copying records or retaining moved results as current report sources', () => {
  const f = fixture(), before = structuredClone(entries(f.task1)[0].trial.records);
  tasks.getState().addArtifactToReport(f.task1, { projectId: f.artifact.projectId, artifactId: f.artifact.id });
  physical.getState().updateConcreteTrial(f.trialA, { taskBookId: f.task2 });
  assert.equal(entries(f.task1).length, 1); assert.equal(entries(f.task2).length, 2);
  assert.deepEqual(entries(f.task2).find(item => item.trial.id === f.trialA).trial.records, before);
  const task = tasks.getState().tasks.find(item => item.id === f.task1);
  assert.equal(api.getTaskReportArtifacts(task, entries(f.task1), projects.getState().projects).length, 0);
  assert.equal(task.reportDraft.sections.flatMap(section => section.artifactRefs).length, 1);
  physical.getState().updateConcreteTrial(f.trialA, { taskBookId: undefined });
  assert.equal(entries(f.task2).length, 1);
  assert.equal(api.findPhysicalTrialRecord(physical.getState().objects, f.objectA, f.setupA, f.first).id, f.first);
});
test('overview is read-only and report editing persists existing drafts without AI completion or trial data changes', async () => {
  const f = fixture(), before = structuredClone(physical.getState().objects), task = tasks.getState().tasks.find(item => item.id === f.task1);
  api.getTaskReportArtifacts(task, entries(f.task1), projects.getState().projects);
  tasks.getState().updateReportSection(f.task1, task.reportDraft.sections[0].id, '人工撰写的任务目标');
  await tasks.persist.rehydrate();
  const restored = tasks.getState().tasks.find(item => item.id === f.task1);
  assert.equal(restored.reportDraft.sections[0].body, '人工撰写的任务目标');
  assert.equal(restored.reportDraft.aiCompletedAt, undefined); assert.equal(restored.requirements.length, 0);
  assert.deepEqual(physical.getState().objects, before);
});
