import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundled = await build({ stdin: { contents: "export * from './src/workspace/physicalNavigation';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const { resolvePhysicalNavigation } = api;
const objects = [{ id: 'category', name: '涵道风扇', legacyCategories: [{ id: 'old-category' }], configurations: [
  { id: 'device-a', experiments: [{ id: 'setup-a', trials: [{ id: 'trial-a', records: [{ id: 'record-a' }] }] }] },
  { id: 'device-b', experiments: [{ id: 'setup-b', trials: [{ id: 'trial-b', records: [{ id: 'record-b' }] }] }] },
] }];
const query = (patch = {}) => new URLSearchParams({ objectId: 'category', configurationId: 'device-a', experimentId: 'setup-a', trialId: 'trial-a', recordId: 'record-a', ...patch });

test('the physical browser tree contains categories and equipment, with legacy setups reachable only by their original routes', () => {
  assert.equal(typeof api.buildPhysicalTreeModel, 'function');
  const tree = api.buildPhysicalTreeModel(objects);
  assert.equal(tree[0].kind, 'category'); assert.equal(tree[0].id, 'category');
  assert.equal(tree[0].children[0].kind, 'object'); assert.equal(tree[0].children[0].id, 'device-a');
  assert.deepEqual(tree[0].children[0].children, []);
  const kinds = items => items.flatMap(n => [n.kind, ...kinds(n.children)]);
  assert.deepEqual([...new Set(kinds(tree))].sort(), ['category','object']);
  assert.equal(resolvePhysicalNavigation(objects, query()).experiment.id, 'setup-a');
  assert.equal(tree[0].children[1].id, 'device-b');
});

test('merged demo equipment retains the original category IDs for objects and parts', () => {
  const demo = {id:'demo-category-fan',name:'涵道风扇（演示）',configurations:[{id:'demo-fan-A',name:'A',experiments:[],children:[{id:'demo-rotor',name:'转子',experiments:[]}]}]};
  const items = [{...objects[0],id:'category-fan'},demo];
  const tree = api.buildPhysicalTreeModel(items);
  assert.equal(tree.length,1);
  const fan = tree[0].children.find(n=>n.id==='demo-fan-A');
  assert.equal(fan.categoryId,demo.id);
  assert.equal(fan.children[0].categoryId,demo.id);
  assert.equal(resolvePhysicalNavigation(items,new URLSearchParams({objectId:demo.id,configurationId:fan.id})).configuration.id,fan.id);
});

test('composition parts are nested by identity while internal trial containers are not presented as CFGs',()=>{
  const part={id:'rotor',name:'转子',children:[{id:'blade',name:'叶片',children:[],configurations:[],experiments:[]}],configurations:[],experiments:[]};
  const nested=[{...objects[0],configurations:[{...objects[0].configurations[0],name:'风扇',children:[part],experiments:[{id:'internal',category:'internal:cfg-trials',name:'内部容器',trials:[]}]}]}];
  const tree=api.buildPhysicalTreeModel(nested);
  assert.equal(tree[0].children[0].children[0].id,'rotor');
  assert.equal(tree[0].children[0].children[0].children[0].id,'blade');
  assert.equal(tree[0].children[0].children.some(n=>n.id==='internal'),false);
});

test('the workspace and tree resolve the full parent chain by stable IDs', () => {
  const source = resolvePhysicalNavigation(objects, query());
  assert.equal(source.missing, false);
  assert.equal(source.family.id, 'category'); assert.equal(source.configuration.id, 'device-a');
  assert.equal(source.experiment.id, 'setup-a'); assert.equal(source.trial.id, 'trial-a'); assert.equal(source.record.id, 'record-a');
});
test('conflicting explicit parents never select a different object by experiment ID', () => {
  const source = resolvePhysicalNavigation(objects, query({ configurationId: 'device-b' }));
  assert.equal(source.missing, true); assert.equal(source.configuration.id, 'device-b');
  assert.equal(source.experiment, undefined); assert.equal(source.trial, undefined); assert.equal(source.record, undefined);
});
test('a missing or empty record ID cannot fall back to an existing execution', () => {
  for (const recordId of ['', 'deleted', 'record-b']) {
    const source = resolvePhysicalNavigation(objects, query({ recordId }));
    assert.equal(source.missing, true); assert.equal(source.requestedRecordUnavailable, true); assert.equal(source.record, undefined);
  }
});
test('a trial list or trial detail does not implicitly select its first execution', () => {
  const params = query(); params.delete('recordId');
  assert.equal(resolvePhysicalNavigation(objects, params).record, undefined);
  params.delete('trialId');
  const source = resolvePhysicalNavigation(objects, params);
  assert.equal(source.missing, false); assert.equal(source.experiment.id, 'setup-a'); assert.equal(source.trial, undefined);
});
test('legacy category/device links and record-only links preserve ownership', () => {
  const params = query({ objectId: 'old-category' }); params.delete('trialId');
  assert.equal(resolvePhysicalNavigation(objects, params).trial.id, 'trial-a');
  params.set('objectId', 'device-a'); params.delete('configurationId');
  assert.equal(resolvePhysicalNavigation(objects, params).record.id, 'record-a');
  params.set('trialId', 'trial-b');
  assert.equal(resolvePhysicalNavigation(objects, params).missing, true);
});
