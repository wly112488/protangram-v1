'use strict';

const express = require('express');

function createRelationRouter({ relations }) {
  const router = express.Router();
  router.get('/entries/:id/relations', (req, res) => res.json({ success: true, data: relations.list(req.params.id) }));
  router.post('/entries/:id/relations', (req, res) => res.status(201).json({ success: true, data: relations.add(req.params.id, req.body || {}) }));
  router.delete('/entries/:id/relations/:relationId', (req, res) => res.json({ success: true, data: relations.remove(req.params.id, req.params.relationId) }));
  return router;
}
module.exports = { createRelationRouter };
