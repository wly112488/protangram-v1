import { getRecordCharts, type PhysicalObject } from './physicalObjectStore';
import { getSourceArtifacts, samePhysicalSource, type RecordChartReference } from './physicalBusinessContext';
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { Project, ProjectArtifact } from './types';
import type { TaskRecord } from './taskTypes';

export const taskBookPath = (taskId: string, view?: string) => `/task-center?${new URLSearchParams({ taskId, ...(view ? { view } : {}) })}`;

// This is a live projection. No trial, record, file or result is written into a task.
export function getTaskTrials(objects: PhysicalObject[], projects: Project[], sessions: WorkSession[], taskId: string) {
  return objects.flatMap(category => category.configurations.flatMap(object => object.experiments.flatMap(configuration => configuration.trials
    .filter(trial => Boolean(taskId) && trial.taskBookId === taskId)
    .map(trial => ({ category, object, configuration, trial, records: trial.records.map(record => ({
      record, charts: getRecordCharts(trial, record.id),
      artifacts: getSourceArtifacts(projects, sessions, { physicalObjectId: object.id, experimentId: configuration.id, trialId: trial.id, testRecordId: record.id }),
    })) })))));
}
export type TaskTrialEntry = ReturnType<typeof getTaskTrials>[number];

export function groupTaskTrials(entries: TaskTrialEntry[]) {
  const groups = new Map<string, { object: TaskTrialEntry['object']; category: TaskTrialEntry['category']; configurations: Array<{ configuration: TaskTrialEntry['configuration']; entries: TaskTrialEntry[] }> }>();
  for (const entry of entries) {
    let group = groups.get(entry.object.id);
    if (!group) { group = { object: entry.object, category: entry.category, configurations: [] }; groups.set(entry.object.id, group); }
    let configuration = group.configurations.find(item => item.configuration.id === entry.configuration.id);
    if (!configuration) { configuration = { configuration: entry.configuration, entries: [] }; group.configurations.push(configuration); }
    configuration.entries.push(entry);
  }
  return [...groups.values()];
}

export function getTaskTrialSources(entries: TaskTrialEntry[]) {
  const artifacts = new Map<string, ProjectArtifact>();
  const charts: Array<{ reference: RecordChartReference; chart: TaskTrialEntry['records'][number]['charts'][number]; label: string }> = [];
  let records = 0, files = 0, tables = 0;
  for (const entry of entries) for (const item of entry.records) {
    records++; files += item.record.rawFiles.length; tables += item.record.tables.length;
    for (const artifact of item.artifacts) artifacts.set(`${artifact.projectId}/${artifact.id}`, artifact);
    for (const chart of item.charts) charts.push({ chart, label: `${entry.object.name} / ${entry.configuration.name} / ${entry.trial.name} / ${item.record.name} / ${chart.name}`,
      reference: { physicalObjectId: entry.object.id, experimentId: entry.configuration.id, trialId: entry.trial.id, testRecordId: item.record.id, chartId: chart.id } });
  }
  return { artifacts: [...artifacts.values()], charts, records, files, tables };
}

export function getTaskReportArtifacts(task: TaskRecord, entries: TaskTrialEntry[], projects: Project[]) {
  const artifacts = new Map(getTaskTrialSources(entries).artifacts.map(artifact => [`${artifact.projectId}/${artifact.id}`, artifact]));
  const references = [...(task.artifactRefs ?? []), ...task.requirements.flatMap(item => item.artifactRefs ?? []),
    ...(task.professionalProjects ?? []).flatMap(item => item.artifactRefs), ...task.reportDraft.sections.flatMap(item => item.artifactRefs)];
  for (const reference of references) {
    const artifact = projects.find(project => project.id === reference.projectId)?.artifacts.find(item => item.id === reference.artifactId);
    if (!artifact) continue;
    const scope = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    if (scope?.testRecordId && !entries.some(entry => entry.records.some(({ record }) => samePhysicalSource(scope, {
      physicalObjectId: entry.object.id, experimentId: entry.configuration.id, trialId: entry.trial.id, testRecordId: record.id,
    })))) continue;
    artifacts.set(`${artifact.projectId}/${artifact.id}`, artifact);
  }
  return [...artifacts.values()];
}
