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
  const functionBarSource = readFileSync(new URL('../src/workbench/FunctionBar.tsx', import.meta.url), 'utf8');
  const headerSource = readFileSync(new URL('../src/workspace/WorkspaceHeader.tsx', import.meta.url), 'utf8');

  assert.match(functionBarSource, /onSectionSelect\?:/);
  assert.match(functionBarSource, /onSectionSelect\?\.\(item\.key\)/);
  assert.match(headerSource, /selectedSection/);
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
        testObject: '发动机',
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
