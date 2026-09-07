import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { normalizeBusinessSession } from '../src/workspace/businessSessionModel.ts';
import {
  addArtifactToProject,
  buildProjectNavigation,
  createAnalysisArtifactInput,
  createCalibrationArtifactInput,
  createDesignArtifactInput,
  createRootCauseArtifactInput,
  createVirtualConditionArtifactInput,
  getProjectStats,
  migrateLegacyExperiments,
  removeArtifactFromProject,
} from '../src/workspace/projectModel.ts';
import { filterProjectsBySearch, getHeaderActiveKey } from '../src/workspace/presentationModel.ts';

const legacyExperiment = {
  id: 'experiment-1',
  name: 'CE25A 高转速性能验证',
  designName: '创建两水平因子设计',
  designSummary: {
    factorCount: 2,
    runCount: 8,
    blockCount: 1,
    wholePlotCount: 0,
    wholePlotRunCount: 0,
    wholePlotReplicateCount: 2,
    subPlotReplicateCount: 0,
    hardToChangeFactor: 'A',
    wholePlotGenerator: 'A',
    note: '所有项均不混杂。',
  },
  worksheetData: {
    '1-C1': 'Run',
    '1-C2': '转速',
    '2-C1': '1',
    '2-C2': '8000',
  },
  extraItems: ['旧分析结果'],
};

test('migrates a legacy generated experiment into one unified project', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-04T08:00:00.000Z');

  assert.equal(project.id, 'experiment-1');
  assert.equal(project.name, 'CE25A 高转速性能验证');
  assert.equal(project.worksheet?.data['2-C2'], '8000');
  assert.equal(project.artifacts.length, 1);
  assert.equal(project.artifacts[0].type, 'design');
  assert.deepEqual(project.legacyItems, ['旧分析结果']);
});

test('project navigation only exposes categories backed by real content', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-04T08:00:00.000Z');
  const withCalibration = addArtifactToProject(project, {
    id: 'cal-1',
    projectId: project.id,
    type: 'calibration',
    title: '模型校准 V2.1',
    source: '试验数字孪生',
    summary: '可信度 94.6%',
    payload: { charts: [{ id: 'comparison', title: '结果对比' }] },
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
  });

  assert.deepEqual(buildProjectNavigation(withCalibration).map((item) => item.view), [
    'overview',
    'worksheet',
    'charts',
    'calibration',
    'design',
  ]);
});

test('removing the final artifact of a category removes that navigation category', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-04T08:00:00.000Z');
  const withRootCause = addArtifactToProject(project, {
    id: 'root-1',
    projectId: project.id,
    type: 'rootCause',
    title: '高转速温度异常根因',
    source: '试验数据分析',
    summary: '冷却流量下降是主要候选根因',
    payload: {},
    createdAt: '2026-09-04T09:00:00.000Z',
    updatedAt: '2026-09-04T09:00:00.000Z',
  });

  assert.equal(buildProjectNavigation(withRootCause).some((item) => item.view === 'rootCause'), true);
  const removed = removeArtifactFromProject(withRootCause, 'root-1', '2026-09-04T10:00:00.000Z');
  assert.equal(buildProjectNavigation(removed).some((item) => item.view === 'rootCause'), false);
});

test('project statistics are derived from persisted project content', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-04T08:00:00.000Z');
  const enriched = {
    ...project,
    datasets: [
      { id: 'd1', name: '实测数据', kind: 'measured' },
      { id: 'd2', name: '仿真数据', kind: 'simulation' },
    ],
    artifacts: [
      ...project.artifacts,
      {
        id: 'analysis-1',
        projectId: project.id,
        type: 'analysis' as const,
        title: '高转速分析',
        source: '试验数据分析',
        summary: '发现 3 个异常事件',
        payload: { charts: [{ id: 'c1' }, { id: 'c2' }] },
        createdAt: '2026-09-04T09:00:00.000Z',
        updatedAt: '2026-09-04T09:00:00.000Z',
      },
    ],
  };

  assert.deepEqual(getProjectStats(enriched), {
    datasetCount: 2,
    worksheetRowCount: 2,
    chartCount: 2,
    artifactCount: 2,
  });
});

