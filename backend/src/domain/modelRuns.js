'use strict';

const { randomUUID } = require('node:crypto');
const { now, parseJson, isSubclass } = require('./schema');
const { entryRow, snapshot: entrySnapshot } = require('./entries');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function objectValue(value, name) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) fail(400, name + ' 必须是 JSON 对象');
  return value;
}
function createModelRunService({ db }) {
  function get(id) {
    const row = db.prepare('SELECT r.*, om.name AS object_model_name, mr.model_entry_id, mr.version AS model_version, model.name AS model_name FROM model_runs r JOIN entries om ON om.id = r.object_model_entry_id JOIN model_revisions mr ON mr.id = r.model_revision_id JOIN entries model ON model.id = mr.model_entry_id WHERE r.id = ?').get(id);
    if (!row) fail(404, '模型运行不存在: ' + id);
    row.inputSnapshot = parseJson(row.input_snapshot_json, {});
    row.parameterSnapshot = parseJson(row.parameter_snapshot_json, {});
    row.outputSnapshot = parseJson(row.output_snapshot_json, {});
    row.entrySources = db.prepare('SELECT s.*, e.name, e.class_id FROM model_run_entry_sources s JOIN entries e ON e.id = s.entry_id WHERE s.model_run_id = ?').all(id);
    row.assetSources = db.prepare('SELECT s.*, a.original_name, a.sha256 FROM model_run_asset_sources s JOIN assets a ON a.id = s.asset_id WHERE s.model_run_id = ?').all(id);
    row.artifacts = db.prepare('SELECT s.*, a.name, a.artifact_type FROM model_run_artifacts s JOIN artifacts a ON a.id = s.artifact_id WHERE s.model_run_id = ?').all(id);
    row.input_snapshot_json = undefined;
    row.parameter_snapshot_json = undefined;
    row.output_snapshot_json = undefined;
    return row;
  }
  function list({ objectModelEntryId, limit = 100 } = {}) {
    const params = [];
    let where = '';
    if (objectModelEntryId) { where = ' WHERE object_model_entry_id = ?'; params.push(objectModelEntryId); }
    return db.prepare('SELECT id, object_model_entry_id, model_revision_id, status, started_at, completed_at, created_at FROM model_runs' + where + ' ORDER BY created_at DESC LIMIT ?')
      .all(...params, Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 100)));
  }
  function create(input) {
    const objectModelEntryId = String(input.objectModelEntryId || '').trim();
    const objectModel = entryRow(db, objectModelEntryId);
    if (!objectModel) fail(404, '对象模型实例不存在: ' + objectModelEntryId);
    if (!isSubclass(db, objectModel.class_id, 'OM')) fail(422, '模型运行必须关联 OM 类对象模型');
    const revision = db.prepare('SELECT * FROM model_revisions WHERE id = ?').get(input.modelRevisionId);
    if (!revision) fail(404, '模型版本不存在: ' + input.modelRevisionId);
    if (revision.status !== 'registered') fail(409, '只有已注册的模型版本可以用于运行');
    const modelEntry = entryRow(db, revision.model_entry_id);
    if (!modelEntry) fail(404, '模型定义实例不存在: ' + revision.model_entry_id);
    const basedOn = db.prepare("SELECT 1 FROM entry_relations WHERE source_entry_id = ? AND relation_name = '基于' AND target_entry_id = ?").get(objectModelEntryId, revision.model_entry_id);
    if (!basedOn) fail(422, '对象模型的“基于”关系与指定模型版本不一致');
    if (input.entrySources != null && !Array.isArray(input.entrySources)) fail(400, 'entrySources 必须是数组');
    if (input.assetSources != null && !Array.isArray(input.assetSources)) fail(400, 'assetSources 必须是数组');

    const entrySourceMap = new Map();
    const addEntrySource = (entryId, role) => entrySourceMap.set(entryId + '|' + role, { entryId, role });
    const declaredModelRelations = db.prepare("SELECT relation_name, target_entry_id FROM entry_relations WHERE source_entry_id = ? AND relation_name IN ('仿真对象', '标定数据')").all(objectModelEntryId);
    for (const relation of declaredModelRelations) {
      addEntrySource(relation.target_entry_id, relation.relation_name === '仿真对象' ? 'target_object' : 'calibration_record');
    }
    for (const source of input.entrySources || []) {
      const entry = entryRow(db, source.entryId);
      if (!entry) fail(404, '模型输入实例不存在: ' + source.entryId);
      const role = String(source.role || 'input');
      if (role === 'target_object') {
        if (!isSubclass(db, entry.class_id, 'OBJ')) fail(422, 'target_object 来源必须是 OBJ 的具体子类');
        const targetRelation = db.prepare("SELECT 1 FROM entry_relations WHERE source_entry_id = ? AND relation_name = '仿真对象' AND target_entry_id = ?").get(objectModelEntryId, source.entryId);
        if (!targetRelation) fail(422, '运行目标对象不在对象模型的“仿真对象”范围内: ' + source.entryId);
      }
      addEntrySource(source.entryId, role);
    }
    const assetSourceMap = new Map();
    const addAssetSource = (assetId, role) => assetSourceMap.set(assetId + '|' + role, { assetId, role });
    for (const source of input.assetSources || []) {
      const asset = db.prepare('SELECT * FROM assets WHERE id = ?').get(source.assetId);
      if (!asset) fail(404, '模型输入数据资产不存在: ' + source.assetId);
      addAssetSource(source.assetId, String(source.role || 'input'));
    }
    for (const source of entrySourceMap.values()) {
      if (source.role !== 'calibration_record') continue;
      const linkedAssets = db.prepare('SELECT asset_id FROM entry_field_values WHERE entry_id = ? AND asset_id IS NOT NULL').all(source.entryId);
      for (const asset of linkedAssets) addAssetSource(asset.asset_id, 'calibration_data');
    }

    const objectModelSnapshot = entrySnapshot(db, objectModelEntryId);
    const modelSnapshot = entrySnapshot(db, revision.model_entry_id);
    const revisionSnapshot = {
      id: revision.id,
      modelEntryId: revision.model_entry_id,
      version: revision.version,
      methodAssetId: revision.method_asset_id,
      inputSchema: parseJson(revision.input_schema_json, {}),
      outputSchema: parseJson(revision.output_schema_json, {}),
      scope: parseJson(revision.scope_json, {}),
      validation: parseJson(revision.validation_json, {})
    };
    const sourceEntrySnapshots = Array.from(entrySourceMap.values()).map(source => {
      const entry = entryRow(db, source.entryId);
      return { entryId: source.entryId, role: source.role, revisionNo: entry.revision };
    });
    const sourceAssetSnapshots = Array.from(assetSourceMap.values()).map(source => {
      const asset = db.prepare('SELECT id, original_name, media_type, size_bytes, sha256, format_entry_id FROM assets WHERE id = ?').get(source.assetId);
      return { ...source, originalName: asset.original_name, mediaType: asset.media_type, sizeBytes: asset.size_bytes, sha256: asset.sha256, formatEntryId: asset.format_entry_id };
    });
    const inputSnapshot = {
      provided: objectValue(input.inputSnapshot, 'inputSnapshot'),
      modelRevision: revisionSnapshot,
      modelEntryRevisionNo: modelEntry.revision,
      objectModelRevisionNo: objectModel.revision,
      objectModel: objectModelSnapshot,
      sourceEntries: sourceEntrySnapshots,
      sourceAssets: sourceAssetSnapshots
    };
    const parameterSnapshot = {
      provided: objectValue(input.parameters, 'parameters'),
      objectModelFields: objectModelSnapshot.fields.filter(field => ['参数', '模型参数'].includes(field.group_name))
    };
    const id = input.id || randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO model_runs(id, object_model_entry_id, model_revision_id, status, input_snapshot_json, parameter_snapshot_json, output_snapshot_json, error, started_at, completed_at, created_at, object_model_revision_no, model_entry_revision_no) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?)')
        .run(id, objectModelEntryId, revision.id, 'created', JSON.stringify(inputSnapshot), JSON.stringify(parameterSnapshot), '{}', now(), objectModel.revision, modelEntry.revision);
      for (const source of entrySourceMap.values()) {
        const entry = entryRow(db, source.entryId);
        db.prepare('INSERT INTO model_run_entry_sources(model_run_id, entry_id, role, source_revision_no) VALUES (?, ?, ?, ?)')
          .run(id, source.entryId, source.role, entry.revision);
      }
      for (const source of assetSourceMap.values()) {
        const asset = db.prepare('SELECT sha256 FROM assets WHERE id = ?').get(source.assetId);
        db.prepare('INSERT INTO model_run_asset_sources(model_run_id, asset_id, role, source_sha256) VALUES (?, ?, ?, ?)')
          .run(id, source.assetId, source.role, asset.sha256);
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return get(id);
  }
  function update(id, patch) {
    const current = db.prepare('SELECT * FROM model_runs WHERE id = ?').get(id);
    if (!current) fail(404, '模型运行不存在: ' + id);
    if (['completed', 'failed', 'cancelled'].includes(current.status)) fail(409, '终态模型运行不可修改');
    const nextStatus = patch.status || current.status;
    const transitions = {
      created: ['created', 'running', 'failed', 'cancelled'],
      running: ['running', 'completed', 'failed', 'cancelled']
    };
    if (!transitions[current.status] || !transitions[current.status].includes(nextStatus)) fail(409, '模型运行状态转换不合法: ' + current.status + ' → ' + nextStatus);
    if (patch.outputs !== undefined && nextStatus !== 'completed') fail(409, '仅在模型运行完成时允许提交输出');
    const outputs = patch.outputs === undefined ? parseJson(current.output_snapshot_json, {}) : objectValue(patch.outputs, 'outputs');
    const errorText = patch.error === undefined ? current.error : (patch.error == null ? null : String(patch.error));
    const startedAt = current.started_at || (nextStatus === 'running' ? now() : null);
    const completedAt = ['completed', 'failed', 'cancelled'].includes(nextStatus) ? now() : current.completed_at;
    db.prepare('UPDATE model_runs SET status = ?, output_snapshot_json = ?, error = ?, started_at = ?, completed_at = ? WHERE id = ?')
      .run(nextStatus, JSON.stringify(outputs), errorText, startedAt, completedAt, id);
    return get(id);
  }
  function attachArtifact(runId, input) {
    if (!db.prepare('SELECT id FROM model_runs WHERE id = ?').get(runId)) fail(404, '模型运行不存在: ' + runId);
    const artifact = db.prepare('SELECT id, revision_no FROM artifacts WHERE id = ?').get(input.artifactId);
    if (!artifact) fail(404, '分析成果不存在: ' + input.artifactId);
    db.prepare('INSERT INTO model_run_artifacts(model_run_id, artifact_id, role, artifact_revision_no) VALUES (?, ?, ?, ?)')
      .run(runId, input.artifactId, input.role || 'output', artifact.revision_no);
    return get(runId);
  }
  return { get, list, create, update, attachArtifact };
}
module.exports = { createModelRunService };
