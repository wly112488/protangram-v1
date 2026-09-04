import { useMemo } from 'react';
import type { BusinessRouteState } from '@/types/businessContext';
import { normalizeBusinessSession } from './businessSessionModel';
import { useProjectStore } from './projectStore';

export const useWorkspaceBusinessSession = (incoming: BusinessRouteState | null) => {
  const projects = useProjectStore((state) => state.projects);
  const session = useMemo(
    () => normalizeBusinessSession(incoming?.workspaceSession, projects.map((project) => project.id)),
    [incoming?.workspaceSession, projects],
  );
  const targetProject = session.mode === 'project'
    ? projects.find((project) => project.id === session.targetProjectId) ?? null
    : null;

  return { projects, session, targetProject };
};
