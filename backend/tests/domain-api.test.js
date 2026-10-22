'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createApp } = require('../src/app');
const { importStructureHtml } = require('../src/scripts/import-structure-html');

function csv(headers, rows) {
  return [headers.join(','), ...rows.map(row => row.map(value => {
    const text = String(value == null ? '' : value);
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(','))].join('\r\n');
}
function fixtureHtml(filePath) {
  const vfs = {
    '结构/类.csv': csv(['类ID', '名称', '分组', '上级类', '说明', '只用于归类'], [
      ['OBJ', '对象', '对象', '', '实际物理对象的根类', '是'],
      ['G_PROD', '产品', '对象', 'OBJ', '产品类归类', '是'],
      ['OBJ_FAN', '涵道风扇', '对象', 'G_PROD', '', ''],
      ['OBJ_CASING', '机匣', '对象', 'G_PROD', '', ''],
      ['REC', '试验记录', '试验', '', '', ''],
      ['MODEL', '通用模型', '仿真', '', '', ''],
      ['OM', '对象模型', '仿真', '', '', ''],
      ['FMT', '采集格式', '共享库', '', '', '']
    ]),
    '结构/类字段.csv': csv(['类ID', '字段'], [
      ['OBJ', '编号'], ['OBJ_FAN', '叶尖直径'], ['REC', '原始数据表'],
      ['MODEL', '版本'], ['FMT', '文件编码'], ['FMT', '表头行数']
    ]),
    '结构/类组成.csv': csv(['类ID', '下级类ID', '数量'], [['OBJ_FAN', 'OBJ_CASING', '×1']]),
    '结构/类关联.csv': csv(['类ID', '关系名', '终点类ID', '数量'], [
      ['OBJ', '演变自', 'OBJ', '0 或 1'],
      ['REC', '试验件', 'OBJ', '≥1'],
      ['OM', '基于', 'MODEL', '×1'],
      ['OM', '仿真对象', 'OBJ', '≥1']
    ]),
    '结构/字段字典.csv': csv(['名称', '含义', '值类型', '标准单位', '别名'], [
      ['编号', '对象编号', '文本', '', '编号'],
      ['叶尖直径', '叶尖直径', '数值', 'mm', ''],
      ['原始数据表', '原始测量文件', '文件', '', ''],
      ['版本', '模型版本', '文本', '', ''],
      ['文件编码', '文本编码', '文本', '', ''],
      ['表头行数', '列名之前的表头行数', '数值', '行', '']
    ]),
    '结构/关系名称.csv': csv(['关系名', '终点一侧名称', '起点 → 终点'], [
      ['组成', '属于', '对象 → 对象'],
      ['演变自', '演变为', '对象 → 对象'],
      ['试验件', '试验记录', '试验记录 → 对象'],
      ['基于', '对象模型', '对象模型 → 通用模型'],
      ['仿真对象', '被模型仿真', '对象模型 → 对象']
    ]),
    '实例/条目.csv': csv(['ID', '类ID', '名称', '上级ID', '描述', '次要部件'], [
      ['OBJ-001', 'OBJ_FAN', '涵道风扇A', '', '', ''],
      ['OBJ-002', 'OBJ_CASING', '机匣A', '', '', ''],
      ['REC-001', 'REC', '执行记录1', '', '', ''],
      ['MOD-001', 'MODEL', '通用气动模型', '', '', ''],
      ['OM-001', 'OM', '风扇A气动模型', '', '', ''],
      ['FMT-001', 'FMT', 'CSV采集格式', '', '', '']
    ]),
    '实例/字段值.csv': csv(['条目ID', '字段', '值', '单位', '分组', '上下限', '取自ID', '说明'], [
      ['OBJ-001', '编号', 'FAN-A', '', '', '', '', ''],
      ['OBJ-001', '叶尖直径', '700', 'mm', '参数', '', '', ''],
      ['REC-001', '原始数据表', '', '', '', '', '', ''],
      ['FMT-001', '文件编码', 'utf-8', '', '', '', '', ''],
      ['FMT-001', '表头行数', '0', '行', '', '', '', '']
    ]),
    '实例/关联.csv': csv(['起点ID', '关系名', '终点ID'], [
      ['OBJ-001', '组成', 'OBJ-002'],
      ['REC-001', '试验件', 'OBJ-001'],
      ['OM-001', '基于', 'MOD-001'],
      ['OM-001', '仿真对象', 'OBJ-001']
    ])
  };
  fs.writeFileSync(filePath, '<!doctype html><script type="application/json" id="vfs">' + JSON.stringify(vfs) + '</script>', 'utf8');
}
async function startApp(dataDir, projectRoot) {
  const instance = createApp({ dataDir, projectRoot, serveFrontend: false });
  const server = await new Promise(resolve => {
    const listening = instance.app.listen(0, '127.0.0.1', () => resolve(listening));
  });
  const base = 'http://127.0.0.1:' + server.address().port;
  async function request(method, route, body) {
    const options = { method, headers: {}, body: undefined };
    if (body instanceof FormData) options.body = body;
    else if (body !== undefined) {
      options.headers['content-type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(base + route, options);
    const type = response.headers.get('content-type') || '';
    const payload = type.includes('application/json') ? await response.json() : await response.text();
    return { status: response.status, payload, response };
  }
  return {
    ...instance, server, request,
    async close() {
      await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
      instance.dbHandle.db.close();
    }
  };
}

test('imports source schema and preserves field values and relationships', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'protangram-import-'));
  const dataDir = path.join(root, 'data');
  const htmlPath = path.join(root, 'source.html');
  fixtureHtml(htmlPath);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = importStructureHtml({ inputPath: htmlPath, dataDir });
  assert.equal(result.skipped, false);
  assert.equal(result.counts.classes, 8);
  assert.equal(result.counts.entries, 6);
  assert.equal(result.counts.relations, 4);
  assert.equal(result.counts.fieldSchemaOverrides, 0);

  const api = await startApp(dataDir, root);
  t.after(() => api.close());
  const schema = await api.request('GET', '/api/domain/schema');
  assert.equal(schema.status, 200);
  assert.equal(schema.payload.data.classes.length, 8);

  const entry = await api.request('GET', '/api/domain/entries/OBJ-001');
  assert.equal(entry.status, 200);
  assert.equal(entry.payload.data.fields.find(field => field.field_name === '叶尖直径').value, 700);
  assert.equal(entry.payload.data.relations.outgoing.some(relation => relation.relation_name === '组成'), true);

  const repeatedImport = importStructureHtml({ inputPath: htmlPath, dataDir });
  assert.equal(repeatedImport.skipped, true);
});

test('validates class relationships, records schema overrides, and preserves revisions', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'protangram-api-'));
  const dataDir = path.join(root, 'data');
  const htmlPath = path.join(root, 'source.html');
  fixtureHtml(htmlPath);
  importStructureHtml({ inputPath: htmlPath, dataDir });
  let api = await startApp(dataDir, root);
  t.after(async () => {
    if (api) await api.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const created = await api.request('POST', '/api/domain/entries', { classId: 'OBJ_FAN', name: '涵道风扇B' });
  assert.equal(created.status, 201, JSON.stringify(created.payload));
  const fanId = created.payload.data.id;
  const field = await api.request('POST', '/api/domain/entries/' + fanId + '/field-values', { fieldName: '叶尖直径', value: 710, unit: 'mm' });
  assert.equal(field.status, 201);

  const earlyActivation = await api.request('PATCH', '/api/domain/entries/' + fanId, { status: 'active' });
  assert.equal(earlyActivation.status, 422);

  const casing = await api.request('POST', '/api/domain/entries', { classId: 'OBJ_CASING', name: '机匣B' });
  assert.equal(casing.status, 201);
  const relation = await api.request('POST', '/api/domain/entries/' + fanId + '/relations', { relationName: '组成', targetEntryId: casing.payload.data.id });
  assert.equal(relation.status, 201);
  const tooMany = await api.request('POST', '/api/domain/entries/' + fanId + '/relations', { relationName: '组成', targetEntryId: 'OBJ-002' });
  assert.equal(tooMany.status, 422);
  const activation = await api.request('PATCH', '/api/domain/entries/' + fanId, { status: 'active' });
  assert.equal(activation.status, 200);

  const deniedOverride = await api.request('POST', '/api/domain/entries/OBJ-001/field-values', { fieldName: '文件编码', value: 'utf-8' });
  assert.equal(deniedOverride.status, 422);
  const allowedOverride = await api.request('POST', '/api/domain/entries/OBJ-001/field-values', { fieldName: '文件编码', value: 'utf-8', allowSchemaOverride: true });
  assert.equal(allowedOverride.status, 201);
  assert.equal(allowedOverride.payload.data.schema_override, 1);

  const history = await api.request('GET', '/api/domain/entries/OBJ-001/history');
  assert.equal(history.status, 200);
  assert.equal(history.payload.data.length, 2);
});

