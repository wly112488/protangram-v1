'use strict';

const express = require('express');
const { validateEntry } = require('./schema');

function createEntryRouter({ db, entries }) {
  const router = express.Router();
  const wrap = fn => (req, res, next) => { try { Promise.resolve(fn(req, res, next)).catch(next); } catch (error) { next(error); } };

  router.get('/', (req, res) => {
    const limit = req.query.limit == null ? 100 : Number(req.query.limit);
    const offset = req.query.offset == null ? 0 : Number(req.query.offset);
    const data = entries.list({
      classId: req.query.classId,
      parentId: req.query.parentId,
      status: req.query.status,
      q: req.query.q,
      limit: Number.isInteger(limit) ? limit : 100,
      offset: Number.isInteger(offset) ? offset : 0
    });
    res.json({ success: true, data });
  });
  router.post('/', (req, res) => res.status(201).json({ success: true, data: entries.create(req.body || {}) }));
  router.get('/:id', (req, res) => res.json({ success: true, data: entries.get(req.params.id, { includeChildren: req.query.includeChildren === 'true' }) }));
  router.patch('/:id', (req, res) => res.json({ success: true, data: entries.update(req.params.id, req.body || {}) }));
  router.delete('/:id', (req, res) => res.json({ success: true, data: entries.archive(req.params.id) }));
  router.get('/:id/history', (req, res) => res.json({ success: true, data: entries.history(req.params.id) }));
  router.post('/:id/validate', (req, res) => res.json({ success: true, data: validateEntry(db, req.params.id) }));
  router.get('/:id/field-values', (req, res) => res.json({ success: true, data: entries.get(req.params.id).fields }));
  router.post('/:id/field-values', (req, res) => res.status(201).json({ success: true, data: entries.addFieldValue(req.params.id, req.body || {}) }));
  router.patch('/:id/field-values/:valueId', (req, res) => res.json({ success: true, data: entries.updateFieldValue(req.params.id, req.params.valueId, req.body || {}) }));
  router.delete('/:id/field-values/:valueId', (req, res) => res.json({ success: true, data: entries.deleteFieldValue(req.params.id, req.params.valueId) }));
  return router;
}
module.exports = { createEntryRouter };
