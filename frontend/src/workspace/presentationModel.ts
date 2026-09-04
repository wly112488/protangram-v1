import type { Project } from './types';

export type HeaderActiveKey = 'experiment' | 'doe' | 'analysis' | 'report' | null;

export const filterProjectsBySearch = (projects: Project[], keyword: string): Project[] => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => project.name.toLowerCase().includes(normalized));
};

export const getHeaderActiveKey = (pathname: string): HeaderActiveKey => {
  if (pathname.startsWith('/analysis')) return 'analysis';
  if (pathname.startsWith('/report')) return 'report';
  if (pathname.startsWith('/experiment/design')) return 'doe';
  if (pathname.startsWith('/experiment')) return 'experiment';
  return null;
};
