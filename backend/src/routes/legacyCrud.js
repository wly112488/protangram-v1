'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

function createLegacyCrudRouter({ projectRoot, dataDir }) {
  const router = express.Router();
  const PROJECT_ROOT = projectRoot;
  const DATA_DIR = dataDir;
  const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');
  const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
  const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
  const REPORTS_DIR = path.join(DATA_DIR, 'reports');
  for (const dir of [EXPERIMENTS_DIR, TEMPLATES_DIR, PROJECTS_DIR, REPORTS_DIR]) fs.mkdirSync(dir, { recursive: true });
  function safeRecordPath(dir, id) {
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
      throw Object.assign(new Error('记录 ID 格式不合法'), { status: 400 });
    }
    return path.join(dir, id + '.json');
  }

// ==================== 试验卡片CRUD API ====================

/**
 * GET /api/experiments
 * 获取所有试验卡片
 */
router.get('/api/experiments', (req, res) => {
  try {
    const files = fs.readdirSync(EXPERIMENTS_DIR).filter(f => f.endsWith('.json'));
    const experiments = files.map(f => {
      const content = fs.readFileSync(path.join(EXPERIMENTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: experiments });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/experiments
 * 新建/更新试验卡片
 */
router.post('/api/experiments', (req, res) => {
  try {
    const experiment = req.body;
    if (!experiment.id) experiment.id = uuidv4();
    const filePath = safeRecordPath(EXPERIMENTS_DIR, experiment.id);
    fs.writeFileSync(filePath, JSON.stringify(experiment, null, 2), 'utf-8');
    res.json({ success: true, data: experiment });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/experiments/:id
 * 删除试验卡片
 */
router.delete('/api/experiments/:id', (req, res) => {
  try {
    const filePath = safeRecordPath(EXPERIMENTS_DIR, req.params.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ==================== 数据分析模板CRUD API ====================

/**
 * GET /api/templates
 * 获取所有分析模板
 */
router.get('/api/templates', (req, res) => {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      const content = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/templates
 * 新建/更新分析模板
 */
router.post('/api/templates', (req, res) => {
  try {
    const template = req.body;
    if (!template.id) template.id = uuidv4();
    const filePath = safeRecordPath(TEMPLATES_DIR, template.id);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/templates/:id
 * 删除分析模板
 */
router.delete('/api/templates/:id', (req, res) => {
  try {
    const filePath = safeRecordPath(TEMPLATES_DIR, req.params.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ==================== 数据分析项目CRUD API ====================

/**
 * GET /api/projects
 * 获取所有分析项目
 */
router.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const projects = files.map(f => {
      const content = fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: projects });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/projects
 * 新建/更新分析项目
 */
router.post('/api/projects', (req, res) => {
  try {
    const project = req.body;
    if (!project.id) project.id = uuidv4();
    const filePath = safeRecordPath(PROJECTS_DIR, project.id);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/projects/:id
 * 删除分析项目
 */
router.delete('/api/projects/:id', (req, res) => {
  try {
    const filePath = safeRecordPath(PROJECTS_DIR, req.params.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ==================== 分析报告CRUD API ====================

/**
 * GET /api/reports
 * 获取所有报告
 */
router.get('/api/reports', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'));
    const reports = files.map(f => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports
 * 新建/更新报告
 */
router.post('/api/reports', (req, res) => {
  try {
    const report = req.body;
    if (!report.id) report.id = uuidv4();
    const filePath = safeRecordPath(REPORTS_DIR, report.id);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/reports/:id
 * 删除分析报告
 */
router.delete('/api/reports/:id', (req, res) => {
  try {
    const filePath = safeRecordPath(REPORTS_DIR, req.params.id);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});


  return router;
}
module.exports = { createLegacyCrudRouter };
