import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { BusinessRouteState } from '@/types/businessContext';
import { normalizeBusinessSession } from './businessSessionModel';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';

export const useWorkspaceBusinessSession = (incoming: BusinessRouteState | null) => {
  const location = useLocation();
  const projects = useProjectStore((state) => state.projects);
  const tasks = useTaskStore((state) => state.tasks);
  const requestedTaskId = new URLSearchParams(location.search).get('taskId');
  const requestedTaskItemId = new URLSearchParams(location.search).get('taskItemId') ?? undefined;
  const requestedProfessionalProjectId = new URLSearchParams(location.search).get('professionalProjectId') ?? undefined;
  const requestedTask = tasks.find((task) => task.id === requestedTaskId);
  const incomingSession = incoming?.workspaceSession ?? (requestedTask
    ? { mode: 'task' as const, taskId: requestedTask.id, targetProjectId: requestedTask.projectId, taskItemId: requestedTaskItemId, professionalProjectId: requestedProfessionalProjectId }
    : undefined);
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
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const addArtifactToTask = useTaskStore((state) => state.addArtifactToTask);
  const addArtifactToProfessionalProject = useTaskStore((state) => state.addArtifactToProfessionalProject);
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const recordArtifactForTaskItem = useCallback((reference: { projectId: string; artifactId: string }) => {
    if (session.mode !== 'task') return;
    if (session.professionalProjectId) {
      addArtifactToProfessionalProject(session.taskId, session.professionalProjectId, reference);
      const professionalProject = tasks.find((task) => task.id === session.taskId)?.professionalProjects?.find((item) => item.id === session.professionalProjectId);
      const relatedRequirement = professionalProject?.relatedRequirementId
        ? tasks.find((task) => task.id === session.taskId)?.requirements.find((item) => item.id === professionalProject.relatedRequirementId)
        : undefined;
      if (professionalProject?.relatedRequirementId) {
        addArtifactToTaskItem(session.taskId, professionalProject.relatedRequirementId, reference);
        if (relatedRequirement && relatedRequirement.status !== '已满足') {
          setRequirementStatus(session.taskId, professionalProject.relatedRequirementId, '待确认');
        }
      }
      return;
    }
    if (session.taskItemId) addArtifactToTaskItem(session.taskId, session.taskItemId, reference);
    else addArtifactToTask(session.taskId, reference);
  }, [addArtifactToProfessionalProject, addArtifactToTask, addArtifactToTaskItem, setRequirementStatus, session, tasks]);

  return { projects, tasks, session, targetProject, activeTask, activeTaskItem, recordArtifactForTaskItem };
};
