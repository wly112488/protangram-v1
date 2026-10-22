'use strict';

const express = require('express');

function createModelRouter({ revisions, runs }) {
  const router = express.Router();
  router.get('/revisions', (req, res) => {
    if (!req.query.modelEntryId) return res.json({ success: true, data: [] });
    return res.json({ success: true, data: revisions.list(req.query.modelEntryId) });
  });
  router.post('/revisions', (req, res) => res.status(201).json({ success: true, data: revisions.create(req.body || {}) }));
  router.get('/revisions/:id', (req, res) => res.json({ success: true, data: revisions.get(req.params.id) }));
  router.patch('/revisions/:id/status', (req, res) => res.json({ success: true, data: revisions.setStatus(req.params.id, (req.body || {}).status) }));
  router.get('/runs', (req, res) => res.json({ success: true, data: runs.list({
    objectModelEntryId: req.query.objectModelEntryId,
    limit: Number.isInteger(Number(req.query.limit)) ? Number(req.query.limit) : 100
  }) }));
  router.post('/runs', (req, res) => res.status(201).json({ success: true, data: runs.create(req.body || {}) }));
  router.get('/runs/:id', (req, res) => res.json({ success: true, data: runs.get(req.params.id) }));
  router.patch('/runs/:id', (req, res) => res.json({ success: true, data: runs.update(req.params.id, req.body || {}) }));
  router.post('/runs/:id/artifacts', (req, res) => res.status(201).json({ success: true, data: runs.attachArtifact(req.params.id, req.body || {}) }));
  return router;
}
module.exports = { createModelRouter };
