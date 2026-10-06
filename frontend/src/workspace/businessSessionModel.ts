import type { BusinessSession } from './types.ts';

export const createWorkspaceNavigationState = (activeProjectId: string | null) => ({
  workspaceSession: activeProjectId
    ? { mode: 'project' as const, targetProjectId: activeProjectId }
    : { mode: 'standalone' as const },
});

export const normalizeBusinessSession = (
  session: BusinessSession | undefined,
  validProjectIds: string[],
): BusinessSession => {
  if (
    session?.mode === 'project'
    && session.targetProjectId
    && validProjectIds.includes(session.targetProjectId)
  ) {
    return { mode: 'project', targetProjectId: session.targetProjectId };
  }
  return { mode: 'standalone' };
};
