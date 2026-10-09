import type { BusinessSession } from './types';
import { useTaskStore } from './taskStore';

/** Record evidence without treating production of an artifact as acceptance. */
export function recordTaskBusinessArtifact(
  session: BusinessSession,
  reference: { projectId: string; artifactId: string },
  selectedTaskItemId?: string,
) {
  if (session.mode !== 'task') return null;
  const store = useTaskStore.getState();
  const task = store.tasks.find(item => item.id === session.taskId);
  if (!task) return null;
  const professional = task.professionalProjects?.find(item => item.id === session.professionalProjectId);
  const requirementId = professional ? professional.relatedRequirementId : session.taskItemId ?? selectedTaskItemId;
  const requirement = task.requirements.find(item => item.id === requirementId);
  if (professional) store.addArtifactToProfessionalProject(task.id, professional.id, reference);
  if (requirement) {
    store.addArtifactToTaskItem(task.id, requirement.id, reference);
    if (requirement.status !== '已满足') store.setRequirementStatus(task.id, requirement.id, '待确认');
  } else if (!professional) {
    store.addArtifactToTask(task.id, reference);
  }
  return professional ? 'professional' : requirement ? 'item' : 'task';
}
