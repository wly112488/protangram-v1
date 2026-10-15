import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({ stdin: { contents: "export * from './src/workspace/predictionContract'; export * from './src/services/predictionApi';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const reference = (id) => ({ physicalObjectId: `object-${id}`, physicalObjectName: `对象 ${id}`, experimentId: id, experimentName: `构型 ${id}` });
const target = { ...reference('target'), objectParameters: [], configurationParameters: [], testType: 'thrust' };
const model = { modelId: 'model', modelName: '推力模型', version: 'V2', sourceConfiguration: reference('source'), availability: 'available', inputFields: [{ key: 'speed', label: '转速', type: 'number', required: true, unit: 'rpm' }] };
const request = { requestId: 'request', service: 'virtualCondition', targetConfiguration: target, model, inputs: { speed: 3000 } };
const task = { ...request, taskId: 'task', status: 'completed', resultMode: 'computed', saved: false, completedAt: '2026-10-15T08:00:00Z', result: { summary: '计算完成', columns: [{ key: 'thrust', label: '推力' }], rows: [{ thrust: 10 }] } };
test('backend availability drives selection; source configuration, target CSV and test type do not gate a model', () => {
  assert.equal(api.preferredModel([model]), model);
  assert.equal(api.sameConfiguration(model.sourceConfiguration, target), false);
  const local = { ...model, sourceConfiguration: target, modelId: 'local' };
  assert.equal(api.preferredModel([model, local]), undefined);
  assert.equal(api.preferredModel([model, { ...local, recommended: true }]).modelId, 'local');
  assert.equal(api.preferredModel([{ ...model, availability: 'not_ready', recommended: true }]), undefined);
  assert.equal(api.preferredModel([{ ...model, recommended: true }, { ...local, recommended: true }]), undefined);
});
test('catalogs must provide explicit availability, model origin, version and supported input schema', () => {
  const catalog = { serviceReady: true, persistenceReady: false, models: [model] };
  assert.equal(api.parsePredictionCatalog(catalog), catalog);
  for (const patch of [{ sourceConfiguration: undefined }, { version: '' }, { availability: undefined }, { inputFields: [{ key: 'x', label: 'x', type: 'unsupported' }] }]) {
    assert.throws(() => api.parsePredictionCatalog({ ...catalog, models: [{ ...model, ...patch }] }));
  }
  assert.throws(() => api.parsePredictionCatalog({ ...catalog, models: [model, model] }));
});
test('completed predictions retain independent target and source snapshots without a real execution', () => {
  const before = structuredClone(request);
  assert.deepEqual(api.parsePredictionTask(task, request), task);
  assert.deepEqual(request, before);
  assert.equal(task.targetConfiguration.experimentId, 'target');
  assert.equal(task.model.sourceConfiguration.experimentId, 'source');
  assert.equal(task.trialId, undefined); assert.equal(task.testRecordId, undefined);
});
test('demo, incomplete, wrong target, wrong model source, wrong inputs and wrong request cannot become results', () => {
  for (const patch of [{ resultMode: 'demo' }, { status: 'running' }, { taskId: '' }, { targetConfiguration: { ...target, experimentId: 'source' } }, { model: { ...model, sourceConfiguration: reference('wrong') } }, { inputs: { speed: 9000 } }, { requestId: 'stale' }, { targetConfiguration: { ...target, testType: 'thermal' } }, { targetConfiguration: { ...target, configurationParameters: undefined } }]) {
    assert.throws(() => api.parsePredictionTask({ ...task, ...patch }, request));
  }
  assert.throws(() => api.parsePredictionTask(task, request, true));
  assert.equal(api.parsePredictionTask({ ...task, saved: true }, request, true).saved, true);
});
test('missing service never falls back to global demo models; failed save remains failed', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response('Not found', { status: 404 });
    await assert.rejects(api.fetchApplicableModels('virtualCondition', target, new AbortController().signal), /尚未接入/);
    globalThis.fetch = async () => Response.json({ success: false, error: '模型服务未就绪' }, { status: 503 });
    await assert.rejects(api.runPrediction(request, new AbortController().signal), /模型服务未就绪/);
    globalThis.fetch = async () => Response.json({ success: true, data: { ...task, saved: true, taskId: 'other-task' } });
    await assert.rejects(api.savePrediction(task, new AbortController().signal), /计算任务不匹配/);
    assert.equal(task.saved, false);
  } finally { globalThis.fetch = original; }
});
