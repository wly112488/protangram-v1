const REPORTABLE_ARTIFACT_TYPES = new Set([
  'design',
  'analysis',
  'rootCause',
  'calibration',
  'virtualCondition',
]);

/** @param {import('../../workspace/types').ProjectArtifact[]} artifacts */
export function getReportableArtifacts(artifacts) {
  return artifacts.filter((artifact) => REPORTABLE_ARTIFACT_TYPES.has(artifact.type));
}

/** @param {{ routeProjectId?: string; activeProjectId?: string | null; projectIds: string[] }} input */
export function resolveReportProjectId({ routeProjectId, activeProjectId, projectIds }) {
  if (routeProjectId && projectIds.includes(routeProjectId)) return routeProjectId;
  if (activeProjectId && projectIds.includes(activeProjectId)) return activeProjectId;
  return '';
}

/** @param {{ reportId: string; title: string; summary: string; reportTemplateId: string; artifactIds: string[]; tagBindings: Record<string, string>; createdAt?: string }} input */
export function createReportArtifactInput({
  reportId,
  title,
  summary,
  reportTemplateId,
  artifactIds,
  tagBindings,
  createdAt = new Date().toISOString(),
}) {
  return {
    id: reportId,
    type: 'report',
    title,
    source: '报告生成',
    status: 'generated',
    summary,
    payload: {
      reportId,
      reportTemplateId,
      artifactIds,
      tagBindings,
    },
    createdAt,
    updatedAt: createdAt,
  };
}
