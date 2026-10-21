import type { Project } from './types';
import type { TaskRecord } from './taskTypes';

export type TrialCreationContext =
  | { mode: 'task'; taskId: string; taskName: string; projectId: string }
  | { mode: 'project'; projectId: string; projectName: string }
  | { mode: 'independent' }
  | { mode: 'missing-task'; taskId: string }
  | { mode: 'missing-project'; projectId: string };

export function resolveTrialCreationContext(search: string, tasks: TaskRecord[], projects: Project[]): TrialCreationContext {
  const params = new URLSearchParams(search);
  const taskId = params.get('taskBookId');
  if (taskId) {
    const task = tasks.find(item => item.id === taskId);
    return task ? { mode: 'task', taskId, taskName: task.title, projectId: task.projectId } : { mode: 'missing-task', taskId };
  }
  const projectId = params.get('projectId');
  if (projectId) {
    const project = projects.find(item => item.id === projectId && !item.sessionOwnerId);
    return project ? { mode: 'project', projectId, projectName: project.name } : { mode: 'missing-project', projectId };
  }
  return { mode: 'independent' };
}

export function resolveTrialTaskBookId(context: TrialCreationContext, selectedTaskBookId?: string) {
  if (context.mode === 'task') return context.taskId;
  if (context.mode === 'missing-task' || context.mode === 'missing-project') return undefined;
  return selectedTaskBookId || undefined;
}
