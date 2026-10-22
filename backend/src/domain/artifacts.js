'use strict';

const { randomUUID } = require('node:crypto');
const { now, parseJson } = require('./schema');
const { entryRow } = require('./entries');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function createArtifactService({ db }) {
  function get(id) {
    const artifact = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    if (!artifact) fail(404, '分析成果不存在: ' + id);
    artifact.payload = parseJson(artifact.payload_json, {});
    artifact.entrySources = db.prepare('SELECT s.*, e.name, e.class_id FROM artifact_entry_sources s JOIN entries e ON e.id = s.entry_id WHERE s.artifact_id = ?').all(id);
    artifact.assetSources = db.prepare('SELECT s.*, a.original_name, a.media_type, a.sha256 FROM artifact_asset_sources s JOIN assets a ON a.id = s.asset_id WHERE s.artifact_id = ?').all(id);
    artifact.dependencies = db.prepare('SELECT d.*, a.name AS source_name, a.artifact_type AS source_type FROM artifact_dependencies d JOIN artifacts a ON a.id = d.source_artifact_id WHERE d.artifact_id = ?').all(id);
    artifact.payload_json = undefined;
    return artifact;
  }
  function list({ ownerEntryId, artifactType, limit = 100 } = {}) {
    const clauses = [], params = [];
    if (ownerEntryId) { clauses.push('owner_entry_id = ?'); params.push(ownerEntryId); }
    if (artifactType) { clauses.push('artifact_type = ?'); params.push(artifactType); }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    return db.prepare('SELECT id, artifact_type, name, owner_entry_id, status, revision_no, created_at, updated_at FROM artifacts' + where + ' ORDER BY updated_at DESC LIMIT ?')
      .all(...params, Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 100)));
  }
  function create(input) {
    const type = String(input.artifactType || '').trim();
    const name = String(input.name || '').trim();
    if (!type || !name) fail(400, 'artifactType 和 name 必填');
    const ownerEntryId = input.ownerEntryId || null;
    if (ownerEntryId && !entryRow(db, ownerEntryId)) fail(404, '成果所属实例不存在: ' + ownerEntryId);
    const entrySources = Array.isArray(input.entrySources) ? input.entrySources : [];
    const assetSources = Array.isArray(input.assetSources) ? input.assetSources : [];
    const dependencies = Array.isArray(input.dependencies) ? input.dependencies : [];
    for (const source of entrySources) if (!entryRow(db, source.entryId)) fail(404, '成果来源实例不存在: ' + source.entryId);
    for (const source of assetSources) if (!db.prepare('SELECT id FROM assets WHERE id = ?').get(source.assetId)) fail(404, '成果来源数据资产不存在: ' + source.assetId);
    for (const sourceId of dependencies) if (!db.prepare('SELECT id FROM artifacts WHERE id = ?').get(sourceId)) fail(404, '依赖成果不存在: ' + sourceId);
    const id = input.id || randomUUID(), payload = input.payload == null ? {} : input.payload, timestamp = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO artifacts(id, artifact_type, name, owner_entry_id, payload_json, status, revision_no, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, type, name, ownerEntryId, JSON.stringify(payload), input.status === 'draft' ? 'draft' : 'saved', timestamp, timestamp);
      db.prepare('INSERT INTO artifact_revisions(id, artifact_id, revision_no, payload_json, name, created_at) VALUES (?, ?, 1, ?, ?, ?)')
        .run(randomUUID(), id, JSON.stringify(payload), name, timestamp);
      for (const source of entrySources) db.prepare('INSERT INTO artifact_entry_sources(artifact_id, entry_id, role) VALUES (?, ?, ?)').run(id, source.entryId, source.role || 'source');
      for (const source of assetSources) db.prepare('INSERT INTO artifact_asset_sources(artifact_id, asset_id, role) VALUES (?, ?, ?)').run(id, source.assetId, source.role || 'source');
      for (const sourceId of dependencies) {
        if (sourceId === id) fail(400, '成果不能依赖自身');
        db.prepare('INSERT INTO artifact_dependencies(artifact_id, source_artifact_id, role) VALUES (?, ?, ?)').run(id, sourceId, 'derived_from');
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return get(id);
  }
  function update(id, patch) {
    const current = db.prepare('SELECT * FROM artifacts WHERE id = ?').get(id);
    if (!current) fail(404, '分析成果不存在: ' + id);
    if (patch.status !== undefined && !['draft', 'saved', 'archived'].includes(patch.status)) fail(400, '成果状态不合法');
    const name = patch.name === undefined ? current.name : String(patch.name).trim();
    if (!name) fail(400, '成果名称不能为空');
    const payload = patch.payload === undefined ? parseJson(current.payload_json, {}) : patch.payload;
    const revision = current.revision_no + (patch.payload !== undefined || patch.name !== undefined ? 1 : 0);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE artifacts SET name = ?, payload_json = ?, status = ?, revision_no = ?, updated_at = ? WHERE id = ?')
        .run(name, JSON.stringify(payload), patch.status === undefined ? current.status : patch.status, revision, now(), id);
      if (revision !== current.revision_no) db.prepare('INSERT INTO artifact_revisions(id, artifact_id, revision_no, payload_json, name, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(randomUUID(), id, revision, JSON.stringify(payload), name, now());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return get(id);
  }
  function history(id) {
    if (!db.prepare('SELECT id FROM artifacts WHERE id = ?').get(id)) fail(404, '分析成果不存在: ' + id);
    return db.prepare('SELECT id, artifact_id, revision_no, payload_json, name, created_at FROM artifact_revisions WHERE artifact_id = ? ORDER BY revision_no').all(id)
      .map(row => ({ ...row, payload: parseJson(row.payload_json, {}), payload_json: undefined }));
  }
  return { get, list, create, update, history };
}
module.exports = { createArtifactService };
