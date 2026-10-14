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
const bundle = await build({
  stdin: { contents: "export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/trialDataFiles';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const { usePhysicalObjectStore, buildChartPoints, parseTrialCsv, findPhysicalTrialRecord } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('a concrete trial owns one record and keeps independent chart configurations under a trial configuration', () => {
  const store = usePhysicalObjectStore.getState();
  const familyId = store.addRoot({ name: 'E2E 风扇', type: '涵道风扇' });
  const configurationId = store.addConfiguration(familyId, { name: 'E2E 风扇 A' });
  assert.ok(configurationId);
  store.addField(configurationId, 'parameters', { name: '转速', description: '轴转速', unit: 'r/min', form: '单值', value: '1200' });
  const experimentId = store.addExperiment(configurationId, {
    name: '试验构型 A', category: '性能与功能类', settings: [], parameters: [],
  });
  const trialId = store.addConcreteTrial(experimentId, { name: '起飞设计点性能试验', taskBookId: 'task-1', designs: [{ id: 'design-1', name: '设计点转速', value: '1200', unit: 'r/min', form: '单值', usage: '条件' }] });

  const recordId = store.ensureTrialRecord(trialId, {
    name: '起飞设计点记录', actualConditions: [], measurements: [{ id: 'measurement-1', name: '推力', value: '830', unit: 'N', form: '单值' }],
  });
  assert.equal(store.ensureTrialRecord(trialId, { name: '重复点击', actualConditions: [], measurements: [] }), recordId);

  store.addRawFile(trialId, { id: 'raw-1', name: 'run.csv', mimeType: 'text/csv', size: 32, addedAt: new Date().toISOString(), headers: ['time', 'thrust'], rowCount: 3 });
  const firstChart = store.saveChart(trialId, { name: 'C001', rawFileId: 'raw-1', xField: 'time', yField: 'thrust', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: true });
  const secondChart = store.saveChart(trialId, { name: 'C002', rawFileId: 'raw-1', xField: 'time', yField: 'thrust', chartType: 'scatter', startRow: 1, endRow: 3, scale: 0.5, offset: 2, color: '#ff4d4f', smooth: false });
  store.saveChart(trialId, { name: 'C001', rawFileId: 'raw-1', xField: 'time', yField: 'thrust', chartType: 'bar', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false }, firstChart);

  const experiment = usePhysicalObjectStore.getState().objects.find(item => item.id === familyId).configurations[0].experiments[0];
  const trial = experiment.trials[0];
  assert.equal(trial.taskBookId, 'task-1');
  assert.equal(trial.designs[0].value, '1200');
  assert.equal(trial.record.id, recordId);
  assert.equal(trial.record.rawFiles.length, 1);
  assert.equal(trial.record.charts.length, 2);
  assert.equal(trial.record.charts.find(item => item.id === firstChart).chartType, 'bar');
  assert.equal(trial.record.charts.find(item => item.id === secondChart).chartType, 'scatter');
  assert.equal(trial.record.measurements[0].value, '830');

  const persisted = JSON.parse(localStorage.getItem('protangram-physical-objects-v1'));
  assert.equal(persisted.state.objects.find(item => item.id === familyId).configurations[0].experiments[0].trials[0].record.charts.length, 2);
});

test('chart points come from imported CSV fields, row range, scale and offset', () => {
  const data = parseTrialCsv('time_s,thrust_n\n0,10\n1,20\n2,30\n');
  assert.deepEqual(data.headers, ['time_s', 'thrust_n']);
  assert.deepEqual(buildChartPoints(data.rows, 'time_s', 'thrust_n', { startRow: 1, endRow: 3, scale: 0.5, offset: 2 }), [[1, 12], [2, 17]]);
});

test('blank and nonnumeric cells are skipped instead of plotted as zero', () => {
  const data = parseTrialCsv('time,value\n0,10\n1,\n2,   \n,20\n3,no-data\n4,0\n');
  assert.deepEqual(buildChartPoints(data.rows, 'time', 'value', { startRow: 0, endRow: 0, scale: 1, offset: 0 }), [[0, 10], [4, 0]]);
  assert.deepEqual(buildChartPoints(data.rows, 'time', 'value', { startRow: 0, endRow: 0, scale: 0, offset: 2 }), [[0, 2], [4, 2]]);
});

test('legacy migration preserves object identity, relationships and every record', async () => {
  const records = [
    { id: 'old-record-1', name: '第一轮', createdAt: '2026-10-12', data: [{ id: 'm1', name: '推力', form: '单值', value: '10' }] },
    { id: 'old-record-2', name: '第二轮', createdAt: '2026-10-13', data: [{ id: 'm2', name: '推力', form: '单值', value: '20' }] },
  ];
  const legacy = { objects: [{ id: 'old-config', name: '风扇 A', type: '涵道风扇', basedOnId: 'old-base', parameters: [], materials: [], children: [], designs: [], models: [], experiments: [{ id: 'old-exp', name: '性能试验', category: '性能与功能类', settings: [], taskBookId: 'old-task', records }] }] };
  localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ state: legacy, version: 0 }));
  await usePhysicalObjectStore.persist.rehydrate();
  const config = usePhysicalObjectStore.getState().objects[0].configurations[0];
  assert.equal(config.id, 'old-config');
  assert.equal(config.basedOnId, 'old-base');
  assert.equal(config.experiments[0].id, 'old-exp');
  assert.equal(config.experiments[0].taskBookId, 'old-task');
  assert.equal(config.experiments[0].trials[0].record.id, records[0].id);
  assert.equal(config.experiments[0].trials[0].archivedRecords[0].id, records[1].id);
  assert.equal(config.experiments[0].trials[0].archivedRecords[0].measurements[0].value, '20');
  const objects = usePhysicalObjectStore.getState().objects;
  assert.equal(findPhysicalTrialRecord(objects, 'old-config', 'old-exp', 'old-record-2').measurements[0].value, '20');
  assert.equal(findPhysicalTrialRecord(objects, 'old-config', 'old-exp', 'missing-record'), undefined);
  await usePhysicalObjectStore.persist.rehydrate();
  assert.equal(usePhysicalObjectStore.getState().objects[0].configurations[0].experiments[0].trials[0].archivedRecords[0].id, 'old-record-2');
});

