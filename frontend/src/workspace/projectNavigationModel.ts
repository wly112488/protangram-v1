import type { Project } from './types';
import type { WorkSession } from './sessionModel';
import type { PhysicalObject } from './physicalObjectStore';
import type { TaskRecord } from './taskTypes';
import { getProjectTrialEntries, getProjectTrialDraftSessions } from './projectTrialModel';

export interface ProjectNavigationNode {
  key: string;
  kind: 'project' | 'trials' | 'analysis' | 'trial' | 'draft' | 'taskBook';
  name: string;
  projectId: string;
  targetId?: string;
  count?: number;
  children: ProjectNavigationNode[];
}

/** Navigation is a projection of existing ownership, never a source of business objects. */
export function buildProjectNavigation(projects: Project[], sessions: WorkSession[], objects: PhysicalObject[], tasks: TaskRecord[]): ProjectNavigationNode[] {
  return projects.filter(project => !project.sessionOwnerId).map(project => {
    const trials = getProjectTrialEntries(project.id, objects, projects, sessions);
    const drafts = getProjectTrialDraftSessions(project.id, sessions);
    const node = (kind: ProjectNavigationNode['kind'], name: string, targetId?: string, children: ProjectNavigationNode[] = []): ProjectNavigationNode => ({
      key: JSON.stringify([project.id, kind, targetId ?? '']), kind, name, projectId: project.id, targetId, children,
    });
    return { ...node('project', project.name, undefined, [
      node('trials', '试验任务', undefined, [
        ...trials.map(entry => node('trial', entry.trial.name, entry.trial.id)),
        ...drafts.map(session => node('draft', `${session.title} · 草稿`, session.id)),
      ]),
      node('analysis', '分析任务书', undefined, tasks.filter(task => task.projectId === project.id).map(task => node('taskBook', task.title, task.id))),
    ]), count: trials.length };
  });
}
