'use strict';
const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const initSqlJs = require('sql.js');
const { v4: uuid } = require('uuid');

const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS object_types (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, field_schema_json TEXT NOT NULL DEFAULT '{}', relation_schema_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, object_type_id TEXT NOT NULL REFERENCES object_types(id) ON DELETE RESTRICT, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS design_versions (id TEXT PRIMARY KEY, design_id TEXT NOT NULL REFERENCES designs(id) ON DELETE RESTRICT, version TEXT NOT NULL, parameters_json TEXT NOT NULL DEFAULT '{}', requirements_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, UNIQUE(design_id,version))",
  "CREATE TABLE IF NOT EXISTS design_relations (id TEXT PRIMARY KEY, source_version_id TEXT NOT NULL REFERENCES design_versions(id) ON DELETE RESTRICT, target_version_id TEXT NOT NULL REFERENCES design_versions(id) ON DELETE RESTRICT, relation_type TEXT NOT NULL, role TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(source_version_id,target_version_id,relation_type,role), CHECK(source_version_id <> target_version_id))",
  "CREATE TABLE IF NOT EXISTS physical_objects (id TEXT PRIMARY KEY, object_type_id TEXT NOT NULL REFERENCES object_types(id) ON DELETE RESTRICT, design_version_id TEXT REFERENCES design_versions(id) ON DELETE RESTRICT, code TEXT NOT NULL UNIQUE, serial_number TEXT, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'active', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS object_relations (id TEXT PRIMARY KEY, source_id TEXT NOT NULL REFERENCES physical_objects(id) ON DELETE RESTRICT, target_id TEXT NOT NULL REFERENCES physical_objects(id) ON DELETE RESTRICT, relation_type TEXT NOT NULL, role TEXT, valid_from TEXT, valid_to TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(source_id,target_id,relation_type,role), CHECK(source_id <> target_id))",
  "CREATE TABLE IF NOT EXISTS trial_configurations (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'draft', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS configuration_members (id TEXT PRIMARY KEY, configuration_id TEXT NOT NULL REFERENCES trial_configurations(id) ON DELETE RESTRICT, entity_type TEXT NOT NULL CHECK(entity_type IN ('design_version','physical_object')), entity_id TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('subject_candidate','power_source','companion','equipment','other')), selection_mode TEXT NOT NULL DEFAULT 'optional' CHECK(selection_mode IN ('candidate','required','optional')), ordinal INTEGER NOT NULL DEFAULT 0, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(configuration_id,entity_type,entity_id,role))",
  "CREATE TABLE IF NOT EXISTS programs (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, version TEXT, content_uri TEXT, metadata_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS trials (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, purpose TEXT, description TEXT, status TEXT NOT NULL DEFAULT 'draft', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS trial_settings (id TEXT PRIMARY KEY, trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE RESTRICT, code TEXT NOT NULL, name TEXT, configuration_id TEXT REFERENCES trial_configurations(id) ON DELETE RESTRICT, program_id TEXT REFERENCES programs(id) ON DELETE RESTRICT, variable_values_json TEXT NOT NULL DEFAULT '{}', requirements_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(trial_id,code))",
  "CREATE TABLE IF NOT EXISTS execution_records (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE RESTRICT, setting_id TEXT REFERENCES trial_settings(id) ON DELETE RESTRICT, name TEXT, status TEXT NOT NULL DEFAULT 'draft', started_at TEXT, completed_at TEXT, actual_conditions_json TEXT NOT NULL DEFAULT '{}', summary_json TEXT NOT NULL DEFAULT '{}', notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS execution_objects (id TEXT PRIMARY KEY, execution_id TEXT NOT NULL REFERENCES execution_records(id) ON DELETE RESTRICT, object_id TEXT NOT NULL REFERENCES physical_objects(id) ON DELETE RESTRICT, role TEXT NOT NULL CHECK(role IN ('test_item','measured_component','equipment','other')), metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(execution_id,object_id,role))",
  "CREATE TABLE IF NOT EXISTS data_formats (id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL, version TEXT NOT NULL, file_type TEXT NOT NULL, time_definition_json TEXT NOT NULL DEFAULT '{}', column_mappings_json TEXT NOT NULL DEFAULT '[]', invalid_rules_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, UNIQUE(code,version))",
  "CREATE TABLE IF NOT EXISTS data_assets (id TEXT PRIMARY KEY, name TEXT NOT NULL, asset_type TEXT NOT NULL CHECK(asset_type IN ('raw_file','dataset','chart','analysis_result','other')), storage_uri TEXT NOT NULL, media_type TEXT, sha256 TEXT, size_bytes INTEGER, format_id TEXT REFERENCES data_formats(id) ON DELETE RESTRICT, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS asset_links (id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES data_assets(id) ON DELETE RESTRICT, owner_type TEXT NOT NULL, owner_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'attachment', metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(asset_id,owner_type,owner_id,role))",
  "CREATE TABLE IF NOT EXISTS asset_relations (id TEXT PRIMARY KEY, source_asset_id TEXT NOT NULL REFERENCES data_assets(id) ON DELETE RESTRICT, target_asset_id TEXT NOT NULL REFERENCES data_assets(id) ON DELETE RESTRICT, relation_type TEXT NOT NULL, metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(source_asset_id,target_asset_id,relation_type), CHECK(source_asset_id <> target_asset_id))",
  "CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, model_type TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS model_versions (id TEXT PRIMARY KEY, model_id TEXT NOT NULL REFERENCES models(id) ON DELETE RESTRICT, version TEXT NOT NULL, method_uri TEXT, input_schema_json TEXT NOT NULL DEFAULT '{}', output_schema_json TEXT NOT NULL DEFAULT '{}', scope_json TEXT NOT NULL DEFAULT '{}', validation_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL, UNIQUE(model_id,version))",
  "CREATE TABLE IF NOT EXISTS object_models (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL, model_version_id TEXT NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT, parameters_json TEXT NOT NULL DEFAULT '{}', scope_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'draft', created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS object_model_targets (id TEXT PRIMARY KEY, object_model_id TEXT NOT NULL REFERENCES object_models(id) ON DELETE RESTRICT, target_type TEXT NOT NULL CHECK(target_type IN ('object_type','design_version','physical_object')), target_id TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'applicable_to', created_at TEXT NOT NULL, UNIQUE(object_model_id,target_type,target_id,role))",
  "CREATE TABLE IF NOT EXISTS object_model_data (id TEXT PRIMARY KEY, object_model_id TEXT NOT NULL REFERENCES object_models(id) ON DELETE RESTRICT, asset_id TEXT NOT NULL REFERENCES data_assets(id) ON DELETE RESTRICT, role TEXT NOT NULL CHECK(role IN ('training','calibration','validation','reference','other')), metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(object_model_id,asset_id,role))",
  "CREATE TABLE IF NOT EXISTS model_runs (id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, model_version_id TEXT NOT NULL REFERENCES model_versions(id) ON DELETE RESTRICT, object_model_id TEXT REFERENCES object_models(id) ON DELETE RESTRICT, target_type TEXT, target_id TEXT, input_snapshot_json TEXT NOT NULL DEFAULT '{}', parameters_json TEXT NOT NULL DEFAULT '{}', status TEXT NOT NULL DEFAULT 'created', outputs_json TEXT NOT NULL DEFAULT '{}', error TEXT, started_at TEXT, completed_at TEXT, created_at TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS model_run_assets (id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES model_runs(id) ON DELETE RESTRICT, asset_id TEXT NOT NULL REFERENCES data_assets(id) ON DELETE RESTRICT, role TEXT NOT NULL CHECK(role IN ('input','output','reference')), metadata_json TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, UNIQUE(run_id,asset_id,role))"
];

