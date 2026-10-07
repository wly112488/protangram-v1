import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type {
  TaskArtifactReference,
  TaskRecord,
  TaskRequirement,
  TaskReportSection,
  TaskStatus,
} from './taskTypes';

export const TASK_STORAGE_KEY = 'protangram-task-workspace-v1';

interface CreateTaskInput {
  id?: string;
  title: string;
  sourceName?: string;
  sourceText?: string;
  projectId: string;
  requirementTexts: string[];
}

interface CreateDemoTaskInput {
  projectId: string;
  title?: string;
  sourceName?: string;
}

interface TaskState {
  tasks: TaskRecord[];
  createTask: (input: CreateTaskInput) => string;
  createDemoTask: (input: CreateDemoTaskInput) => string;
  addArtifactToTaskItem: (taskId: string, requirementId: string, reference: Omit<TaskArtifactReference, 'addedAt'>) => void;
  updateTask: (taskId: string, patch: Partial<Pick<TaskRecord, 'title' | 'sourceName' | 'sourceText' | 'status'>>) => void;
  setRequirementStatus: (taskId: string, requirementId: string, status: TaskRequirement['status']) => void;
  setPlanConfirmed: (taskId: string, confirmed: boolean) => void;
  updateReportSection: (taskId: string, sectionId: string, body: string) => void;
  addArtifactToReport: (taskId: string, reference: Omit<TaskArtifactReference, 'addedAt'>, sectionId?: string) => void;
  setReportStatus: (taskId: string, status: TaskRecord['reportDraft']['status']) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
}

