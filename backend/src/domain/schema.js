'use strict';

const { randomUUID } = require('node:crypto');

function now() { return new Date().toISOString(); }
function parseJson(value, fallback = null) {
  if (value == null || value === '') return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
}
function getClass(db, classId) {
  return db.prepare('SELECT * FROM classes WHERE id = ?').get(classId) || null;
}
function requireClass(db, classId) {
  const value = getClass(db, classId);
  if (!value) throw Object.assign(new Error('类不存在: ' + classId), { status: 404 });
  return value;
}
function getAncestors(db, classId) {
  const result = [];
  const seen = new Set();
  let current = getClass(db, classId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    result.push(current);
    current = current.parent_class_id ? getClass(db, current.parent_class_id) : null;
  }
  return result;
}
function isSubclass(db, candidateClassId, expectedClassId) {
  return getAncestors(db, candidateClassId).some(item => item.id === expectedClassId);
}
function effectiveFields(db, classId) {
  const result = [];
  const seen = new Set();
  for (const cls of getAncestors(db, classId).reverse()) {
    const rows = db.prepare('SELECT f.*, cf.source_order AS class_source_order FROM class_fields cf JOIN field_dictionary f ON f.name = cf.field_name WHERE cf.class_id = ? ORDER BY cf.source_order').all(cls.id);
    for (const row of rows) {
      if (seen.has(row.name)) continue;
      seen.add(row.name);
      result.push({ ...row, aliases: parseJson(row.aliases_json, []) });
    }
  }
  return result;
}
function fieldForClass(db, classId, fieldName) {
  return effectiveFields(db, classId).find(field => field.name === fieldName) || null;
}
function allowedRelation(db, sourceClassId, relationName, targetClassId) {
  if (relationName === '组成') {
    for (const sourceClass of getAncestors(db, sourceClassId)) {
      const rules = db.prepare('SELECT * FROM class_compositions WHERE parent_class_id = ?').all(sourceClass.id);
      for (const rule of rules) {
        if (isSubclass(db, targetClassId, rule.child_class_id)) return { ...rule, source_class_id: sourceClass.id, relation_name: relationName };
      }
    }
    return null;
  }
  for (const sourceClass of getAncestors(db, sourceClassId)) {
    const rules = db.prepare('SELECT * FROM class_relation_rules WHERE source_class_id = ? AND relation_name = ?').all(sourceClass.id, relationName);
    for (const rule of rules) {
      if (isSubclass(db, targetClassId, rule.target_class_id)) return rule;
    }
  }
  return null;
}
function validateRelation(db, sourceEntry, relationName, targetEntry, { ignoreRelationId = null } = {}) {
  if (sourceEntry.id === targetEntry.id) return { valid: false, error: '实例不能与自身建立关联' };
  const type = db.prepare('SELECT name FROM relationship_types WHERE name = ?').get(relationName);
  if (!type) return { valid: false, error: '关系类型未注册: ' + relationName };
  const rule = allowedRelation(db, sourceEntry.class_id, relationName, targetEntry.class_id);
  if (!rule) return { valid: false, error: '该类组合不允许此关系: ' + sourceEntry.class_id + ' —' + relationName + '→ ' + targetEntry.class_id };
  if (rule.max_count != null) {
    const targetClassId = relationName === '组成' ? rule.child_class_id : rule.target_class_id;
    const count = db.prepare("SELECT COUNT(*) AS n FROM entry_relations r JOIN entries target ON target.id = r.target_entry_id WHERE r.source_entry_id = ? AND r.relation_name = ? AND target.class_id IN (WITH RECURSIVE descendants(id) AS (SELECT id FROM classes WHERE id = ? UNION ALL SELECT c.id FROM classes c JOIN descendants d ON c.parent_class_id = d.id) SELECT id FROM descendants) AND (? IS NULL OR r.id <> ?)")
      .get(sourceEntry.id, relationName, targetClassId, ignoreRelationId, ignoreRelationId).n;
    if (count >= rule.max_count) return { valid: false, error: '关系数量超过约束: ' + relationName + '（' + rule.cardinality_label + '）' };
  }
  return { valid: true, rule };
}
function validateEntry(db, entryId) {
  const entry = db.prepare('SELECT * FROM entries WHERE id = ?').get(entryId);
  if (!entry) throw Object.assign(new Error('实例不存在: ' + entryId), { status: 404 });
  const errors = [];
  const warnings = [];
  const fields = db.prepare('SELECT v.*, d.value_type FROM entry_field_values v JOIN field_dictionary d ON d.name = v.field_name WHERE v.entry_id = ?').all(entryId);
  for (const value of fields) {
    if (!fieldForClass(db, entry.class_id, value.field_name)) {
      if (value.schema_override) warnings.push('字段未列入当前类的字段清单，已按来源数据保留: ' + value.field_name);
      else errors.push('字段不适用于当前类: ' + value.field_name);
      continue;
    }
    if (value.value_json == null) continue;
    const parsed = parseJson(value.value_json);
    if (value.value_type === '数值' && (typeof parsed !== 'number' || !Number.isFinite(parsed))) errors.push('字段值不是有效数值: ' + value.field_name);
    if (['文本', '选项'].includes(value.value_type) && typeof parsed !== 'string') errors.push('字段值类型错误: ' + value.field_name);
    if (['文件', '表格'].includes(value.value_type) && value.asset_id == null && typeof parsed !== 'string') errors.push('文件/表格字段必须引用数据资产或保留来源路径: ' + value.field_name);
  }
  const relationRules = [];
  for (const cls of getAncestors(db, entry.class_id)) relationRules.push(...db.prepare('SELECT * FROM class_relation_rules WHERE source_class_id = ?').all(cls.id));
  for (const rule of relationRules) {
    if (rule.min_count <= 0) continue;
    const count = db.prepare("SELECT COUNT(*) AS n FROM entry_relations r JOIN entries target ON target.id = r.target_entry_id WHERE r.source_entry_id = ? AND r.relation_name = ? AND target.class_id IN (WITH RECURSIVE descendants(id) AS (SELECT id FROM classes WHERE id = ? UNION ALL SELECT c.id FROM classes c JOIN descendants d ON c.parent_class_id = d.id) SELECT id FROM descendants)").get(entry.id, rule.relation_name, rule.target_class_id).n;
    if (count < rule.min_count) errors.push('缺少必需关系: ' + rule.relation_name + ' → ' + rule.target_class_id);
  }
  for (const cls of getAncestors(db, entry.class_id)) {
    const rules = db.prepare('SELECT * FROM class_compositions WHERE parent_class_id = ?').all(cls.id);
    for (const rule of rules) {
      if (rule.min_count <= 0) continue;
      const count = db.prepare("SELECT COUNT(*) AS n FROM entry_relations r JOIN entries target ON target.id = r.target_entry_id WHERE r.source_entry_id = ? AND r.relation_name = '组成' AND target.class_id IN (WITH RECURSIVE descendants(id) AS (SELECT id FROM classes WHERE id = ? UNION ALL SELECT c.id FROM classes c JOIN descendants d ON c.parent_class_id = d.id) SELECT id FROM descendants)").get(entry.id, rule.child_class_id).n;
      if (count < rule.min_count) errors.push('组成关系数量不足: ' + rule.child_class_id + '（' + rule.cardinality_label + '）');
    }
  }
  return { valid: errors.length === 0, entryId, errors, warnings };
}
function listSchema(db) {
  const classes = db.prepare('SELECT * FROM classes ORDER BY source_order, id').all();
  const fields = db.prepare('SELECT * FROM field_dictionary ORDER BY source_order, name').all().map(row => ({ ...row, aliases: parseJson(row.aliases_json, []) }));
  const relations = db.prepare('SELECT * FROM relationship_types ORDER BY source_order, name').all();
  const classFields = db.prepare('SELECT * FROM class_fields ORDER BY class_id, source_order').all();
  const compositions = db.prepare('SELECT * FROM class_compositions ORDER BY parent_class_id, source_order').all();
  const relationRules = db.prepare('SELECT * FROM class_relation_rules ORDER BY source_class_id, source_order').all();
  return { classes, fields, relations, classFields, compositions, relationRules };
}

module.exports = {
  now, parseJson, getClass, requireClass, getAncestors, isSubclass,
  effectiveFields, fieldForClass, allowedRelation, validateRelation,
  validateEntry, listSchema, randomUUID
};
