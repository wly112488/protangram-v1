import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const { listCfgCategoryGroups: group } = await loadWorkspace("export * from './src/workspace/cfgCategoryModel';");

test('CFG categories are explicit; legacy and stale assignments stay unclassified', () => {
  const categories = [{id:'aero',name:'气动试验'}, {id:'empty',name:'空分类'}];
  const cfgs = [{id:'cfg-1',categoryId:'aero',members:[]}, {id:'cfg-2',members:[]}, {id:'cfg-3',categoryId:'missing',members:[]}];
  const before = structuredClone({categories,cfgs});
  assert.deepEqual(group(categories,cfgs), [
    {id:'aero',name:'气动试验',cfgIds:['cfg-1']},
    {id:'empty',name:'空分类',cfgIds:[]},
    {id:'unclassified',name:'未分类',cfgIds:['cfg-2','cfg-3']},
  ]);
  assert.deepEqual({categories,cfgs}, before);
});
