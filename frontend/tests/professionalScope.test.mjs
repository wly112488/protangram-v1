import assert from 'node:assert/strict';
import test from 'node:test';
import {loadWorkspace} from './helpers/workspaceTest.mjs';
const {cfgOperationScope}=await loadWorkspace("export * from './src/workspace/professionalScopeModel';");
const trial={id:'t',name:'试验',cfgId:'A',records:[{id:'r',name:'记录'}]};
const objects=[{id:'category',name:'装备',configurations:[{id:'fan',name:'风扇',experiments:[{id:'setup',name:'具体试验',trials:[trial]}]},{id:'other',name:'其他装备',experiments:[]}]}];
const base={physicalObjectId:'fan',experimentId:'setup',trialId:'t',testRecordId:'r',cfgId:'A'};
const cfg=(id,objectId='fan')=>({id,name:id,members:[{objectId,role:'tested'}]});

test('a professional operation needs a valid CFG but does not create a trial',()=>{
  const before=structuredClone(objects);
  const scope=cfgOperationScope(cfg('B'),objects);
  assert.equal(scope.cfgId,'B');assert.equal(scope.physicalObjectId,'fan');
  assert.equal(scope.trialId,undefined);assert.equal(scope.experimentId,undefined);
  assert.deepEqual(objects,before);
  assert.throws(()=>cfgOperationScope(cfg('invalid','missing'),objects),/失效/);
});
test('switching CFG cannot inherit an unrelated trial or execution',()=>{
  const original=cfgOperationScope(cfg('A'),objects,base);
  assert.equal(original.trialId,'t');assert.equal(original.testRecordId,'r');
  for(const alternative of [cfg('B'),cfg('C','other')]) {
    assert.throws(()=>cfgOperationScope(alternative,objects,base),/不匹配/);
  }
});

test('an explicitly opened legacy trial retains its identity when the user selects a CFG for the same equipment',()=>{
  const legacy=structuredClone(objects);delete legacy[0].configurations[0].experiments[0].trials[0].cfgId;
  const before=structuredClone(legacy);
  const scope=cfgOperationScope(cfg('selected'),legacy,base);
  assert.equal(scope.trialId,'t');assert.equal(scope.experimentId,'setup');assert.equal(scope.testRecordId,'r');
  assert.equal(scope.cfgId,'selected');assert.deepEqual(legacy,before);
  assert.throws(()=>cfgOperationScope(cfg('other','other'),legacy,base),/不匹配/);
});