test('project search filters only by top-level project name', () => {
  const [project] = migrateLegacyExperiments([legacyExperiment], '2026-09-04T08:00:00.000Z');
  const second = { ...project, id: 'experiment-2', name: '电机热性能验证' };

  assert.deepEqual(filterProjectsBySearch([project, second], 'CE25').map((item) => item.id), ['experiment-1']);
  assert.deepEqual(filterProjectsBySearch([project, second], '根因分析').map((item) => item.id), []);
});

test('header active key follows the current business route', () => {
  assert.equal(getHeaderActiveKey('/experiment/design/intelligent'), 'doe');
  assert.equal(getHeaderActiveKey('/analysis/digital-twin'), 'analysis');
  assert.equal(getHeaderActiveKey('/report/list'), 'report');
  assert.equal(getHeaderActiveKey('/'), null);
});

test('business artifact factories assign stable type, source and payload contracts', () => {
  const calibration = createCalibrationArtifactInput({ title: '模型校准 V2.1', summary: '综合拟合度 R² = 0.946', payload: { modelVersion: 'V2.1', charts: [{ id: 'comparison' }] } });
  const design = createDesignArtifactInput({ title: '智能推荐方案 #01', summary: '推荐 8 个试验工况', payload: { plan: [{ order: 1 }] } });
  const analysis = createAnalysisArtifactInput({ title: '高转速试验分析', summary: '分析流程已完成', payload: { charts: [{ id: 'analysis-chart' }] } });
  const rootCause = createRootCauseArtifactInput({ title: '高转速异常根因', summary: '冷却流量下降为主要候选根因', payload: { evidence: ['7600rpm 后流量下降'] } });
  const virtual = createVirtualConditionArtifactInput({ title: '高转速虚拟工况预测', summary: '完成 36 个虚拟工况预测', payload: { highRiskCount: 6 } });

  assert.deepEqual([calibration.type, design.type, analysis.type, rootCause.type, virtual.type], ['calibration', 'design', 'analysis', 'rootCause', 'virtualCondition']);
  assert.deepEqual([calibration.source, design.source, analysis.source, rootCause.source, virtual.source], ['试验数字孪生', '智能试验设计', '试验数据分析', '试验数据分析', '虚拟工况扩展']);
  assert.equal((calibration.payload.charts as unknown[]).length, 1);
  assert.equal((design.payload.plan as unknown[]).length, 1);
  assert.equal(virtual.payload.highRiskCount, 6);
});

test('assistant primary presentation is an embedded workspace panel with a narrow-screen fallback', () => {
  const source = readFileSync(new URL('../src/components/TrialAIAssistant.tsx', import.meta.url), 'utf8');
  assert.match(source, /workspace-ai-panel/);
  assert.match(source, /workspace-ai-mobile-trigger/);
  assert.match(source, /试验 AI 助手/);
});

test('business session stays standalone unless the route explicitly supplies a valid project', () => {
  assert.deepEqual(normalizeBusinessSession(undefined, ['project-a']), { mode: 'standalone' });
  assert.deepEqual(normalizeBusinessSession({ mode: 'project', targetProjectId: 'project-a' }, ['project-a']), { mode: 'project', targetProjectId: 'project-a' });
  assert.deepEqual(normalizeBusinessSession({ mode: 'project', targetProjectId: 'missing' }, ['project-a']), { mode: 'standalone' });
});

test('workspace header and data analysis integrate the approved COMAC visual assets and interactive measurement view', () => {
  const headerSource = readFileSync(new URL('../src/workspace/WorkspaceHeader.tsx', import.meta.url), 'utf8');
  const analysisSource = readFileSync(new URL('../src/pages/analysis/projects/AnalysisProjects.tsx', import.meta.url), 'utf8');

  assert.match(headerSource, /comac_logo\.png/);
  assert.match(headerSource, /workspace-brand-logo/);
  assert.match(analysisSource, /duct_flow_diagram\.png/);
  assert.match(analysisSource, /analysis-structure-view/);
  assert.match(analysisSource, /analysis-hotspot/);
  assert.match(analysisSource, /selectedMeasurementPoint/);
});
