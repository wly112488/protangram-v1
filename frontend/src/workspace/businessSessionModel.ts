import type { WorkspaceSessionState } from '@/types/businessContext';
import type { BusinessSession } from './types.ts';

export const createWorkspaceNavigationState = (activeProjectId: string | null) => ({
  workspaceSession: activeProjectId
    ? { mode: 'project' as const, targetProjectId: activeProjectId }
    : { mode: 'standalone' as const },
});

export const createTaskNavigationState = (taskId: string, projectId: string, taskItemId?: string) => ({
  workspaceSession: { mode: 'task' as const, taskId, targetProjectId: projectId, taskItemId },
});

export const createTopLevelNavigationSession = (session: WorkspaceSessionState): WorkspaceSessionState =>
  session.mode === 'task'
    ? { mode: 'task', taskId: session.taskId, targetProjectId: session.targetProjectId }
    : session;

export const createTaskContextSearch = (session: BusinessSession) => session.mode === 'task'
  ? `?taskId=${encodeURIComponent(session.taskId)}${session.taskItemId ? `&taskItemId=${encodeURIComponent(session.taskItemId)}` : ''}`
  : '';

export const createTaskReturnPath = (session: BusinessSession) => session.mode === 'task'
  ? `/tasks/${encodeURIComponent(session.taskId)}${session.taskItemId ? `?taskItemId=${encodeURIComponent(session.taskItemId)}` : ''}`
  : '/';

export const normalizeBusinessSession = (
  session: BusinessSession | undefined,
  validProjectIds: string[],
  validTaskProjectIds: Record<string, string> = {},
  validTaskItemIds: Record<string, string[]> = {},
): BusinessSession => {
  if (session?.mode === 'task') {
    const taskProjectId = validTaskProjectIds[session.taskId];
    if (taskProjectId && validProjectIds.includes(taskProjectId)) {
      const taskItemId = session.taskItemId && validTaskItemIds[session.taskId]?.includes(session.taskItemId)
        ? session.taskItemId
        : undefined;
      return { mode: 'task', taskId: session.taskId, targetProjectId: taskProjectId, taskItemId };
    }
  }
  if (
    session?.mode === 'project'
    && session.targetProjectId
    && validProjectIds.includes(session.targetProjectId)
  ) {
    return { mode: 'project', targetProjectId: session.targetProjectId };
  }
  return { mode: 'standalone' };
};
