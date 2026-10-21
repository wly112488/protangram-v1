import type { PhysicalObject } from './physicalObjectStore';
import type { TaskRecord, TaskRequirement, TaskTrialDraft } from './taskTypes';
import type { SessionCapability } from './sessionModel';

export const taskCapabilityLabels: Record<NonNullable<TaskRequirement['capability']>, string> = {
  dataAnalysis: '数据分析', digitalTwin: '数字孪生', virtualCondition: '虚拟工况', experimentDesign: '智能试验设计', report: '报告',
};
export const taskCapabilityRoute: Record<NonNullable<TaskRequirement['capability']>, SessionCapability> = {
  dataAnalysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition', experimentDesign: 'doe', report: 'report',
};

const id = () => crypto.randomUUID();
// Reuse the existing front-end planning sequence. Only explicit source values
// are used to fill business fields; document extraction can replace this adapter.
export function createTaskAnalysisPreview(sourceName: string, sourceText: string, objects: PhysicalObject[]) {
  const title = sourceName.replace(/\.[^.]+$/, '').trim() || '任务书分析';
  const normalized = `${sourceName}\n${sourceText}`.replace(/\s/g, '');
  const candidates = objects.flatMap(category => category.configurations.map(object => ({ category, object })))
    .filter(({ object }) => normalized.includes(object.name.replace(/\s/g, '')));
  const match = candidates.length === 1 ? candidates[0] : undefined;
  const configs = match?.object.experiments.filter(config => normalized.includes(config.name.replace(/\s/g, ''))) ?? [];
  const config = configs.length === 1 ? configs[0] : undefined;
  const definitions: Array<[TaskRequirement['capability'], string]> = [
    ['dataAnalysis', '分析试验数据并识别异常响应'], ['digitalTwin', '评估模型预测能力'],
    ['virtualCondition', '补充未覆盖工况并识别风险'], ['experimentDesign', '制定补充验证试验方案'], ['report', '汇总成果并编制任务报告'],
  ];
  const requirements: TaskRequirement[] = definitions.map(([capability, text]) => ({ id: id(), text, capability, status: '待完成' }));
  requirements.forEach((requirement, index) => { if (index > 0) requirement.dependsOnIds = [requirements[index - 1].id]; });
  const names = [...sourceText.matchAll(/(?:试验名称|具体试验)[：:]\s*([^\n；;]+)/g)].map(item => item[1].trim());
  const trialDrafts: TaskTrialDraft[] = [...new Set(names.length ? names : [title])].map(name => ({
    id: id(), name, categoryId: match?.category.id, physicalObjectId: match?.object.id, experimentId: config?.id,
    loadSpectrum: sourceText.match(/载荷谱(?:名称|编号)?[：:]\s*([^\n，,；;]+)/)?.[1]?.trim() ?? '',
    description: sourceText.trim().slice(0, 1500) || undefined, requirementIds: requirements.map(item => item.id),
  }));
  return { title, requirements, trialDrafts };
}

export const getTaskProgress = (task: TaskRecord) => {
  const total = task.requirements.length;
  const completed = task.requirements.filter(item => item.status === '已满足').length;
  return { total, completed, percent: total ? Math.round(completed / total * 100) : 0 };
};
