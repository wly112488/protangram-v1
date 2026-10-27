import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { build } from 'esbuild';
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
const bundle = await build({ stdin: { contents: "export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/physicalBusinessContext'; export * from './src/workspace/taskTrialModel';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const physical = api.usePhysicalObjectStore;
beforeEach(() => { storage.clear(); physical.setState({ objects: [] }); });
const file = id => ({ id, name: `${id}.csv`, mimeType: 'text/csv', size: 25, addedAt: '', headers: ['time','speed','thrust'], rowCount: 3 });
const chart = (name, rawFileId) => ({ name, rawFileId, xField: 'time', yField: 'speed', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
function fixture() {
  const store = physical.getState();
  const categoryId = store.addRoot({ name: '涵道风扇', type: '涵道风扇' });
  const physicalObjectId = store.addConfiguration(categoryId, { name: '电涵道风扇' });
  const experimentId = store.addExperiment(physicalObjectId, { name: '构型 01', parameters: [] });
  const trialId = store.addConcreteTrial(experimentId, { name: '性能试验', loadSpectrum: 'LS01', taskBookId: 'task' });
  const first = store.addTrialRecord(trialId, {}), second = store.addTrialRecord(trialId, {});
  store.addRawFile(trialId, first, file('first-csv')); store.addRawFile(trialId, second, file('second-csv'));
  const trial = () => physical.getState().objects[0].configurations[0].experiments[0].trials[0];
  const ref = (record, chartId) => ({ physicalObjectId, experimentId, trialId, testRecordId: record, chartId });
  return { store, physicalObjectId, experimentId, trialId, first, second, trial, ref };
}
test('records produce results in one trial collection with explicit provenance and without copying raw data', () => {
  const f = fixture(), before = structuredClone(f.trial().records);
  const a = f.store.saveChart(f.trialId, f.first, chart('转速曲线', 'first-csv'));
  const b = f.store.saveChart(f.trialId, f.second, chart('推力曲线', 'second-csv'));
  assert.deepEqual(f.trial().records, before);
  assert.equal(f.trial().records.every(record => !Object.hasOwn(record, 'charts')), true);
  assert.deepEqual(f.trial().charts.map(item => [item.id,item.sourceRecordId,item.rawFileId]), [[a,f.first,'first-csv'],[b,f.second,'second-csv']]);
  assert.equal(api.resolveRecordChart(physical.getState().objects,f.ref(f.first,a)).chart, f.trial().charts[0]);
  assert.equal(api.resolveRecordChart(physical.getState().objects,f.ref(f.second,a)), undefined);
});
test('shared name validation rejects duplicates across records, whitespace/case variations and overwrites', () => {
  const f=fixture();f.store.saveChart(f.trialId,f.first,chart(' Speed ','first-csv'));
  const before=structuredClone(f.trial());
  for (const name of ['Speed',' speed ','SPEED']) assert.throws(()=>f.store.saveChart(f.trialId,f.second,chart(name,'second-csv')),/同名图表/);
  assert.deepEqual(f.trial(),before);assert.equal(f.trial().charts[0].name,'Speed');
  assert.throws(()=>f.store.saveChart(f.trialId,f.second,chart('  ','second-csv')),/填写图表名称/);
});
test('different concrete trials allow the same chart name', () => {
  const f=fixture();f.store.saveChart(f.trialId,f.first,chart('转速曲线','first-csv'));
  const trial=f.store.addConcreteTrial(f.experimentId,{name:'另一试验',loadSpectrum:'LS02'});
  const record=f.store.addTrialRecord(trial,{});f.store.addRawFile(trial,record,file('other-csv'));
  assert.ok(f.store.saveChart(trial,record,chart('转速曲线','other-csv')));
});
test('editing excludes its own identity but cannot rename over another result or move a result to a sibling record', () => {
  const f=fixture(), a=f.store.saveChart(f.trialId,f.first,chart('转速曲线','first-csv'));
  const b=f.store.saveChart(f.trialId,f.second,chart('推力曲线','second-csv'));
  const records=structuredClone(f.trial().records);
  f.store.saveChart(f.trialId,f.first,{...chart('转速曲线','first-csv'),scale:0},a);
  assert.equal(f.trial().charts[0].scale,0);
  assert.throws(()=>f.store.saveChart(f.trialId,f.first,chart('推力曲线','first-csv'),a),/同名图表/);
  assert.throws(()=>f.store.saveChart(f.trialId,f.second,chart('转移','second-csv'),a),/来源记录/);
  assert.equal(f.trial().charts.find(item=>item.id===b).scale,1);assert.deepEqual(f.trial().records,records);
});
test('v5 migration keeps historical duplicate names, duplicate IDs across records, configurations and old report references', () => {
  const f=fixture(), raw=structuredClone(physical.getState().objects), old=raw[0].configurations[0].experiments[0].trials[0];
  delete old.charts;
  for(const record of old.records) record.charts=[{...chart('同名曲线',record.rawFiles[0].id),id:'old-chart',createdAt:'2026-10-14',updatedAt:'2026-10-14',modelId:'legacy-model',modelInputs:[{id:'input',value:'5'}]}];
  const before=structuredClone(raw), migrated=api.migratePhysicalState({objects:raw});
  assert.deepEqual(raw,before);physical.setState(migrated);
  assert.equal(f.trial().charts.length,2);assert.equal(f.trial().records.every(record=>record.charts===undefined),true);
  for(const record of f.trial().records) {
    const result=api.resolveRecordChart(physical.getState().objects,{...f.ref(record.id,'old-chart'),trialId:undefined});
    assert.equal(result.record.id,record.id);assert.equal(result.chart.modelId,'legacy-model');assert.equal(result.rawFile.id,record.rawFiles[0].id);
    assert.equal(api.hasTrialChartNameConflict(f.trial(),'同名曲线',result.chart),true);
  }
  assert.deepEqual(api.migratePhysicalState(migrated),migrated);
  f.store.saveChart(f.trialId,f.first,chart('重命名曲线','first-csv'),'old-chart');
  assert.equal(f.trial().charts[1].name,'同名曲线');assert.equal(f.trial().charts.length,2);
});
test('persisted migration and refresh retain the one shared collection and original CSV IDs', async () => {
  const f=fixture();f.store.saveChart(f.trialId,f.first,chart('转速曲线','first-csv'));f.store.saveChart(f.trialId,f.second,chart('推力曲线','second-csv'));
  const before=structuredClone(physical.getState().objects);await physical.persist.rehydrate();
  assert.deepEqual(physical.getState().objects,before);
  const saved=JSON.parse(localStorage.getItem('protangram-physical-objects-v1'));assert.equal(saved.version,7);
  assert.equal(saved.state.objects[0].configurations[0].experiments[0].trials[0].charts.length,2);
});
test('task books and report references read the canonical trial results for every execution', () => {
  const f=fixture();f.store.saveChart(f.trialId,f.first,chart('转速曲线','first-csv'));f.store.saveChart(f.trialId,f.second,chart('推力曲线','second-csv'));
  const snapshot=structuredClone(physical.getState().objects);
  const sources=api.getTaskTrialSources(api.getTaskTrials(physical.getState().objects,[],[],'task'));
  assert.equal(sources.charts.length,2);
  assert.deepEqual(sources.charts.map(item=>item.reference.testRecordId),[f.first,f.second]);
  for(const item of sources.charts) assert.equal(api.resolveRecordChart(physical.getState().objects,item.reference).chart,item.chart);
  assert.deepEqual(physical.getState().objects,snapshot);
});
