'use strict';

const express = require('express');

function createArtifactRouter({ artifacts }) {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ success: true, data: artifacts.list({
    ownerEntryId: req.query.ownerEntryId,
    artifactType: req.query.artifactType,
    limit: Number.isInteger(Number(req.query.limit)) ? Number(req.query.limit) : 100
  }) }));
  router.post('/', (req, res) => res.status(201).json({ success: true, data: artifacts.create(req.body || {}) }));
  router.get('/:id', (req, res) => res.json({ success: true, data: artifacts.get(req.params.id) }));
  router.patch('/:id', (req, res) => res.json({ success: true, data: artifacts.update(req.params.id, req.body || {}) }));
  router.get('/:id/history', (req, res) => res.json({ success: true, data: artifacts.history(req.params.id) }));
  return router;
}
module.exports = { createArtifactRouter };
