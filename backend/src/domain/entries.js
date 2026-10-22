'use strict';

const { randomUUID } = require('node:crypto');
const {
  now, parseJson, requireClass, fieldForClass, validateEntry, getClass
} = require('./schema');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function entryRow(db, id) {
  return db.prepare('SELECT e.*, c.name AS class_name, c.group_name AS class_group, p.name AS parent_name FROM entries e JOIN classes c ON c.id = e.class_id LEFT JOIN entries p ON p.id = e.parent_entry_id WHERE e.id = ?').get(id) || null;
}
function fieldValues(db, entryId) {
  return db.prepare('SELECT v.*, d.value_type, d.standard_unit, d.meaning AS field_meaning, a.original_name AS asset_name, a.media_type AS asset_media_type FROM entry_field_values v JOIN field_dictionary d ON d.name = v.field_name LEFT JOIN assets a ON a.id = v.asset_id WHERE v.entry_id = ? ORDER BY v.source_order, v.created_at, v.id').all(entryId)
    .map(row => ({ ...row, value: parseJson(row.value_json), value_json: undefined }));
}
function entryRelations(db, entryId) {
  const outgoing = db.prepare('SELECT r.*, t.name AS target_name, t.class_id AS target_class_id FROM entry_relations r JOIN entries t ON t.id = r.target_entry_id WHERE r.source_entry_id = ? ORDER BY r.relation_name, t.name').all(entryId)
    .map(row => ({ ...row, direction: 'outgoing' }));
  const incoming = db.prepare('SELECT r.*, s.name AS source_name, s.class_id AS source_class_id FROM entry_relations r JOIN entries s ON s.id = r.source_entry_id WHERE r.target_entry_id = ? ORDER BY r.relation_name, s.name').all(entryId)
    .map(row => ({ ...row, direction: 'incoming' }));
  return { outgoing, incoming };
}
function snapshot(db, entryId) {
  const entry = entryRow(db, entryId);
  if (!entry) return null;
  return { entry, fields: fieldValues(db, entryId), relations: entryRelations(db, entryId), capturedAt: now() };
}
function recordRevision(db, entryId) {
  const entry = db.prepare('SELECT revision FROM entries WHERE id = ?').get(entryId);
  if (!entry) return;
  db.prepare('INSERT OR REPLACE INTO entry_revisions(id, entry_id, revision_no, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(randomUUID(), entryId, entry.revision, JSON.stringify(snapshot(db, entryId)), now());
}
function touchEntry(db, entryId) {
  db.prepare('UPDATE entries SET revision = revision + 1, updated_at = ? WHERE id = ?').run(now(), entryId);
  recordRevision(db, entryId);
}
function createEntryService({ db }) {
  function get(id, { includeChildren = false } = {}) {
    const entry = entryRow(db, id);
    if (!entry) fail(404, '实例不存在: ' + id);
    const result = { ...entry, fields: fieldValues(db, id), relations: entryRelations(db, id) };
    if (includeChildren) result.children = db.prepare('SELECT id, class_id, name, status FROM entries WHERE parent_entry_id = ? ORDER BY name').all(id);
    return result;
  }
  function list({ classId, parentId, status, q, limit = 100, offset = 0 } = {}) {
    const clauses = [], params = [];
    if (classId) { requireClass(db, classId); clauses.push('e.class_id = ?'); params.push(classId); }
    if (parentId !== undefined) { clauses.push('e.parent_entry_id IS ?'); params.push(parentId || null); }
    if (status) { clauses.push('e.status = ?'); params.push(status); }
    if (q) { clauses.push('(e.name LIKE ? OR e.id LIKE ? OR e.description LIKE ?)'); params.push('%' + q + '%', '%' + q + '%', '%' + q + '%'); }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const safeLimit = Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 100));
    const safeOffset = Math.max(0, Number.isInteger(offset) ? offset : 0);
    return db.prepare('SELECT e.id, e.class_id, c.name AS class_name, e.name, e.parent_entry_id, e.description, e.secondary_part, e.status, e.revision, e.created_at, e.updated_at FROM entries e JOIN classes c ON c.id = e.class_id' + where + ' ORDER BY e.name, e.id LIMIT ? OFFSET ?')
      .all(...params, safeLimit, safeOffset);
  }
  function create(input) {
    const classId = String(input.classId || '').trim();
    const cls = requireClass(db, classId);
    if (cls.is_grouping) fail(422, '归类用的抽象类不能直接创建实例: ' + classId);
    const id = String(input.id || randomUUID()).trim();
    const name = String(input.name || '').trim();
    if (!id || !/^[\p{L}\p{N}._:-]{1,160}$/u.test(id)) fail(400, '实例 ID 格式不合法');
    if (!name) fail(400, '实例名称不能为空');
    const parentId = input.parentEntryId || null;
    if (parentId) {
      if (!entryRow(db, parentId)) fail(404, '上级实例不存在: ' + parentId);
      if (parentId === id) fail(400, '实例不能以自身为上级');
    }
    const status = input.status || 'draft';
    if (!['draft', 'active', 'archived'].includes(status)) fail(400, '实例状态不合法');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO entries(id, class_id, name, parent_entry_id, description, secondary_part, status, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)')
        .run(id, classId, name, parentId, String(input.description || ''), input.secondaryPart ? 1 : 0, 'draft', now(), now());
      if (status === 'active') {
        const validation = validateEntry(db, id);
        if (!validation.valid) fail(422, validation.errors.join('；'));
      }
      if (status !== 'draft') db.prepare('UPDATE entries SET status = ? WHERE id = ?').run(status, id);
      recordRevision(db, id);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE constraint failed')) fail(409, '实例 ID 已存在: ' + id);
      throw error;
    }
    return get(id);
  }
  function update(id, patch) {
    const current = entryRow(db, id);
    if (!current) fail(404, '实例不存在: ' + id);
    const allowed = {};
    if (patch.name !== undefined) {
      const name = String(patch.name).trim();
      if (!name) fail(400, '实例名称不能为空');
      allowed.name = name;
    }
    if (patch.description !== undefined) allowed.description = String(patch.description || '');
    if (patch.parentEntryId !== undefined) {
      const parentId = patch.parentEntryId || null;
      if (parentId === id) fail(400, '实例不能以自身为上级');
      let ancestorId = parentId;
      while (ancestorId) {
        if (ancestorId === id) fail(409, '调整上级关系会形成循环');
        const ancestor = entryRow(db, ancestorId);
        if (!ancestor) fail(404, '上级实例不存在: ' + ancestorId);
        ancestorId = ancestor.parent_entry_id;
      }
      allowed.parent_entry_id = parentId;
    }
    if (patch.secondaryPart !== undefined) allowed.secondary_part = patch.secondaryPart ? 1 : 0;
    if (patch.status !== undefined) {
      if (!['draft', 'active', 'archived'].includes(patch.status)) fail(400, '实例状态不合法');
      allowed.status = patch.status;
    }
    if (!Object.keys(allowed).length) return get(id);
    const assignments = Object.keys(allowed).map(key => key + ' = ?').join(', ');
    db.exec('BEGIN IMMEDIATE');
    try {
      if (allowed.status === 'active') {
        const validation = validateEntry(db, id);
        if (!validation.valid) fail(422, validation.errors.join('；'));
      }
      db.prepare('UPDATE entries SET ' + assignments + ', revision = revision + 1, updated_at = ? WHERE id = ?')
        .run(...Object.values(allowed), now(), id);
      recordRevision(db, id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return get(id);
  }
  function archive(id) {
    if (!entryRow(db, id)) fail(404, '实例不存在: ' + id);
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('UPDATE entries SET status = ?, revision = revision + 1, updated_at = ? WHERE id = ?').run('archived', now(), id);
      recordRevision(db, id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { id, status: 'archived' };
  }
  function addFieldValue(entryId, input) {
    const entry = entryRow(db, entryId);
    if (!entry) fail(404, '实例不存在: ' + entryId);
    const fieldName = String(input.fieldName || '').trim();
    const declaredField = fieldForClass(db, entry.class_id, fieldName);
    const field = declaredField || db.prepare('SELECT * FROM field_dictionary WHERE name = ?').get(fieldName);
    if (!field) fail(404, '字段字典中不存在: ' + fieldName);
    const schemaOverride = !declaredField;
    if (schemaOverride && input.allowSchemaOverride !== true) fail(422, '字段未列入当前类字段清单；确认需要保留该扩展字段时设置 allowSchemaOverride=true');
    const assetId = input.assetId || null;
    if (assetId && !db.prepare('SELECT id FROM assets WHERE id = ?').get(assetId)) fail(404, '数据资产不存在: ' + assetId);
    if (assetId && !['文件', '表格'].includes(field.value_type)) fail(422, '只有文件/表格字段可以引用数据资产: ' + fieldName);
    const value = input.value === undefined ? null : input.value;
    if (value !== null) {
      if (field.value_type === '数值' && !(typeof value === 'number' && Number.isFinite(value))) fail(422, '数值字段必须使用有限数值: ' + fieldName);
      if (['文本', '选项'].includes(field.value_type) && typeof value !== 'string') fail(422, '文本/选项字段必须使用字符串: ' + fieldName);
      if (['文件', '表格'].includes(field.value_type) && assetId == null && typeof value !== 'string') fail(422, '文件/表格字段需要数据资产 ID 或来源路径: ' + fieldName);
    }
    if (['文件', '表格'].includes(field.value_type) && value == null && assetId == null) fail(422, '文件/表格字段不能为空');
    if (input.sourceEntryId && !entryRow(db, input.sourceEntryId)) fail(404, '字段来源实例不存在: ' + input.sourceEntryId);
    const id = randomUUID(), timestamp = now();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO entry_field_values(id, entry_id, field_name, value_json, raw_value, unit, group_name, limit_value, source_entry_id, asset_id, note, source_order, created_at, updated_at, schema_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, entryId, fieldName, value === null ? null : JSON.stringify(value),
          input.rawValue == null ? (value === null ? null : String(value)) : String(input.rawValue),
          input.unit == null ? '' : String(input.unit), input.groupName == null ? '' : String(input.groupName),
          input.limitValue == null ? '' : String(input.limitValue), input.sourceEntryId || null, assetId,
          input.note == null ? '' : String(input.note), Number.isInteger(input.order) ? input.order : 0, timestamp, timestamp, schemaOverride ? 1 : 0);
      touchEntry(db, entryId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return db.prepare('SELECT * FROM entry_field_values WHERE id = ?').get(id);
  }
  function updateFieldValue(entryId, valueId, patch) {
    const value = db.prepare('SELECT * FROM entry_field_values WHERE id = ? AND entry_id = ?').get(valueId, entryId);
    if (!value) fail(404, '字段值不存在');
    const entry = entryRow(db, entryId);
    const declaredField = fieldForClass(db, entry.class_id, value.field_name);
    const field = declaredField || db.prepare('SELECT * FROM field_dictionary WHERE name = ?').get(value.field_name);
    if (!field) fail(404, '字段字典中不存在: ' + value.field_name);
    if (!declaredField && !value.schema_override && patch.allowSchemaOverride !== true) fail(422, '字段未列入当前类字段清单；确认需要保留该扩展字段时设置 allowSchemaOverride=true');
    const next = { ...value };
    if (patch.allowSchemaOverride === true) next.schema_override = 1;
    if (patch.value !== undefined) {
      if (patch.value === null) next.value_json = null;
      else {
        if (field.value_type === '数值' && !(typeof patch.value === 'number' && Number.isFinite(patch.value))) fail(422, '数值字段必须使用有限数值: ' + value.field_name);
        if (['文本', '选项'].includes(field.value_type) && typeof patch.value !== 'string') fail(422, '文本/选项字段必须使用字符串: ' + value.field_name);
        next.value_json = JSON.stringify(patch.value);
        next.raw_value = String(patch.value);
      }
    }
    const mapping = { unit: 'unit', groupName: 'group_name', limitValue: 'limit_value', sourceEntryId: 'source_entry_id', assetId: 'asset_id', note: 'note', order: 'source_order', rawValue: 'raw_value' };
    for (const [inputKey, column] of Object.entries(mapping)) {
      if (patch[inputKey] === undefined) continue;
      if (column === 'source_order') {
        const order = Number(patch[inputKey]);
        if (!Number.isInteger(order)) fail(400, 'order 必须是整数');
        next[column] = order;
      } else if (['unit', 'group_name', 'limit_value', 'note'].includes(column)) next[column] = patch[inputKey] == null ? '' : String(patch[inputKey]);
      else next[column] = patch[inputKey] == null || patch[inputKey] === '' ? null : String(patch[inputKey]);
    }
    if (next.source_entry_id && !entryRow(db, next.source_entry_id)) fail(404, '字段来源实例不存在: ' + next.source_entry_id);
    if (next.asset_id && !db.prepare('SELECT id FROM assets WHERE id = ?').get(next.asset_id)) fail(404, '数据资产不存在: ' + next.asset_id);
    const nextValue = parseJson(next.value_json);
    if (['文件', '表格'].includes(field.value_type) && next.asset_id == null && typeof nextValue !== 'string') fail(422, '文件/表格字段需要数据资产 ID 或来源路径: ' + value.field_name);
    db.exec('BEGIN IMMEDIATE');
    try {
      if (next.asset_id && !['文件', '表格'].includes(field.value_type)) fail(422, '只有文件/表格字段可以引用数据资产: ' + value.field_name);
      db.prepare('UPDATE entry_field_values SET value_json=?, raw_value=?, unit=?, group_name=?, limit_value=?, source_entry_id=?, asset_id=?, note=?, source_order=?, updated_at=?, schema_override=? WHERE id=? AND entry_id=?')
        .run(next.value_json, next.raw_value, next.unit, next.group_name, next.limit_value, next.source_entry_id, next.asset_id, next.note, next.source_order, now(), next.schema_override ? 1 : 0, valueId, entryId);
      touchEntry(db, entryId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return db.prepare('SELECT * FROM entry_field_values WHERE id = ?').get(valueId);
  }
  function deleteFieldValue(entryId, valueId) {
    if (!db.prepare('SELECT id FROM entry_field_values WHERE id = ? AND entry_id = ?').get(valueId, entryId)) fail(404, '字段值不存在');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM entry_field_values WHERE id = ?').run(valueId);
      touchEntry(db, entryId);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { deleted: true, id: valueId };
  }
  function history(entryId) {
    if (!entryRow(db, entryId)) fail(404, '实例不存在: ' + entryId);
    return db.prepare('SELECT id, entry_id, revision_no, snapshot_json, created_at FROM entry_revisions WHERE entry_id = ? ORDER BY revision_no').all(entryId)
      .map(row => ({ ...row, snapshot: parseJson(row.snapshot_json, {}) }));
  }
  return { get, list, create, update, archive, addFieldValue, updateFieldValue, deleteFieldValue, history, snapshot, recordRevision, touchEntry, entryRow, fieldValues, entryRelations };
}

module.exports = { createEntryService, entryRow, fieldValues, entryRelations, snapshot, recordRevision, touchEntry };
