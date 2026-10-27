import type { Project, ProjectArtifact } from './types';
import { getSessionResourcesPath, type WorkSession } from './sessionModel';
import type { PhysicalObject } from './physicalObjectStore';
import { collectAnalysisResults, getTrialArtifacts, type ResultEntry } from './analysisResultModel';
import { getProjectTrialEntries } from './projectTrialModel';

export const projectWorkspacePath = (projectId: string, view: 'analysis' | 'trials' | 'resources' = 'trials', trialId?: string) =>
  `/projects?${new URLSearchParams({ projectId, view, ...(trialId ? { trialId } : {}) })}`;

export function sessionResourcesPath(session: WorkSession, projects: Project[]) {
  void projects; // Retained for existing project and task navigation callers.
  return getSessionResourcesPath(session.id);
}

export function artifactResourcesPath(artifact: ProjectArtifact, projects: Project[], sessions: WorkSession[]) {
  const scope = artifact.payload.sourceScope as { trialId?: string } | undefined;
  const session = sessions.find(item => item.id === artifact.payload.sourceSessionId)
    ?? sessions.find(item => item.storageProjectId === artifact.projectId);
  if (session) return sessionResourcesPath(session, projects);
  const project = projects.find(item => item.id === artifact.projectId);
  return project && !project.sessionOwnerId ? projectWorkspacePath(project.id, 'resources', scope?.trialId)
    : `/shared?${new URLSearchParams({ projectId: artifact.projectId, ...(scope?.trialId ? { trialId: scope.trialId } : {}) })}`;
}

export function collectSharedResources(projects: Project[], sessions: WorkSession[], objects: PhysicalObject[], scope: { projectId?: string; sessionId?: string; trialId?: string }) {
  const session = sessions.find(item => item.id === scope.sessionId);
  const projectId = scope.sessionId ? session?.storageProjectId : scope.projectId;
  const project = projects.find(item => item.id === projectId);
  const related = project ? getProjectTrialEntries(project.id, objects, projects, sessions) : [];
  const trialId = scope.trialId ?? (scope.sessionId ? session?.businessScope?.trialId : undefined);
  const missing = !project || Boolean(trialId && !related.some(entry => entry.trial.id === trialId));
  const selected = missing ? [] : related.filter(entry => !trialId || entry.trial.id === trialId);
  const entries: ResultEntry[] = selected.flatMap(({ object, experiment, trial }) =>
    collectAnalysisResults(trial, getTrialArtifacts(projects, sessions, { physicalObjectId: object.id, experimentId: experiment.id, trialId: trial.id }, trial)));
  if (!missing && !trialId) {
    const storageIds = new Set([projectId, ...sessions.filter(item => item.projectId === projectId || item.storageProjectId === projectId).map(item => item.storageProjectId)]);
    const included = new Set(entries.flatMap(entry => entry.artifact ? [`${entry.artifact.projectId}/${entry.artifact.id}`] : []));
    const unbound = projects.filter(item => storageIds.has(item.id)).flatMap(item => item.artifacts)
      .filter(item => !included.has(`${item.projectId}/${item.id}`));
    entries.push(...collectAnalysisResults(undefined, unbound));
    // Keep imported legacy worksheets accessible through the same catalog.
    if (project?.worksheet) {
      const worksheet = project.worksheet;
      const rowIds = [...new Set(Object.keys(worksheet.data).map(key => key.split('-')[0]))];
      entries.push({ key: `worksheet:${project.id}`, kind: 'table', name: worksheet.name, result: {
        id: `worksheet:${project.id}`, name: worksheet.name, kind: 'table',
        columns: worksheet.columns.map(key => ({ key, label: key })),
        rows: rowIds.map(row => Object.fromEntries(worksheet.columns.map(column => [column, worksheet.data[`${row}-${column}`] ?? null]))),
      } });
    }
  }
  return { entries: [...new Map(entries.map(entry => [entry.key, entry])).values()], trials: selected.map(entry => entry.trial), related, missing };
}
