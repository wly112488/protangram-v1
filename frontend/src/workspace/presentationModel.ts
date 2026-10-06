import type { Project } from './types';

export type HeaderActiveKey = 'taskCenter' | 'experiment' | 'doe' | 'analysis' | 'digitalTwin' | 'virtualCondition' | 'report' | null;

export interface PrimaryNavigationItem {
  key: Exclude<HeaderActiveKey, null>;
  label: string;
  path?: string;
  groups?: string[];
}

export const primaryNavigationItems: PrimaryNavigationItem[] = [
  { key: 'taskCenter', label: '任务中心', path: '/' },
  { key: 'experiment', label: '试验管理', groups: ['关联对象管理', '试验科目', '采样要求'] },
  { key: 'doe', label: '试验设计', path: '/experiment/design/intelligent' },
  { key: 'analysis', label: '试验数据分析', path: '/analysis/projects' },
  { key: 'digitalTwin', label: '试验数字孪生', path: '/analysis/digital-twin' },
  { key: 'virtualCondition', label: '虚拟工况扩展', path: '/analysis/virtual-condition' },
  { key: 'report', label: '报告生成', groups: ['报告模板管理', '分析报告管理', '报告生成'] },
];

export const filterProjectsBySearch = (projects: Project[], keyword: string): Project[] => {
  const normalized = keyword.trim().toLowerCase();
  if (!normalized) return projects;
  return projects.filter((project) => project.name.toLowerCase().includes(normalized));
};

export const getHeaderActiveKey = (pathname: string): HeaderActiveKey => {
  if (pathname === '/' || pathname.startsWith('/tasks/')) return 'taskCenter';
  if (pathname.startsWith('/analysis/digital-twin')) return 'digitalTwin';
  if (pathname.startsWith('/analysis/virtual-condition')) return 'virtualCondition';
  if (pathname.startsWith('/analysis/projects')) return 'analysis';
  if (pathname.startsWith('/report')) return 'report';
  if (pathname.startsWith('/experiment/design')) return 'doe';
  if (pathname.startsWith('/experiment')) return 'experiment';
  return null;
};
