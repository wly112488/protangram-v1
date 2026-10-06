import type { ProjectArtifact, ProjectArtifactType } from '../../workspace/types';

export function getReportableArtifacts(artifacts: ProjectArtifact[]): ProjectArtifact[];

export function resolveReportProjectId(input: {
  routeProjectId?: string;
  activeProjectId?: string | null;
  projectIds: string[];
}): string;

export function createReportArtifactInput(input: {
  reportId: string;
  title: string;
  summary: string;
  reportTemplateId: string;
  artifactIds: string[];
  tagBindings: Record<string, string>;
  createdAt?: string;
}): Omit<ProjectArtifact, 'projectId'> & { type: Extract<ProjectArtifactType, 'report'> };
