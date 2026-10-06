import assert from 'node:assert/strict';
import test from 'node:test';

const reportModel = await import('./reportModel.js').catch(() => ({}));

const artifact = (type, id = type) => ({
  id,
  projectId: 'project-1',
  type,
  title: `${type} result`,
  source: 'test',
  summary: `${type} summary`,
  payload: {},
  createdAt: '2026-10-06T00:00:00.000Z',
  updatedAt: '2026-10-06T00:00:00.000Z',
});

test('report selection only includes real reportable project artifacts', () => {
  assert.equal(typeof reportModel.getReportableArtifacts, 'function');
  const artifacts = [
    artifact('design'),
    artifact('analysis'),
    artifact('rootCause'),
    artifact('calibration'),
    artifact('virtualCondition'),
    artifact('report'),
  ];

  assert.deepEqual(
    reportModel.getReportableArtifacts(artifacts).map(({ type }) => type),
    ['design', 'analysis', 'rootCause', 'calibration', 'virtualCondition'],
  );
});

test('report project resolves from route state before the active project', () => {
  assert.equal(typeof reportModel.resolveReportProjectId, 'function');
  assert.equal(reportModel.resolveReportProjectId({
    routeProjectId: 'project-2',
    activeProjectId: 'project-1',
    projectIds: ['project-1', 'project-2'],
  }), 'project-2');
  assert.equal(reportModel.resolveReportProjectId({
    activeProjectId: 'missing',
    projectIds: ['project-1'],
  }), '');
});

test('report artifact input preserves the report and selected artifact references', () => {
  assert.equal(typeof reportModel.createReportArtifactInput, 'function');
  const input = reportModel.createReportArtifactInput({
    reportId: 'report-1',
    title: 'CE25A 报告',
    summary: '报告生成完成',
    reportTemplateId: 'rt-1',
    artifactIds: ['design-1', 'analysis-1'],
    tagBindings: { '{{分析结果图表}}': 'analysis-1' },
  });

  assert.equal(input.id, 'report-1');
  assert.equal(input.type, 'report');
  assert.deepEqual(input.payload.artifactIds, ['design-1', 'analysis-1']);
  assert.deepEqual(input.payload.tagBindings, { '{{分析结果图表}}': 'analysis-1' });
});
