import assert from 'node:assert/strict';
import test from 'node:test';
import { buildProjectTree, resolveProjectSelection } from '../src/workbench/projectTreeModel.ts';

const experiments = [
  {
    id: 'exp-1',
    name: '项目一',
    designSummary: { runCount: 8 },
    worksheetData: { '1-C1': 'Run' },
    extraItems: ['根因分析'],
  },
  {
    id: 'exp-2',
    name: '项目二',
    designSummary: null,
    worksheetData: {},
    extraItems: [],
  },
];

test('buildProjectTree exposes only content that already exists', () => {
  const tree = buildProjectTree(experiments);

  assert.equal(tree.length, 2);
  assert.deepEqual(tree[0].children?.map((item) => item.title), [
    '项目概览',
    '试验工作表',
    '设计摘要',
    '根因分析',
  ]);
  assert.deepEqual(tree[1].children?.map((item) => item.title), ['项目概览']);
});

test('resolveProjectSelection maps project and child keys to the correct view', () => {
  assert.deepEqual(resolveProjectSelection(experiments, 'exp-1'), {
    experimentId: 'exp-1',
    view: 'overview',
  });
  assert.deepEqual(resolveProjectSelection(experiments, 'exp-1-worksheet'), {
    experimentId: 'exp-1',
    view: 'worksheet',
  });
  assert.deepEqual(resolveProjectSelection(experiments, 'exp-1-summary'), {
    experimentId: 'exp-1',
    view: 'summary',
  });
  assert.deepEqual(resolveProjectSelection(experiments, 'exp-1-extra-0'), {
    experimentId: 'exp-1',
    view: 'extra',
    extraIndex: 0,
  });
});

test('resolveProjectSelection returns no project for an unknown key', () => {
  assert.deepEqual(resolveProjectSelection(experiments, 'missing'), {
    experimentId: null,
    view: 'overview',
  });
});
