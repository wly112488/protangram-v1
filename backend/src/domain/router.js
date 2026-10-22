'use strict';

const express = require('express');
const { createEntryService } = require('./entries');
const { createRelationService } = require('./relations');
const { createAssetService } = require('./assets');
const { createArtifactService } = require('./artifacts');
const { createModelRevisionService } = require('./modelRevisions');
const { createModelRunService } = require('./modelRuns');
const { createSchemaRouter } = require('./schemaRoutes');
const { createEntryRouter } = require('./entryRoutes');
const { createRelationRouter } = require('./relationRoutes');
const { createAssetRouter } = require('./assetRoutes');
const { createArtifactRouter } = require('./artifactRoutes');
const { createModelRouter } = require('./modelRoutes');

function createDomainRouter({ db, dataDir }) {
  const router = express.Router();
  const entries = createEntryService({ db });
  const relations = createRelationService({ db });
  const assets = createAssetService({ db, dataDir, entryService: entries });
  const artifacts = createArtifactService({ db });
  const revisions = createModelRevisionService({ db });
  const runs = createModelRunService({ db });

  router.get('/health', (req, res) => res.json({
    success: true,
    data: { service: 'domain-api', database: 'sqlite', schemaVersion: 2 }
  }));
  router.use('/schema', createSchemaRouter({ db }));
  router.use('/entries', createEntryRouter({ db, entries }));
  router.use('/', createRelationRouter({ relations }));
  router.use('/assets', createAssetRouter({ assets, dataDir }));
  router.use('/artifacts', createArtifactRouter({ artifacts }));
  router.use('/models', createModelRouter({ revisions, runs }));

  router.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error && error.status
      ? error.status
      : error && error.code === 'LIMIT_FILE_SIZE'
        ? 413
        : String(error && error.message || '').includes('UNIQUE constraint failed')
          ? 409
          : String(error && error.message || '').includes('FOREIGN KEY constraint failed')
            ? 422
            : 500;
    return res.status(status).json({ success: false, error: error && error.message || '未知服务错误' });
  });
  return router;
}
module.exports = { createDomainRouter };
