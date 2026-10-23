import type { PhysicalObject, RawDataFile } from './physicalObjectStore';
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { Project } from './types';
import { artifactResultMode, getSourceArtifacts, resolvePhysicalSource } from './physicalBusinessContext';
import { collectAnalysisResults, getTrialArtifacts } from './analysisResultModel';

export function getProfessionalSources(objects: PhysicalObject[], projects: Project[], sessions: WorkSession[], scope: PhysicalBusinessScope) {
  const source = resolvePhysicalSource(objects, scope);
  const trials = source.trial ? [source.trial] : source.experiment?.trials ?? [];
  const records = trials.flatMap(trial => trial.records.map(record => ({ trial, record })));
  const artifacts = new Map(getSourceArtifacts(projects, sessions, { physicalObjectId: scope.physicalObjectId, experimentId: scope.experimentId })
    .filter(artifact => artifact.type !== 'report').map(artifact => [`${artifact.projectId}/${artifact.id}`, artifact]));
  if (source.experiment) for (const artifact of getSourceArtifacts(projects, sessions, { physicalObjectId: scope.physicalObjectId })) {
    if (artifact.type !== 'report') artifacts.set(`${artifact.projectId}/${artifact.id}`, artifact);
  }
  for (const reference of [source.experiment?.designArtifactRef, source.trial?.designArtifactRef]) {
    const artifact = reference && projects.find(project => project.id === reference.projectId)?.artifacts.find(item => item.id === reference.artifactId);
    if (artifact && artifact.type !== 'report') artifacts.set(`${artifact.projectId}/${artifact.id}`, artifact);
  }
  for (const trial of trials) for (const artifact of getTrialArtifacts(projects, sessions, { physicalObjectId: scope.physicalObjectId, experimentId: scope.experimentId, trialId: trial.id }, trial)) {
    if (artifact.type !== 'report') artifacts.set(`${artifact.projectId}/${artifact.id}`, artifact);
  }
  const results = [...trials.flatMap(trial => collectAnalysisResults(trial, [])), ...collectAnalysisResults(undefined, [...artifacts.values()])].map(entry => {
    const scope = entry.artifact?.payload.sourceScope as PhysicalBusinessScope | undefined;
    return entry.artifact ? { ...entry, record: records.find(item => item.record.id === scope?.testRecordId)?.record } : entry;
  });
  const files = records.flatMap(({ trial, record }) => record.rawFiles.map(file => ({ ...file, trialId: trial.id, sourceRecordId: record.id })));
  return { source, results, files, rawFiles: source.record ? files.filter(file => file.sourceRecordId === source.record!.id) : files };
}

export interface ProfessionalDataContext {
  scope: PhysicalBusinessScope;
  objectParameters: Array<{ id: string; name: string; value: string; unit?: string }>;
  configurationParameters: Array<{ id: string; name: string; value: string; unit?: string }>;
  loadSpectrum?: string;
  records: Array<{ id: string; trialId: string; trialName: string; loadSpectrum: string; name: string; actualConditions: unknown[]; measurements: unknown[] }>;
  rawFiles: Array<RawDataFile & { trialId: string; sourceRecordId: string }>;
  results: Array<{ key: string; kind: string; name: string; source: string; resultMode: string; sourceRecordId?: string; sourceScope?: PhysicalBusinessScope; artifactRef?: { projectId: string; artifactId: string }; data: unknown }>;
}

export function professionalDataContext(sources: ReturnType<typeof getProfessionalSources>): ProfessionalDataContext {
  const { source } = sources;
  if (!source.configuration || source.missing) throw new Error('当前试验来源不可用，请返回原试验检查');
  const results = sources.results;
  const requiredFiles = new Set(results.flatMap(entry => entry.rawFile ? [entry.rawFile.id] : []));
  const rawFiles = sources.files.filter(file => sources.rawFiles.some(current => current.id === file.id) || requiredFiles.has(file.id));
  const trials = source.trial ? [source.trial] : source.experiment?.trials ?? [];
  return {
    scope: { physicalObjectId: source.configuration.id, experimentId: source.experiment?.id, ...(source.trial?.cfgId?{cfgId:source.trial.cfgId}:{}), trialId: source.trial?.id, testRecordId: source.record?.id },
    objectParameters: source.configuration.parameters, configurationParameters: source.experiment?.parameters ?? [], loadSpectrum: source.trial?.loadSpectrum,
    records: trials.flatMap(trial => trial.records.filter(record => !source.record || record.id === source.record.id || rawFiles.some(file => file.sourceRecordId === record.id)).map(record => ({ id: record.id, trialId: trial.id, trialName: trial.name, loadSpectrum: trial.loadSpectrum, name: record.name, actualConditions: record.actualConditions, measurements: record.measurements }))),
    rawFiles,
    results: results.map(entry => ({ key: entry.key, kind: entry.kind, name: entry.name, source: entry.artifact?.source ?? '真实试验数据', resultMode: entry.artifact ? artifactResultMode(entry.artifact) : 'measured', sourceRecordId: entry.record?.id, sourceScope: entry.artifact?.payload.sourceScope as PhysicalBusinessScope | undefined,
      artifactRef: entry.artifact ? { projectId: entry.artifact.projectId, artifactId: entry.artifact.id } : undefined, data: entry.chart ?? entry.table ?? entry.result,
    })),
  };
}
