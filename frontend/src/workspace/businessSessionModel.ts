import type { BusinessSession } from './types.ts';

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
