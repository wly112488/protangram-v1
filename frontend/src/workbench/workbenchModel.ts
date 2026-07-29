export type ExperimentStatus = 'idle' | 'running' | 'done' | 'warning';

export type ResourceKind = 'outline' | 'worksheet-network' | 'worksheet' | 'chart' | 'analysis' | 'report' | 'config';

export interface WorkbenchResource {
  id: string;
  title: string;
  kind: ResourceKind;
  category: string;
  description: string;
}

export interface WorksheetNode {
  id: string;
  title: string;
  type: 'plan' | 'raw' | 'clean' | 'factor' | 'response' | 'result' | 'report';
  records: number;
  fields: number;
  x: number;
  y: number;
}

export interface WorksheetEdge {
  from: string;
  to: string;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WorkbenchWindow {
  id: string;
  resourceId: string;
  title: string;
  kind: ResourceKind;
  bounds: WindowBounds;
  zIndex: number;
  minimized: boolean;
}

export interface ExperimentWorkspace {
  id: string;
  name: string;
  status: ExperimentStatus;
  resources: WorkbenchResource[];
  worksheetNodes: WorksheetNode[];
  worksheetEdges: WorksheetEdge[];
  windows: WorkbenchWindow[];
  activeResourceId: string;
  bottomTab: 'log' | 'params' | 'runs' | 'changes';
}

export interface WorkbenchState {
  experiments: ExperimentWorkspace[];
  activeExperimentId: string;
  nextWindowZ: number;
}

const defaultBoundsByKind: Record<ResourceKind, WindowBounds> = {
  outline: { x: 36, y: 34, width: 440, height: 300 },
  'worksheet-network': { x: 86, y: 70, width: 760, height: 430 },
  worksheet: { x: 160, y: 118, width: 520, height: 340 },
  chart: { x: 230, y: 82, width: 480, height: 320 },
  analysis: { x: 280, y: 150, width: 420, height: 300 },
  report: { x: 340, y: 96, width: 500, height: 340 },
  config: { x: 120, y: 180, width: 400, height: 300 },
};

export const getStatusLabel = (status: ExperimentStatus) => {
  const labels: Record<ExperimentStatus, string> = {
    idle: '待运行',
    running: '运行中',
    done: '已完成',
    warning: '需检查',
  };
  return labels[status];
};

const createResources = (prefix: string): WorkbenchResource[] => [
  {
    id: `${prefix}-outline`,
    title: '试验大纲',
    kind: 'outline',
    category: '试验设计',
    description: '方法、参数、因子、响应变量和试验方案汇总。',
  },
  {
    id: `${prefix}-network`,
    title: '工作表数据网络',
    kind: 'worksheet-network',
    category: '表格数据',
    description: '展示试验表格之间的来源、处理和报告引用关系。',
  },
  {
    id: `${prefix}-plan`,
    title: '试验方案表',
    kind: 'worksheet',
    category: '表格数据',
    description: '由试验大纲生成的试验运行方案。',
  },
  {
    id: `${prefix}-raw`,
    title: '原始采集表',
    kind: 'worksheet',
    category: '表格数据',
    description: '来自试验现场或导入文件的原始记录。',
  },
  {
    id: `${prefix}-chart-temp`,
    title: '温度趋势图',
    kind: 'chart',
    category: '分析图表',
    description: '关键温度响应变量随时间变化。',
  },
  {
    id: `${prefix}-chart-factor`,
    title: '因子响应关系',
    kind: 'chart',
    category: '分析图表',
    description: '试验因子与响应变量之间的对比关系。',
  },
  {
    id: `${prefix}-analysis-run`,
    title: '分析执行记录',
    kind: 'analysis',
    category: '分析任务',
    description: '当前分析模板的执行步骤和节点状态。',
  },
  {
    id: `${prefix}-report`,
    title: '报告绑定',
    kind: 'report',
    category: '报告资源',
    description: '报告模板标签与分析结果数据的绑定关系。',
  },
];

const worksheetNodes: WorksheetNode[] = [
  { id: 'plan', title: '试验方案表', type: 'plan', records: 18, fields: 8, x: 40, y: 150 },
  { id: 'raw', title: '原始采集表', type: 'raw', records: 1260, fields: 32, x: 230, y: 70 },
  { id: 'clean', title: '清洗数据表', type: 'clean', records: 1218, fields: 30, x: 430, y: 70 },
  { id: 'factor', title: '因子表', type: 'factor', records: 18, fields: 12, x: 430, y: 235 },
  { id: 'response', title: '响应变量表', type: 'response', records: 18, fields: 10, x: 630, y: 150 },
  { id: 'result', title: '分析结果表', type: 'result', records: 18, fields: 16, x: 830, y: 150 },
  { id: 'report', title: '报告引用表', type: 'report', records: 8, fields: 6, x: 1030, y: 150 },
];

const worksheetEdges: WorksheetEdge[] = [
  { from: 'plan', to: 'raw' },
  { from: 'raw', to: 'clean' },
  { from: 'clean', to: 'response' },
  { from: 'plan', to: 'factor' },
  { from: 'factor', to: 'response' },
  { from: 'response', to: 'result' },
  { from: 'result', to: 'report' },
];

const createExperiment = (id: string, name: string, status: ExperimentStatus, offset: number): ExperimentWorkspace => {
  const resources = createResources(id);
  return {
    id,
    name,
    status,
    resources,
    worksheetNodes: worksheetNodes.map((node) => ({
      ...node,
      x: node.x + offset,
      y: node.y,
    })),
    worksheetEdges,
    activeResourceId: resources[1].id,
    bottomTab: 'log',
    windows: [
      {
        id: `${id}-network-window`,
        resourceId: resources[1].id,
        title: resources[1].title,
        kind: resources[1].kind,
        bounds: { x: 52, y: 50, width: 760, height: 430 },
        zIndex: 2,
        minimized: false,
      },
      {
        id: `${id}-outline-window`,
        resourceId: resources[0].id,
        title: resources[0].title,
        kind: resources[0].kind,
        bounds: { x: 660, y: 70, width: 400, height: 290 },
        zIndex: 1,
        minimized: false,
      },
    ],
  };
};

export const createInitialWorkbenchState = (): WorkbenchState => ({
  activeExperimentId: 'exp-engine-dust',
  nextWindowZ: 5,
  experiments: [
    createExperiment('exp-engine-dust', '航空活塞发动机防尘测试', 'running', 0),
    createExperiment('exp-vibration', '振动疲劳可靠性试验', 'idle', 20),
    createExperiment('exp-temperature', '高低温循环试验', 'done', -10),
  ],
});

export const getActiveExperiment = (state: WorkbenchState) =>
  state.experiments.find((experiment) => experiment.id === state.activeExperimentId) ?? state.experiments[0];

export const openResourceWindow = (
  state: WorkbenchState,
  experimentId: string,
  resourceId: string,
): WorkbenchState => {
  const nextZ = state.nextWindowZ + 1;
  return {
    ...state,
    nextWindowZ: nextZ,
    experiments: state.experiments.map((experiment) => {
      if (experiment.id !== experimentId) return experiment;
      const resource = experiment.resources.find((item) => item.id === resourceId);
      if (!resource) return experiment;
      const existing = experiment.windows.find((window) => window.resourceId === resourceId);
      if (existing) {
        return {
          ...experiment,
          activeResourceId: resourceId,
          windows: experiment.windows.map((window) =>
            window.id === existing.id ? { ...window, zIndex: nextZ, minimized: false } : window,
          ),
        };
      }
      const sameKindCount = experiment.windows.filter((window) => window.kind === resource.kind).length;
      const bounds = defaultBoundsByKind[resource.kind];
      return {
        ...experiment,
        activeResourceId: resourceId,
        windows: [
          ...experiment.windows,
          {
            id: `${resource.id}-window`,
            resourceId,
            title: resource.title,
            kind: resource.kind,
            bounds: {
              ...bounds,
              x: bounds.x + sameKindCount * 28,
              y: bounds.y + sameKindCount * 24,
            },
            zIndex: nextZ,
            minimized: false,
          },
        ],
      };
    }),
  };
};

export const updateWindowBounds = (
  state: WorkbenchState,
  experimentId: string,
  windowId: string,
  bounds: Partial<WindowBounds>,
): WorkbenchState => ({
  ...state,
  experiments: state.experiments.map((experiment) =>
    experiment.id === experimentId
      ? {
          ...experiment,
          windows: experiment.windows.map((window) =>
            window.id === windowId ? { ...window, bounds: { ...window.bounds, ...bounds } } : window,
          ),
        }
      : experiment,
  ),
});

export const updateWindowState = (
  state: WorkbenchState,
  experimentId: string,
  windowId: string,
  patch: Partial<Pick<WorkbenchWindow, 'minimized' | 'zIndex'>>,
): WorkbenchState => ({
  ...state,
  experiments: state.experiments.map((experiment) =>
    experiment.id === experimentId
      ? {
          ...experiment,
          windows: experiment.windows.map((window) =>
            window.id === windowId ? { ...window, ...patch } : window,
          ),
        }
      : experiment,
  ),
});

export const closeWindow = (state: WorkbenchState, experimentId: string, windowId: string): WorkbenchState => ({
  ...state,
  experiments: state.experiments.map((experiment) =>
    experiment.id === experimentId
      ? {
          ...experiment,
          windows: experiment.windows.filter((window) => window.id !== windowId),
        }
      : experiment,
  ),
});

export const switchExperiment = (state: WorkbenchState, experimentId: string): WorkbenchState => ({
  ...state,
  activeExperimentId: experimentId,
});

export const setBottomTab = (
  state: WorkbenchState,
  experimentId: string,
  bottomTab: ExperimentWorkspace['bottomTab'],
): WorkbenchState => ({
  ...state,
  experiments: state.experiments.map((experiment) =>
    experiment.id === experimentId ? { ...experiment, bottomTab } : experiment,
  ),
});