test('uploads and previews source files, registers model runs, and protects filesystem paths', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'protangram-assets-'));
  const dataDir = path.join(root, 'data');
  const htmlPath = path.join(root, 'source.html');
  const outsideFile = path.join(root, 'secret.txt');
  fixtureHtml(htmlPath);
  fs.writeFileSync(outsideFile, 'not allowed', 'utf8');
  importStructureHtml({ inputPath: htmlPath, dataDir });
  let api = await startApp(dataDir, root);
  t.after(async () => {
    if (api) await api.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  const blockedRead = await api.request('POST', '/api/data/read-chunk', { filePath: outsideFile, offset: 0, chunkSize: 10 });
  assert.equal(blockedRead.status, 403);
  const blockedId = await api.request('POST', '/api/experiments', { id: '../secret', name: 'bad' });
  assert.equal(blockedId.status, 400);

  const form = new FormData();
  form.append('file', new Blob(['time,rpm\\n0,100\\n1,200\\n'], { type: 'text/csv' }), 'rpm.csv');
  form.append('formatEntryId', 'FMT-001');
  form.append('ownerEntryId', 'REC-001');
  form.append('fieldName', '原始数据表');
  const uploaded = await api.request('POST', '/api/domain/assets/upload', form);
  assert.equal(uploaded.status, 201, JSON.stringify(uploaded.payload));
  const assetId = uploaded.payload.data.id;

  const preview = await api.request('GET', '/api/domain/assets/' + assetId + '/preview?limit=10');
  assert.equal(preview.status, 200, JSON.stringify(preview.payload));
  assert.deepEqual(preview.payload.data.headers, ['time', 'rpm']);
  assert.deepEqual(preview.payload.data.rows, [['0', '100'], ['1', '200']]);

  const revision = await api.request('POST', '/api/domain/models/revisions', {
    modelEntryId: 'MOD-001', version: '1.0', status: 'registered',
    inputSchema: { rpm: 'number' }, outputSchema: { thrust: 'number' }
  });
  assert.equal(revision.status, 201, JSON.stringify(revision.payload));
  const run = await api.request('POST', '/api/domain/models/runs', {
    objectModelEntryId: 'OM-001',
    modelRevisionId: revision.payload.data.id,
    entrySources: [
      { entryId: 'OBJ-001', role: 'target_object' },
      { entryId: 'REC-001', role: 'calibration_record' }
    ],
    assetSources: [{ assetId, role: 'input' }],
    inputSnapshot: { rpm: 12000 },
    parameters: { correction: 1.02 }
  });
  assert.equal(run.status, 201, JSON.stringify(run.payload));
  const running = await api.request('PATCH', '/api/domain/models/runs/' + run.payload.data.id, { status: 'running' });
  assert.equal(running.status, 200);
  const completed = await api.request('PATCH', '/api/domain/models/runs/' + run.payload.data.id, { status: 'completed', outputs: { thrust: 300 } });
  assert.equal(completed.status, 200);
  assert.deepEqual(completed.payload.data.outputSnapshot, { thrust: 300 });

  await api.close();
  api = await startApp(dataDir, root);
  const persisted = await api.request('GET', '/api/domain/assets/' + assetId);
  assert.equal(persisted.status, 200);
  assert.equal(persisted.payload.data.sha256, uploaded.payload.data.sha256);
});
