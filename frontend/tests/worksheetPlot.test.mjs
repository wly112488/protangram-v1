import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export * from './src/workspace/trialChartOutput';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const base = { rawFileId: 'csv', xField: 't', yField: 'a', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false };
const rows = [{ t: '0', a: '2', b: '10' }, { t: '1', a: '4', b: '20' }, { t: '2', a: '', b: '30' }, { t: '3', a: '8', b: '40' }];
test('multiple selected columns produce independent named series without coercing blank cells to zero', () => {
  const option = api.createTrialChartOption({ ...base, plotKind: 'line', yFields: ['a', 'b'] }, rows);
  assert.equal(option.series.length, 2);
  assert.deepEqual(option.series[0].data, [[0, 2], [1, 4], [3, 8]]);
  assert.equal(option.series[1].name, 'b');
});
test('sample means use complete paired rows and preserve the chosen grouping', () => {
  const option = api.createTrialChartOption({ ...base, plotKind: 'line', yFields: ['a'], averageEvery: 2 }, rows);
  assert.deepEqual(option.series[0].data, [[0.5, 3], [3, 8]]);
  assert.equal(rows[0].a, '2');
});
test('bubble charts bind a third numeric field and histogram works with one column', () => {
  const bubble = api.createTrialChartOption({ ...base, plotKind: 'bubble', sizeField: 'b' }, rows);
  assert.deepEqual(bubble.series[0].data[0], [0, 2, 10]);
  const histogram = api.createTrialChartOption({ ...base, plotKind: 'histogram', xField: 'a' }, rows);
  assert.equal(histogram.series[0].type, 'bar');
  assert.equal(histogram.series[0].data.reduce((a, b) => a + b, 0), 3);
});
test('missing mapped fields and unconfigured third field do not silently generate an unrelated chart', () => {
  assert.throws(() => api.createTrialChartOption({ ...base, plotKind: 'bubble' }, rows), /第三|大小/);
  assert.throws(() => api.createTrialChartOption({ ...base, plotKind: 'line', yFields: ['unknown'] }, rows), /字段|数值/);
});
test('legacy two-column graphs keep the existing scale/offset behavior', () => {
  const option = api.createTrialChartOption({ ...base, scale: 2, offset: 1 }, rows);
  assert.deepEqual(option.series[0].data, [[0, 5], [1, 9], [3, 17]]);
});
