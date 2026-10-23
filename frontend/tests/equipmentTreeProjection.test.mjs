import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const { getEquipmentCategoryViews: project } = await loadWorkspace("export * from './src/workspace/equipmentTreeProjection';");

test('only the known demo category joins the official fan view, in either order', () => {
  const regular = { id:'category-fan', name:'涵道风扇', configurations:[{id:'real-fan'}] };
  const demo = { id:'demo-category-fan', name:'涵道风扇（演示）', configurations:[{id:'demo-fan-A'}, {id:'demo-fan-B'}] };
  const custom = { id:'user-demo', name:demo.name, configurations:[{id:'custom'}] };
  for (const items of [[regular,demo,custom], [demo,custom,regular]]) {
    const before = structuredClone(items);
    const views = project(items);
    assert.deepEqual(views.find(v=>v.id===regular.id).configurations.map(v=>v.id), ['real-fan','demo-fan-A','demo-fan-B']);
    assert.deepEqual(views.find(v=>v.id===regular.id).sourceCategoryIds, [regular.id,demo.id]);
    assert.equal(views.some(v=>v.id===custom.id), true);
    assert.equal(views.some(v=>v.id===demo.id), false);
    assert.deepEqual(items, before);
  }
});

test('missing demo or official category and user names stay visible without guessing', () => {
  const demo = { id:'demo-category-fan', name:'涵道风扇（演示）', configurations:[] };
  const user = { id:'custom-fan', name:'涵道风扇', configurations:[] };
  assert.equal(project([user,demo]).length, 2);
  assert.deepEqual(project([]), []);
  assert.equal(project([demo])[0].id, demo.id);
  assert.equal(project([{...demo,name:'用户重命名'}, {id:'category-fan',name:'涵道风扇',configurations:[]}]).length, 2);
});
