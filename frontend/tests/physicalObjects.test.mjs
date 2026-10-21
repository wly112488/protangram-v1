import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
globalThis.localStorage = new MemoryStorage();
const bundle = await build({ stdin: { contents: "export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/trialDataFiles';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { usePhysicalObjectStore: physical, buildChartPoints, parseTrialCsv, findPhysicalTrialRecord, migratePhysicalState, findObjectCategory, getRecordCharts } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const field = (id, value = '10') => ({ id, name: id, value, form: '单值', description: '描述' });
const file = id => ({ id, name: `${id}.csv`, mimeType: 'text/csv', size: 32, addedAt: '', headers: ['time', 'thrust'], rowCount: 3 });
const chart = (rawFileId, scale = 1) => ({ name: '推力', rawFileId, xField: 'time', yField: 'thrust', chartType: 'line', startRow: 0, endRow: 0, scale, offset: 0, color: '#1677ff', smooth: false });
const fixture = () => {
  physical.setState({ objects: [] });const store = physical.getState();
  const objectId = store.addRoot({ name: '电涵道风扇', type: '涵道风扇' });
  const configurationId = store.addConfiguration(objectId, { name: '风扇 A' });
  const experimentId = store.addExperiment(configurationId, { name: '出口探针布置', parameters: [field('probe')] });
  const trialId = store.addConcreteTrial(experimentId, { name: '起飞试验', loadSpectrum: '载荷谱 01' });
  const trial = () => physical.getState().objects[0].configurations[0].experiments[0].trials[0];
  return { store, objectId, configurationId, experimentId, trialId, trial };
};
test('repeat executions have distinct records; records own raw files and tables while the trial owns attributed shared charts', () => {
  const { store, trialId, trial } = fixture();
  const first = store.addTrialRecord(trialId, {}), second = store.addTrialRecord(trialId, { name: '复测' });
  assert.notEqual(first, second);assert.deepEqual(trial().records.map(item => item.executionNumber), [1, 2]);
  store.addRawFile(trialId, first, file('csv-a'));store.addRawFile(trialId, first, file('csv-a2'));store.addRawFile(trialId, second, file('csv-b'));
  const firstChart = store.saveChart(trialId, first, chart('csv-a'));
  const secondChart = store.saveChart(trialId, first, { ...chart('csv-a', 2), name: '修正推力' });
  store.saveChart(trialId, first, chart('csv-a', 3), firstChart);
  const tableId = store.saveTable(trialId, first, { name: '原始数据表', rawFileId: 'csv-a2', fields: ['time', 'thrust'], startRow: 0, endRow: 0 });
  assert.equal(trial().charts.find(item => item.id === secondChart).scale, 2);
  assert.equal(trial().records[0].rawFiles.length, 2);assert.equal(trial().records[0].tables[0].id, tableId);
  assert.equal(trial().records[1].rawFiles.length, 1);assert.equal(getRecordCharts(trial(), second).length, 0);
  store.updateTrialRecord(trialId, second, { description: '复测说明' });assert.equal(trial().records[0].description, undefined);
  const saved = JSON.parse(localStorage.getItem('protangram-physical-objects-v1'));assert.equal(saved.version, 6);assert.equal(saved.state.objects[0].configurations[0].experiments[0].trials[0].records.length, 2);
});
test('write operations require the exact record and never route files or results to another execution', () => {
  const { store, trialId, trial } = fixture();const a = store.addTrialRecord(trialId, {}), b = store.addTrialRecord(trialId, {});
  store.addRawFile(trialId, a, file('csv-a'));const snapshot = structuredClone(trial());
  assert.throws(() => store.addRawFile(trialId, 'missing', file('bad')), /指定试验记录不存在/);
  assert.throws(() => store.updateTrialRecord(trialId, '', { name: '覆盖' }), /指定试验记录不存在/);
  assert.throws(() => store.saveChart(trialId, b, chart('csv-a')), /本记录/);
  assert.throws(() => store.saveTable(trialId, b, { name: '错误', rawFileId: 'csv-a', fields: ['time'], startRow: 0, endRow: 0 }), /本记录/);
  assert.throws(() => store.addTrialRecord('missing-trial', {}), /所属具体试验不存在/);
  assert.deepEqual(trial(), snapshot);
});

test('shared table names are unique across executions and updating a table preserves its identity', () => {
  const { store, trialId, trial } = fixture();
  const first = store.addTrialRecord(trialId, {}), second = store.addTrialRecord(trialId, {});
  store.addRawFile(trialId, first, file('csv-first')); store.addRawFile(trialId, second, file('csv-second'));
  const input = { name: '选定工况', rawFileId: 'csv-first', fields: ['time'], startRow: 0, endRow: 0 };
  const id = store.saveTable(trialId, first, input);
  assert.throws(() => store.saveTable(trialId, second, { ...input, rawFileId: 'csv-second' }), /同名/);
  assert.equal(store.saveTable(trialId, first, { ...input, fields: ['time', 'thrust'] }, id), id);
  assert.equal(trial().records[0].tables.length, 1);
  assert.deepEqual(trial().records[0].tables[0].fields, ['time', 'thrust']);
});

test('removing a CSV marks it unavailable but preserves its identity and existing result references', () => {
  const { store, trialId, trial } = fixture();
  const recordId = store.addTrialRecord(trialId, {});
  store.addRawFile(trialId, recordId, file('csv-remove'));
  const chartId = store.saveChart(trialId, recordId, chart('csv-remove'));

  store.removeRawFile(trialId, recordId, 'csv-remove');

  assert.equal(trial().records[0].rawFiles[0].status, 'removed');
  assert.equal(trial().charts.find(item => item.id === chartId).rawFileId, 'csv-remove');
  assert.throws(() => store.saveTable(trialId, recordId, { name: '新表', rawFileId: 'csv-remove', fields: ['time'], startRow: 0, endRow: 0 }), /已移除/);
});
test('load spectrum is only an identifier and different spectrum after execution requires a different trial', () => {
  const { store, trialId, experimentId, trial } = fixture();store.updateConcreteTrial(trialId, { loadSpectrum: '载荷谱 02' });store.addTrialRecord(trialId, {});
  assert.throws(() => store.updateConcreteTrial(trialId, { loadSpectrum: '载荷谱 03' }), /新建具体试验/);
  store.updateConcreteTrial(trialId, { name: '名称更正', taskBookId: 'task-1' });assert.equal(trial().loadSpectrum, '载荷谱 02');assert.equal(trial().taskBookId, 'task-1');
  const next = store.addConcreteTrial(experimentId, { name: '下一项试验', loadSpectrum: '载荷谱 03' });assert.notEqual(next, trialId);
  assert.throws(() => store.addConcreteTrial(experimentId, { name: '无标识', loadSpectrum: '' }), /载荷谱/);
});
test('trial configurations have independent parameters and used setup cannot silently overwrite historical meaning', () => {
  const { store, configurationId, experimentId, trialId } = fixture();
  const next = store.addExperiment(configurationId, { name: '另一布置', parameters: [field('another-probe', '20')] });
  store.updateExperiment(next, { parameters: [field('another-probe', '30')] });
  store.updateExperiment(experimentId, { parameters: [field('probe')] });store.addTrialRecord(trialId, {});
  assert.throws(() => store.updateExperiment(experimentId, { parameters: [] }), /不可覆盖/);
  store.updateExperiment(experimentId, { name: '布置名称更正' });
  const experiments = physical.getState().objects[0].configurations[0].experiments;assert.equal(experiments[0].parameters[0].value, '10');assert.equal(experiments[1].parameters[0].value, '30');
});
test('CSV chart points respect fields, ranges and blank cells', () => {
  const parsed = parseTrialCsv('time,thrust\n0,10\n1,20\n2,\n3,no-data\n4,0\n');
  assert.deepEqual(parsed.headers, ['time', 'thrust']);assert.deepEqual(buildChartPoints(parsed.rows, 'time', 'thrust', { startRow: 1, endRow: 0, scale: 0.5, offset: 2 }), [[1, 12], [4, 2]]);
});
test('v0 migration keeps configuration identity, task association and all original measurement records', async () => {
  const old = { objects: [{ id: 'old-config', name: '风扇 A', type: '涵道风扇', basedOnId: 'old-base', experiments: [{ id: 'old-exp', name: '旧试验', taskBookId: 'old-task', settings: [field('setup')], parameters: [field('parameter')], records: [ { id: 'old-record-1', name: '第一轮', createdAt: '2026-10-12', data: [field('m1')] }, { id: 'old-record-2', name: '第二轮', createdAt: '2026-10-13', data: [field('m2', '20')] } ] }] }] };
  localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ version: 0, state: old }));await physical.persist.rehydrate();
  const config = physical.getState().objects[0].configurations[0], exp = config.experiments[0], trial = exp.trials[0];
  assert.equal(config.id, 'old-config');assert.equal(config.basedOnId, 'old-base');assert.equal(trial.taskBookId, 'old-task');assert.equal(trial.records.length, 2);assert.equal(trial.records[1].measurements[0].value, '20');assert.equal(exp.parameters.length, 2);assert.equal(exp.settings, undefined);assert.equal(trial.record, undefined);
  assert.equal(findPhysicalTrialRecord(physical.getState().objects, config.id, exp.id, 'old-record-2').id, 'old-record-2');
  await physical.persist.rehydrate();assert.equal(physical.getState().objects[0].configurations[0].experiments[0].trials[0].records.length, 2);
});
const oldRecord = (id, date) => ({ id, name: id, createdAt: date, actualConditions: [field('actual')], measurements: [field('measured')], rawFiles: [file(id+'-csv')], charts: [{ ...chart(id+'-csv'), id: id+'-chart', createdAt: date, updatedAt: date, modelId: 'legacy-model', modelInputs: [field('legacy-input')] }] });
const canonical = experiment => ({ objects: [{ id: 'object', name: '电涵道风扇', configurations: [{ id: 'config', name: '风扇 A', parameters: [], materials: [], designs: [], children: [], models: [{ id: 'legacy-model', name: '旧模型' }], experiments: [experiment] }] }] });
test('v2 record and archives migrate to a stable trial with all CSV and chart references intact', () => {
  const current = oldRecord('current','2026-10-13'), archive = oldRecord('archive','2026-10-12');
  const migrated = migratePhysicalState(canonical({ id: 'exp', name: '布置', record: current, archivedRecords: [archive], settings: [field('s')], parameters: [field('p')] }));
  const trial = migrated.objects[0].configurations[0].experiments[0].trials[0];assert.equal(trial.id, 'trial-exp');assert.deepEqual(trial.records.map(record => record.id), ['archive','current']);
  assert.deepEqual(trial.records[1].rawFiles,current.rawFiles);assert.deepEqual(getRecordCharts(trial, 'current').map(({sourceRecordId, ...chart}) => chart),current.charts);assert.equal(trial.loadSpectrum,'');assert.equal(trial.archivedRecords,undefined);assert.equal(trial.records[1].executionNumber,2);
  assert.deepEqual(migratePhysicalState(migrated), migrated);
});
test('v3 migration retains existing trial IDs and references, merges fields without losing conflicting contents', () => {
  const current = oldRecord('v3-current','2026-10-13'), archive = oldRecord('v3-old','2026-10-12');
  const migrated = migratePhysicalState(canonical({ id:'exp',name:'布置', settings:[field('same-id','10')],parameters:[field('same-id','20')],trials:[{id:'trial-v3',name:'试验',taskBookId:'task',designs:[field('legacy-design')],designArtifactRef:{projectId:'p',artifactId:'d'},record:current,archivedRecords:[archive]}] }));
  const exp=migrated.objects[0].configurations[0].experiments[0],trial=exp.trials[0];assert.equal(trial.id,'trial-v3');assert.deepEqual(trial.records.map(record=>record.id),['v3-old','v3-current']);assert.equal(exp.parameters.length,2);assert.equal(new Set(exp.parameters.map(field=>field.id)).size,2);assert.deepEqual(trial.designArtifactRef,{projectId:'p',artifactId:'d'});assert.equal(trial.designs[0].id,'legacy-design');
});
test('legacy trial may acquire a missing spectrum once; new execution still uses a new record ID', () => {
  physical.setState(migratePhysicalState(canonical({id:'exp',name:'布置',trials:[{id:'old-trial',name:'试验',record:oldRecord('old-record','2026-10-13')}]})));
  const store=physical.getState();assert.throws(()=>store.addTrialRecord('old-trial',{}),/补充/);store.updateConcreteTrial('old-trial',{loadSpectrum:'补登载荷谱'});const next=store.addTrialRecord('old-trial',{});assert.notEqual(next,'old-record');assert.equal(getRecordCharts(physical.getState().objects[0].configurations[0].experiments[0].trials[0], 'old-record')[0].id,'old-record-chart');
});

