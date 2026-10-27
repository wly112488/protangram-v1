import type { EChartsOption } from 'echarts';
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { ConcreteTrial, DerivedTable, RawDataFile, TestRecord, TrialChartResult, PhysicalObject } from './physicalObjectStore';
import type { Project, ProjectArtifact } from './types';
import { resolvePhysicalSource, samePhysicalSource, isDemoArtifact } from './physicalBusinessContext';
import type { PredictionResultTask } from './predictionContract';

export function predictionArtifactInput(task: PredictionResultTask) {
  if (!task.saved) throw new Error('预测结果尚未确认保存');
  const source = task.service === 'digitalTwin' ? '数字孪生预测' : '虚拟工况扩展';
  return {
    id: `prediction:${task.service}:${task.taskId}`,
    type: task.service === 'digitalTwin' ? 'calibration' as const : 'virtualCondition' as const,
    title: `${task.targetConfiguration.experimentName} · ${source}`,
    source, summary: task.result.summary,
    payload: {
      resultMode: task.resultMode, resultNature: task.service === 'digitalTwin' ? 'digitalTwin' : 'virtualPrediction', predictionTaskId: task.taskId, model: task.model, inputs: task.inputs,
      targetConfiguration: task.targetConfiguration,
      sourceScope: task.context?.scope,
      execution: {id:task.taskId, completedAt:task.completedAt, cfgId:task.context?.scope.cfgId, trialId:task.context?.scope.trialId, testRecordId:task.context?.scope.testRecordId, inputs:structuredClone(task.inputs)},
      ...(task.modelPlan?{modelPlan:structuredClone(task.modelPlan)}:{}),
      sourceContext: task.context ? { rawFiles: task.context.rawFiles } : undefined,
      upstreamResultKeys: task.context?.results.map(result => result.key),
      upstreamArtifactRefs: task.context ? [...new Map(task.context.results.flatMap(result => result.artifactRef ? [[`${result.artifactRef.projectId}/${result.artifactRef.artifactId}`, result.artifactRef] as const] : [])).values()] : undefined,
      results: [{ id: 'prediction', name: source, kind: 'table', ...task.result,
        basis: [`输入条件：${(task.resultMode === 'demo' ? task.inputFields : task.model.inputFields).map(field => `${field.label}：${task.inputs[field.key] ?? '未填写'} ${field.unit ?? ''}`).join('；') || '无额外输入'}`,
          ...(task.resultMode === 'demo' ? ['前端演示数据；关联的 CSV 和已有成果仅作为业务上下文，未参与物理预测计算。'] : [])],
      }] satisfies AnalysisResult[],
    },
  };
}

export type ResultValue = string | number | null;
export type AnalysisResult = { id: string; name: string; basis?: string[] } & (
  | { kind: 'chart'; option: EChartsOption }
  | { kind: 'table'; columns: Array<{ key: string; label: string; unit?: string }>; rows: Array<Record<string, ResultValue>> }
  | { kind: 'metric'; value: ResultValue; unit?: string }
);

// A view over the original objects. Trial and record views never save a second copy.
export interface ResultEntry {
  key: string;
  kind: AnalysisResult['kind'] | 'document';
  name: string;
  record?: TestRecord;
  rawFile?: RawDataFile;
  chart?: TrialChartResult;
  table?: DerivedTable;
  artifact?: ProjectArtifact;
  result?: AnalysisResult;
  sourceAvailable?: boolean;
  trialId?: string;
  loadSpectrum?: string;
  resolvedScope?: PhysicalBusinessScope;
}

