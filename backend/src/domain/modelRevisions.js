'use strict';

const { randomUUID } = require('node:crypto');
const { now, parseJson, isSubclass } = require('./schema');
const { entryRow } = require('./entries');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function jsonObject(value, name) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(400, name + ' 必须是 JSON 对象');
  return value;
}
function createModelRevisionService({ db }) {
  function list(modelEntryId) {
    const model = entryRow(db, modelEntryId);
    if (!model) fail(404, '通用模型实例不存在: ' + modelEntryId);
    if (!isSubclass(db, model.class_id, 'MODEL')) fail(422, '模型版本必须关联 MODEL 类实例');
    return db.prepare('SELECT * FROM model_revisions WHERE model_entry_id = ? ORDER BY created_at DESC').all(modelEntryId);
  }
  function get(id) {
    const row = db.prepare('SELECT r.*, e.name AS model_name, a.original_name AS method_asset_name FROM model_revisions r JOIN entries e ON e.id = r.model_entry_id LEFT JOIN assets a ON a.id = r.method_asset_id WHERE r.id = ?').get(id);
    if (!row) fail(404, '模型版本不存在: ' + id);
    return {
      ...row,
      inputSchema: parseJson(row.input_schema_json, {}),
      outputSchema: parseJson(row.output_schema_json, {}),
      scope: parseJson(row.scope_json, {}),
      validation: parseJson(row.validation_json, {}),
      input_schema_json: undefined, output_schema_json: undefined,
      scope_json: undefined, validation_json: undefined
    };
  }
  function create(input) {
    const modelEntryId = String(input.modelEntryId || '').trim();
    const model = entryRow(db, modelEntryId);
    if (!model) fail(404, '通用模型实例不存在: ' + modelEntryId);
    if (!isSubclass(db, model.class_id, 'MODEL')) fail(422, '模型版本必须关联 MODEL 类实例');
    const version = String(input.version || '').trim();
    if (!version) fail(400, '模型版本号不能为空');
    const methodAssetId = input.methodAssetId || null;
    if (methodAssetId && !db.prepare('SELECT id FROM assets WHERE id = ?').get(methodAssetId)) fail(404, '模型方法文件不存在: ' + methodAssetId);
    const status = input.status || 'draft';
    if (!['draft', 'registered'].includes(status)) fail(400, '新模型版本状态只能是 draft 或 registered');
    const id = input.id || randomUUID();
    try {
      db.prepare('INSERT INTO model_revisions(id, model_entry_id, version, method_asset_id, input_schema_json, output_schema_json, scope_json, validation_json, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, modelEntryId, version, methodAssetId,
          JSON.stringify(jsonObject(input.inputSchema, 'inputSchema')),
          JSON.stringify(jsonObject(input.outputSchema, 'outputSchema')),
          JSON.stringify(jsonObject(input.scope, 'scope')),
          JSON.stringify(jsonObject(input.validation, 'validation')),
          status, now());
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) fail(409, '该模型版本号已注册: ' + version);
      throw error;
    }
    return get(id);
  }
  function setStatus(id, status) {
    const row = db.prepare('SELECT * FROM model_revisions WHERE id = ?').get(id);
    if (!row) fail(404, '模型版本不存在: ' + id);
    if (!['registered', 'deprecated'].includes(status)) fail(400, '模型版本状态只能变更为 registered 或 deprecated');
    if (row.status === 'deprecated' && status !== 'deprecated') fail(409, '已弃用的模型版本不可重新启用，应创建新版本');
    db.prepare('UPDATE model_revisions SET status = ? WHERE id = ?').run(status, id);
    return get(id);
  }
  return { list, get, create, setStatus };
}
module.exports = { createModelRevisionService };
