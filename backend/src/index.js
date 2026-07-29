const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 9016;

// 中间件
app.use(cors());
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// 项目根目录
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');

// 托管前端静态文件（生产环境）
const FRONTEND_DIST = path.join(PROJECT_ROOT, 'frontend', 'dist');
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));
  // SPA fallback：非 /api 请求返回 index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
}

// 数据存储目录
const DATA_DIR = path.join(PROJECT_ROOT, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const EXPERIMENTS_DIR = path.join(DATA_DIR, 'experiments');
if (!fs.existsSync(EXPERIMENTS_DIR)) fs.mkdirSync(EXPERIMENTS_DIR, { recursive: true });

const TEMPLATES_DIR = path.join(DATA_DIR, 'templates');
if (!fs.existsSync(TEMPLATES_DIR)) fs.mkdirSync(TEMPLATES_DIR, { recursive: true });

const PROJECTS_DIR = path.join(DATA_DIR, 'projects');
if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });

const REPORTS_DIR = path.join(DATA_DIR, 'reports');
if (!fs.existsSync(REPORTS_DIR)) fs.mkdirSync(REPORTS_DIR, { recursive: true });

const PROCESS_DATA_DIR = path.join(DATA_DIR, 'process_data');
if (!fs.existsSync(PROCESS_DATA_DIR)) fs.mkdirSync(PROCESS_DATA_DIR, { recursive: true });

// ==================== CSV文件读取API ====================

/**
 * GET /api/csv/bom
 * 读取BOM.csv文件
 */
