import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('CSV import and analysis live in the current analysis workspace, not the physical object tree', () => {
  const analysis = source('../src/pages/analysis/projects/AnalysisProjects.tsx');
  const csvWorkspace = source('../src/workspace/TrialCsvAnalysis.tsx');
  const objects = source('../src/workspace/PhysicalObjectsPage.tsx');

  assert.match(analysis, /<TrialCsvAnalysis/);
  assert.match(csvWorkspace, /导入 CSV/);
  assert.doesNotMatch(objects, /<Upload/);
  assert.match(objects, /数据分析.*功能中统一导入/);
});

test('session shared results render trial data in place instead of redirecting into object navigation', () => {
  const content = source('../src/workspace/ProjectContent.tsx');
  const session = source('../src/workspace/SessionWorkbench.tsx');

  assert.match(content, /collectSharedResources/);
  assert.match(content, /sessionViewId \?\? routeSessionId/);
  assert.doesNotMatch(content, /<Navigate/);
  assert.match(session, /sessionResourcesPath\(session, projects\)/);
  assert.doesNotMatch(content, /Navigate to=\{physicalPath\}/);
  assert.doesNotMatch(session, /navigate\(sourcePath/);
});
