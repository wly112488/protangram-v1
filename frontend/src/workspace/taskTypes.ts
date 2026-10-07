export type TaskStatus = '进行中' | '已完成' | '已归档';
export type TaskRequirementStatus = '待完成' | '进行中' | '已满足';

export interface TaskRequirement {
  id: string;
  text: string;
  status: TaskRequirementStatus;
  dependsOnIds?: string[];
  capability?: 'dataAnalysis' | 'digitalTwin' | 'virtualCondition' | 'experimentDesign' | 'report';
  recommendationReason?: string;
  sourceRef?: string;
  sourceExcerpt?: string;
  inputSummary?: string;
  artifactRefs?: TaskArtifactReference[];
}

export interface TaskArtifactReference {
  projectId: string;
  artifactId: string;
  addedAt: string;
}

export interface TaskReportSection {
  id: string;
  title: string;
  body: string;
  artifactRefs: TaskArtifactReference[];
}

export interface TaskReportDraft {
  status: 'draft' | 'finalized';
  updatedAt: string;
  sections: TaskReportSection[];
}

export interface TaskRecord {
  id: string;
  title: string;
  sourceName?: string;
  sourceText?: string;
  projectId: string;
  demo?: boolean;
  planConfirmed?: boolean;
  status: TaskStatus;
  requirements: TaskRequirement[];
  reportDraft: TaskReportDraft;
  createdAt: string;
  updatedAt: string;
}