test('v2 migration keeps canonical objects and attaches legacy records to a stable concrete-trial id', async () => {
  const record = { id: 'v2-record', name: '旧记录', createdAt: '2026-10-13', actualConditions: [], measurements: [{ id: 'm', name: '推力', value: '800', unit: 'N', form: '单值' }], rawFiles: [], charts: [] };
  const v2 = { objects: [{ id: 'object-v2', name: '电涵道风扇', type: '涵道风扇', description: '', configurations: [{ id: 'config-v2', name: '电涵道风扇 A', description: '', parameters: [{ id: 'field-v2', name: '转速', value: '1200', unit: 'r/min', form: '单值' }], materials: [], children: [], designs: [], models: [], experiments: [{ id: 'trial-config-v2', name: '风洞布置', category: '性能与功能类', settings: [], parameters: [], record, archivedRecords: [] }] }], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] }] };
  localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ state: v2, version: 2 }));
  await usePhysicalObjectStore.persist.rehydrate();
  const object = usePhysicalObjectStore.getState().objects[0];
  const config = object.configurations[0];
  const trialConfiguration = config.experiments[0];
  assert.equal(object.id, 'object-v2');
  assert.equal(config.id, 'config-v2');
  assert.equal(config.parameters[0].id, 'field-v2');
  assert.equal(trialConfiguration.id, 'trial-config-v2');
  assert.equal(trialConfiguration.record, undefined);
  assert.equal(trialConfiguration.trials[0].id, 'trial-trial-config-v2');
  assert.equal(trialConfiguration.trials[0].record.id, 'v2-record');
  assert.equal(trialConfiguration.trials[0].record.measurements[0].value, '800');
});
