export type BusinessSource = 'digitalTwin' | 'intelligentDesign' | 'dataAnalysis' | 'virtualCondition';

export type BusinessAction =
  | '用于试验设计' | '用于工况扩展' | '查看适用范围'
  | '查看推荐工况' | '调整方案'
  | '生成补充试验' | '用于模型校准' | '虚拟工况扩展'
  | '生成验证试验' | '加入报告';

export interface ModelContract {
  modelId: string;
  modelName: string;
  version: string;
  trustedRange: string;
  measuredRange?: string;
  status?: string;
  calibratedAt?: string;
}

export interface TaskContract {
  taskId: string;
  taskName: string;
  taskType: string;
  source: string;
  status: '待执行' | '执行中' | '已完成';
}

export interface DataContract {
  dataId: string;
  dataName: string;
  dataType: string;
  source: string;
  taskId: string;
}

export interface ResultContract {
  resultType: string;
  resultSummary: string;
  abnormalRange?: string;
  metrics?: string[];
}

export interface ValidationContract {
  goal: string;
  suggestedRange: string;
  highRiskRange?: string;
  metrics: string[];
  recommendedRuns: number;
}

export interface PlanCondition {
  key: string;
  order: number;
  speed: number;
  temperature: number;
  pressure: number;
  recommendation: string;
  risk: string;
  reason: string;
}

export interface WorkspaceSessionState {
  mode: 'project' | 'standalone';
  targetProjectId?: string;
}

export interface BusinessRouteState {
  source: BusinessSource;
  task?: TaskContract;
  data?: DataContract;
  model?: ModelContract;
  result?: ResultContract;
  validation?: ValidationContract;
  plan?: PlanCondition[];
  datasets?: string[];
  workspaceSession?: WorkspaceSessionState;
}

export interface BusinessReportItem {
  id: string;
  source: string;
  title: string;
  summary: string;
  createdAt: string;
}

const BUSINESS_REPORT_KEY = 'protangram-business-report-results';

export const loadBusinessReportItems = (): BusinessReportItem[] => {
  try {
    const raw = localStorage.getItem(BUSINESS_REPORT_KEY);
    return raw ? JSON.parse(raw) as BusinessReportItem[] : [];
  } catch {
    return [];
  }
};

export const saveBusinessReportItem = (item: Omit<BusinessReportItem, 'id' | 'createdAt'>) => {
  const next: BusinessReportItem = { ...item, id: `business-result-${Date.now()}`, createdAt: new Date().toLocaleString('zh-CN') };
  localStorage.setItem(BUSINESS_REPORT_KEY, JSON.stringify([next, ...loadBusinessReportItems()]));
  return next;
};