app.get('/api/csv/bom', (req, res) => {
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
app.get('/api/csv/test', (req, res) => {
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
app.get('/api/csv/testmethod', (req, res) => {
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
app.get('/api/data-processing-config', (req, res) => {
  try {
    const filePath = path.join(PROJECT_ROOT, 'data-processing.json');
    const content = fs.readFileSync(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 试验卡片CRUD API ====================

/**
 * GET /api/experiments
 * 获取所有试验卡片
 */
app.get('/api/experiments', (req, res) => {
  try {
    const files = fs.readdirSync(EXPERIMENTS_DIR).filter(f => f.endsWith('.json'));
    const experiments = files.map(f => {
      const content = fs.readFileSync(path.join(EXPERIMENTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: experiments });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/experiments
 * 新建/更新试验卡片
 */
app.post('/api/experiments', (req, res) => {
  try {
    const experiment = req.body;
    if (!experiment.id) experiment.id = uuidv4();
    const filePath = path.join(EXPERIMENTS_DIR, `${experiment.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(experiment, null, 2), 'utf-8');
    res.json({ success: true, data: experiment });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/experiments/:id
 * 删除试验卡片
 */
app.delete('/api/experiments/:id', (req, res) => {
  try {
    const filePath = path.join(EXPERIMENTS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 数据分析模板CRUD API ====================

/**
 * GET /api/templates
 * 获取所有分析模板
 */
app.get('/api/templates', (req, res) => {
  try {
    const files = fs.readdirSync(TEMPLATES_DIR).filter(f => f.endsWith('.json'));
    const templates = files.map(f => {
      const content = fs.readFileSync(path.join(TEMPLATES_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: templates });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/templates
 * 新建/更新分析模板
 */
app.post('/api/templates', (req, res) => {
  try {
    const template = req.body;
    if (!template.id) template.id = uuidv4();
    const filePath = path.join(TEMPLATES_DIR, `${template.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(template, null, 2), 'utf-8');
    res.json({ success: true, data: template });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/templates/:id
 * 删除分析模板
 */
app.delete('/api/templates/:id', (req, res) => {
  try {
    const filePath = path.join(TEMPLATES_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 数据分析项目CRUD API ====================

/**
 * GET /api/projects
 * 获取所有分析项目
 */
app.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.json'));
    const projects = files.map(f => {
      const content = fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: projects });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/projects
 * 新建/更新分析项目
 */
app.post('/api/projects', (req, res) => {
  try {
    const project = req.body;
    if (!project.id) project.id = uuidv4();
    const filePath = path.join(PROJECTS_DIR, `${project.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(project, null, 2), 'utf-8');
    res.json({ success: true, data: project });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/projects/:id
 * 删除分析项目
 */
app.delete('/api/projects/:id', (req, res) => {
  try {
    const filePath = path.join(PROJECTS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 分析报告CRUD API ====================

/**
 * GET /api/reports
 * 获取所有报告
 */
app.get('/api/reports', (req, res) => {
  try {
    const files = fs.readdirSync(REPORTS_DIR).filter(f => f.endsWith('.json'));
    const reports = files.map(f => {
      const content = fs.readFileSync(path.join(REPORTS_DIR, f), 'utf-8');
      return JSON.parse(content);
    });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * POST /api/reports
 * 新建/更新报告
 */
app.post('/api/reports', (req, res) => {
  try {
    const report = req.body;
    if (!report.id) report.id = uuidv4();
    const filePath = path.join(REPORTS_DIR, `${report.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf-8');
    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/reports/:id
 * 删除分析报告
 */
app.delete('/api/reports/:id', (req, res) => {
  try {
    const filePath = path.join(REPORTS_DIR, `${req.params.id}.json`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 报告模板文件API ====================

/**
 * GET /api/report-templates
 * 获取wordreporttemplate目录下所有Word模板列表
 */
app.get('/api/report-templates', (req, res) => {
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

// ==================== 计算模块WebService代理 ====================

/**
 * POST /api/compute/:moduleId/:algId
 * 计算模块统一调用接口（解耦设计，需求D.a）
 * 当前版本：内置计算逻辑；生产环境：转发至外部WebService
 */
app.post('/api/compute/:moduleId/:algId', (req, res) => {
  try {
    const { moduleId, algId } = req.params;
    const { data, weights, ddof, norm, source_range, target_range, scale_factor,
            threshold, condition, iqr_factor, window_size, agg_func, features,
            x, y, x_new, method, base } = req.body;

    let result;

    switch (`${moduleId}/${algId}`) {
      // 统计类
      case 'statistical/mean': {
        const sum = data.reduce((a, b) => a + b, 0);
        result = { mean_value: sum / data.length };
        break;
      }
      case 'statistical/median': {
        const sorted = [...data].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        result = { median_value: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2 };
        break;
      }
      case 'statistical/range': {
        result = { range_value: Math.max(...data) - Math.min(...data) };
        break;
      }
      case 'statistical/variance': {
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const d = ddof || 0;
        const variance = data.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (data.length - d);
        result = { variance_value: variance };
        break;
      }
      case 'statistical/std': {
        const m = data.reduce((a, b) => a + b, 0) / data.length;
        const dd = ddof || 0;
        const v = data.reduce((sum, val) => sum + (val - m) ** 2, 0) / (data.length - dd);
        result = { std_value: Math.sqrt(v) };
        break;
      }
      // 归一化/标准化类
      case 'normalization/min-max': {
        const min = Math.min(...data);
        const max = Math.max(...data);
        const range = max - min || 1;
        result = { normalized_data: data.map(v => (v - min) / range) };
        break;
      }
      case 'normalization/standard': {
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        const std = Math.sqrt(data.reduce((s, v) => s + (v - avg) ** 2, 0) / data.length);
        result = { standardized_data: data.map(v => (v - avg) / (std || 1)) };
        break;
      }
      case 'normalization/centralize': {
        const avg2 = data.reduce((a, b) => a + b, 0) / data.length;
        result = { centralized_data: data.map(v => v - avg2) };
        break;
      }
      case 'normalization/regularize': {
        const n = norm || 'l2';
        const normVal = n === 'l1'
          ? data.reduce((s, v) => s + Math.abs(v), 0)
          : Math.sqrt(data.reduce((s, v) => s + v * v, 0));
        result = { regularized_data: data.map(v => v / (normVal || 1)) };
        break;
      }
      case 'normalization/interval-map': {
        const [sMin, sMax] = source_range;
        const [tMin, tMax] = target_range;
        const sRange = sMax - sMin || 1;
        result = { mapped_data: data.map(v => tMin + ((v - sMin) / sRange) * (tMax - tMin)) };
        break;
      }
      case 'normalization/feature-scale': {
        result = { scaled_data: data.map(v => v * scale_factor) };
        break;
      }
      // 极值与筛选类
      case 'extreme-value/max': {
        const maxVal = Math.max(...data);
        result = { max_result: { max_value: maxVal, max_index: data.indexOf(maxVal) } };
        break;
      }
      case 'extreme-value/min': {
        const minVal = Math.min(...data);
        result = { min_result: { min_value: minVal, min_index: data.indexOf(minVal) } };
        break;
      }
      case 'extreme-value/threshold-filter': {
        const ops = { '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '==': (a, b) => a === b, '!=': (a, b) => a !== b };
        const fn = ops[condition] || ops['>'];
        result = { filtered_data: data.filter(v => fn(v, threshold)) };
        break;
      }
      case 'extreme-value/outlier-remove': {
        const sorted2 = [...data].sort((a, b) => a - b);
        const q1 = sorted2[Math.floor(sorted2.length * 0.25)];
        const q3 = sorted2[Math.floor(sorted2.length * 0.75)];
        const iqr = q3 - q1;
        const factor = iqr_factor || 1.5;
        result = { cleaned_data: data.filter(v => v >= q1 - factor * iqr && v <= q3 + factor * iqr) };
        break;
      }
      case 'extreme-value/peak-detect': {
        const ws = window_size || 3;
        const peaks = []; const peakIdx = [];
        for (let i = 1; i < data.length - 1; i++) {
          if (data[i] > data[i - 1] && data[i] > data[i + 1]) { peaks.push(data[i]); peakIdx.push(i); }
        }
        result = { peak_result: { peak_values: peaks, peak_indices: peakIdx } };
        break;
      }
      case 'extreme-value/valley-detect': {
        const valleys = []; const valleyIdx = [];
        for (let i = 1; i < data.length - 1; i++) {
          if (data[i] < data[i - 1] && data[i] < data[i + 1]) { valleys.push(data[i]); valleyIdx.push(i); }
        }
        result = { valley_result: { valley_values: valleys, valley_indices: valleyIdx } };
        break;
      }
      // 数学运算类
      case 'math/weighted-sum': {
        result = { weighted_sum_value: data.reduce((s, v, i) => s + v * (weights[i] || 0), 0) };
        break;
      }
      case 'math/weighted-average': {
        const wSum = data.reduce((s, v, i) => s + v * (weights[i] || 0), 0);
        const wTotal = weights.reduce((s, w) => s + w, 0);
        result = { weighted_average_value: wSum / (wTotal || 1) };
        break;
      }
      case 'math/log-transform': {
        const b = base || Math.E;
        result = { log_transformed_data: data.map(v => Math.log(v) / Math.log(b)) };
        break;
      }
      case 'math/exp-transform': {
        const eb = base || Math.E;
        result = { exp_transformed_data: data.map(v => Math.pow(eb, v)) };
        break;
      }
      // 聚合/降维类
      case 'aggregation/aggregate': {
        const ws2 = window_size || 2;
        const aggFn = { sum: arr => arr.reduce((a, b) => a + b, 0), mean: arr => arr.reduce((a, b) => a + b, 0) / arr.length, max: arr => Math.max(...arr), min: arr => Math.min(...arr) };
        const fn2 = aggFn[agg_func] || aggFn.mean;
        const aggResult = [];
        for (let i = 0; i < data.length; i += ws2) {
          aggResult.push(fn2(data.slice(i, i + ws2)));
        }
        result = { aggregated_data: aggResult };
        break;
      }
      case 'aggregation/feature-extract': {
        const feats = features || ['mean', 'std', 'max', 'min'];
        const extracted = {};
        const avg3 = data.reduce((a, b) => a + b, 0) / data.length;
        if (feats.includes('mean')) extracted.mean = avg3;
        if (feats.includes('std')) extracted.std = Math.sqrt(data.reduce((s, v) => s + (v - avg3) ** 2, 0) / data.length);
        if (feats.includes('max')) extracted.max = Math.max(...data);
        if (feats.includes('min')) extracted.min = Math.min(...data);
        result = { extracted_features: extracted };
        break;
      }
      case 'aggregation/smooth': {
        const ws3 = window_size || 3;
        const smoothed = [];
        const half = Math.floor(ws3 / 2);
        for (let i = half; i < data.length - half; i++) {
          const window = data.slice(i - half, i + half + 1);
          smoothed.push(window.reduce((a, b) => a + b, 0) / window.length);
        }
        result = { smoothed_data: smoothed };
        break;
      }
      case 'aggregation/interpolate': {
        const yNew = x_new.map(xn => {
          let i = 0;
          while (i < x.length - 1 && x[i + 1] < xn) i++;
          if (i >= x.length - 1) return y[y.length - 1];
          const t = (xn - x[i]) / (x[i + 1] - x[i] || 1);
          return y[i] + t * (y[i + 1] - y[i]);
        });
        result = { y_new: yNew };
        break;
      }
      default:
        return res.status(404).json({ success: false, error: `算法 ${moduleId}/${algId} 不存在` });
    }

    // 存储过程数据到process_data目录（需求D.b）
    const processId = uuidv4();
    const processData = {
      id: processId,
      module: moduleId,
      algorithm: algId,
      input: req.body,
      output: result,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(PROCESS_DATA_DIR, `${processId}.json`),
      JSON.stringify(processData, null, 2),
      'utf-8'
    );

    res.json({ success: true, data: result, processId });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== 大文件分块读取API（需求D.b） ====================

/**
 * POST /api/data/read-chunk
 * 分块读取大文件，不修改原文件
 * @param {string} filePath - 文件路径
 * @param {number} offset - 起始字节偏移量
 * @param {number} chunkSize - 读取块大小（字节）
 */
app.post('/api/data/read-chunk', (req, res) => {
  try {
    const { filePath, offset = 0, chunkSize = 1024 * 1024 } = req.body; // 默认1MB块
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: '文件不存在' });
    }
    const stat = fs.statSync(filePath);
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(Math.min(chunkSize, stat.size - offset));
    const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, offset);
    fs.closeSync(fd);

    res.json({
      success: true,
      data: {
        content: buffer.toString('utf-8', 0, bytesRead),
        bytesRead,
        totalSize: stat.size,
        offset,
        hasMore: offset + bytesRead < stat.size,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== AI辅助接口（预留） ====================

/**
 * POST /api/ai/generate
 * AI辅助生成内容（需配置LLM接口）
 */
app.post('/api/ai/generate', (req, res) => {
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

// 启动服务器
app.listen(PORT, () => {
  console.log(`ProTangram 后端服务已启动: http://localhost:${PORT}`);
  console.log(`项目根目录: ${PROJECT_ROOT}`);
  console.log(`数据存储目录: ${DATA_DIR}`);
});
