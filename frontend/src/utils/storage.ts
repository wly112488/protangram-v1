import type { ExperimentCard, AnalysisTemplate, AnalysisProject, AnalysisReport } from '@/types';
import {
  fetchExperiments, saveExperiment,
  fetchTemplates, saveTemplate,
  fetchProjects, saveProject,
  fetchReports, saveReport,
} from '@/services/api';

const STORAGE_KEYS = {
  EXPERIMENTS: 'protangram_experiments',
  ANALYSIS_TEMPLATES: 'protangram_analysis_templates',
  ANALYSIS_PROJECTS: 'protangram_analysis_projects',
  ANALYSIS_REPORTS: 'protangram_analysis_reports',
};

// ==================== 试验设计项目 ====================

/**
 * 保存试验卡片列表（localStorage + 后端JSON文件）
 * @param experiments - 试验卡片数组
 */
export function saveExperiments(experiments: ExperimentCard[]): void {
  localStorage.setItem(STORAGE_KEYS.EXPERIMENTS, JSON.stringify(experiments));
  // 异步同步到后端JSON文件
  experiments.forEach((exp) => {
    saveExperiment(exp).catch((err) => console.warn('后端保存试验失败:', err));
  });
}

/**
 * 从localStorage同步加载试验卡片列表
 * @returns 试验卡片数组
 */
export function loadExperiments(): ExperimentCard[] {
  const data = localStorage.getItem(STORAGE_KEYS.EXPERIMENTS);
  return data ? JSON.parse(data) : [];
}

/**
 * 从后端异步加载试验卡片列表并同步到localStorage
 * @returns 试验卡片数组
 */
export async function fetchAndSyncExperiments(): Promise<ExperimentCard[]> {
  try {
    const data = await fetchExperiments();
    if (data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.EXPERIMENTS, JSON.stringify(data));
    }
    return data;
  } catch {
    return loadExperiments();
  }
}

// ==================== 数据分析模板 ====================

/**
 * 保存数据分析模板列表（localStorage + 后端JSON文件）
 * @param templates - 模板数组
 */
export function saveAnalysisTemplates(templates: AnalysisTemplate[]): void {
  localStorage.setItem(STORAGE_KEYS.ANALYSIS_TEMPLATES, JSON.stringify(templates));
  // 异步同步到后端JSON文件
  templates.forEach((t) => {
    saveTemplate(t).catch((err) => console.warn('后端保存模板失败:', err));
  });
}

/**
 * 从localStorage同步加载数据分析模板列表
 * @returns 模板数组
 */
export function loadAnalysisTemplates(): AnalysisTemplate[] {
  const data = localStorage.getItem(STORAGE_KEYS.ANALYSIS_TEMPLATES);
  return data ? JSON.parse(data) : [];
}

/**
 * 从后端异步加载数据分析模板列表并同步到localStorage
 * @returns 模板数组
 */
export async function fetchAndSyncTemplates(): Promise<AnalysisTemplate[]> {
  try {
    const data = await fetchTemplates();
    if (data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.ANALYSIS_TEMPLATES, JSON.stringify(data));
    }
    return data;
  } catch {
    return loadAnalysisTemplates();
  }
}

// ==================== 数据分析项目 ====================

/**
 * 保存数据分析项目列表（localStorage + 后端JSON文件）
 * @param projects - 项目数组
 */
export function saveAnalysisProjects(projects: AnalysisProject[]): void {
  localStorage.setItem(STORAGE_KEYS.ANALYSIS_PROJECTS, JSON.stringify(projects));
  // 异步同步到后端JSON文件
  projects.forEach((p) => {
    saveProject(p).catch((err) => console.warn('后端保存项目失败:', err));
  });
}

/**
 * 从localStorage同步加载数据分析项目列表
 * @returns 项目数组
 */
export function loadAnalysisProjects(): AnalysisProject[] {
  const data = localStorage.getItem(STORAGE_KEYS.ANALYSIS_PROJECTS);
  return data ? JSON.parse(data) : [];
}

/**
 * 从后端异步加载数据分析项目列表并同步到localStorage
 * @returns 项目数组
 */
export async function fetchAndSyncProjects(): Promise<AnalysisProject[]> {
  try {
    const data = await fetchProjects();
    if (data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.ANALYSIS_PROJECTS, JSON.stringify(data));
    }
    return data;
  } catch {
    return loadAnalysisProjects();
  }
}

// ==================== 分析报告 ====================

/**
 * 保存分析报告列表（localStorage + 后端JSON文件）
 * @param reports - 报告数组
 */
export function saveAnalysisReports(reports: AnalysisReport[]): void {
  localStorage.setItem(STORAGE_KEYS.ANALYSIS_REPORTS, JSON.stringify(reports));
  // 异步同步到后端JSON文件
  reports.forEach((r) => {
    saveReport(r).catch((err) => console.warn('后端保存报告失败:', err));
  });
}

/**
 * 从localStorage同步加载分析报告列表
 * @returns 报告数组
 */
export function loadAnalysisReports(): AnalysisReport[] {
  const data = localStorage.getItem(STORAGE_KEYS.ANALYSIS_REPORTS);
  return data ? JSON.parse(data) : [];
}

/**
 * 从后端异步加载分析报告列表并同步到localStorage
 * @returns 报告数组
 */
export async function fetchAndSyncReports(): Promise<AnalysisReport[]> {
  try {
    const data = await fetchReports();
    if (data.length > 0) {
      localStorage.setItem(STORAGE_KEYS.ANALYSIS_REPORTS, JSON.stringify(data));
    }
    return data;
  } catch {
    return loadAnalysisReports();
  }
}

/**
 * 从后端拉取所有数据并同步到localStorage（应用初始化时调用）
 * @returns 所有数据
 */
export async function syncAllFromBackend(): Promise<{
  experiments: ExperimentCard[];
  templates: AnalysisTemplate[];
  projects: AnalysisProject[];
  reports: AnalysisReport[];
}> {
  const [experiments, templates, projects, reports] = await Promise.all([
    fetchAndSyncExperiments(),
    fetchAndSyncTemplates(),
    fetchAndSyncProjects(),
    fetchAndSyncReports(),
  ]);
  return { experiments, templates, projects, reports };
}

/**
 * 下载JSON文件到本地
 * @param data - 需要保存的数据
 * @param fileName - 文件名
 */
export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 读取本地JSON文件
 * @param file - File对象
 * @returns Promise<T>
 */
export function readJsonFile<T>(file: File): Promise<T> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        resolve(data);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/**
 * 读取本地CSV文件文本
 * @param file - File对象
 * @returns Promise<string>
 */
export function readCsvFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
