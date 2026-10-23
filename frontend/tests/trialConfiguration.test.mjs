import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage = new MemoryStorage();
const { validateTrialConfiguration: validate, useTrialConfigurationStore: cfg, usePhysicalObjectStore: physical } = await loadWorkspace("export * from './src/workspace/trialConfigurationModel'; export * from './src/workspace/trialConfigurationStore'; export * from './src/workspace/physicalObjectStore';");

test('CFG supports cross-equipment members, optional companions and independent roles', () => {
  const input = { id:'cfg-1', name:'气动试验构型', members:[{ objectId:'fan', role:'tested' }, { objectId:'rig', role:'rig' }] };
  const ids = new Set(['fan','rig']);
  assert.deepEqual(validate(input, ids), []);
  assert.deepEqual(validate({ ...input, members:[{ objectId:'missing', role:'tested' }] }, ids), ['装备引用已失效：missing']);
  assert.ok(validate({ ...input, members:[] }, ids).includes('至少选择一项被试装备'));
  assert.deepEqual(validate({ ...input, members:[{ objectId:'fan', role:'tested' }, { objectId:'fan', role:'support' }] }, ids), []);
  assert.ok(validate({ ...input, members:[input.members[0], input.members[0]] }, ids).includes('同一装备不可重复添加相同角色'));
  assert.ok(validate({ ...input, members:[{ objectId:'fan', role:'unsupported' }] }, ids).length);
});

test('user categories validate names and IDs, preserve members and persist on reload', async () => {
  cfg.setState({ categories: [], configurations: [] });
  const s = physical.getState();
  const category = s.addRoot({ name:'分类测试装备',type:'装备' });
  const fan = s.addConfiguration(category,{name:'同名装备'});
  const id = cfg.getState().createConfiguration({name:'分类测试 CFG',members:[{objectId:fan,role:'tested'}]});
  const before = structuredClone(cfg.getState().getConfiguration(id));
  const aero = cfg.getState().createCategory(' 气动试验 ');
  const structural = cfg.getState().createCategory('结构试验');
  assert.equal(cfg.getState().categories[0].name,'气动试验');
  for (const name of ['', ' ', '气动试验', '未分类']) assert.throws(()=>cfg.getState().createCategory(name));
  cfg.getState().setConfigurationCategory(id,aero);
  cfg.getState().renameCategory(aero,'气动验收');
  assert.throws(()=>cfg.getState().renameCategory(aero,'结构试验'),/已存在/);
  assert.throws(()=>cfg.getState().renameCategory(aero,' '));
  assert.throws(()=>cfg.getState().renameCategory('missing','测试'),/不存在/);
  assert.throws(()=>cfg.getState().setConfigurationCategory('missing',aero),/不存在/);
  assert.throws(()=>cfg.getState().setConfigurationCategory(id,'missing'),/不存在/);
  assert.throws(()=>cfg.getState().createConfiguration({name:'错误分类',categoryId:'missing',members:before.members}),/不存在/);
  assert.deepEqual(cfg.getState().getConfiguration(id),{...before,categoryId:aero});
  const saved = localStorage.getItem('protangram-trial-configurations-v1');
  cfg.setState({categories:[],configurations:[]});
  localStorage.setItem('protangram-trial-configurations-v1',saved);
  await cfg.persist.rehydrate();
  assert.deepEqual(cfg.getState().categories,[{id:aero,name:'气动验收'},{id:structural,name:'结构试验'}]);
  assert.equal(cfg.getState().getConfiguration(id).categoryId,aero);
  cfg.getState().setConfigurationCategory(id);
  assert.deepEqual(cfg.getState().getConfiguration(id),{...before,categoryId:undefined});
});

test('legacy CFG storage hydrates without categories and retains stable references', async () => {
  const legacy = {id:'legacy-cfg',name:'旧构型',members:[{objectId:'legacy-equipment',role:'tested'}]};
  cfg.setState({categories:[],configurations:[]});
  localStorage.setItem('protangram-trial-configurations-v1',JSON.stringify({version:1,state:{configurations:[legacy]}}));
  await cfg.persist.rehydrate();
  assert.deepEqual(cfg.getState().categories,[]);
  assert.deepEqual(cfg.getState().getConfiguration(legacy.id),legacy);
});

test('CFG create/get/reload preserves equipment and legacy storage, invalid members cause no writes', async () => {
  physical.setState({ objects: [] }); cfg.setState({ configurations: [] });
  const s = physical.getState();
  const category = s.addRoot({ name:'装备', type:'装备' });
  const fan = s.addConfiguration(category, { name:'风扇' });
  const rotor = s.addComponent(fan, { name:'转子' });
  const before = localStorage.getItem('protangram-physical-objects-v1');
  const input = { name:'转子试验', members:[{ objectId:rotor, role:'tested' }, { objectId:fan, role:'rig' }] };
  const id = cfg.getState().createConfiguration(input);
  assert.equal(cfg.getState().getConfiguration(id).members[0].objectId, rotor);
  input.members[0].objectId = 'mutated';
  assert.equal(cfg.getState().getConfiguration(id).members[0].objectId, rotor);
  assert.equal(localStorage.getItem('protangram-physical-objects-v1'), before);
  assert.equal(physical.getState().objects[0].configurations[0].experiments.length, 0);
  const saved = localStorage.getItem('protangram-trial-configurations-v1');
  assert.throws(() => cfg.getState().createConfiguration({ name:'错误', members:[{ objectId:'missing', role:'tested' }] }), /失效/);
  assert.equal(localStorage.getItem('protangram-trial-configurations-v1'), saved);
  cfg.setState({ configurations:[] }); localStorage.setItem('protangram-trial-configurations-v1', saved);
  await cfg.persist.rehydrate();
  assert.equal(cfg.getState().getConfiguration(id).members[0].objectId, rotor);
});