export function captureResultContext(objects: PhysicalObject[], scope: PhysicalBusinessScope) {
  const source = resolvePhysicalSource(objects, scope);
  if (!source.configuration || source.missing) throw new Error('成果来源已失效，请返回原试验检查');
  return {
    scope: { physicalObjectId: source.configuration.id, experimentId: source.experiment?.id, ...((scope.cfgId ?? source.trial?.cfgId) ? {cfgId:scope.cfgId ?? source.trial?.cfgId} : {}), trialId: source.trial?.id, testRecordId: source.record?.id },
    physicalObjectName: source.configuration.name, experimentName: source.experiment?.name,
    trialName: source.trial?.name, recordName: source.record?.name,
    loadSpectrum: source.trial?.loadSpectrum,
    objectParameters: source.configuration.parameters, configurationParameters: source.experiment?.parameters,
    rawFiles: source.record?.rawFiles ?? source.trial?.records.flatMap(record => record.rawFiles) ?? [],
  };
}

// Read older saved data without inventing a chart for title-only placeholders.
export function artifactResults(artifact: ProjectArtifact): AnalysisResult[] {
  if (Array.isArray(artifact.payload.results)) return artifact.payload.results as AnalysisResult[];
  const payload = artifact.payload;
  const results: AnalysisResult[] = [];
  if (Array.isArray(payload.charts)) for (const [index, chart] of payload.charts.entries()) {
    if (chart?.option && typeof chart.option === 'object') results.push({ id: String(chart.id ?? `chart-${index}`), kind: 'chart', name: String(chart.title ?? chart.name ?? artifact.title), option: chart.option });
  }
  const rows = (value: unknown): Array<Record<string, ResultValue>> => Array.isArray(value) ? value.filter(item => item && typeof item === 'object').map(item => Object.fromEntries(Object.entries(item).map(([key, cell]) => [key, cell == null ? null : typeof cell === 'string' || typeof cell === 'number' ? cell : JSON.stringify(cell)]))) : [];
  const table = (id: string, name: string, data: Array<Record<string, ResultValue>>) => {
    if (!data.length) return;
    const keys = [...new Set(data.flatMap(item => Object.keys(item)))].filter(key => key !== 'key' && key !== 'id');
    const labels: Record<string, string> = { event: '异常事件', condition: '工况', time: '时间', level: '程度', reason: '可能原因', relevance: '关联程度' };
    results.push({ id, name, kind: 'table', columns: keys.map(key => ({ key, label: labels[key] ?? key })), rows: data });
  };
  table('anomalies', `${artifact.title} · 异常事件`, rows(payload.anomalies));
  table('candidates', `${artifact.title} · 根因候选`, rows(payload.candidates));
  table('plan', artifact.title, rows(payload.plan));
  table('conditions', artifact.title, rows(payload.conditions));
  table('factors', `${artifact.title} · 设计因子`, rows(payload.factors));
  for (const [key, label, unit] of [['credibility', '可信度', '%'], ['errorLimit', '校准结果', ''], ['trustedRange', '可信范围', '']]) {
    const value = payload[key];
    if (typeof value === 'number' || typeof value === 'string') results.push({ id: key, kind: 'metric', name: label, value, unit });
  }
  const conclusion = payload.conclusion ?? (payload.confirmedRootCause as { reason?: string } | undefined)?.reason;
  if (typeof conclusion === 'string') results.push({ id: 'conclusion', name: artifact.title, kind: 'metric', value: conclusion, basis: Array.isArray(payload.evidence) ? payload.evidence.filter(item => typeof item === 'string') : undefined });
  if (!results.length && artifact.type !== 'report') results.push({ id: 'legacy-summary', kind: 'metric', name: artifact.title, value: artifact.summary, basis: ['历史成果仅保存了摘要；没有保存实际图形或明细数据。'] });
  return results;
}

