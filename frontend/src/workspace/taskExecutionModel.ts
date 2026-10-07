import type { TaskRequirement } from './taskTypes';
import type { ProjectArtifactType } from './types';

const CAPABILITY_RESULT: Record<NonNullable<TaskRequirement['capability']>, {
  source: string;
  type: ProjectArtifactType;
  title: string;
  summary: (requirement: TaskRequirement) => string;
  payload: Record<string, unknown>;
}> = {
  dataAnalysis: {
    source: '试验数据分析（任务内模拟）',
    type: 'analysis',
    title: '试验数据分析结果',
    summary: (requirement) => `已围绕“${requirement.text}”完成模拟分析，识别到高转速区间存在温度响应偏差，建议结合后续模型校准继续核验。`,
    payload: { range: '11800～12200 rpm', findings: ['温度响应偏差', '建议模型校准复核'] },
  },
  digitalTwin: {
    source: '试验数字孪生（任务内模拟）',
    type: 'calibration',
    title: '数字孪生评估结果',
    summary: (requirement) => `已围绕“${requirement.text}”完成模拟评估，模型在目标区间的预测能力已形成校准结论。`,
    payload: { range: '11800～12200 rpm', modelConfidence: '需结合实测补充验证' },
  },
  virtualCondition: {
    source: '虚拟工况扩展（任务内模拟）',
    type: 'virtualCondition',
    title: '虚拟工况扩展结果',
    summary: (requirement) => `已围绕“${requirement.text}”完成模拟扩展，形成待验证工况及高风险区间。`,
    payload: { expandedRange: '11600～12400 rpm', highRiskRange: '12100～12300 rpm' },
  },
  experimentDesign: {
    source: '智能试验设计（任务内模拟）',
    type: 'design',
    title: '补充试验设计方案',
    summary: (requirement) => `已围绕“${requirement.text}”形成模拟补充验证方案，建议 8 组试验覆盖高风险区间。`,
    payload: { runCount: 8, validationRange: '12100～12300 rpm', factors: ['转速', '出口温度', '推力'] },
  },
  report: {
    source: '任务报告（任务内模拟）',
    type: 'report',
    title: '任务报告',
    summary: (requirement) => `已完成“${requirement.text}”的报告整理。`,
    payload: {},
  },
};

export const createMockTaskCapabilityArtifact = (
  requirement: TaskRequirement,
  taskId: string,
  taskTitle: string,
  createdAt = new Date().toISOString(),
) => {
  if (!requirement.capability || requirement.capability === 'report') return null;
  const result = CAPABILITY_RESULT[requirement.capability];
  return {
    type: result.type,
    title: `${result.title} · ${requirement.text}`,
    source: result.source,
    status: '模拟完成',
    summary: result.summary(requirement),
    payload: {
      ...result.payload,
      taskId,
      taskTitle,
      taskItemId: requirement.id,
      taskItem: requirement.text,
      mock: true,
    },
    createdAt,
    updatedAt: createdAt,
  };
};
