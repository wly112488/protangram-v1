'use strict';
const express = require('express');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');
const { importJsonDirectoryOnce } = require('../db/legacyImport');

function createComputeRouter({ db, dataDir }) {
  const router = express.Router();
  const PROCESS_DATA_DIR = path.join(dataDir, 'process_data');
  importJsonDirectoryOnce({
    db, resourceType: 'process_data', directory: PROCESS_DATA_DIR,
    importRecord(payload, filename) {
      if (!payload || typeof payload !== 'object' || !payload.id || !payload.module || !payload.algorithm) {
        throw new Error('旧计算记录缺少必要字段: ' + path.join(PROCESS_DATA_DIR, filename));
      }
      db.prepare('INSERT OR IGNORE INTO processing_runs(id, module, algorithm, input_json, output_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(String(payload.id), String(payload.module), String(payload.algorithm), JSON.stringify(payload.input || {}), JSON.stringify(payload.output || {}), payload.timestamp || new Date().toISOString());
    }
  });

// ==================== 计算模块WebService代理 ====================

/**
 * POST /api/compute/:moduleId/:algId
 * 计算模块统一调用接口（解耦设计，需求D.a）
 * 当前版本：内置计算逻辑；生产环境：转发至外部WebService
 */
router.post('/api/compute/:moduleId/:algId', (req, res) => {
  try {
    const { moduleId, algId } = req.params;
    const { data, weights, ddof, norm, source_range, target_range, scale_factor,
            threshold, condition, iqr_factor, window_size, agg_func, features,
            x, y, x_new, method, base } = req.body;

    const algorithmKey = moduleId + '/' + algId;
    const supportedAlgorithms = new Set([
      'statistical/mean', 'statistical/median', 'statistical/range', 'statistical/variance', 'statistical/std',
      'normalization/min-max', 'normalization/standard', 'normalization/centralize', 'normalization/regularize',
      'normalization/interval-map', 'normalization/feature-scale',
      'extreme-value/max', 'extreme-value/min', 'extreme-value/threshold-filter', 'extreme-value/outlier-remove',
      'extreme-value/peak-detect', 'extreme-value/valley-detect',
      'math/weighted-sum', 'math/weighted-average', 'math/log-transform', 'math/exp-transform',
      'aggregation/aggregate', 'aggregation/feature-extract', 'aggregation/smooth', 'aggregation/interpolate'
    ]);
    if (!supportedAlgorithms.has(algorithmKey)) return res.status(404).json({ success: false, error: '算法 ' + algorithmKey + ' 不存在' });
    const numericArray = (value, name, minimumLength = 1) => {
      if (!Array.isArray(value) || value.length < minimumLength || !value.every(item => typeof item === 'number' && Number.isFinite(item))) {
        throw Object.assign(new Error(name + ' 必须是至少 ' + minimumLength + ' 个有限数值组成的数组'), { status: 400 });
      }
      return value;
    };
    if (algorithmKey !== 'aggregation/interpolate') numericArray(data, 'data');
    if (['statistical/variance', 'statistical/std'].includes(algorithmKey)) {
      if (ddof !== undefined && (!Number.isInteger(ddof) || ddof < 0 || ddof >= data.length)) throw Object.assign(new Error('ddof 必须是小于数据长度的非负整数'), { status: 400 });
    }
    if (['math/weighted-sum', 'math/weighted-average'].includes(algorithmKey)) {
      numericArray(weights, 'weights');
      if (weights.length !== data.length) throw Object.assign(new Error('weights 与 data 长度必须一致'), { status: 400 });
    }
    if (algorithmKey === 'normalization/interval-map') {
      numericArray(source_range, 'source_range', 2); numericArray(target_range, 'target_range', 2);
      if (source_range.length !== 2 || target_range.length !== 2) throw Object.assign(new Error('source_range 和 target_range 必须各包含两个数值'), { status: 400 });
    }
    if (algorithmKey === 'normalization/feature-scale' && (typeof scale_factor !== 'number' || !Number.isFinite(scale_factor))) throw Object.assign(new Error('scale_factor 必须是有限数值'), { status: 400 });
    if (algorithmKey === 'extreme-value/threshold-filter' && (typeof threshold !== 'number' || !Number.isFinite(threshold))) throw Object.assign(new Error('threshold 必须是有限数值'), { status: 400 });
    if (['aggregation/aggregate', 'aggregation/smooth'].includes(algorithmKey) && window_size !== undefined && (!Number.isInteger(window_size) || window_size < 1)) throw Object.assign(new Error('window_size 必须是正整数'), { status: 400 });
    if (algorithmKey === 'aggregation/interpolate') {
      numericArray(x, 'x', 2); numericArray(y, 'y', 2); numericArray(x_new, 'x_new');
      if (x.length !== y.length) throw Object.assign(new Error('x 与 y 长度必须一致'), { status: 400 });
      if (x.some((value, index) => index > 0 && value <= x[index - 1])) throw Object.assign(new Error('插值输入 x 必须严格递增'), { status: 400 });
    }
    if (['math/log-transform', 'math/exp-transform'].includes(algorithmKey) && base !== undefined && (typeof base !== 'number' || !Number.isFinite(base) || base <= 0 || (algorithmKey === 'math/log-transform' && base === 1))) throw Object.assign(new Error('base 取值不合法'), { status: 400 });
    if (algorithmKey === 'math/log-transform' && data.some(value => value <= 0)) throw Object.assign(new Error('对数变换要求 data 中所有值均大于 0'), { status: 400 });

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

    const processId = uuidv4();
    db.prepare('INSERT INTO processing_runs(id, module, algorithm, input_json, output_json, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(processId, moduleId, algId, JSON.stringify(req.body || {}), JSON.stringify(result), new Date().toISOString());

    res.json({ success: true, data: result, processId });
  } catch (err) {
    res.status(err.status || 500).json({ success: false, error: err.message });
  }
});


  return router;
}
module.exports = { createComputeRouter };
