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
import { captureResultContext } from './analysisResultModel';
import { getProfessionalSources, professionalDataContext } from './professionalContext';
import { saveOwnedArtifact } from './sessionResourceStore';
import { useProfessionalScope } from './professionalScopeContext';

export const useWorkspaceBusinessSession = (incoming: BusinessRouteState | null) => {
  const location = useLocation();
  const sessionId = getSessionIdFromLocation(location.pathname, location.search);
  const storedSession = useMemo(() => sessionId ? useSessionStore.getState().getWorkspaceSession(sessionId) : undefined, [sessionId]);
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
  const professionalScope = useProfessionalScope();
  const objects = usePhysicalObjectStore(state => state.objects);
  const sourceSessions = useSessionStore(state => state.sessions);
  const physicalSource = useMemo(() => resolvePhysicalSource(objects, session), [objects, session]);
  const sources = useMemo(() => getProfessionalSources(objects, projects, sourceSessions, session), [objects, projects, sourceSessions, session]);
  const dataContext = useMemo(() => session.physicalObjectId && !physicalSource.missing ? {
    ...professionalDataContext(sources), scope: { ...professionalDataContext(sources).scope, cfgId: session.cfgId ?? physicalSource.trial?.cfgId },
  } : undefined, [sources, session.physicalObjectId, session.cfgId, physicalSource.missing, physicalSource.trial?.cfgId]);
  const addArtifact = useCallback((projectId: string, input: Parameters<ReturnType<typeof useProjectStore.getState>['addArtifact']>[1]) => {
    if (physicalSource.missing) return null;
    const professionalCapability = capability === 'doe' || capability === 'analysis' || capability === 'digitalTwin' || capability === 'virtualCondition';
    if (session.sessionId && professionalCapability && !professionalScope?.cfgId) return null;
    const model = input.payload.model as { modelId?: string } | undefined;
    const draft = useSessionStore.getState().sessions.find(item => item.id === session.sessionId)?.drafts[capability];
    const inheritedContext = session.physicalObjectId ? captureResultContext(objects, session) : undefined;
    const modelPlan = input.payload.modelPlan as { trialId?: string; cfgId?: string } | undefined;
    const resultScope = inheritedContext && modelPlan?.trialId === inheritedContext.scope.trialId && modelPlan?.cfgId
      ? { ...inheritedContext.scope, cfgId: modelPlan.cfgId } : inheritedContext?.scope;
    const capturedFiles = (input.payload.sourceContext as { rawFiles?: NonNullable<typeof dataContext>['rawFiles'] } | undefined)?.rawFiles;
    const sourceContext = inheritedContext
      ? { ...inheritedContext, scope: resultScope!, rawFiles: capturedFiles ?? dataContext?.rawFiles ?? inheritedContext.rawFiles }
      : capturedFiles?.length ? { scope: professionalScope, rawFiles: capturedFiles } : undefined;
    const previousProjects = useProjectStore.getState().projects;
    const upstream = dataContext?.results.filter(result => !(result.artifactRef?.projectId === projectId && result.artifactRef.artifactId === input.id)) ?? [];
    const upstreamRefs = input.payload.upstreamArtifactRefs as Array<{ projectId: string; artifactId: string }> | undefined;
    const prepared = { ...input, payload: {
      ...input.payload,
      sourceCapability: capability,
      resultMode: input.payload.resultMode ?? (input.type === 'design' && (input.payload.designSummary || input.payload.designMethod) ? 'configuration' : 'demo'),
      sourceScope: professionalScope ?? sourceContext?.scope,
      sourceContext,
      upstreamArtifactIds: upstreamRefs?.map(reference => reference.artifactId) ?? [...new Set([...(incoming?.artifactIds ?? []), ...upstream.flatMap(result => result.artifactRef ? [result.artifactRef.artifactId] : [])])],
      upstreamArtifactRefs: upstreamRefs ?? [...new Map([...upstream.flatMap(result => result.artifactRef ? [result.artifactRef] : []), ...projects.flatMap(project => project.artifacts.filter(artifact => incoming?.artifactIds?.includes(artifact.id) && artifact.id !== input.id).map(artifact => ({ projectId: project.id, artifactId: artifact.id })))].map(reference => [`${reference.projectId}/${reference.artifactId}`, reference])).values()],
      upstreamResultKeys: input.payload.upstreamResultKeys ?? upstream.map(result => result.key),
      modelInputs: model?.modelId ? draft?.[`modelInputs:${model.modelId}`] : undefined,
    } };
    let artifact;
    try {
      const ownerCfgId = professionalScope?.cfgId ?? session.cfgId;
      artifact = session.sessionId && ownerCfgId
        ? saveOwnedArtifact(session.sessionId, {kind:'cfg',cfgId:ownerCfgId}, prepared)
        : useProjectStore.getState().addArtifact(projectId, prepared);
    } catch { return null; }
    const saveError = useSessionStore.getState().saveError;
    if (saveError) {
      useProjectStore.setState({ projects: previousProjects });
      useSessionStore.setState({ saveError });
      return null;
    }
    return artifact;
  }, [capability, incoming?.artifactIds, physicalSource.missing, projects, objects, session, dataContext, professionalScope]);
  const selectedTaskItemId = useSessionStore(state => {
    const value = state.sessions.find(item => item.id === sessionId)?.drafts[capability]?.artifactTaskItemId;
    return typeof value === 'string' ? value : undefined;
  });
  const recordArtifactForTaskItem = useCallback((reference: { projectId: string; artifactId: string }) => {
    recordTaskBusinessArtifact(session, reference, selectedTaskItemId);
    if (session.sessionId) {
      window.dispatchEvent(new CustomEvent('protangram:session-artifact-saved', {
        detail: { sessionId: session.sessionId, artifactId: reference.artifactId },
      }));
    }
  }, [session, selectedTaskItemId]);

  return { projects, tasks, session, targetProject, activeTask, activeTaskItem, physicalSource, sources, dataContext, addArtifact, recordArtifactForTaskItem };
};