export function collectAnalysisResults(trial: ConcreteTrial | undefined, artifacts: ProjectArtifact[], recordId?: string): ResultEntry[] {
  const entries: ResultEntry[] = [];
  for (const chart of trial?.charts ?? []) {
    if (recordId && chart.sourceRecordId !== recordId) continue;
    const record = trial?.records.find(item => item.id === chart.sourceRecordId);
    const rawFile = record?.rawFiles.find(file => file.id === chart.rawFileId);
    entries.push({ key: `chart:${chart.sourceRecordId}:${chart.id}`, kind: 'chart', name: chart.name, chart, record, rawFile, sourceAvailable: Boolean(rawFile && rawFile.status !== 'removed') });
  }
  for (const record of trial?.records ?? []) {
    if (recordId && record.id !== recordId) continue;
    for (const table of record.tables) {
      const rawFile = record.rawFiles.find(file => file.id === table.rawFileId);
      entries.push({ key: `table:${record.id}:${table.id}`, kind: 'table', name: table.name, table, record, rawFile, sourceAvailable: Boolean(rawFile && rawFile.status !== 'removed') });
    }
  }
  for (const artifact of artifacts) {
    const scope = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    if (recordId && scope?.testRecordId && scope.testRecordId !== recordId) continue;
    const capturedFiles = (artifact.payload.sourceContext as { rawFiles?: RawDataFile[] } | undefined)?.rawFiles ?? [];
    const removedFileIds = new Set(trial?.records.flatMap(item => item.rawFiles).filter(file => file.status === 'removed').map(file => file.id) ?? []);
    const sourceAvailable = !capturedFiles.some(file => removedFileIds.has(file.id));
    if (artifact.type === 'report') {
      entries.push({ key: `report:${artifact.projectId}:${artifact.id}`, kind: 'document', name: artifact.title, artifact, sourceAvailable, record: trial?.records.find(item => item.id === scope?.testRecordId) });
      continue;
    }
    for (const result of artifactResults(artifact)) entries.push({ key: `artifact:${artifact.projectId}:${artifact.id}:${result.id}`, kind: result.kind, name: result.name, artifact, result, record: trial?.records.find(item => item.id === scope?.testRecordId), sourceAvailable });
  }
  return entries.map(entry => ({ ...entry, trialId: trial?.id, loadSpectrum: trial?.loadSpectrum }));
}

export function getTrialArtifacts(projects: Project[], sessions: WorkSession[], scope: PhysicalBusinessScope, trial: ConcreteTrial) {
  return projects.flatMap(project => project.artifacts.filter(artifact => {
    const explicit = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    const sources = explicit ? [explicit] : sessions.filter(session => session.storageProjectId === project.id).map(session => session.businessScope);
    const matches = (source: PhysicalBusinessScope | undefined) => source && (scope.testRecordId ? samePhysicalSource(source, scope)
      : source.physicalObjectId === scope.physicalObjectId && source.experimentId === scope.experimentId
        && (source.trialId === trial.id || !source.trialId && trial.records.some(record => record.id === source.testRecordId)));
    return explicit ? Boolean(matches(explicit)) : sources.length > 0 && sources.every(source => Boolean(matches(source)));
  }));
}

// A diagnosis belongs to one saved CSV, independent of the active session's original record.
export function collectCsvDiagnosisResults(trial: ConcreteTrial, artifacts: ProjectArtifact[], rawFileId?: string): ResultEntry[] {
  if (!rawFileId) return [];
  const owner = trial.records.find(record => record.rawFiles.some(file => file.id === rawFileId && file.status !== 'removed'));
  if (!owner) return [];
  const diagnoses = artifacts.filter(artifact => {
    const scope = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    const files = (artifact.payload.sourceContext as { rawFiles?: RawDataFile[] } | undefined)?.rawFiles;
    return (artifact.type === 'analysis' || artifact.type === 'rootCause') && !isDemoArtifact(artifact)
      && (!scope?.trialId || scope.trialId === trial.id) && (!scope?.testRecordId || scope.testRecordId === owner.id)
      && files?.length === 1 && files[0].id === rawFileId;
  });
  return collectAnalysisResults(trial, diagnoses, owner.id).filter(entry => Boolean(entry.artifact));
}
