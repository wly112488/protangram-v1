export type ProjectStatus = '未开始' | '进行中' | '已完成' | '已归档';

export type ProjectArtifactType =
  | 'design'
  | 'analysis'
  | 'rootCause'
  | 'calibration'
  | 'virtualCondition'
  | 'report';

export type ProjectView =
  | 'overview'
  | 'worksheet'
  | 'charts'
  | ProjectArtifactType;

export interface ProjectBasicInfo {
  testObject?: string;
  currentModel?: string;
}

export interface ProjectDataset {
  id: string;
  name: string;
  kind: string;
  source?: string;
}

export interface ProjectWorksheet {
  name: string;
  columns: string[];
  data: Record<string, string>;
}

export interface ProjectArtifact {
  id: string;
  projectId: string;
  type: ProjectArtifactType;
  title: string;
  source: string;
  status?: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  basicInfo: ProjectBasicInfo;
  worksheet?: ProjectWorksheet;
  datasets: ProjectDataset[];
  artifacts: ProjectArtifact[];
  legacyItems?: string[];
}

export interface ProjectNavigationItem {
  key: string;
  title: string;
  view: ProjectView;
}

export interface ProjectStats {
  datasetCount: number;
  worksheetRowCount: number;
  chartCount: number;
  artifactCount: number;
}

export interface BusinessSession {
  mode: 'project' | 'standalone';
  targetProjectId?: string;
}
