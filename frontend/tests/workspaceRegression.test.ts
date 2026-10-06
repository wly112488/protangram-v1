import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { addArtifactToProject, migrateLegacyExperiments } from '../src/workspace/projectModel.ts';

const legacyExperiment = {
  id: 'experiment-1',
  name: 'CE25A 高转速性能验证',
  designName: '创建两水平因子设计',
  worksheetData: { '1-C1': 'Run', '2-C1': '1' },
};

test('clicking a top-level business section can update the header selection immediately', () => {
  const headerSource = readFileSync(new URL('../src/workspace/WorkspaceHeader.tsx', import.meta.url), 'utf8');

  assert.match(headerSource, /selectedSection/);
  assert.match(headerSource, /onClickCapture/);
  assert.match(headerSource, /layout-function-item/);
});

test('saving a business artifact refreshes project test object and current model', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-08T00:00:00.000Z');
  const updated = addArtifactToProject(project, {
    id: 'calibration-1',
    projectId: project.id,
    type: 'calibration',
    title: '模型校准结果',
    source: '试验数字孪生',
    summary: '校准完成',
    payload: {
      model: {
        modelId: 'engine-v2.1',
        modelName: '发动机数字孪生模型',
        version: 'V2.1',
        trustedRange: '2000～8800 rpm',
      },
    },
    createdAt: '2026-09-08T01:00:00.000Z',
    updatedAt: '2026-09-08T01:00:00.000Z',
  });

  assert.equal(updated.basicInfo.testObject, '发动机');
  assert.equal(updated.basicInfo.currentModel, '发动机数字孪生模型 V2.1');
});

