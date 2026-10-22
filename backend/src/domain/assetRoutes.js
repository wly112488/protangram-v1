'use strict';

const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

function createAssetRouter({ assets, dataDir }) {
  const router = express.Router();
  const tempDir = path.join(dataDir, '.upload-tmp');
  fs.mkdirSync(tempDir, { recursive: true });
  const upload = multer({
    dest: tempDir,
    limits: { fileSize: 512 * 1024 * 1024, files: 1 }
  });
  const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  router.get('/', (req, res) => res.json({ success: true, data: assets.list({
    entryId: req.query.entryId,
    kind: req.query.kind,
    limit: Number.isInteger(Number(req.query.limit)) ? Number(req.query.limit) : 100
  }) }));
  router.post('/upload', upload.single('file'), asyncRoute(async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, error: '缺少文件；multipart 字段名应为 file' });
    try {
      const data = await assets.registerUpload(req.file, req.body || {});
      return res.status(201).json({ success: true, data });
    } catch (error) {
      if (req.file.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      throw error;
    }
  }));
  router.get('/:id/content', (req, res, next) => {
    try {
      const file = assets.contentPath(req.params.id);
      return res.download(file.path, file.asset.original_name);
    } catch (error) { next(error); }
  });
  router.get('/:id/preview', asyncRoute(async (req, res) => {
    const limit = req.query.limit == null ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) return res.status(400).json({ success: false, error: 'limit 必须为 1–500 的整数' });
    const data = await assets.preview(req.params.id, { limit, delimiter: req.query.delimiter === '\\t' ? '\\t' : ',' });
    return res.json({ success: true, data });
  }));
  router.get('/:id', (req, res) => res.json({ success: true, data: assets.get(req.params.id) }));
  router.post('/:id/derivations', (req, res) => res.status(201).json({ success: true, data: assets.addDerivation(req.params.id, req.body || {}) }));
  return router;
}
module.exports = { createAssetRouter };
