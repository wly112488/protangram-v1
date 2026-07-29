/**
 * 后端API调用层
 * @description 统一封装所有后端API请求，实现JSON文件持久化存储
 */
import type {
  ExperimentCard,
  AnalysisTemplate,
  AnalysisProject,
  AnalysisReport,
} from '@/types';

const BASE_URL = '/api';

/**
 * 通用请求封装
 * @param url - 请求地址
 * @param options - fetch选项
 * @returns 响应数据
 */
async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || '请求失败');
  return json.data;
}

// ==================== 试验设计项目 ====================

/**
 * 获取所有试验设计项目
 * @returns 试验卡片数组
 */
export async function fetchExperiments(): Promise<ExperimentCard[]> {
  return request<ExperimentCard[]>('/experiments');
}

/**
 * 保存试验设计项目（新建或更新）
 * @param experiment - 试验卡片数据
 * @returns 保存后的数据
 */
export async function saveExperiment(experiment: ExperimentCard): Promise<ExperimentCard> {
  return request<ExperimentCard>('/experiments', {
    method: 'POST',
    body: JSON.stringify(experiment),
  });
}

/**
 * 删除试验设计项目
 * @param id - 试验卡片ID
 */
export async function deleteExperiment(id: string): Promise<void> {
  await request(`/experiments/${id}`, { method: 'DELETE' });
}

// ==================== 数据分析模板 ====================

/**
 * 获取所有数据分析模板
 * @returns 模板数组
 */
export async function fetchTemplates(): Promise<AnalysisTemplate[]> {
  return request<AnalysisTemplate[]>('/templates');
}

/**
 * 保存数据分析模板（新建或更新）
 * @param template - 模板数据
 * @returns 保存后的数据
 */
export async function saveTemplate(template: AnalysisTemplate): Promise<AnalysisTemplate> {
  return request<AnalysisTemplate>('/templates', {
    method: 'POST',
    body: JSON.stringify(template),
  });
}

/**
 * 删除数据分析模板
 * @param id - 模板ID
 */
export async function deleteTemplate(id: string): Promise<void> {
  await request(`/templates/${id}`, { method: 'DELETE' });
}

// ==================== 数据分析项目 ====================

/**
 * 获取所有数据分析项目
 * @returns 项目数组
 */
export async function fetchProjects(): Promise<AnalysisProject[]> {
  return request<AnalysisProject[]>('/projects');
}

/**
 * 保存数据分析项目（新建或更新）
 * @param project - 项目数据
 * @returns 保存后的数据
 */
export async function saveProject(project: AnalysisProject): Promise<AnalysisProject> {
  return request<AnalysisProject>('/projects', {
    method: 'POST',
    body: JSON.stringify(project),
  });
}

/**
 * 删除数据分析项目
 * @param id - 项目ID
 */
export async function deleteProject(id: string): Promise<void> {
  await request(`/projects/${id}`, { method: 'DELETE' });
}

// ==================== 分析报告 ====================

/**
 * 获取所有分析报告
 * @returns 报告数组
 */
export async function fetchReports(): Promise<AnalysisReport[]> {
  return request<AnalysisReport[]>('/reports');
}

/**
 * 保存分析报告（新建或更新）
 * @param report - 报告数据
 * @returns 保存后的数据
 */
export async function saveReport(report: AnalysisReport): Promise<AnalysisReport> {
  return request<AnalysisReport>('/reports', {
    method: 'POST',
    body: JSON.stringify(report),
  });
}

/**
 * 删除分析报告
 * @param id - 报告ID
 */
export async function deleteReport(id: string): Promise<void> {
  await request(`/reports/${id}`, { method: 'DELETE' });
}
