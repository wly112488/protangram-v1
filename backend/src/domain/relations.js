'use strict';

const { randomUUID } = require('node:crypto');
const { now, validateRelation } = require('./schema');
const { entryRow, touchEntry } = require('./entries');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }

function createRelationService({ db }) {
  function list(entryId) {
    if (!entryRow(db, entryId)) fail(404, '实例不存在: ' + entryId);
    return db.prepare('SELECT r.*, s.name AS source_name, s.class_id AS source_class_id, t.name AS target_name, t.class_id AS target_class_id FROM entry_relations r JOIN entries s ON s.id = r.source_entry_id JOIN entries t ON t.id = r.target_entry_id WHERE r.source_entry_id = ? OR r.target_entry_id = ? ORDER BY r.created_at')
      .all(entryId, entryId);
  }
  function add(sourceEntryId, input) {
    const source = entryRow(db, sourceEntryId);
    if (!source) fail(404, '起点实例不存在: ' + sourceEntryId);
    const targetEntryId = String(input.targetEntryId || '').trim();
    const target = entryRow(db, targetEntryId);
    if (!target) fail(404, '终点实例不存在: ' + targetEntryId);
    const relationName = String(input.relationName || '').trim();
    const check = validateRelation(db, source, relationName, target);
    if (!check.valid) fail(422, check.error);
    const id = randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('INSERT INTO entry_relations(id, source_entry_id, relation_name, target_entry_id, created_at) VALUES (?, ?, ?, ?, ?)')
        .run(id, sourceEntryId, relationName, targetEntryId, now());
      touchEntry(db, sourceEntryId);
      touchEntry(db, targetEntryId);
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE constraint failed')) fail(409, '该关联已存在');
      throw error;
    }
    return db.prepare('SELECT * FROM entry_relations WHERE id = ?').get(id);
  }
  function remove(entryId, relationId) {
    const relation = db.prepare('SELECT * FROM entry_relations WHERE id = ? AND (source_entry_id = ? OR target_entry_id = ?)').get(relationId, entryId, entryId);
    if (!relation) fail(404, '关联不存在');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.prepare('DELETE FROM entry_relations WHERE id = ?').run(relationId);
      touchEntry(db, relation.source_entry_id);
      touchEntry(db, relation.target_entry_id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    return { deleted: true, id: relationId };
  }
  return { list, add, remove };
}

module.exports = { createRelationService };
