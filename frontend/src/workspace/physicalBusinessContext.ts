import type { PhysicalObject, TestRecord } from './physicalObjectStore';
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { Project, ProjectArtifact } from './types';

export const recordLabel = (record: TestRecord) => record.name === `第 ${record.executionNumber} 次试验记录` ? record.name : `第 ${record.executionNumber} 次 · ${record.name}`;

export interface ArtifactReference { projectId: string; artifactId: string }
export interface RecordChartReference { physicalObjectId: string; experimentId: string; trialId?: string; testRecordId: string; chartId: string }

// Names, selected models and task-book associations do not identify raw data.
export const samePhysicalSource = (left?: PhysicalBusinessScope, right?: PhysicalBusinessScope) => Boolean(left?.physicalObjectId && right?.physicalObjectId)
  && left?.physicalObjectId === right?.physicalObjectId
  && left?.experimentId === right?.experimentId
  && left?.testRecordId === right?.testRecordId
  && (left?.trialId === right?.trialId || Boolean(left?.testRecordId && left.testRecordId === right?.testRecordId && (!left.trialId || !right.trialId)));

export const resolvePhysicalSource = (objects: PhysicalObject[], scope?: PhysicalBusinessScope) => {
  const family = objects.find(item => item.configurations.some(config => config.id === scope?.physicalObjectId));
  const configuration = family?.configurations.find(item => item.id === scope?.physicalObjectId);
  const experiment = configuration?.experiments.find(item => item.id === scope?.experimentId);
  const requestedTrial = experiment?.trials?.find(item => item.id === scope?.trialId);
  const matchingTrial = scope?.testRecordId ? experiment?.trials?.find(item => item.records.some(record => record.id === scope.testRecordId)) : undefined;
  const trial = scope?.trialId != null ? requestedTrial : matchingTrial;
  const record = trial?.records.find(item => item.id === scope?.testRecordId);
  const missing = Boolean(scope?.physicalObjectId && (!configuration || scope.experimentId && !experiment || scope.trialId != null && !trial || scope.testRecordId != null && !record));
  return { family, configuration, experiment, trial, record, missing };
};

export const physicalSourcePath = (objects: PhysicalObject[], scope?: PhysicalBusinessScope, view?: string) => {
  const source = resolvePhysicalSource(objects, scope);
  if (!source.family || !source.configuration || source.missing) return undefined;
  const params = new URLSearchParams({ objectId: source.family.id, configurationId: source.configuration.id });
  if (source.experiment) params.set('experimentId', source.experiment.id);
  if (source.trial) params.set('trialId', source.trial.id);
  if (source.record) params.set('recordId', source.record.id);
  if (view) params.set('view', view);
  return `/physical-objects?${params}`;
};

export const getSourceArtifacts = (projects: Project[], sessions: WorkSession[], scope?: PhysicalBusinessScope): ProjectArtifact[] => {
  if (!scope?.physicalObjectId) return [];
  const sourceProjects = new Set(sessions.filter(item => samePhysicalSource(item.businessScope, scope)).map(item => item.storageProjectId));
  return projects.flatMap(project => project.artifacts.filter(artifact => {
    const explicit = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    return explicit ? samePhysicalSource(explicit, scope) : sourceProjects.has(project.id);
  }));
};

export const resolveRecordChart = (objects: PhysicalObject[], reference: RecordChartReference) => {
  const source = resolvePhysicalSource(objects, reference);
  const chart = source.trial?.charts.find(item => item.id === reference.chartId && item.sourceRecordId === source.record?.id);
  return chart && !source.missing ? { ...source, chart, rawFile: source.record?.rawFiles.find(item => item.id === chart.rawFileId) } : undefined;
};

export const recordChartKey = (reference: RecordChartReference) => `record-chart:${reference.physicalObjectId}:${reference.experimentId}:${reference.testRecordId}:${reference.chartId}`;
export const artifactResultMode = (artifact: ProjectArtifact): string => {
  if (typeof artifact.payload.resultMode === 'string') return artifact.payload.resultMode;
  // These legacy writers produced only fixed demo calculations. Preserve their data,
  // but do not promote their unmarked results to measured/calculated evidence.
  if (['试验数据分析', '试验数字孪生', '虚拟工况扩展', '智能试验设计'].includes(artifact.source)
    && ['analysis', 'rootCause', 'calibration', 'virtualCondition', 'design'].includes(artifact.type)) return 'demo';
  if (artifact.type === 'design' && (artifact.payload.designSummary || artifact.source === 'DOE设计' && artifact.payload.designMethod)) return 'configuration';
  return 'unknown';
};
export const isDemoArtifact = (artifact: ProjectArtifact) => artifactResultMode(artifact) === 'demo';
export const artifactResultLabel = (artifact: ProjectArtifact) => ({
  demo: '演示成果', computed: '计算成果', configuration: '配置方案', composed: '编制报告',
}[artifactResultMode(artifact)] ?? '旧成果（来源性质未标记）');
