'use strict';

const express = require('express');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { importJsonDirectoryOnce } = require('../db/legacyImport');

function fail(status, message) { throw Object.assign(new Error(message), { status }); }
function validId(value) {
  const id = String(value == null ? '' : value).trim();
  if (!id || id.length > 160 || id === '.' || id === '..' || /[\/\\\u0000-\u001f]/.test(id)) {
    fail(400, '记录 ID 格式不合法');
  }
  return id;
}
function createLegacyCrudRouter({ db, dataDir }) {
  const router = express.Router();
  const resources = {
    experiments: path.join(dataDir, 'experiments'),
    templates: path.join(dataDir, 'templates'),
    projects: path.join(dataDir, 'projects'),
    reports: path.join(dataDir, 'reports')
  };
  const timestamp = () => new Date().toISOString();

  for (const [resourceType, directory] of Object.entries(resources)) {
    importJsonDirectoryOnce({
      db, resourceType, directory,
      importRecord(payload, filename) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
          throw new Error('旧数据迁移失败，记录必须是 JSON 对象: ' + path.join(directory, filename));
        }
        const id = validId(payload.id || path.basename(filename, '.json'));
        db.prepare('INSERT OR IGNORE INTO legacy_records(resource_type, id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
          .run(resourceType, id, JSON.stringify({ ...payload, id }), timestamp(), timestamp());
      }
    });
  }

  function list(resourceType) {
    return db.prepare('SELECT payload_json FROM legacy_records WHERE resource_type = ? ORDER BY updated_at DESC, id')
      .all(resourceType).map(row => JSON.parse(row.payload_json));
  }
  function save(resourceType, payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) fail(400, '请求正文必须是 JSON 对象');
    const id = validId(payload.id || randomUUID());
    const value = { ...payload, id };
    const time = timestamp();
    db.prepare('INSERT INTO legacy_records(resource_type, id, payload_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(resource_type, id) DO UPDATE SET payload_json = excluded.payload_json, updated_at = excluded.updated_at')
      .run(resourceType, id, JSON.stringify(value), time, time);
    return value;
  }
  function remove(resourceType, id) {
    db.prepare('DELETE FROM legacy_records WHERE resource_type = ? AND id = ?').run(resourceType, validId(id));
    return { success: true };
  }

  router.get('/api/experiments', (req, res) => res.json({ success: true, data: list('experiments') }));
  router.post('/api/experiments', (req, res) => res.json({ success: true, data: save('experiments', req.body) }));
  router.delete('/api/experiments/:id', (req, res) => res.json(remove('experiments', req.params.id)));

  router.get('/api/templates', (req, res) => res.json({ success: true, data: list('templates') }));
  router.post('/api/templates', (req, res) => res.json({ success: true, data: save('templates', req.body) }));
  router.delete('/api/templates/:id', (req, res) => res.json(remove('templates', req.params.id)));

  router.get('/api/projects', (req, res) => res.json({ success: true, data: list('projects') }));
  router.post('/api/projects', (req, res) => res.json({ success: true, data: save('projects', req.body) }));
  router.delete('/api/projects/:id', (req, res) => res.json(remove('projects', req.params.id)));

  router.get('/api/reports', (req, res) => res.json({ success: true, data: list('reports') }));
  router.post('/api/reports', (req, res) => res.json({ success: true, data: save('reports', req.body) }));
  router.delete('/api/reports/:id', (req, res) => res.json(remove('reports', req.params.id)));

  return router;
}

module.exports = { createLegacyCrudRouter };
