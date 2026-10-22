'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

function createLegacyResourcesRouter({ projectRoot, dataDir }) {
  const router = express.Router();
  const PROJECT_ROOT = projectRoot;
  const DATA_DIR = dataDir;
  fs.mkdirSync(DATA_DIR, { recursive: true });

// ==================== CSV文件读取API ====================

/**
 * GET /api/csv/bom
 * 读取BOM.csv文件
 */
router.get('/api/csv/bom', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, 'BOM.csv');
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/csv/test
 * 读取test.csv文件
 */
router.get('/api/csv/test', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, 'test.csv');
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/csv/testmethod
 * 读取testmethod.csv文件
 */
router.get('/api/csv/testmethod', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, 'testmethod.csv');
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json({ success: true, data: content });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 计算模块配置API ====================

/**
 * GET /api/data-processing-config
 * 读取data-processing.json配置
 */
router.get('/api/data-processing-config', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, 'data-processing.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 报告模板文件API ====================

/**
 * GET /api/report-templates
 * 获取wordreporttemplate目录下所有Word模板列表
 */
router.get('/api/report-templates', (req, res) => {
  try {
    const templateDir = path.join(PROJECT_ROOT, 'wordreporttemplate');
    const files = fs.readdirSync(templateDir).filter(f => f.endsWith('.docx'));
    const templates = files.map((f, i) => ({
      id: `rt-${i + 1}`,
      name: f.replace('.docx', ''),
      fileName: f,
      fileSize: fs.statSync(path.join(templateDir, f)).size,
    }));
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// ==================== 安全分块读取 API ====================
router.post('/api/data/read-chunk', (req, res) => {
  try {
    const { filePath, offset = 0, chunkSize = 1024 * 1024 } = req.body || {};
    if (typeof filePath !== 'string' || !filePath.trim()) {
      return res.status(400).json({ success: false, error: 'filePath 必须是数据目录内的文件路径' });
    }
    const candidate = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(DATA_DIR, filePath);
    if (!fs.existsSync(candidate)) return res.status(404).json({ success: false, error: '文件不存在' });
    const dataRoot = fs.realpathSync(DATA_DIR);
    const resolved = fs.realpathSync(candidate);
    const relative = path.relative(dataRoot, resolved);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
      return res.status(403).json({ success: false, error: '仅允许读取数据目录内的文件' });
    }
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) return res.status(400).json({ success: false, error: '目标不是普通文件' });
    const start = Number(offset), size = Number(chunkSize);
    if (!Number.isInteger(start) || start < 0 || start > stat.size) return res.status(416).json({ success: false, error: 'offset 超出文件范围' });
    if (!Number.isInteger(size) || size < 1 || size > 8 * 1024 * 1024) return res.status(400).json({ success: false, error: 'chunkSize 必须在 1 到 8388608 字节之间' });
    const length = Math.min(size, stat.size - start);
    const buffer = Buffer.alloc(length);
    const fd = fs.openSync(resolved, 'r');
    let bytesRead;
    try { bytesRead = fs.readSync(fd, buffer, 0, length, start); } finally { fs.closeSync(fd); }
    return res.json({ success: true, data: { content: buffer.toString('utf-8', 0, bytesRead), bytesRead, totalSize: stat.size, offset: start, hasMore: start + bytesRead < stat.size } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// ==================== AI辅助接口（预留） ====================

/**
 * POST /api/ai/generate
 * AI辅助生成内容（需配置LLM接口）
 */
router.post('/api/ai/generate', (req, res) => {
  const { context, prompt } = req.body;
  // 预留AI接口，返回模拟数据
  res.json({
    success: true,
    data: {
      message: 'AI辅助功能需要配置LLM API密钥。请在系统管理中配置。',
      generated: null,
    },
  });
});


  return router;
}
module.exports = { createLegacyResourcesRouter };
