'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { openDatabase } = require('../db/index');
const { createEntryService } = require('../domain/entries');

function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 1; }
        else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field.length === 0) { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r' || ch === '\n') {
      row.push(field); field = ''; rows.push(row); row = [];
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      continue;
    }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (quoted) throw new Error('CSV 存在未闭合的双引号');
  if (!rows.length) return [];
  const header = rows[0].map(value => value.trim());
  return rows.slice(1).filter(values => values.some(value => value !== '')).map(values => {
    const result = {};
    header.forEach((key, index) => { result[key] = values[index] == null ? '' : values[index]; });
    return result;
  });
}
function parseCardinality(label) {
  const value = String(label || '').trim();
  let match = value.match(/^(\d+)\s*或\s*(\d+)$/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  match = value.match(/^×\s*(\d+)$/);
  if (match) return { min: Number(match[1]), max: Number(match[1]) };
  match = value.match(/^≥\s*(\d+)$/);
  if (match) return { min: Number(match[1]), max: null };
  match = value.match(/^(\d+)\s*-\s*(\d+)$/);
  if (match) return { min: Number(match[1]), max: Number(match[2]) };
  return { min: 0, max: null };
}
function readVfs(html) {
  const match = html.match(/<script\s+type="application\/json"\s+id="vfs">([\s\S]*?)<\/script>/i);
  if (!match) throw new Error('HTML 中找不到 id="vfs" 的嵌入数据');
  const vfs = JSON.parse(match[1]);
  const required = ['结构/类.csv', '结构/类字段.csv', '结构/类组成.csv', '结构/类关联.csv', '结构/字段字典.csv', '结构/关系名称.csv', '实例/条目.csv', '实例/字段值.csv', '实例/关联.csv'];
  for (const key of required) if (typeof vfs[key] !== 'string') throw new Error('HTML 缺少必要数据表: ' + key);
  return vfs;
}
function importStructureHtml({ inputPath, dataDir }) {
  if (!inputPath || !fs.existsSync(inputPath)) throw new Error('必须指定存在的 HTML 文件路径');
  const htmlBuffer = fs.readFileSync(inputPath);
  const html = htmlBuffer.toString('utf8');
  const sourceSha = crypto.createHash('sha256').update(htmlBuffer).digest('hex');
  const vfs = readVfs(html);
  const parsed = Object.fromEntries(Object.entries(vfs).filter(([, value]) => typeof value === 'string').map(([key, value]) => [key, parseCsv(value)]));
  const dbHandle = openDatabase({ dataDir });
  const { db } = dbHandle;
  const existingImport = db.prepare('SELECT * FROM import_batches WHERE source_sha256 = ?').get(sourceSha);
  if (existingImport) {
    db.close();
    return { skipped: true, reason: '该 HTML 已导入', batchId: existingImport.id, counts: JSON.parse(existingImport.counts_json) };
  }
  const existingRows = [
    db.prepare('SELECT COUNT(*) AS n FROM classes').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM field_dictionary').get().n,
    db.prepare('SELECT COUNT(*) AS n FROM entries').get().n
  ].reduce((sum, count) => sum + count, 0);
  if (existingRows > 0) {
    db.close();
    throw new Error('数据库已包含领域元数据或实例；为避免覆盖现有业务数据，HTML 导入仅允许在空领域库中首次执行');
  }
  const classes = parsed['结构/类.csv'];
  const classFields = parsed['结构/类字段.csv'];
  const compositions = parsed['结构/类组成.csv'];
  const classRelations = parsed['结构/类关联.csv'];
  const dictionary = parsed['结构/字段字典.csv'];
  const relationTypes = parsed['结构/关系名称.csv'];
  const sourceEntries = parsed['实例/条目.csv'];
  const sourceValues = parsed['实例/字段值.csv'];
  const sourceRelations = parsed['实例/关联.csv'];
  const counts = {};
  const timestamp = new Date().toISOString();
  db.exec('BEGIN IMMEDIATE');
  try {
    const insertClass = db.prepare('INSERT INTO classes(id, name, group_name, parent_class_id, description, is_grouping, source_order) VALUES (?, ?, ?, NULL, ?, ?, ?)');
    const updateClassParent = db.prepare('UPDATE classes SET parent_class_id = ? WHERE id = ?');
    const classIds = new Set(classes.map(row => row['类ID']));
    for (let i = 0; i < classes.length; i += 1) {
      const row = classes[i];
      insertClass.run(row['类ID'], row['名称'], row['分组'] || '', row['说明'] || '', row['只用于归类'] === '是' ? 1 : 0, i);
    }
    for (const row of classes) {
      if (row['上级类']) {
        if (!classIds.has(row['上级类'])) throw new Error('类的上级不存在: ' + row['类ID'] + ' → ' + row['上级类']);
        updateClassParent.run(row['上级类'], row['类ID']);
      }
    }
    const insertField = db.prepare('INSERT INTO field_dictionary(name, meaning, value_type, standard_unit, aliases_json, source_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < dictionary.length; i += 1) {
      const row = dictionary[i];
      const type = ['文本', '数值', '文件', '表格', '选项'].includes(row['值类型']) ? row['值类型'] : '其他';
      const aliases = String(row['别名'] || '').split('、').map(value => value.trim()).filter(Boolean);
      insertField.run(row['名称'], row['含义'] || '', type, row['标准单位'] || '', JSON.stringify(aliases), i);
    }
    const insertClassField = db.prepare('INSERT INTO class_fields(class_id, field_name, source_order) VALUES (?, ?, ?)');
    for (let i = 0; i < classFields.length; i += 1) {
      const row = classFields[i];
      insertClassField.run(row['类ID'], row['字段'], i);
    }
    const insertRelationType = db.prepare('INSERT INTO relationship_types(name, inverse_name, direction_label, source_order) VALUES (?, ?, ?, ?)');
    for (let i = 0; i < relationTypes.length; i += 1) {
      const row = relationTypes[i];
      insertRelationType.run(row['关系名'], row['终点一侧名称'] || '', row['起点 → 终点'] || '', i);
    }
    const insertComposition = db.prepare('INSERT INTO class_compositions(parent_class_id, child_class_id, cardinality_label, min_count, max_count, source_order) VALUES (?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < compositions.length; i += 1) {
      const row = compositions[i], cardinality = parseCardinality(row['数量']);
      insertComposition.run(row['类ID'], row['下级类ID'], row['数量'] || '若干', cardinality.min, cardinality.max, i);
    }
    const insertClassRelation = db.prepare('INSERT INTO class_relation_rules(source_class_id, relation_name, target_class_id, cardinality_label, min_count, max_count, source_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
    for (let i = 0; i < classRelations.length; i += 1) {
      const row = classRelations[i], cardinality = parseCardinality(row['数量']);
      insertClassRelation.run(row['类ID'], row['关系名'], row['终点类ID'], row['数量'] || '若干', cardinality.min, cardinality.max, i);
    }
    const insertEntry = db.prepare('INSERT INTO entries(id, class_id, name, parent_entry_id, description, secondary_part, status, revision, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?, 1, ?, ?)');
    const entryIds = new Set(sourceEntries.map(row => row['ID']));
    for (const row of sourceEntries) {
      insertEntry.run(row['ID'], row['类ID'], row['名称'], row['描述'] || '', row['次要部件'] === '是' ? 1 : 0, 'active', timestamp, timestamp);
    }
    const setParent = db.prepare('UPDATE entries SET parent_entry_id = ? WHERE id = ?');
    for (const row of sourceEntries) {
      if (row['上级ID']) {
        if (!entryIds.has(row['上级ID'])) throw new Error('实例的上级不存在: ' + row['ID'] + ' → ' + row['上级ID']);
        setParent.run(row['上级ID'], row['ID']);
      }
    }
    const fieldTypes = new Map(dictionary.map(row => [row['名称'], row['值类型']]));
    const entryClassById = new Map(sourceEntries.map(row => [row['ID'], row['类ID']]));
    const classFieldSet = new Map();
    for (const row of classFields) {
      if (!classFieldSet.has(row['类ID'])) classFieldSet.set(row['类ID'], new Set());
      classFieldSet.get(row['类ID']).add(row['字段']);
    }
    const parentClassById = new Map(classes.map(row => [row['类ID'], row['上级类'] || '']));
    const fieldApplies = (classId, fieldName) => {
      let current = classId;
      const seen = new Set();
      while (current && !seen.has(current)) {
        seen.add(current);
        if (classFieldSet.get(current)?.has(fieldName)) return true;
        current = parentClassById.get(current) || '';
      }
      return false;
    };
    const insertValue = db.prepare('INSERT INTO entry_field_values(id, entry_id, field_name, value_json, raw_value, unit, group_name, limit_value, source_entry_id, asset_id, note, source_order, created_at, updated_at, schema_override) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?)');
    let fieldSchemaOverrides = 0;
    for (let i = 0; i < sourceValues.length; i += 1) {
      const row = sourceValues[i];
      const raw = String(row['值'] || '');
      const type = fieldTypes.get(row['字段']) || '文本';
      let value = null;
      if (raw !== '') {
        if (type === '数值') {
          value = Number(raw);
          if (!Number.isFinite(value)) throw new Error('数值字段无法解析: ' + row['条目ID'] + '/' + row['字段'] + '=' + raw);
        } else value = raw;
      }
      if (row['取自ID'] && !entryIds.has(row['取自ID'])) throw new Error('字段来源实例不存在: ' + row['取自ID']);
      const schemaOverride = !fieldApplies(entryClassById.get(row['条目ID']), row['字段']);
      if (schemaOverride) fieldSchemaOverrides += 1;
      insertValue.run(crypto.randomUUID(), row['条目ID'], row['字段'], value === null ? null : JSON.stringify(value), raw === '' ? null : raw,
        row['单位'] || '', row['分组'] || '', row['上下限'] || '', row['取自ID'] || null, row['说明'] || '', i, timestamp, timestamp, schemaOverride ? 1 : 0);
    }
    const insertRelation = db.prepare('INSERT INTO entry_relations(id, source_entry_id, relation_name, target_entry_id, created_at) VALUES (?, ?, ?, ?, ?)');
    for (const row of sourceRelations) {
      if (!entryIds.has(row['起点ID']) || !entryIds.has(row['终点ID'])) throw new Error('关联端点不存在: ' + row['起点ID'] + ' → ' + row['终点ID']);
      insertRelation.run(crypto.randomUUID(), row['起点ID'], row['关系名'], row['终点ID'], timestamp);
    }
    const entryService = createEntryService({ db });
    for (const row of sourceEntries) entryService.recordRevision(row['ID']);
    const batchId = crypto.randomUUID();
    counts.classes = classes.length;
    counts.fields = dictionary.length;
    counts.classFields = classFields.length;
    counts.classCompositions = compositions.length;
    counts.classRelationRules = classRelations.length;
    counts.entries = sourceEntries.length;
    counts.fieldValues = sourceValues.length;
    counts.fieldSchemaOverrides = fieldSchemaOverrides;
    counts.relations = sourceRelations.length;
    db.prepare('INSERT INTO import_batches(id, source_name, source_sha256, imported_at, counts_json) VALUES (?, ?, ?, ?, ?)')
      .run(batchId, path.basename(inputPath), sourceSha, timestamp, JSON.stringify(counts));
    db.exec('COMMIT');
    db.close();
    return { skipped: false, batchId, counts, note: '导入了结构元数据与实例字段/关联；文件路径作为来源引用保留，未将 HTML 中的嵌入预览当作原始文件字节导入。' };
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch {}
    db.close();
    throw error;
  }
}
function cliArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--input') args.inputPath = argv[++i];
    else if (argv[i] === '--data-dir') args.dataDir = argv[++i];
    else if (argv[i] === '--help' || argv[i] === '-h') args.help = true;
    else throw new Error('未知参数: ' + argv[i]);
  }
  return args;
}
if (require.main === module) {
  try {
    const args = cliArgs(process.argv.slice(2));
    if (args.help || !args.inputPath) {
      process.stdout.write('用法: node src/scripts/import-structure-html.js --input <HTML路径> [--data-dir <数据目录>]\n');
      process.exit(args.help ? 0 : 2);
    }
    const projectRoot = path.resolve(__dirname, '../../..');
    const result = importStructureHtml({ inputPath: path.resolve(args.inputPath), dataDir: path.resolve(args.dataDir || path.join(projectRoot, 'data')) });
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write((error.stack || error.message) + '\n');
    process.exit(1);
  }
}
module.exports = { parseCsv, parseCardinality, readVfs, importStructureHtml };