test('partly migrated legacy records join the existing stable trial without duplicate entities or input mutation', () => {
  const current = oldRecord('current','2026-10-13'), archive = oldRecord('archive','2026-10-12');
  const input = canonical({id:'exp',name:'旧布置',taskBookId:'task',record:current,archivedRecords:[archive],trials:[{id:'trial-exp',name:'旧试验',record:current,archivedRecords:[]}]});
  const before = structuredClone(input), result = migratePhysicalState(input), trials = result.objects[0].configurations[0].experiments[0].trials;
  assert.deepEqual(input,before);assert.equal(trials.length,1);assert.equal(trials[0].taskBookId,'task');assert.deepEqual(trials[0].records.map(record=>record.id),['archive','current']);
});
test('an old task association without records still becomes a concrete trial association', () => {
  const migrated = migratePhysicalState(canonical({id:'exp',name:'旧布置',taskBookId:'task',settings:[],parameters:[]}));
  const trial = migrated.objects[0].configurations[0].experiments[0].trials[0];assert.equal(trial.taskBookId,'task');assert.equal(trial.records.length,0);assert.equal(trial.loadSpectrum,'');
});


test('the first store import hydrates v3 data before any page action, without an initialization-order failure', async () => {
  const input=canonical({id:'exp',name:'旧布置',settings:[field('setup')],parameters:[],trials:[{id:'old-trial',name:'旧试验',record:oldRecord('old-record','2026-10-13')}]});
  localStorage.setItem('protangram-physical-objects-v1',JSON.stringify({version:3,state:input}));
  const fresh = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}#initial-hydration`);
  assert.equal(fresh.usePhysicalObjectStore.persist.hasHydrated(),true);
  const objects=fresh.usePhysicalObjectStore.getState().objects;assert.equal(objects.length,3);assert.equal(objects[0].configurations[0].experiments[0].trials[0].records[0].id,'old-record');
  assert.equal(JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).version,6);
});


