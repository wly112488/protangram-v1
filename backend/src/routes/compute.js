'use strict';
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');

function createComputeRouter({ dataDir }) {
  const router = express.Router();
  const PROCESS_DATA_DIR = path.join(dataDir, 'process_data');
  fs.mkdirSync(PROCESS_DATA_DIR, { recursive: true });

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


  return router;
}
module.exports = { createComputeRouter };
