import type { Project } from './types';
import type { TaskRecord } from './taskTypes';
import type { WorkSession } from './sessionModel';

export const getSessionSidebarContent = (
  projects: Project[],
  sessions: WorkSession[],
  tasks: TaskRecord[],
  search: string,
  showArchived: boolean,
) => {
  const query = search.trim().toLowerCase();
  const matches = (value: string) => value.toLowerCase().includes(query);
  const taskProjectIds = new Set(tasks.map(task => task.projectId));
  const visibleProjects = projects.filter(project => !project.sessionOwnerId && !taskProjectIds.has(project.id));
  const visibleSessions = [...sessions].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const independentSessions = visibleSessions.filter(session => !session.taskId
    && !visibleProjects.some(project => project.id === session.projectId)
    && session.archived === showArchived && matches(session.title));
  const visibleTasks = tasks.filter(task => (task.status === '已归档') === showArchived && matches(task.title));

  return { visibleProjects, visibleSessions, independentSessions, visibleTasks };
};

export const getTaskNavigationSession = (sessions: WorkSession[], taskId: string) =>
  sessions.find(session => session.taskId === taskId && session.capability !== 'task');

export const getRecentSessionsForHome = (sessions: WorkSession[]) => sessions
  .filter(session => !session.archived && !(session.taskId && session.capability === 'task'))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  .slice(0, 6);
