import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { BusinessRouteState } from '@/types/businessContext';
import { normalizeBusinessSession } from './businessSessionModel';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { getCapabilityFromPath, getSessionIdFromLocation } from './sessionModel';
import { recordTaskBusinessArtifact } from './taskArtifactAssociation';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { resolvePhysicalSource } from './physicalBusinessContext';
import { assertUniqueResultNames } from './resultNaming';
import { commitWorkspaceChange, flushWorkspacePersistence } from './workspacePersistence';
import { artifactResults, collectAnalysisResults, getTrialArtifacts, captureResultContext } from './analysisResultModel';
import { getProfessionalSources, professionalDataContext } from './professionalContext';

export const useWorkspaceBusinessSession = (incoming: BusinessRouteState | null) => {
  const location = useLocation();
  const sessionId = getSessionIdFromLocation(location.pathname, location.search);
  const sourceSessions = useSessionStore(state => state.sessions);
  const storedSession = useMemo(() => sessionId ? useSessionStore.getState().getWorkspaceSession(sessionId) : undefined, [sessionId, sourceSessions]);
  const projects = useProjectStore((state) => state.projects);
  const tasks = useTaskStore((state) => state.tasks);
  const requestedTaskId = new URLSearchParams(location.search).get('taskId');
  const requestedTaskItemId = new URLSearchParams(location.search).get('taskItemId') ?? undefined;
  const requestedProfessionalProjectId = new URLSearchParams(location.search).get('professionalProjectId') ?? undefined;
  const requestedTask = tasks.find((task) => task.id === requestedTaskId);
  const incomingSession = useMemo(() => incoming?.workspaceSession ?? storedSession ?? (requestedTask
    ? { mode: 'task' as const, taskId: requestedTask.id, targetProjectId: requestedTask.projectId, taskItemId: requestedTaskItemId, professionalProjectId: requestedProfessionalProjectId }
    : undefined), [incoming?.workspaceSession, storedSession, requestedTask, requestedTaskItemId, requestedProfessionalProjectId]);
  const session = useMemo(
    () => normalizeBusinessSession(
      incomingSession,
      projects.map((project) => project.id),
      Object.fromEntries(tasks.map((task) => [task.id, task.projectId])),
      Object.fromEntries(tasks.map((task) => [task.id, task.requirements.map((item) => item.id)])),
      Object.fromEntries(tasks.map((task) => [task.id, (task.professionalProjects ?? []).map((item) => item.id)])),
    ),
    [incomingSession, projects, tasks],
  );
  const targetProject = session.mode !== 'standalone'
    ? projects.find((project) => project.id === session.targetProjectId) ?? null
    : null;
  const activeTask = session.mode === 'task'
    ? tasks.find((task) => task.id === session.taskId) ?? null
    : null;
  const activeTaskItem = session.mode === 'task'
    ? activeTask?.requirements.find((item) => item.id === session.taskItemId) ?? null
    : null;
  const capability = getCapabilityFromPath(location.pathname);
  const objects = usePhysicalObjectStore(state => state.objects);
  const physicalSource = useMemo(() => resolvePhysicalSource(objects, session), [objects, session]);
  const sources = useMemo(() => getProfessionalSources(objects, projects, sourceSessions, session), [objects, projects, sourceSessions, session]);
  const dataContext = useMemo(() => session.physicalObjectId && !physicalSource.missing ? professionalDataContext(sources) : undefined, [sources, session.physicalObjectId, physicalSource.missing]);
  const addArtifact = useCallback(async (projectId: string, input: Parameters<ReturnType<typeof useProjectStore.getState>['addArtifact']>[1]) => {
    if (physicalSource.missing) throw new Error('成果来源已失效，请返回具体试验检查');
    return commitWorkspaceChange(() => {
      const model = input.payload.model as { modelId?: string } | undefined;
      const draft = useSessionStore.getState().sessions.find(item => item.id === session.sessionId)?.drafts[capability];
      const inheritedContext = session.physicalObjectId ? captureResultContext(objects, session) : undefined;
      const capturedFiles = (input.payload.sourceContext as { rawFiles?: NonNullable<typeof dataContext>['rawFiles'] } | undefined)?.rawFiles;
      const sourceContext = inheritedContext ? { ...inheritedContext, rawFiles: capturedFiles ?? dataContext?.rawFiles ?? inheritedContext.rawFiles } : undefined;
      const currentProjects = useProjectStore.getState().projects;
      const currentSessions = useSessionStore.getState().sessions;
      if (physicalSource.trial && input.type !== 'report') {
        const existing = collectAnalysisResults(physicalSource.trial, getTrialArtifacts(currentProjects, currentSessions, { ...session, testRecordId: undefined }, physicalSource.trial));
        assertUniqueResultNames(artifactResults({ ...input, id: input.id ?? '', projectId, createdAt: '', updatedAt: '' }), existing, { projectId, artifactId: input.id });
      }
      const upstream = dataContext?.results.filter(result => !(result.artifactRef?.projectId === projectId && result.artifactRef.artifactId === input.id)) ?? [];
      const upstreamRefs = input.payload.upstreamArtifactRefs as Array<{ projectId: string; artifactId: string }> | undefined;
      const artifact = useProjectStore.getState().addArtifact(projectId, { ...input, payload: {
        ...input.payload,
        resultMode: input.payload.resultMode ?? (input.type === 'design' && (input.payload.designSummary || input.payload.designMethod) ? 'configuration' : 'demo'),
        sourceScope: sourceContext?.scope,
        sourceContext,
        upstreamArtifactIds: upstreamRefs?.map(reference => reference.artifactId) ?? [...new Set([...(incoming?.artifactIds ?? []), ...upstream.flatMap(result => result.artifactRef ? [result.artifactRef.artifactId] : [])])],
        upstreamArtifactRefs: upstreamRefs ?? [...new Map([...upstream.flatMap(result => result.artifactRef ? [result.artifactRef] : []), ...projects.flatMap(project => project.artifacts.filter(artifact => incoming?.artifactIds?.includes(artifact.id) && artifact.id !== input.id).map(artifact => ({ projectId: project.id, artifactId: artifact.id })))].map(reference => [`${reference.projectId}/${reference.artifactId}`, reference])).values()],
        upstreamResultKeys: input.payload.upstreamResultKeys ?? upstream.map(result => result.key),
        modelInputs: model?.modelId ? draft?.[`modelInputs:${model.modelId}`] : undefined,
      } });
      if (!artifact) throw new Error('当前试验的成果空间不可用');
      const selected = useSessionStore.getState().sessions.find(item => item.id === session.sessionId)?.drafts[capability]?.artifactTaskItemId;
      recordTaskBusinessArtifact(session, { projectId: artifact.projectId, artifactId: artifact.id }, typeof selected === 'string' ? selected : undefined);
      return artifact;
    });
  }, [capability, incoming?.artifactIds, physicalSource.missing, projects, objects, session, dataContext]);
  // The task association is part of the artifact transaction; announce only after acknowledgment.
  const recordArtifactForTaskItem = useCallback(async (reference: { projectId: string; artifactId: string }) => {
    await flushWorkspacePersistence();
    if (session.sessionId) {
      window.dispatchEvent(new CustomEvent('protangram:session-artifact-saved', {
        detail: { sessionId: session.sessionId, artifactId: reference.artifactId },
      }));
    }
  }, [session]);

  return { projects, tasks, session, targetProject, activeTask, activeTaskItem, physicalSource, sources, dataContext, addArtifact, recordArtifactForTaskItem };
};
