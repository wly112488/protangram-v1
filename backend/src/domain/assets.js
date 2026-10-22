'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { randomUUID } = require('node:crypto');
const { now, parseJson, isSubclass } = require('./schema');
const { entryRow } = require('./entries');
const { fieldForClass } = require('./schema');
const { previewCsv } = require('../services/csvPreview');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function safeExtension(name) {
  const ext = path.extname(String(name || '')).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(ext) ? ext : '';
}
function parseMetadata(value) {
  if (value == null || value === '') return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) fail(400, 'metadata 必须是 JSON 对象');
    return parsed;
  } catch (error) {
    if (error.status) throw error;
    fail(400, 'metadata JSON 格式错误');
  }
}
async function sha256File(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}
function createAssetService({ db, dataDir, entryService }) {
  const assetDir = path.join(dataDir, 'assets');
  fs.mkdirSync(assetDir, { recursive: true });
  function row(id) { return db.prepare('SELECT * FROM assets WHERE id = ?').get(id) || null; }
  function get(id) {
    const asset = row(id);
    if (!asset) fail(404, '数据资产不存在: ' + id);
    const fieldReferences = db.prepare('SELECT v.id AS field_value_id, v.entry_id, v.field_name, e.name AS entry_name FROM entry_field_values v JOIN entries e ON e.id = v.entry_id WHERE v.asset_id = ? ORDER BY e.name').all(id);
    const derivedFrom = db.prepare('SELECT d.*, a.original_name AS source_name, a.sha256 AS source_sha256 FROM asset_derivations d JOIN assets a ON a.id = d.source_asset_id WHERE d.derived_asset_id = ?').all(id);
    const derivedAssets = db.prepare('SELECT d.*, a.original_name AS derived_name, a.sha256 AS derived_sha256 FROM asset_derivations d JOIN assets a ON a.id = d.derived_asset_id WHERE d.source_asset_id = ?').all(id);
    return { ...asset, metadata: parseJson(asset.metadata_json, {}), metadata_json: undefined, fieldReferences, derivedFrom, derivedAssets };
  }
  function list({ entryId, kind, limit = 100 } = {}) {
    const clauses = [], params = [];
    if (kind) { clauses.push('a.kind = ?'); params.push(kind); }
    if (entryId) { clauses.push('v.entry_id = ?'); params.push(entryId); }
    const where = clauses.length ? ' WHERE ' + clauses.join(' AND ') : '';
    const join = entryId ? ' JOIN entry_field_values v ON v.asset_id = a.id' : '';
    return db.prepare('SELECT DISTINCT a.id, a.original_name, a.kind, a.media_type, a.size_bytes, a.sha256, a.format_entry_id, a.created_at FROM assets a' + join + where + ' ORDER BY a.created_at DESC LIMIT ?')
      .all(...params, Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 100)));
  }
  async function registerUpload(file, input = {}) {
    if (!file || !file.path) fail(400, '缺少上传文件');
    const formatEntryId = input.formatEntryId || null;
    if (formatEntryId) {
      const format = entryRow(db, formatEntryId);
      if (!format) fail(404, '采集格式实例不存在: ' + formatEntryId);
      if (!isSubclass(db, format.class_id, 'FMT')) fail(422, 'formatEntryId 必须引用 FMT 类实例');
    }
    const ownerEntryId = input.ownerEntryId || null;
    const fieldName = input.fieldName == null ? '' : String(input.fieldName).trim();
    if (!!ownerEntryId !== !!fieldName) fail(400, 'ownerEntryId 与 fieldName 必须同时提供');
    if (ownerEntryId) {
      const owner = entryRow(db, ownerEntryId);
      if (!owner) fail(404, '所属实例不存在: ' + ownerEntryId);
      const field = fieldForClass(db, owner.class_id, fieldName);
      if (!field) fail(422, '字段不适用于所属实例: ' + fieldName);
      if (!['文件', '表格'].includes(field.value_type)) fail(422, '上传文件只能写入“文件”或“表格”字段: ' + fieldName);
    }
    const id = randomUUID();
    const extension = safeExtension(file.originalname);
    const storageKey = id + extension;
    const destination = path.join(assetDir, storageKey);
    const sha = await sha256File(file.path);
    const mediaType = String(file.mimetype || 'application/octet-stream');
    const kind = input.kind || (extension === '.csv' ? 'table_data' : 'raw_file');
    if (!['raw_file', 'table_data', 'document', 'image', 'model_method', 'derived_dataset', 'chart_export', 'other'].includes(kind)) fail(400, '数据资产类型不合法');
    const metadata = parseMetadata(input.metadata);
    fs.renameSync(file.path, destination);
    try {
      db.prepare('INSERT INTO assets(id, original_name, storage_key, kind, media_type, size_bytes, sha256, format_entry_id, source_path, representation, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)')
        .run(id, path.basename(String(file.originalname || 'upload')), storageKey, kind, mediaType, file.size, sha, formatEntryId, 'original', JSON.stringify(metadata), now());
      if (ownerEntryId) {
        try {
          entryService.addFieldValue(ownerEntryId, { fieldName, assetId: id, rawValue: file.originalname, note: input.note || '' });
        } catch (error) {
          db.prepare('DELETE FROM assets WHERE id = ?').run(id);
          throw error;
        }
      }
    } catch (error) {
      if (fs.existsSync(destination)) fs.unlinkSync(destination);
      throw error;
    }
    return get(id);
  }
  function contentPath(id) {
    const asset = row(id);
    if (!asset) fail(404, '数据资产不存在: ' + id);
    const root = path.resolve(assetDir);
    const target = path.resolve(root, asset.storage_key);
    if (!target.startsWith(root + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) fail(404, '数据文件不存在');
    return { asset, path: target };
  }
  function formatConfig(formatEntryId) {
    if (!formatEntryId) return { encoding: 'utf-8', skipRows: 0 };
    const values = db.prepare('SELECT field_name, value_json FROM entry_field_values WHERE entry_id = ? ORDER BY source_order').all(formatEntryId);
    const map = new Map();
    for (const item of values) if (!map.has(item.field_name) && item.value_json != null) map.set(item.field_name, parseJson(item.value_json));
    const combined = String(map.get('文件类型与编码') || '');
    const encoding = String(map.get('文件编码') || (combined.match(/GB18030|GBK|UTF-8/i) || ['utf-8'])[0]);
    const skipRows = Number(map.get('表头行数') || ((combined.match(/前\s*(\d+)\s*行表头/i) || [])[1]) || 0);
    return { encoding, skipRows: Number.isFinite(skipRows) ? Math.max(0, Math.floor(skipRows)) : 0 };
  }
  async function preview(id, { limit = 50, delimiter = ',' } = {}) {
    const { asset, path: filePath } = contentPath(id);
    if (!/csv|text\/plain|text\/tab-separated-values/i.test(asset.media_type + ' ' + asset.original_name)) fail(415, '当前基础预览仅支持 CSV/文本文件；不会自动将 XLSX 预览数据伪装成原始文件');
    const config = formatConfig(asset.format_entry_id);
    return { assetId: id, originalName: asset.original_name, sha256: asset.sha256, formatEntryId: asset.format_entry_id, ...await previewCsv(filePath, { ...config, limit, delimiter }) };
  }
  function addDerivation(sourceAssetId, input) {
    const source = row(sourceAssetId);
    const derived = row(input.derivedAssetId);
    if (!source || !derived) fail(404, '源资产或派生资产不存在');
    if (sourceAssetId === input.derivedAssetId) fail(400, '资产不能派生自自身');
    const createsCycle = db.prepare('WITH RECURSIVE descendants(id) AS (SELECT derived_asset_id FROM asset_derivations WHERE source_asset_id = ? UNION ALL SELECT d.derived_asset_id FROM asset_derivations d JOIN descendants x ON d.source_asset_id = x.id) SELECT 1 FROM descendants WHERE id = ? LIMIT 1')
      .get(input.derivedAssetId, sourceAssetId);
    if (createsCycle) fail(409, '该派生关系会形成循环');
    const id = randomUUID();
    try {
      db.prepare('INSERT INTO asset_derivations(id, source_asset_id, derived_asset_id, relation_type, transformation_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, sourceAssetId, input.derivedAssetId, input.relationType || 'derived_from', JSON.stringify(input.transformation || {}), now());
    } catch (error) {
      if (String(error.message).includes('UNIQUE constraint failed')) fail(409, '该派生关系已存在');
      throw error;
    }
    return db.prepare('SELECT * FROM asset_derivations WHERE id = ?').get(id);
  }
  return { get, list, registerUpload, contentPath, preview, addDerivation, assetDir };
}
module.exports = { createAssetService };
