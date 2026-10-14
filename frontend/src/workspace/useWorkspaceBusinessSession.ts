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
  const objects = usePhysicalObjectStore(state => state.objects);
  const physicalSource = useMemo(() => resolvePhysicalSource(objects, session), [objects, session]);
  const addArtifact = useCallback((projectId: string, input: Parameters<ReturnType<typeof useProjectStore.getState>['addArtifact']>[1]) => {
    if (physicalSource.missing) return null;
    const model = input.payload.model as { modelId?: string } | undefined;
    const draft = useSessionStore.getState().sessions.find(item => item.id === session.sessionId)?.drafts[capability];
    return useProjectStore.getState().addArtifact(projectId, { ...input, payload: {
      ...input.payload,
      resultMode: input.type === 'design' && (input.payload.designSummary || input.payload.designMethod) ? 'configuration' : 'demo',
      sourceScope: session.physicalObjectId ? { physicalObjectId: session.physicalObjectId, experimentId: session.experimentId, testRecordId: session.testRecordId } : undefined,
      upstreamArtifactIds: incoming?.artifactIds ?? [],
      upstreamArtifactRefs: projects.flatMap(project => project.artifacts.filter(artifact => incoming?.artifactIds?.includes(artifact.id)).map(artifact => ({ projectId: project.id, artifactId: artifact.id }))),
      modelInputs: model?.modelId ? draft?.[`modelInputs:${model.modelId}`] : undefined,
    } });
  }, [capability, incoming?.artifactIds, physicalSource.missing, projects, session.sessionId, session.physicalObjectId, session.experimentId, session.testRecordId]);
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

  return { projects, tasks, session, targetProject, activeTask, activeTaskItem, physicalSource, addArtifact, recordArtifactForTaskItem };
};
