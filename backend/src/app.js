'use strict';

const express = require('express');
const cors = require('cors');
const fs = require('node:fs');
const path = require('node:path');
const { openDatabase } = require('./db');
const { createDomainRouter } = require('./domain/router');
const { createLegacyCrudRouter } = require('./routes/legacyCrud');
const { createLegacyResourcesRouter } = require('./routes/legacyResources');
const { createComputeRouter } = require('./routes/compute');

function createApp(options = {}) {
  const projectRoot = options.projectRoot || path.resolve(__dirname, '../..');
  const dataDir = options.dataDir || path.join(projectRoot, 'data');
  fs.mkdirSync(dataDir, { recursive: true });
  const dbHandle = openDatabase({ dataDir });
  const app = express();

  app.disable('x-powered-by');
  app.use(cors());
  app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || '50mb' }));

  app.use('/api/domain', createDomainRouter({ db: dbHandle.db, dataDir }));
  app.use(createLegacyCrudRouter({ projectRoot, dataDir }));
  app.use(createLegacyResourcesRouter({ projectRoot, dataDir }));
  app.use(createComputeRouter({ dataDir }));

  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) return res.status(404).json({ success: false, error: 'API 路径不存在' });
    return next();
  });

  if (options.serveFrontend !== false) {
    const frontendDist = path.join(projectRoot, 'frontend', 'dist');
    if (fs.existsSync(frontendDist)) {
      app.use(express.static(frontendDist));
      app.get(/^(?!\/api).*/, (req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
    }
  }

  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error && error.status ? error.status : error && error.type === 'entity.too.large' ? 413 : 500;
    return res.status(status).json({ success: false, error: error && error.message || '未知服务错误' });
  });

  return { app, dbHandle, projectRoot, dataDir };
}

module.exports = { createApp };
