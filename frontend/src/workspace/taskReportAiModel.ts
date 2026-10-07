import type { TaskRecord, TaskReportSection } from './taskTypes';

export interface TaskReportArtifactSummary {
  projectId: string;
  artifactId: string;
  title: string;
  source: string;
  summary: string;
}

export interface MockAiTaskReportResult {
  sections: TaskReportSection[];
  structuredJson: string;
  aiCompletedAt: string;
}

const getTaskArtifactReferences = (task: TaskRecord) => {
  const references = [...task.requirements.flatMap((requirement) => requirement.artifactRefs ?? []),
    ...task.reportDraft.sections.flatMap((section) => section.artifactRefs)];
  return references.filter((reference, index) => references.findIndex((candidate) =>
    candidate.projectId === reference.projectId && candidate.artifactId === reference.artifactId) === index);
};

export const createMockAiTaskReport = (
  task: TaskRecord,
  availableArtifacts: TaskReportArtifactSummary[],
  aiCompletedAt = new Date().toISOString(),
): MockAiTaskReportResult => {
  const artifactReferences = getTaskArtifactReferences(task);
  const sources = artifactReferences.flatMap((reference) => {
    const artifact = availableArtifacts.find((candidate) =>
      candidate.projectId === reference.projectId && candidate.artifactId === reference.artifactId);
    return artifact ? [{ ...artifact }] : [];
  });
  const sourceText = sources.length
    ? sources.map((source) => `- ${source.title}（${source.source}）：${source.summary}`).join('\n')
    : '当前没有已关联的专业分析成果。请先完成所需分析事项，或在任务工作台关联已有成果。';
  const completeCount = task.requirements.filter((requirement) => requirement.status === '已满足').length;
  const pendingItems = task.requirements.filter((requirement) => requirement.status !== '已满足');
  const sections = task.reportDraft.sections.map((section): TaskReportSection => {
    if (section.body.trim()) return section;
    let body: string;
    let artifactRefs = section.artifactRefs;
    if (section.id === 'task-background') {
      body = `本报告围绕“${task.title}”整理。${task.sourceName ? `任务书：${task.sourceName}。` : ''}\n纳入任务要求 ${task.requirements.length} 项，当前已确认满足 ${completeCount} 项。此处由原型模拟 AI 根据任务信息补全，需由专业人员复核。`;
    } else if (section.id === 'task-analysis') {
      body = `已回流的专业分析成果：\n${sourceText}\n\n本节由原型模拟 AI 根据任务关联成果整理，不替代专业模块的计算结果。`;
      artifactRefs = artifactReferences;
    } else if (section.id === 'task-conclusion') {
      body = pendingItems.length
        ? `当前已确认满足 ${completeCount}/${task.requirements.length} 项任务要求。仍待处理：${pendingItems.map((item) => item.text).join('；')}。请完成剩余事项并复核结论。\n本节由原型模拟 AI 起草，需由专业人员确认。`
        : `当前 ${completeCount} 项任务要求均已确认满足，关联成果已整理至报告草稿。请由专业人员复核分析结论和建议后确认报告完成。\n本节由原型模拟 AI 起草，需由专业人员确认。`;
    } else {
      body = `根据当前任务信息与已回流成果整理：\n${sourceText}\n\n本节由原型模拟 AI 起草，需由专业人员复核。`;
      artifactRefs = artifactReferences;
    }
    return { ...section, body, artifactRefs };
  });

  const structuredJson = JSON.stringify({
    schemaVersion: 1,
    task: { id: task.id, title: task.title, sourceName: task.sourceName, projectId: task.projectId },
    aiCompletedAt,
    completion: { completedItems: completeCount, totalItems: task.requirements.length },
    sources,
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.body,
      artifactRefs: section.artifactRefs,
    })),
  }, null, 2);

  return { sections, structuredJson, aiCompletedAt };
};

export const synchronizeTaskReportJson = (
  structuredJson: string | undefined,
  task: Pick<TaskRecord, 'id' | 'title' | 'sourceName' | 'projectId'>,
  sections: TaskReportSection[],
): string => {
  let previous: Record<string, unknown> = {};
  try {
    previous = structuredJson ? JSON.parse(structuredJson) as Record<string, unknown> : {};
  } catch {
    previous = {};
  }
  return JSON.stringify({
    ...previous,
    schemaVersion: previous.schemaVersion ?? 1,
    task: { id: task.id, title: task.title, sourceName: task.sourceName, projectId: task.projectId },
    sections: sections.map((section) => ({
      id: section.id,
      title: section.title,
      content: section.body,
      artifactRefs: section.artifactRefs,
    })),
  }, null, 2);
};
