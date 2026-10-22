'use strict';

const express = require('express');
const { listSchema, requireClass, effectiveFields } = require('./schema');

function createSchemaRouter({ db }) {
  const router = express.Router();
  router.get('/', (req, res) => res.json({ success: true, data: listSchema(db) }));
  router.get('/classes/:id', (req, res, next) => {
    try {
      const cls = requireClass(db, req.params.id);
      const compositions = db.prepare('SELECT * FROM class_compositions WHERE parent_class_id = ?').all(cls.id);
      const relationRules = db.prepare('SELECT * FROM class_relation_rules WHERE source_class_id = ?').all(cls.id);
      res.json({ success: true, data: { ...cls, effectiveFields: effectiveFields(db, cls.id), compositions, relationRules } });
    } catch (error) { next(error); }
  });
  return router;
}
module.exports = { createSchemaRouter };
