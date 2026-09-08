import type {
  Project,
  ProjectArtifact,
  ProjectArtifactType,
  ProjectNavigationItem,
  ProjectStats,
  ProjectView,
} from './types.ts';

export interface LegacyGeneratedExperiment {
  id: string;
  name: string;
  designName: string;
  designSummary?: Record<string, unknown> & { runCount?: number };
  worksheetData?: Record<string, string>;
  extraItems?: string[];
}

export interface ProjectArtifactInput {
  id?: string;
  type: ProjectArtifactType;
  title: string;
  source: string;
  status?: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

type FactoryInput = Pick<ProjectArtifactInput, 'title' | 'summary' | 'payload'> &
  Partial<Pick<ProjectArtifactInput, 'id' | 'status' | 'createdAt' | 'updatedAt'>>;

const createArtifactInput = (
  type: ProjectArtifactType,
  source: string,
  input: FactoryInput,
): ProjectArtifactInput => ({
  ...input,
  type,
  source,
});

export const createCalibrationArtifactInput = (input: FactoryInput): ProjectArtifactInput =>
  createArtifactInput('calibration', '试验数字孪生', input);

export const createDesignArtifactInput = (input: FactoryInput): ProjectArtifactInput =>
  createArtifactInput('design', '智能试验设计', input);

export const createAnalysisArtifactInput = (input: FactoryInput): ProjectArtifactInput =>
  createArtifactInput('analysis', '试验数据分析', input);

export const createRootCauseArtifactInput = (input: FactoryInput): ProjectArtifactInput =>
  createArtifactInput('rootCause', '试验数据分析', input);

export const createVirtualConditionArtifactInput = (input: FactoryInput): ProjectArtifactInput =>
  createArtifactInput('virtualCondition', '虚拟工况扩展', input);

const artifactViewLabels: Partial<Record<ProjectView, string>> = {
  design: '智能试验设计',
  analysis: '试验数据分析',
  rootCause: '根因分析',
  calibration: '模型校准',
  virtualCondition: '虚拟工况',
  report: '报告',
};

const columnIndex = (column: string) => {
  const match = column.match(/^C(\d+)$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
};

const deriveWorksheetColumns = (data: Record<string, string>): string[] => {
  const columns = new Set<string>();
  Object.keys(data).forEach((key) => {
    const separatorIndex = key.indexOf('-');
    if (separatorIndex >= 0) columns.add(key.slice(separatorIndex + 1));
  });
  return [...columns].sort((left, right) => columnIndex(left) - columnIndex(right));
};

export const migrateLegacyExperiments = (
  experiments: LegacyGeneratedExperiment[],
  migratedAt = new Date().toISOString(),
): Project[] => experiments.map((experiment) => {
  const worksheetData = experiment.worksheetData ?? {};
  const runCount = typeof experiment.designSummary?.runCount === 'number'
    ? experiment.designSummary.runCount
    : undefined;
  const designArtifact: ProjectArtifact = {
    id: `${experiment.id}-legacy-design`,
    projectId: experiment.id,
    type: 'design',
    title: experiment.designName || '试验设计',
    source: '试验设计（DOE）',
    summary: runCount ? `${experiment.designName} · ${runCount} 次试验` : experiment.designName,
    payload: { designSummary: experiment.designSummary ?? {} },
    createdAt: migratedAt,
    updatedAt: migratedAt,
  };

  return {
    id: experiment.id,
    name: experiment.name,
    description: experiment.designName,
    status: '进行中',
    createdAt: migratedAt,
    updatedAt: migratedAt,
    basicInfo: {},
    worksheet: Object.keys(worksheetData).length > 0
      ? {
          name: '试验工作表',
          columns: deriveWorksheetColumns(worksheetData),
          data: worksheetData,
        }
      : undefined,
    datasets: [],
    artifacts: [designArtifact],
    legacyItems: [...(experiment.extraItems ?? [])],
  };
});

const hasCharts = (artifact: ProjectArtifact) => {
  const charts = artifact.payload.charts;
  return Array.isArray(charts) && charts.length > 0;
};

export const buildProjectNavigation = (project: Project): ProjectNavigationItem[] => {
  const items: ProjectNavigationItem[] = [
    { key: `${project.id}:overview`, title: '项目概览', view: 'overview' },
  ];

  if (project.worksheet && Object.keys(project.worksheet.data).length > 0) {
    items.push({ key: `${project.id}:worksheet`, title: '试验工作表', view: 'worksheet' });
  }

  if (project.artifacts.some(hasCharts)) {
    items.push({ key: `${project.id}:charts`, title: '数据图表', view: 'charts' });
  }

  const orderedViews: ProjectArtifact['type'][] = [
    'rootCause',
    'calibration',
    'design',
    'analysis',
    'virtualCondition',
    'report',
  ];

  orderedViews.forEach((view) => {
    if (project.artifacts.some((artifact) => artifact.type === view)) {
      items.push({
        key: `${project.id}:${view}`,
        title: artifactViewLabels[view] ?? view,
        view,
      });
    }
  });

  return items;
};

export const getProjectStats = (project: Project): ProjectStats => {
  const worksheetRows = new Set<number>();
  Object.keys(project.worksheet?.data ?? {}).forEach((key) => {
    const row = Number(key.split('-')[0]);
    if (Number.isFinite(row)) worksheetRows.add(row);
  });

  const chartCount = project.artifacts.reduce((count, artifact) => {
    const charts = artifact.payload.charts;
    return count + (Array.isArray(charts) ? charts.length : 0);
  }, 0);

  return {
    datasetCount: project.datasets.length,
    worksheetRowCount: worksheetRows.size,
    chartCount,
    artifactCount: project.artifacts.length,
  };
};

const getArtifactModelBasicInfo = (artifact: ProjectArtifact) => {
  const model = artifact.payload.model;
  if (!model || typeof model !== 'object' || Array.isArray(model)) return {};

  const record = model as Record<string, unknown>;
  const modelName = typeof record.modelName === 'string' ? record.modelName.trim() : '';
  const version = typeof record.version === 'string' ? record.version.trim() : '';
  const explicitTestObject = typeof record.testObject === 'string' ? record.testObject.trim() : '';
  const inferredTestObject = modelName
    .replace(/(?:数字孪生|热力学|有限元|响应)?模型.*$/, '')
    .trim();

  return {
    ...(modelName ? { currentModel: `${modelName}${version ? ` ${version}` : ''}` } : {}),
    ...(explicitTestObject || inferredTestObject
      ? { testObject: explicitTestObject || inferredTestObject }
      : {}),
  };
};

export const addArtifactToProject = (project: Project, artifact: ProjectArtifact): Project => ({
  ...project,
  updatedAt: artifact.updatedAt,
  basicInfo: {
    ...project.basicInfo,
    ...getArtifactModelBasicInfo(artifact),
  },
  artifacts: [...project.artifacts, artifact],
});

export const removeArtifactFromProject = (
  project: Project,
  artifactId: string,
  updatedAt = new Date().toISOString(),
): Project => ({
  ...project,
  updatedAt,
  artifacts: project.artifacts.filter((artifact) => artifact.id !== artifactId),
});
