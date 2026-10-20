import { recordChartKey, type RecordChartReference } from '../../workspace/physicalBusinessContext';
import type { AnalysisReport } from '@/types';
import type { Project } from '@/workspace/types';

/** Report definitions reference evidence in the acknowledged workspace snapshot. */
export function getWorkspaceReports(projects: Project[], legacy: AnalysisReport[] = []): AnalysisReport[] {
  const reports = new Map(legacy.map(report => [report.id, report]));
  for (const project of projects) for (const artifact of project.artifacts) {
    if (artifact.type !== 'report') continue;
    const report = artifact.payload.reportDefinition as AnalysisReport | undefined;
    if (report?.id === artifact.id) reports.set(report.id, report);
  }
  return [...reports.values()];
}

export const reportArtifactSelectionKey = (artifact: { projectId: string; id: string }) => JSON.stringify([artifact.projectId, artifact.id]);
export const reportChartSelectionKey = (reference: RecordChartReference) => recordChartKey(reference);

export function selectReportArtifacts<T extends { projectId: string; id: string }>(artifacts: T[], selected: string[]): T[] {
  const keys = new Set(selected);
  return artifacts.filter(artifact => keys.has(reportArtifactSelectionKey(artifact)));
}
export function selectReportCharts<T extends { reference: RecordChartReference }>(charts: T[], selected: string[]): T[] {
  const keys = new Set(selected);
  return charts.filter(chart => keys.has(reportChartSelectionKey(chart.reference)));
}
