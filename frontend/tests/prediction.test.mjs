import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export * from './src/workspace/predictionContract'; export * from './src/services/predictionApi'; export * from './src/workspace/predictionParameters'; export * from './src/services/predictionPreview';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const reference = id => ({ physicalObjectId: `object-${id}`, physicalObjectName: `对象 ${id}`, experimentId: id, experimentName: `构型 ${id}` });
const target = { ...reference('target'), objectParameters: [], configurationParameters: [], testType: 'thrust' };
const model = { modelId: 'server-model', modelName: '推力模型', version: 'V2', sourceConfiguration: reference('source'), availability: 'available', inputFields: [{ key: 'speed', label: '转速', type: 'number', required: true, unit: 'rpm' }] };
const context = { scope: { physicalObjectId: target.physicalObjectId, experimentId: target.experimentId, trialId: 'trial', testRecordId: 'record-1' }, objectParameters: [], configurationParameters: [], rawFiles: [], records: [], results: [] };
const request = { requestId: 'request', service: 'virtualCondition', targetConfiguration: target, context, inputs: { speed: 3000 } };
const task = { ...request, model, taskId: 'task', status: 'completed', resultMode: 'computed', saved: false, completedAt: '2026-10-15T08:00:00Z', result: { summary: '计算完成', columns: [{ key: 'thrust', label: '推力' }], rows: [{ thrust: 10 }] } };

test('target inputs are available without backend preparation and remain editable independently of context', () => {
  const configured = { ...context, configurationParameters: [{ id: 'speed', name: '转速', value: '4000', unit: 'rpm', form: '单值' }] };
  const preparation = api.predictionPreparation('digitalTwin', configured);
  assert.deepEqual(api.predictionUserFields(preparation).map(field => field.key), ['speed', 'temperature', 'pressure']);
  assert.deepEqual(api.predictionInputs(preparation, { speed: 9999, temperature: 30, obsolete: 1 }), { speed: 9999, temperature: 30, pressure: 101.3 });
  assert.deepEqual(api.predictionInputs(preparation), { speed: 4000, temperature: 25, pressure: 101.3 });
  assert.equal(api.preparePrediction, undefined);
  const current = { ...configured, records: [{ id: 'record-1', actualConditions: [{ id: 'rpm', name: '转速', value: '5000', unit: 'rpm', form: '单值' }] }] };
  assert.equal(api.predictionInputs(api.predictionPreparation('digitalTwin', current)).speed, 5000);
  assert.equal(api.predictionInputs(api.predictionPreparation('digitalTwin', { ...current, scope: { ...context.scope, testRecordId: 'record-2' } })).speed, 4000);
  assert.deepEqual(configured.configurationParameters, [{ id: 'speed', name: '转速', value: '4000', unit: 'rpm', form: '单值' }]);
});
test('prediction inputs stay specific to each function and reject ambiguous inherited values', () => {
  const invalid = { ...context, configurationParameters: [
    { id: 'speed', name: '转速', value: '1000～2000', unit: 'rpm', form: '范围' },
    { id: 'pressure', name: '压力', value: '1.5', unit: 'MPa', form: '单值' },
    { id: 'temperature', name: '温度', value: '', unit: '℃', form: '单值' },
  ] };
  assert.deepEqual(api.predictionInputs(api.predictionPreparation('digitalTwin', invalid)), { speed: 3000, temperature: 25, pressure: 101.3 });
  const virtual = api.predictionPreparation('virtualCondition', context);
  assert.deepEqual(api.predictionUserFields(virtual).map(field => field.key), ['speedMin', 'speedMax', 'temperatureMin', 'temperatureMax', 'pressureMin', 'pressureMax', 'count']);
  assert.match(api.predictionParameterError({ speedMin: 4000, speedMax: 3000 }), /上限不能小于下限/);
  assert.match(api.predictionParameterError({ count: 1.5 }), /正整数/);
  assert.equal(api.predictionParameterError(api.predictionInputs(virtual)), '');
});
test('backend chooses the model while requests carry execution context and real CSV data', async () => {
  const original = globalThis.fetch;
  let posted;
  try {
    globalThis.fetch = async (_url, options) => { posted = JSON.parse(options.body); return Response.json({ success: true, data: task }); };
    const result = await api.runPrediction({ ...request, csvData: [{ rawFileId: 'csv', headers: ['speed'], rows: [{ speed: '3000' }] }] }, new AbortController().signal);
    assert.equal(posted.model, undefined);
    assert.equal(posted.csvData[0].rows[0].speed, '3000');
    assert.equal(result.model.sourceConfiguration.experimentId, 'source');
    assert.equal(result.context.scope.testRecordId, 'record-1');
  } finally { globalThis.fetch = original; }
});
test('demo, incomplete, wrong target, wrong execution, wrong inputs and stale requests cannot become saved results', () => {
  for (const patch of [{ resultMode: 'demo' }, { status: 'running' }, { taskId: '' }, { targetConfiguration: { ...target, experimentId: 'source' } }, { context: { ...context, scope: { ...context.scope, testRecordId: 'record-2' } } }, { context: undefined }, { inputs: { speed: 9000 } }, { requestId: 'stale' }, { targetConfiguration: { ...target, testType: 'thermal' } }, { targetConfiguration: { ...target, configurationParameters: undefined } }]) assert.throws(() => api.parsePredictionTask({ ...task, ...patch }, request));
  assert.throws(() => api.parsePredictionTask(task, request, true));
  assert.equal(api.parsePredictionTask({ ...task, saved: true }, request, true).saved, true);
});
test('failed requests remain business failures and never become demo fallback or technical status UI', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Not found', { status: 404 });
    assert.equal(api.predictionPreparation('digitalTwin', context).inputFields.length, 3);
    await assert.rejects(api.runPrediction(request, new AbortController().signal), /本次计算未完成/);
    globalThis.fetch = async () => Response.json({ success: false, error: '模型服务未接入 secret details' }, { status: 503 });
    await assert.rejects(api.runPrediction(request, new AbortController().signal), /本次计算未完成/);
    await assert.rejects(api.savePrediction(task, new AbortController().signal), /本次成果未保存/);
    globalThis.fetch = async () => Response.json({ success: true, data: { ...task, saved: true, taskId: 'other-task' } });
    await assert.rejects(api.savePrediction(task, new AbortController().signal), /保存结果不匹配/);
    assert.equal(task.saved, false);
  } finally { globalThis.fetch = original; }
});


