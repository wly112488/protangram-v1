'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');
const { createDomainApi } = require('../src/domainApi');

async function startApi(dataDir) {
  const domain = createDomainApi({ dataDir });
  await domain.initialize();
  const app = express();
  app.use(express.json());
  app.use('/api/domain', domain.router);
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const base = 'http://127.0.0.1:' + server.address().port + '/api/domain';
  async function request(method, route, body) {
    const response = await fetch(base + route, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    const payload = await response.json();
    return { status: response.status, payload };
  }
  return {
    domain,
    server,
    request,
    async close() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      await domain.close();
    }
  };
}

test('persists object relations, trial execution, assets, and model provenance', async t => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'protangram-domain-'));
  let api = await startApi(dataDir);
  t.after(async () => {
    if (api) await api.close();
    fs.rmSync(dataDir, { recursive: true, force: true });
  });

  const create = async (route, body) => {
    const result = await api.request('POST', route, body);
    assert.equal(result.status, 201, JSON.stringify(result.payload));
    return result.payload.data;
  };

  const objectType = await create('/object-types', { code: 'fan', name: '涵道风扇', fieldSchema: { diameter: { type: 'number', unit: 'mm' } } });
  const design = await create('/designs', { objectTypeId: objectType.id, code: 'fan-design-a', name: '涵道风扇方案A' });
  const version = await create('/designs/' + design.id + '/versions', { version: '1.0', parameters: { diameter: 750 } });
  const objectA = await create('/objects', { objectTypeId: objectType.id, designVersionId: version.id, code: 'fan-A001', name: '实物A-001' });
  const objectB = await create('/objects', { objectTypeId: objectType.id, designVersionId: version.id, code: 'fan-A002', name: '实物A-002' });
  await create('/objects/' + objectA.id + '/relations', { targetId: objectB.id, relationType: 'related_to' });
  const relationRead = await api.request('GET', '/objects/' + objectB.id + '/relations');
  assert.equal(relationRead.status, 200);
  assert.equal(relationRead.payload.data.length, 1);

  const configuration = await create('/trial-configurations', { code: 'cfg-1', name: '地面电源配置' });
  await create('/trial-configurations/' + configuration.id + '/members', {
    entityType: 'design_version', entityId: version.id, role: 'subject_candidate', selectionMode: 'candidate'
  });
  const program = await create('/programs', { code: 'prog-1', name: '性能试验程序', version: '1' });
  const trial = await create('/trials', { code: 'subj-1', name: '气动性能试验' });
  const setting = await create('/trials/' + trial.id + '/settings', {
    code: 'set-1', configurationId: configuration.id, programId: program.id,
    variableValues: { rpm: 12000 }
  });
  const record = await create('/execution-records', { code: 'rec-1', trialId: trial.id, settingId: setting.id, actualConditions: { rpm: 11800 } });
  await create('/execution-records/' + record.id + '/objects', { objectId: objectA.id, role: 'test_item' });

  const format = await create('/data-formats', {
    code: 'fmt-csv', name: 'CSV格式', version: '1', fileType: 'text/csv',
    columnMappings: [{ sourceColumn: 'rpm', quantity: 'rotational_speed', unit: 'rpm' }]
  });
  const asset = await create('/data-assets', {
    name: 'measurements.csv', assetType: 'raw_file', storageUri: 'external://measurements.csv',
    formatId: format.id, ownerType: 'execution_record', ownerId: record.id, role: 'raw_measurement'
  });
  const model = await create('/models', { code: 'model-cfd', name: '气动模型', modelType: 'cfd' });
  const modelVersion = await create('/models/' + model.id + '/versions', {
    version: '1.0', inputSchema: { rpm: 'number' }, outputSchema: { thrust: 'number' }, scope: { objectTypeId: objectType.id }
  });
  const objectModel = await create('/object-models', { code: 'om-fan-a', name: '方案A气动模型', modelVersionId: modelVersion.id, parameters: { calibrationFactor: 1.02 } });
  await create('/object-models/' + objectModel.id + '/targets', { targetType: 'design_version', targetId: version.id });
  await create('/object-models/' + objectModel.id + '/data-links', { assetId: asset.id, role: 'calibration' });
  const run = await create('/model-runs', {
    code: 'run-1', modelVersionId: modelVersion.id, objectModelId: objectModel.id,
    targetType: 'physical_object', targetId: objectA.id, inputAssetIds: [asset.id],
    inputSnapshot: { designVersionId: version.id, rpm: 11800 }, parameters: { calibrationFactor: 1.02 }
  });
  const runRead = await api.request('GET', '/model-runs/' + run.id);
  assert.equal(runRead.status, 200);
  assert.equal(runRead.payload.data.assets.length, 1);
  assert.equal(runRead.payload.data.assets[0].asset_id, asset.id);

  const mismatch = await api.request('POST', '/execution-records', {
    code: 'rec-invalid', trialId: trial.id, settingId: 'not-a-setting'
  });
  assert.equal(mismatch.status, 404);

  await api.close();
  api = await startApi(dataDir);
  const objectsAfterRestart = await api.request('GET', '/objects');
  assert.equal(objectsAfterRestart.status, 200);
  assert.equal(objectsAfterRestart.payload.data.length, 2);
});
