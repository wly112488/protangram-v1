import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ stdin: { contents: "export * from './src/workspace/resultCatalogModel'; export * from './src/workspace/csvWorksheetModel';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const file = id => ({ id, name: '同名.csv', headers: ['time', 'speed', 'temperature'], rowCount: 100, status: 'available' });
const record = (id, rawFiles) => ({ id, name: id, executionNumber: 1, rawFiles, tables: [] });
const trial = (id, records) => ({ id, name: id, loadSpectrum: '同名载荷谱', records, charts: [] });

test('catalog retains trial/record/file identity, including files with no saved charts', () => {
  const a = file('a'), b = file('b');
  const ra = record('run-a', [a]), rb = record('run-b', [b]);
  const entry = { key: 'chart-a', kind: 'chart', name: '转速', trialId: 'trial-a', record: ra, rawFile: a };
  const catalog = api.buildResultCatalog([entry], [trial('trial-a', [ra]), trial('trial-b', [rb])]);
  assert.equal(catalog.length, 2);
  assert.notEqual(catalog[0].key, catalog[1].key);
  assert.equal(catalog[0].records[0].files[0].results[0].entry, entry);
  assert.equal(catalog[1].records[0].files[0].file, b);
  assert.equal(catalog[1].records[0].files[0].results.length, 0);
});

test('professional results retain multi-file provenance at trial scope without cloning into CSV nodes', () => {
  const a = file('a'), b = file('b'), t = trial('trial', [record('run', [a, b])]);
  const result = { key: 'prediction', name: '预测', kind: 'table', artifact: { type: 'virtualCondition', summary: '预测说明', payload: { sourceScope: { trialId: t.id }, sourceContext: { rawFiles: [a, b] } } } };
  const catalog = api.buildResultCatalog([result], [t]);
  assert.equal(catalog[0].results[0].entry, result);
  assert.match(catalog[0].results[0].sourceLabel, /多文件/);
  assert.equal(catalog[0].records[0].files.length, 2);
  assert.equal(catalog[0].records[0].files.flatMap(file => file.results).length, 0);
});

test('worksheet edits preserve the original CSV and reject ambiguous field names', () => {
  const original = { headers: ['time', 'speed', 'temperature'], rows: [{ time: '0', speed: '3000', temperature: '25' }] };
  const renamed = api.renameWorksheetField(original, 'speed', '转速');
  const edited = api.editWorksheetCell(renamed, 0, '转速', '3500');
  assert.equal(original.rows[0].speed, '3000');
  assert.equal(renamed.rows[0]['转速'], '3000');
  assert.equal(edited.rows[0]['转速'], '3500');
  assert.throws(() => api.renameWorksheetField(original, 'speed', 'time'), /同名/);
  assert.throws(() => api.renameWorksheetField(original, 'speed', ' '), /名称/);
  const roundtrip = api.parseWorksheetCsv(api.serializeWorksheet(edited));
  assert.deepEqual(roundtrip, edited);
});

test('column clicks select plotting inputs in click order and shift selects a range', () => {
  const headers = ['time', 'speed', 'temperature', 'pressure'];
  assert.deepEqual(api.selectWorksheetColumn(headers, [], 'speed', {}), ['speed']);
  assert.deepEqual(api.selectWorksheetColumn(headers, ['speed'], 'temperature', { additive: true }), ['speed', 'temperature']);
  assert.deepEqual(api.selectWorksheetColumn(headers, ['speed'], 'pressure', { range: true }), ['speed', 'temperature', 'pressure']);
});

test('one CSV contains results from different capabilities and execution nodes remain distinct', () => {
  const a = file('a'), ra = record('one', [a]), rb = record('two', [file('b')]);
  const entries = ['doe', 'analysis'].map(capability => ({ key: capability, kind: 'chart', name: capability, trialId: 'trial', record: ra, rawFile: a, artifact: { payload: { sourceCapability: capability } } }));
  const catalog = api.buildResultCatalog(entries, [trial('trial', [ra, rb])]);
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0].records.length, 2);
  assert.deepEqual(catalog[0].records[0].files[0].results.map(item => item.entry.key), ['doe', 'analysis']);
});

test('a design carrying available CSV context is not falsely presented as derived from that CSV', () => {
  const a = file('a'), t = trial('trial', [record('run', [a])]);
  const entry = { key: 'design', name: '试验方案', kind: 'table', artifact: { type: 'design', payload: { sourceScope: { trialId: t.id }, sourceContext: { rawFiles: [a] } } } };
  const [catalog] = api.buildResultCatalog([entry], [t]);
  assert.equal(catalog.records[0].files[0].results.length, 0);
  assert.equal(catalog.results[0].entry, entry);
});

test('modern CFG-only and generic results are not mislabeled as historical trial data',()=>{
  const entry=owner=>({key:'result',kind:'table',name:'新成果',artifact:{type:'design',payload:{resourceOwner:owner}}});
  assert.equal(api.buildResultCatalog([entry({kind:'cfg',cfgId:'cfg'})])[0].name,'构型成果');
  assert.equal(api.buildResultCatalog([entry({kind:'session',sessionId:'s'})])[0].name,'通用成果');
  assert.equal(api.buildResultCatalog([entry(undefined)])[0].name,'未关联试验的历史成果');
});