test('frontend preview runs both functions without network, model choices or raw CSV access', async () => {
  const originalFetch = globalThis.fetch;
  const before = structuredClone(context);
  try {
    globalThis.fetch = () => { throw new Error('预览不得请求后端'); };
    const signal = new AbortController().signal;
    const twin = await api.runPredictionPreview({ ...request, service: 'digitalTwin', inputs: { speed: 3500 } }, signal);
    assert.equal(twin.resultMode, 'demo'); assert.equal(twin.model, undefined);
    assert.equal(twin.result.rows[0].thrust, 18.2);
    assert.deepEqual(twin.context, context); assert.deepEqual(context, before);
    const different = await api.runPredictionPreview({ ...request, service: 'digitalTwin', inputs: { speed: 4500 } }, signal);
    assert.notEqual(different.result.rows[0].thrust, twin.result.rows[0].thrust);
    const virtual = await api.runPredictionPreview({ ...request, inputs: { speedMin: 4000, speedMax: 6000, count: 3 } }, signal);
    assert.deepEqual(virtual.result.rows.map(row => row.speed), [4000, 5000, 6000]);
    const saved = await api.savePredictionPreview(virtual, signal);
    assert.equal(saved.taskId, virtual.taskId); assert.equal(saved.saved, true); assert.equal(virtual.saved, false);
    assert.equal(saved.result, virtual.result);
    assert.equal((await api.savePredictionPreview(saved, signal)).taskId, virtual.taskId);
    assert.throws(() => api.parsePredictionTask(twin, { ...request, service: 'digitalTwin' }));
  } finally { globalThis.fetch = originalFetch; }
});

test('frontend preview respects cancellation and rejects invalid target ranges', async () => {
  const controller = new AbortController(); controller.abort();
  await assert.rejects(api.runPredictionPreview(request, controller.signal), { name: 'AbortError' });
  const signal = new AbortController().signal;
  await assert.rejects(api.runPredictionPreview({ ...request, inputs: { speedMin: 6000, speedMax: 4000 } }, signal), /上限不能小于下限/);
  await assert.rejects(api.runPredictionPreview({ ...request, inputs: { count: 0 } }, signal), /正整数/);
});