function createDomainApi({ dataDir }) {
  const router = express.Router();
  const filesDir = path.join(dataDir, 'domain-files');
  const dbPath = path.join(dataDir, 'protangram-domain.sqlite');
  fs.mkdirSync(filesDir, { recursive: true });
  let db = null;
  let initPromise = null;
  const now = () => new Date().toISOString();
  const err = (status, message) => Object.assign(new Error(message), { status });
  const required = (v, name) => { if (typeof v !== 'string' || !v.trim()) throw err(400, name + ' 为必填字符串'); return v.trim(); };
  const optional = v => typeof v === 'string' && v.trim() ? v.trim() : null;
  const json = (v, fallback) => JSON.stringify(v == null ? fallback : v);
  const list = (v, name) => { if (v !== undefined && !Array.isArray(v)) throw err(400, name + ' 必须是数组'); return v || []; };
  const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const ok = (res, data, status) => res.status(status || 200).json({ success: true, data });
  function decode(row) {
    if (!row) return row;
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      if (k.endsWith('_json')) { try { out[k.slice(0, -5)] = v == null ? null : JSON.parse(v); } catch (_) { out[k] = v; } }
      else out[k] = v;
    }
    return out;
  }
  function all(sql, params) {
    const s = db.prepare(sql), out = [];
    try { s.bind(params || []); while (s.step()) out.push(decode(s.getAsObject())); } finally { s.free(); }
    return out;
  }
  const one = (sql, params) => all(sql, params)[0] || null;
  function persist() { const tmp = dbPath + '.tmp'; fs.writeFileSync(tmp, Buffer.from(db.export())); fs.renameSync(tmp, dbPath); }
  function tx(fn) {
    db.run('BEGIN IMMEDIATE');
    try { const result = fn(); db.run('COMMIT'); persist(); return result; }
    catch (e) { try { db.run('ROLLBACK'); } catch (_) {} throw e; }
  }
  function insert(table, row) {
    const keys = Object.keys(row);
    db.run('INSERT INTO ' + table + ' (' + keys.join(',') + ') VALUES (' + keys.map(() => '?').join(',') + ')', keys.map(k => row[k]));
    return one('SELECT * FROM ' + table + ' WHERE id = ?', [row.id]);
  }
  function update(table, id, values) {
    const keys = Object.keys(values);
    if (keys.length) db.run('UPDATE ' + table + ' SET ' + keys.map(k => k + ' = ?').join(',') + ' WHERE id = ?', keys.map(k => values[k]).concat(id));
    return one('SELECT * FROM ' + table + ' WHERE id = ?', [id]);
  }
  function need(table, id, label) { const row = one('SELECT * FROM ' + table + ' WHERE id = ?', [id]); if (!row) throw err(404, (label || table) + ' 不存在: ' + id); return row; }
  const entityTables = { object_type: 'object_types', design: 'designs', design_version: 'design_versions', physical_object: 'physical_objects', trial_configuration: 'trial_configurations', program: 'programs', trial: 'trials', trial_setting: 'trial_settings', execution_record: 'execution_records', data_asset: 'data_assets', model: 'models', model_version: 'model_versions', object_model: 'object_models', model_run: 'model_runs' };
  function needEntity(type, id) { if (!entityTables[type]) throw err(400, '不支持的实体类型: ' + type); return need(entityTables[type], id, type); }
  function make(table, fields) { const timestamp = now(); return tx(() => insert(table, Object.assign({ id: uuid(), created_at: timestamp }, fields))); }
  function linkAsset(assetId, ownerType, ownerId, role, metadata) {
    need('data_assets', assetId, '数据资产'); needEntity(ownerType, ownerId);
    return insert('asset_links', { id: uuid(), asset_id: assetId, owner_type: ownerType, owner_id: ownerId, role: optional(role) || 'attachment', metadata_json: json(metadata, {}), created_at: now() });
  }

  async function initialize() {
    if (!initPromise) initPromise = (async () => {
      const SQL = await initSqlJs({ locateFile: f => path.join(path.dirname(require.resolve('sql.js')), f) });
      db = fs.existsSync(dbPath) ? new SQL.Database(new Uint8Array(fs.readFileSync(dbPath))) : new SQL.Database();
      db.run('PRAGMA foreign_keys = ON');
      for (const sql of SCHEMA) db.run(sql);
      if (!one('SELECT version FROM schema_migrations WHERE version = ?', [1])) db.run('INSERT INTO schema_migrations (version,applied_at) VALUES (?,?)', [1, now()]);
      persist();
    })();
    return initPromise;
  }

  router.get('/health', (req, res) => ok(res, { service: 'domain-data', database: 'sqlite', schemaVersion: 1 }));
  router.get('/object-types', (req, res) => ok(res, all('SELECT * FROM object_types ORDER BY name')));
  router.post('/object-types', wrap((req, res) => {
    const b = req.body || {};
    return ok(res, make('object_types', { code: required(b.code, 'code'), name: required(b.name, 'name'), description: optional(b.description), field_schema_json: json(b.fieldSchema, {}), relation_schema_json: json(b.relationSchema, []), status: optional(b.status) || 'active' }), 201);
  }));
  router.get('/designs', (req, res) => ok(res, all('SELECT * FROM designs ORDER BY name')));
  router.post('/designs', wrap((req, res) => {
    const b = req.body || {}; need('object_types', required(b.objectTypeId, 'objectTypeId'), '对象类型');
    return ok(res, make('designs', { object_type_id: b.objectTypeId, code: required(b.code, 'code'), name: required(b.name, 'name'), description: optional(b.description) }), 201);
  }));
  router.get('/designs/:id/versions', (req, res) => { need('designs', req.params.id, '设计定义'); return ok(res, all('SELECT * FROM design_versions WHERE design_id = ? ORDER BY created_at', [req.params.id])); });
  router.post('/designs/:id/versions', wrap((req, res) => {
    need('designs', req.params.id, '设计定义'); const b = req.body || {};
    return ok(res, make('design_versions', { design_id: req.params.id, version: required(b.version, 'version'), parameters_json: json(b.parameters, {}), requirements_json: json(b.requirements, {}), status: optional(b.status) || 'draft' }), 201);
  }));
  router.post('/design-versions/:id/relations', wrap((req, res) => {
    need('design_versions', req.params.id, '设计版本'); const b = req.body || {}; need('design_versions', required(b.targetVersionId, 'targetVersionId'), '目标设计版本');
    if (b.targetVersionId === req.params.id) throw err(400, '设计版本不能关联自身');
    return ok(res, make('design_relations', { source_version_id: req.params.id, target_version_id: b.targetVersionId, relation_type: required(b.relationType, 'relationType'), role: optional(b.role), metadata_json: json(b.metadata, {}) }), 201);
  }));
  router.get('/design-versions/:id/relations', (req, res) => { need('design_versions', req.params.id, '设计版本'); return ok(res, all('SELECT * FROM design_relations WHERE source_version_id = ? OR target_version_id = ?', [req.params.id, req.params.id])); });
  router.get('/objects', (req, res) => {
    let sql = 'SELECT * FROM physical_objects'; const p = [];
    if (req.query.objectTypeId) { sql += ' WHERE object_type_id = ?'; p.push(req.query.objectTypeId); }
    if (req.query.designVersionId) { sql += p.length ? ' AND design_version_id = ?' : ' WHERE design_version_id = ?'; p.push(req.query.designVersionId); }
    return ok(res, all(sql + ' ORDER BY name', p));
  });
  router.post('/objects', wrap((req, res) => {
    const b = req.body || {}; need('object_types', required(b.objectTypeId, 'objectTypeId'), '对象类型'); if (b.designVersionId) need('design_versions', b.designVersionId, '设计版本');
    const t = now(); return ok(res, make('physical_objects', { object_type_id: b.objectTypeId, design_version_id: b.designVersionId || null, code: required(b.code, 'code'), serial_number: optional(b.serialNumber), name: required(b.name, 'name'), description: optional(b.description), status: optional(b.status) || 'active', metadata_json: json(b.metadata, {}), updated_at: t }), 201);
  }));
  router.get('/objects/:id', (req, res) => ok(res, need('physical_objects', req.params.id, '物理对象')));
  router.patch('/objects/:id', wrap((req, res) => {
    const current = need('physical_objects', req.params.id, '物理对象'), b = req.body || {}, v = { updated_at: now() };
    if (b.objectTypeId !== undefined) { need('object_types', b.objectTypeId, '对象类型'); v.object_type_id = b.objectTypeId; }
    if (b.designVersionId !== undefined) { if (b.designVersionId) need('design_versions', b.designVersionId, '设计版本'); v.design_version_id = b.designVersionId || null; }
    if (b.serialNumber !== undefined) v.serial_number = optional(b.serialNumber);
    if (b.name !== undefined) v.name = required(b.name, 'name');
    if (b.description !== undefined) v.description = optional(b.description);
    if (b.status !== undefined) v.status = required(b.status, 'status');
    if (b.metadata !== undefined) v.metadata_json = json(b.metadata, {});
    return ok(res, tx(() => update('physical_objects', current.id, v)));
  }));
  router.get('/objects/:id/relations', (req, res) => { need('physical_objects', req.params.id, '物理对象'); return ok(res, all('SELECT * FROM object_relations WHERE source_id = ? OR target_id = ?', [req.params.id, req.params.id])); });
  router.post('/objects/:id/relations', wrap((req, res) => {
    need('physical_objects', req.params.id, '物理对象'); const b = req.body || {}; need('physical_objects', required(b.targetId, 'targetId'), '目标物理对象'); if (b.targetId === req.params.id) throw err(400, '物理对象不能关联自身');
    return ok(res, make('object_relations', { source_id: req.params.id, target_id: b.targetId, relation_type: required(b.relationType, 'relationType'), role: optional(b.role), valid_from: optional(b.validFrom), valid_to: optional(b.validTo), metadata_json: json(b.metadata, {}) }), 201);
  }));
  router.delete('/objects/:id/relations/:relationId', wrap((req, res) => {
    need('physical_objects', req.params.id, '物理对象'); const r = one('SELECT * FROM object_relations WHERE id = ? AND (source_id = ? OR target_id = ?)', [req.params.relationId, req.params.id, req.params.id]); if (!r) throw err(404, '关联关系不存在');
    tx(() => db.run('DELETE FROM object_relations WHERE id = ?', [r.id])); return ok(res, { deleted: true, id: r.id });
  }));

  router.get('/trial-configurations', (req, res) => ok(res, all('SELECT * FROM trial_configurations ORDER BY name')));
  router.post('/trial-configurations', wrap((req, res) => { const b = req.body || {}; return ok(res, make('trial_configurations', { code: required(b.code, 'code'), name: required(b.name, 'name'), description: optional(b.description), status: optional(b.status) || 'draft', metadata_json: json(b.metadata, {}) }), 201); }));
  router.get('/trial-configurations/:id/members', (req, res) => { need('trial_configurations', req.params.id, '试验构型'); return ok(res, all('SELECT * FROM configuration_members WHERE configuration_id = ? ORDER BY ordinal,created_at', [req.params.id])); });
  router.post('/trial-configurations/:id/members', wrap((req, res) => {
    need('trial_configurations', req.params.id, '试验构型'); const b = req.body || {}, type = required(b.entityType, 'entityType'), role = required(b.role, 'role'), mode = optional(b.selectionMode) || 'optional';
    if (!['design_version','physical_object'].includes(type)) throw err(400, 'entityType 仅支持 design_version 或 physical_object'); needEntity(type, required(b.entityId, 'entityId'));
    if (!['subject_candidate','power_source','companion','equipment','other'].includes(role)) throw err(400, '不支持的构型成员角色'); if (!['candidate','required','optional'].includes(mode)) throw err(400, 'selectionMode 不合法');
    return ok(res, make('configuration_members', { configuration_id: req.params.id, entity_type: type, entity_id: b.entityId, role, selection_mode: mode, ordinal: Number.isInteger(b.ordinal) ? b.ordinal : 0, metadata_json: json(b.metadata, {}) }), 201);
  }));
  router.delete('/trial-configurations/:id/members/:memberId', wrap((req, res) => {
    need('trial_configurations', req.params.id, '试验构型');
    const member = one('SELECT * FROM configuration_members WHERE id = ? AND configuration_id = ?', [req.params.memberId, req.params.id]);
    if (!member) throw err(404, '构型成员不存在');
    tx(() => db.run('DELETE FROM configuration_members WHERE id = ?', [member.id]));
    return ok(res, { deleted: true, id: member.id });
  }));
  router.get('/programs', (req, res) => ok(res, all('SELECT * FROM programs ORDER BY name')));
  router.post('/programs', wrap((req, res) => { const b = req.body || {}; return ok(res, make('programs', { code: required(b.code, 'code'), name: required(b.name, 'name'), version: optional(b.version), content_uri: optional(b.contentUri), metadata_json: json(b.metadata, {}), status: optional(b.status) || 'active' }), 201); }));
  router.get('/trials', (req, res) => ok(res, all('SELECT * FROM trials ORDER BY updated_at DESC')));
  router.post('/trials', wrap((req, res) => { const b = req.body || {}, t = now(); return ok(res, make('trials', { code: required(b.code, 'code'), name: required(b.name, 'name'), purpose: optional(b.purpose), description: optional(b.description), status: optional(b.status) || 'draft', metadata_json: json(b.metadata, {}), updated_at: t }), 201); }));
  router.get('/trials/:id', (req, res) => ok(res, need('trials', req.params.id, '具体试验')));
  router.get('/trials/:id/settings', (req, res) => { need('trials', req.params.id, '具体试验'); return ok(res, all('SELECT * FROM trial_settings WHERE trial_id = ? ORDER BY created_at', [req.params.id])); });
  router.post('/trials/:id/settings', wrap((req, res) => {
    need('trials', req.params.id, '具体试验'); const b = req.body || {}; if (b.configurationId) need('trial_configurations', b.configurationId, '试验构型'); if (b.programId) need('programs', b.programId, '试验程序'); const t = now();
    return ok(res, make('trial_settings', { trial_id: req.params.id, code: required(b.code, 'code'), name: optional(b.name), configuration_id: b.configurationId || null, program_id: b.programId || null, variable_values_json: json(b.variableValues, {}), requirements_json: json(b.requirements, {}), status: optional(b.status) || 'draft', notes: optional(b.notes), updated_at: t }), 201);
  }));
  router.post('/execution-records', wrap((req, res) => {
    const b = req.body || {}; need('trials', required(b.trialId, 'trialId'), '具体试验'); if (b.settingId) { const s = need('trial_settings', b.settingId, '试验设置'); if (s.trial_id !== b.trialId) throw err(400, '试验设置不属于指定的具体试验'); } const t = now();
    return ok(res, make('execution_records', { code: required(b.code, 'code'), trial_id: b.trialId, setting_id: b.settingId || null, name: optional(b.name), status: optional(b.status) || 'draft', started_at: optional(b.startedAt), completed_at: optional(b.completedAt), actual_conditions_json: json(b.actualConditions, {}), summary_json: json(b.summary, {}), notes: optional(b.notes), updated_at: t }), 201);
  }));
  router.get('/execution-records', (req, res) => req.query.trialId ? ok(res, all('SELECT * FROM execution_records WHERE trial_id = ? ORDER BY created_at DESC', [req.query.trialId])) : ok(res, all('SELECT * FROM execution_records ORDER BY created_at DESC')));
  router.get('/execution-records/:id', (req, res) => ok(res, need('execution_records', req.params.id, '执行记录')));
  router.get('/execution-records/:id/objects', (req, res) => { need('execution_records', req.params.id, '执行记录'); return ok(res, all('SELECT * FROM execution_objects WHERE execution_id = ? ORDER BY created_at', [req.params.id])); });
  router.post('/execution-records/:id/objects', wrap((req, res) => {
    need('execution_records', req.params.id, '执行记录'); const b = req.body || {}, role = required(b.role, 'role'); need('physical_objects', required(b.objectId, 'objectId'), '物理对象'); if (!['test_item','measured_component','equipment','other'].includes(role)) throw err(400, '不支持的执行对象角色');
    return ok(res, make('execution_objects', { execution_id: req.params.id, object_id: b.objectId, role, metadata_json: json(b.metadata, {}) }), 201);
  }));

  router.get('/data-formats', (req, res) => ok(res, all('SELECT * FROM data_formats ORDER BY code,version')));
  router.post('/data-formats', wrap((req, res) => { const b = req.body || {}; return ok(res, make('data_formats', { code: required(b.code, 'code'), name: required(b.name, 'name'), version: required(b.version, 'version'), file_type: required(b.fileType, 'fileType'), time_definition_json: json(b.timeDefinition, {}), column_mappings_json: json(list(b.columnMappings, 'columnMappings'), []), invalid_rules_json: json(b.invalidRules, {}), status: optional(b.status) || 'draft' }), 201); }));
  const assetTypes = ['raw_file','dataset','chart','analysis_result','other'];
  function validAssetType(type) { const t = type || 'raw_file'; if (!assetTypes.includes(t)) throw err(400, '不支持的 assetType'); return t; }
  router.get('/data-assets', (req, res) => {
    if (req.query.ownerType && req.query.ownerId) return ok(res, all('SELECT a.* FROM data_assets a JOIN asset_links l ON l.asset_id = a.id WHERE l.owner_type = ? AND l.owner_id = ? ORDER BY a.created_at DESC', [req.query.ownerType, req.query.ownerId]));
    return ok(res, all('SELECT * FROM data_assets ORDER BY created_at DESC'));
  });
  router.post('/data-assets', wrap((req, res) => {
    const b = req.body || {}; if (b.formatId) need('data_formats', b.formatId, '采集格式'); if (!!b.ownerType !== !!b.ownerId) throw err(400, 'ownerType 和 ownerId 必须同时提供'); if (b.ownerType) needEntity(b.ownerType, b.ownerId);
    const id = uuid(), asset = { id, name: required(b.name, 'name'), asset_type: validAssetType(b.assetType), storage_uri: required(b.storageUri, 'storageUri'), media_type: optional(b.mediaType), sha256: optional(b.sha256), size_bytes: Number.isInteger(b.sizeBytes) && b.sizeBytes >= 0 ? b.sizeBytes : null, format_id: b.formatId || null, metadata_json: json(b.metadata, {}), created_at: now() };
    return ok(res, tx(() => { const row = insert('data_assets', asset); if (b.ownerType) linkAsset(id, b.ownerType, b.ownerId, b.role, b.linkMetadata); return row; }), 201);
  }));
  const upload = multer({ storage: multer.diskStorage({ destination: filesDir, filename: (req, file, cb) => cb(null, uuid() + path.extname(file.originalname).slice(0, 16)) }), limits: { fileSize: 512 * 1024 * 1024 } });
  router.post('/data-assets/upload', upload.single('file'), wrap(async (req, res) => {
    if (!req.file) throw err(400, '缺少上传文件，字段名应为 file'); const b = req.body || {};
    try {
      if (b.formatId) need('data_formats', b.formatId, '采集格式'); if (!!b.ownerType !== !!b.ownerId) throw err(400, 'ownerType 和 ownerId 必须同时提供'); if (b.ownerType) needEntity(b.ownerType, b.ownerId);
      const checksum = await new Promise((resolve, reject) => { const hash = crypto.createHash('sha256'), stream = fs.createReadStream(req.file.path); stream.on('data', chunk => hash.update(chunk)); stream.on('error', reject); stream.on('end', () => resolve(hash.digest('hex'))); });
      const metadata = b.metadata ? JSON.parse(b.metadata) : {};
      const row = tx(() => { const id = uuid(), a = insert('data_assets', { id, name: req.file.originalname, asset_type: validAssetType(b.assetType), storage_uri: path.posix.join('domain-files', req.file.filename), media_type: optional(req.file.mimetype), sha256: checksum, size_bytes: req.file.size, format_id: b.formatId || null, metadata_json: json(metadata, {}), created_at: now() }); if (b.ownerType) linkAsset(id, b.ownerType, b.ownerId, b.role, {}); return a; });
      return ok(res, row, 201);
    } catch (e) { if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path); throw e; }
  }));
  router.get('/data-assets/:id/content', (req, res) => {
    const asset = need('data_assets', req.params.id, '数据资产');
    if (!asset.storage_uri || !asset.storage_uri.startsWith('domain-files/')) throw err(404, '该数据资产没有本地上传文件');
    const target = path.resolve(dataDir, asset.storage_uri);
    if (!target.startsWith(path.resolve(filesDir) + path.sep) || !fs.existsSync(target)) throw err(404, '数据文件不存在');
    return res.download(target, asset.name);
  });
  router.get('/data-assets/:id', (req, res) => { const a = need('data_assets', req.params.id, '数据资产'); a.links = all('SELECT * FROM asset_links WHERE asset_id = ?', [a.id]); a.relations = all('SELECT * FROM asset_relations WHERE source_asset_id = ? OR target_asset_id = ?', [a.id, a.id]); return ok(res, a); });
  router.post('/data-assets/:id/links', wrap((req, res) => { const b = req.body || {}; need('data_assets', req.params.id, '数据资产'); needEntity(required(b.ownerType, 'ownerType'), required(b.ownerId, 'ownerId')); return ok(res, tx(() => linkAsset(req.params.id, b.ownerType, b.ownerId, b.role, b.metadata)), 201); }));
  router.post('/data-assets/:id/relations', wrap((req, res) => { const b = req.body || {}; need('data_assets', req.params.id, '数据资产'); need('data_assets', required(b.targetAssetId, 'targetAssetId'), '目标数据资产'); if (b.targetAssetId === req.params.id) throw err(400, '数据资产不能关联自身'); return ok(res, make('asset_relations', { source_asset_id: req.params.id, target_asset_id: b.targetAssetId, relation_type: required(b.relationType, 'relationType'), metadata_json: json(b.metadata, {}) }), 201); }));

  router.get('/models', (req, res) => ok(res, all('SELECT * FROM models ORDER BY name')));
  router.post('/models', wrap((req, res) => { const b = req.body || {}; return ok(res, make('models', { code: required(b.code, 'code'), name: required(b.name, 'name'), model_type: required(b.modelType, 'modelType'), description: optional(b.description) }), 201); }));
  router.get('/models/:id/versions', (req, res) => { need('models', req.params.id, '通用模型'); return ok(res, all('SELECT * FROM model_versions WHERE model_id = ? ORDER BY created_at DESC', [req.params.id])); });
  router.post('/models/:id/versions', wrap((req, res) => { need('models', req.params.id, '通用模型'); const b = req.body || {}; return ok(res, make('model_versions', { model_id: req.params.id, version: required(b.version, 'version'), method_uri: optional(b.methodUri), input_schema_json: json(b.inputSchema, {}), output_schema_json: json(b.outputSchema, {}), scope_json: json(b.scope, {}), validation_json: json(b.validation, {}), status: optional(b.status) || 'draft' }), 201); }));
  router.get('/object-models', (req, res) => ok(res, all('SELECT * FROM object_models ORDER BY name')));
  router.post('/object-models', wrap((req, res) => { const b = req.body || {}; need('model_versions', required(b.modelVersionId, 'modelVersionId'), '模型版本'); return ok(res, make('object_models', { code: required(b.code, 'code'), name: required(b.name, 'name'), model_version_id: b.modelVersionId, parameters_json: json(b.parameters, {}), scope_json: json(b.scope, {}), status: optional(b.status) || 'draft' }), 201); }));
  router.get('/object-models/:id', (req, res) => { const m = need('object_models', req.params.id, '对象模型'); m.targets = all('SELECT * FROM object_model_targets WHERE object_model_id = ?', [m.id]); m.dataLinks = all('SELECT * FROM object_model_data WHERE object_model_id = ?', [m.id]); return ok(res, m); });
  router.post('/object-models/:id/targets', wrap((req, res) => { need('object_models', req.params.id, '对象模型'); const b = req.body || {}, type = required(b.targetType, 'targetType'); if (!['object_type','design_version','physical_object'].includes(type)) throw err(400, '不支持的 targetType'); needEntity(type, required(b.targetId, 'targetId')); return ok(res, make('object_model_targets', { object_model_id: req.params.id, target_type: type, target_id: b.targetId, role: optional(b.role) || 'applicable_to' }), 201); }));
  router.post('/object-models/:id/data-links', wrap((req, res) => { need('object_models', req.params.id, '对象模型'); const b = req.body || {}, role = required(b.role, 'role'); need('data_assets', required(b.assetId, 'assetId'), '数据资产'); if (!['training','calibration','validation','reference','other'].includes(role)) throw err(400, '不支持的数据用途'); return ok(res, make('object_model_data', { object_model_id: req.params.id, asset_id: b.assetId, role, metadata_json: json(b.metadata, {}) }), 201); }));
  router.post('/model-runs', wrap((req, res) => {
    const b = req.body || {}; need('model_versions', required(b.modelVersionId, 'modelVersionId'), '模型版本'); if (b.objectModelId) { const m = need('object_models', b.objectModelId, '对象模型'); if (m.model_version_id !== b.modelVersionId) throw err(400, '对象模型版本与运行指定版本不一致'); }
    if (!!b.targetType !== !!b.targetId) throw err(400, 'targetType 和 targetId 必须同时提供'); if (b.targetType) needEntity(b.targetType, b.targetId); const inputs = list(b.inputAssetIds, 'inputAssetIds'); inputs.forEach(id => need('data_assets', id, '输入数据资产'));
    const t = now(); return ok(res, tx(() => { const run = insert('model_runs', { id: uuid(), code: required(b.code, 'code'), model_version_id: b.modelVersionId, object_model_id: b.objectModelId || null, target_type: b.targetType || null, target_id: b.targetId || null, input_snapshot_json: json(b.inputSnapshot, {}), parameters_json: json(b.parameters, {}), status: optional(b.status) || 'created', outputs_json: json(b.outputs, {}), error: optional(b.error), started_at: optional(b.startedAt), completed_at: optional(b.completedAt), created_at: t }); inputs.forEach(assetId => insert('model_run_assets', { id: uuid(), run_id: run.id, asset_id: assetId, role: 'input', metadata_json: '{}', created_at: t })); return run; }), 201);
  }));
  router.get('/model-runs', (req, res) => ok(res, all('SELECT * FROM model_runs ORDER BY created_at DESC')));
  router.get('/model-runs/:id', (req, res) => { const r = need('model_runs', req.params.id, '模型运行'); r.assets = all('SELECT * FROM model_run_assets WHERE run_id = ?', [r.id]); return ok(res, r); });
  router.patch('/model-runs/:id', wrap((req, res) => { const current = need('model_runs', req.params.id, '模型运行'), b = req.body || {}, v = {}; if (b.status !== undefined) { if (!['created','running','completed','failed','cancelled'].includes(b.status)) throw err(400, '不支持的模型运行状态'); v.status = b.status; if (b.status === 'running' && !current.started_at) v.started_at = now(); if (['completed','failed','cancelled'].includes(b.status)) v.completed_at = now(); } if (b.outputs !== undefined) v.outputs_json = json(b.outputs, {}); if (b.error !== undefined) v.error = optional(b.error); return ok(res, tx(() => update('model_runs', current.id, v))); }));
  router.post('/model-runs/:id/assets', wrap((req, res) => { need('model_runs', req.params.id, '模型运行'); const b = req.body || {}, role = required(b.role, 'role'); need('data_assets', required(b.assetId, 'assetId'), '数据资产'); if (!['input','output','reference'].includes(role)) throw err(400, 'role 必须是 input、output 或 reference'); return ok(res, make('model_run_assets', { run_id: req.params.id, asset_id: b.assetId, role, metadata_json: json(b.metadata, {}) }), 201); }));

  router.use((e, req, res, next) => { if (res.headersSent) return next(e); const message = e && e.message || '未知服务错误'; const status = e && e.status || (message.includes('UNIQUE constraint failed') || message.includes('FOREIGN KEY constraint failed') ? 409 : 500); return res.status(status).json({ success: false, error: message }); });
  async function close() { if (db) { persist(); db.close(); db = null; initPromise = null; } }
  return { router, initialize, close, dbPath, filesDir };
}
module.exports = { createDomainApi };