test('virtual-condition page keeps its persistence callback stable to avoid assistant update loops', () => {
  const source = readFileSync(new URL('../src/pages/analysis/VirtualConditionExtension.tsx', import.meta.url), 'utf8');

  assert.match(source, /const persistVirtualResult = useCallback\(/);
  assert.doesNotMatch(source, /\[boundProject, conditions, effectiveSession, incoming\?\.data, incoming\?\.task, model, navigate, persistedProjectId, persistVirtualResult, predictionStatus\]/);
});

test('project sidebar exposes a guarded delete action backed by the project store', () => {
  const storeSource = readFileSync(new URL('../src/workspace/projectStore.ts', import.meta.url), 'utf8');
  const sidebarSource = readFileSync(new URL('../src/workspace/ProjectSidebar.tsx', import.meta.url), 'utf8');

  assert.match(storeSource, /deleteProject:/);
  assert.match(sidebarSource, /Popconfirm/);
  assert.match(sidebarSource, /deleteProject\(project\.id\)/);
});

test('save target defaults to the active project and makes newly created projects easy to find', () => {
  const source = readFileSync(new URL('../src/workspace/ProjectSaveTargetModal.tsx', import.meta.url), 'utf8');

  assert.match(source, /activeProjectId/);
  assert.match(source, /showSearch/);
  assert.match(source, /orderedProjects/);
});

test('core business pages require explicit user confirmation before enabling the primary action', () => {
  const sources = [
    '../src/pages/analysis/DigitalTwin.tsx',
    '../src/pages/experiment/design/IntelligentExperimentDesign.tsx',
    '../src/pages/analysis/projects/AnalysisProjects.tsx',
    '../src/pages/analysis/VirtualConditionExtension.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  for (const source of sources) {
    assert.match(source, /PreparationChecklist/);
    assert.match(source, /preparationReady/);
    assert.match(source, /confirmed/);
  }
});

test('reset is visually subordinate to preparation and primary actions', () => {
  const sources = [
    '../src/pages/analysis/DigitalTwin.tsx',
    '../src/pages/experiment/design/IntelligentExperimentDesign.tsx',
    '../src/pages/analysis/projects/AnalysisProjects.tsx',
    '../src/pages/analysis/VirtualConditionExtension.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  for (const source of sources) {
    assert.match(source, /workspace-reset-action/);
    assert.match(source, /size="small"/);
    assert.match(source, /type="text"/);
  }
});

test('preparation cards own workflow actions instead of duplicating configuration controls below', () => {
  const checklistSource = readFileSync(new URL('../src/workspace/PreparationChecklist.tsx', import.meta.url), 'utf8');
  const businessSources = [
    '../src/pages/analysis/DigitalTwin.tsx',
    '../src/pages/experiment/design/IntelligentExperimentDesign.tsx',
    '../src/pages/analysis/projects/AnalysisProjects.tsx',
    '../src/pages/analysis/VirtualConditionExtension.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  assert.match(checklistSource, /actions\?: React\.ReactNode/);
  assert.match(checklistSource, /workspace-preparation-actions/);
  for (const source of businessSources) {
    assert.match(source, /actions=\{/);
    assert.doesNotMatch(source, /<Card size="small" className="workspace-business-card"><Space wrap>/);
  }
});

test('data analysis readiness contains only user-confirmed analysis inputs, without an invented comparison-model gate', () => {
  const source = readFileSync(new URL('../src/pages/analysis/projects/AnalysisProjects.tsx', import.meta.url), 'utf8');

  assert.doesNotMatch(source, /label: '对比模型'/);
  assert.doesNotMatch(source, /model: false/);
  assert.doesNotMatch(source, /confirmed\.model/);
});

test('joining analysis and virtual results to a report persists Project artifacts and carries their ids', () => {
  const analysisSource = readFileSync(new URL('../src/pages/analysis/projects/AnalysisProjects.tsx', import.meta.url), 'utf8');
  const virtualSource = readFileSync(new URL('../src/pages/analysis/VirtualConditionExtension.tsx', import.meta.url), 'utf8');
  const createSource = readFileSync(new URL('../src/pages/report/ReportCreate.tsx', import.meta.url), 'utf8');
  const generateSource = readFileSync(new URL('../src/pages/report/ReportGenerate.tsx', import.meta.url), 'utf8');

  assert.match(analysisSource, /persistResult\(boundProject\.id, 'analysis'\)/);
  assert.match(analysisSource, /artifactIds: \[artifactId\]/);
  assert.doesNotMatch(analysisSource, /saveBusinessReportItem/);
  assert.match(virtualSource, /persistVirtualResult\(boundProject\.id\)/);
  assert.match(virtualSource, /artifactIds: \[artifact\.id\]/);
  assert.doesNotMatch(virtualSource, /saveBusinessReportItem/);
  assert.match(createSource, /routeState\?\.artifactIds/);
  assert.match(generateSource, /addArtifact\(workspaceProject\.id, createReportArtifactInput/);
});

test('cross-page workflows explain which task data model or validation context was carried forward', () => {
  const sources = [
    '../src/pages/experiment/design/IntelligentExperimentDesign.tsx',
    '../src/pages/analysis/projects/AnalysisProjects.tsx',
    '../src/pages/analysis/DigitalTwin.tsx',
    '../src/pages/analysis/VirtualConditionExtension.tsx',
  ].map((path) => readFileSync(new URL(path, import.meta.url), 'utf8'));

  for (const source of sources) assert.match(source, /已从[\s\S]{0,400}带入业务上下文|已从试验数据分析带入/);
});

test('project artifact content keeps raw payload in a collapsed debug section and offers a continue action', () => {
  const source = readFileSync(new URL('../src/workspace/ProjectContent.tsx', import.meta.url), 'utf8');

  assert.match(source, /<details/);
  assert.match(source, /调试信息|原始数据/);
  assert.match(source, /workspace-artifact-summary/);
  assert.match(source, /继续|新建/);
  assert.match(source, /workspaceSession: \{ mode: 'project', targetProjectId: projectId \}/);
});

test('project overview recommends deterministic next actions from saved artifacts and virtual risk', () => {
  const source = readFileSync(new URL('../src/workspace/ProjectOverview.tsx', import.meta.url), 'utf8');

  for (const action of ['试验设计', '试验数据分析', '模型校准', '虚拟工况', '补充试验设计', '报告', '验证设计', '创建任务']) {
    assert.ok(source.includes(action), `missing next-step action: ${action}`);
  }
  assert.match(source, /workspaceSession/);
  assert.match(source, /highRiskCount|高风险/);
});

test('project sidebar names the project contents and saved outcomes instead of suggesting feature navigation', () => {
  const source = readFileSync(new URL('../src/workspace/ProjectSidebar.tsx', import.meta.url), 'utf8');

  assert.match(source, /项目内容|项目成果/);
  assert.match(source, /已保存|结果/);
});