const makeId = (prefix: string) => {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${uuid}`;
};

const touchTask = (task: TaskRecord, updatedAt: string): TaskRecord => ({
  ...task,
  updatedAt,
});

export const useTaskStore = create<TaskState>()(persist((set) => ({
  tasks: [],
  createTask: (input) => {
    const now = new Date().toISOString();
    const task: TaskRecord = {
      id: input.id ?? makeId('task'),
      title: input.title.trim(),
      sourceName: input.sourceName?.trim() || undefined,
      sourceText: input.sourceText?.trim() || undefined,
      projectId: input.projectId,
      status: '进行中',
      requirements: input.requirementTexts.map((text): TaskRequirement => ({
        id: makeId('requirement'), text: text.trim(), status: '待完成',
      })).filter((requirement) => requirement.text.length > 0),
      reportDraft: {
        status: 'draft',
        updatedAt: now,
        sections: [
          { id: 'task-background', title: '任务背景与目标', body: '', artifactRefs: [] },
          { id: 'task-analysis', title: '分析过程与结果', body: '', artifactRefs: [] },
          { id: 'task-conclusion', title: '结论与建议', body: '', artifactRefs: [] },
        ],
      },
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task.id;
  },
  createDemoTask: ({ projectId, title, sourceName }) => {
    const now = new Date().toISOString();
    const ids = ['demo-analysis', 'demo-twin', 'demo-extension', 'demo-design', 'demo-report'];
    const task: TaskRecord = {
      id: makeId('task-demo'),
      title: title?.trim() || '高转速区域模型可信性与补充验证',
      sourceName: sourceName?.trim() || '未命名任务书.pdf',
      projectId,
      status: '进行中',
      demo: true,
      requirements: [
        { id: ids[0], text: '分析已有高转速试验数据，识别异常响应', status: '待完成', capability: 'dataAnalysis', recommendationReason: '需要先确认实测数据中的异常区间与主要影响因素。', sourceRef: '第 2 页 · 工作目标第 1 条（模拟定位）', sourceExcerpt: '分析已有高转速试验数据，识别异常响应及主要影响因素。', inputSummary: '预设历史试验数据集 A；尚无任务内分析成果。' },
        { id: ids[1], text: '判断高转速区域模型预测的可信性', status: '待完成', dependsOnIds: [ids[0]], capability: 'digitalTwin', recommendationReason: '需要结合前一事项识别的异常区间校准并评估模型。', sourceRef: '第 2 页 · 工作目标第 1 条（模拟定位）', sourceExcerpt: '判断模型在高转速区域的可信性。', inputSummary: '预设发动机模型 V2.1；等待数据分析事项输出异常区间。' },
        { id: ids[2], text: '扩展实测覆盖不足的高风险工况', status: '待完成', dependsOnIds: [ids[1]], capability: 'virtualCondition', recommendationReason: '使用可信性评估后的模型补充未覆盖工况。', sourceRef: '第 2 页 · 工作目标第 2 条（模拟定位）', sourceExcerpt: '对缺少实测覆盖的区域进行工况扩展。', inputSummary: '等待数字孪生事项输出校准模型和可信范围。' },
        { id: ids[3], text: '针对高风险区域设计补充验证试验', status: '待完成', dependsOnIds: [ids[2]], capability: 'experimentDesign', recommendationReason: '依据扩展分析识别出的高风险区域设计验证点。', sourceRef: '第 2 页 · 工作目标第 2 条（模拟定位）', sourceExcerpt: '针对风险区域设计补充验证试验。', inputSummary: '等待虚拟工况事项输出高风险工况和待验证区间。' },
        { id: ids[4], text: '汇总分析与验证证据，形成最终分析报告', status: '待完成', dependsOnIds: [ids[0], ids[1], ids[2], ids[3]], capability: 'report', recommendationReason: '汇总前序事项的成果与结论，完成报告交付。', sourceRef: '第 3 页 · 交付要求第 1 条（模拟定位）', sourceExcerpt: '提交包含分析过程、验证结果和结论建议的最终分析报告。', inputSummary: '等待前序事项成果回流任务报告草稿。' },
      ],
      reportDraft: {
        status: 'draft',
        updatedAt: now,
        sections: [
          { id: 'task-background', title: '任务背景与目标', body: '本报告围绕高转速区域模型可信性评价与补充验证展开。', artifactRefs: [] },
          { id: 'task-analysis', title: '分析过程与结果', body: '', artifactRefs: [] },
          { id: 'task-conclusion', title: '结论与建议', body: '', artifactRefs: [] },
        ],
      },
      createdAt: now,
      updatedAt: now,
    };
    set((state) => ({ tasks: [task, ...state.tasks] }));
    return task.id;
  },
  addArtifactToTaskItem: (taskId, requirementId, reference) => set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const now = new Date().toISOString();
      return {
        ...touchTask(task, now),
        requirements: task.requirements.map((requirement) => {
          if (requirement.id !== requirementId) return requirement;
          const alreadyAdded = requirement.artifactRefs?.some((item) =>
            item.projectId === reference.projectId && item.artifactId === reference.artifactId);
          return {
            ...requirement,
            status: requirement.status === '已满足' ? '已满足' : '进行中',
            artifactRefs: alreadyAdded
              ? requirement.artifactRefs
              : [...(requirement.artifactRefs ?? []), { ...reference, addedAt: now }],
          };
        }),
      };
    }),
  })),
  updateTask: (taskId, patch) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId
      ? { ...touchTask(task, new Date().toISOString()), ...patch }
      : task),
  })),
  setRequirementStatus: (taskId, requirementId, status) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId ? {
      ...touchTask(task, new Date().toISOString()),
      requirements: task.requirements.map((requirement) => requirement.id === requirementId
        ? { ...requirement, status }
        : requirement),
    } : task),
  })),
  setPlanConfirmed: (taskId, confirmed) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId
      ? { ...touchTask(task, new Date().toISOString()), planConfirmed: confirmed }
      : task),
  })),
  updateReportSection: (taskId, sectionId, body) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId ? {
      ...touchTask(task, new Date().toISOString()),
      reportDraft: {
        ...task.reportDraft,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        sections: task.reportDraft.sections.map((section): TaskReportSection => section.id === sectionId
          ? { ...section, body }
          : section),
      },
    } : task),
  })),
  addArtifactToReport: (taskId, reference, sectionId) => set((state) => ({
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const targetSection = task.reportDraft.sections.find((section) => section.id === sectionId)
        ?? task.reportDraft.sections.find((section) => section.id === 'task-analysis')
        ?? task.reportDraft.sections[0];
      if (!targetSection) return task;
      const alreadyAdded = task.reportDraft.sections.some((section) => section.artifactRefs.some((item) =>
        item.projectId === reference.projectId && item.artifactId === reference.artifactId));
      if (alreadyAdded) return task;
      const artifactRef: TaskArtifactReference = { ...reference, addedAt: new Date().toISOString() };
      const updatedAt = new Date().toISOString();
      return {
        ...touchTask(task, updatedAt),
        reportDraft: {
          ...task.reportDraft,
          status: 'draft',
          updatedAt,
          sections: task.reportDraft.sections.map((section) => section.id === targetSection.id
            ? { ...section, artifactRefs: [...section.artifactRefs, artifactRef] }
            : section),
        },
      };
    }),
  })),
  setReportStatus: (taskId, status) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId ? {
      ...touchTask(task, new Date().toISOString()),
      reportDraft: { ...task.reportDraft, status, updatedAt: new Date().toISOString() },
    } : task),
  })),
  setTaskStatus: (taskId, status) => set((state) => ({
    tasks: state.tasks.map((task) => task.id === taskId
      ? { ...task, status, updatedAt: new Date().toISOString() }
      : task),
  })),
}), {
  name: TASK_STORAGE_KEY,
  version: 1,
  storage: createJSONStorage(() => localStorage),
  partialize: (state) => ({ tasks: state.tasks }),
}));