test('categories stay available and each concrete object owns its parameters and test configurations', () => {
  physical.setState(migratePhysicalState({objects: []}));
  const store = physical.getState();
  assert.deepEqual(store.objects.map(category => category.name), ['涵道风扇', '电机', '电推进']);
  const categoryId = store.objects[0].id;
  assert.equal(store.addRoot({name:'涵道风扇',type:'涵道风扇'}), categoryId);
  const first=store.addConfiguration(categoryId,{name:'电涵道风扇 A'}), second=store.addConfiguration(categoryId,{name:'电涵道风扇 B'});
  store.addField(first,'parameters',field('diameter'));
  store.addExperiment(first,{name:'静推力布置',parameters:[]});
  const devices=physical.getState().objects[0].configurations;
  assert.deepEqual(devices.map(object=>object.id),[first,second]);
  assert.equal(devices[0].parameters.length,1);assert.equal(devices[1].parameters.length,0);
  assert.equal(devices[0].experiments.length,1);assert.equal(devices[1].experiments.length,0);
  assert.throws(()=>store.addConfiguration('missing-category',{name:'不可错挂'}),/对象类别不存在/);
  assert.equal(physical.getState().objects.length,3);
});

test('v4 grouping uses category instead of an extra equipment layer and preserves old links and record identities', () => {
  const record=oldRecord('kept-record','2026-10-13');
  const one=canonical({id:'exp',name:'试验构型',parameters:[],trials:[{id:'trial',name:'具体试验',loadSpectrum:'谱01',taskBookId:'task',records:[record]}]}).objects[0];
  one.type='涵道风扇';one.name='电涵道风扇';
  const two={...structuredClone(one),id:'another-group',name:'另一组风扇',configurations:[{...structuredClone(one.configurations[0]),id:'second-device',experiments:[]}]};
  const original=structuredClone({objects:[one,two]}), migrated=migratePhysicalState(original);
  assert.deepEqual(original,{objects:[one,two]});
  assert.equal(migrated.objects.filter(category=>category.name==='涵道风扇').length,1);
  assert.deepEqual(migrated.objects[0].configurations.map(object=>object.id),['config','second-device']);
  assert.equal(findObjectCategory(migrated.objects,'another-group').id,'object');
  const kept=findPhysicalTrialRecord(migrated.objects,'config','exp','kept-record');
  assert.deepEqual(kept.rawFiles,record.rawFiles);assert.deepEqual(getRecordCharts(migrated.objects[0].configurations[0].experiments[0].trials[0], kept.id).map(({sourceRecordId, ...chart}) => chart),record.charts);
  assert.equal(migrated.objects[0].configurations[0].experiments[0].trials[0].taskBookId,'task');
  assert.deepEqual(migratePhysicalState(migrated),migrated);
});

test('mixed legacy devices and parent business fields are retained without duplicating on another migration', () => {
  const old={objects:[{id:'legacy-device',name:'旧设备',type:'电机',parameters:[field('torque')],experiments:[]},
    {id:'legacy-parent',name:'旧风扇',type:'涵道风扇',parameters:[field('diameter')],configurations:[{id:'child-device',name:'风扇B',parameters:[],experiments:[]}]}]};
  const migrated=migratePhysicalState(old);
  assert.equal(findObjectCategory(migrated.objects,'legacy-device').configurations[0].id,'legacy-device');
  const category=findObjectCategory(migrated.objects,'legacy-parent');
  assert.deepEqual(category.configurations.map(object=>object.id),['legacy-parent','child-device']);
  assert.equal(category.configurations[0].parameters[0].id,'diameter');
  assert.deepEqual(migratePhysicalState(migrated),migrated);
});
