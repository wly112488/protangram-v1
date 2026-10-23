import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage=new MemoryStorage();
const api=await loadWorkspace("export * from './src/workspace/trialSettingsModel'; export * from './src/workspace/physicalObjectStore';");

test('manual SET updates and field arrays are independent; missing ID fails without mutation',()=>{
  const fields=[{id:'field',name:'轴向位置',value:'0',unit:'D',form:'单值'}];
  const a=api.createTrialSetting('s1','0D',fields), b=api.createTrialSetting('s2','0.25D',fields);
  fields[0].value='99';
  const next=api.replaceTrialSetting([a,b],'s1',{name:'0D 修改',fields:[{...a.fields[0],value:'10'}]});
  assert.equal(next[0].fields[0].value,'10');assert.equal(next[1].fields[0].value,'0');assert.equal(a.fields[0].value,'0');
  assert.throws(()=>api.replaceTrialSetting([a,b],'missing',{name:'错误'}),/不存在/);
});
test('trial SETs persist independently of other trials and preserve original records',async()=>{
  const p=api.usePhysicalObjectStore; p.setState({objects:[]}); const s=p.getState();
  const category=s.addRoot({name:'风扇',type:'风扇'}), object=s.addConfiguration(category,{name:'A'});
  const experiment=s.addExperiment(object,{name:'旧布置',parameters:[]});
  const first=s.addConcreteTrial(experiment,{name:'第一项',loadSpectrum:''}), second=s.addConcreteTrial(experiment,{name:'第二项',loadSpectrum:''});
  s.addTrialRecord(first,{});
  const trial=id=>p.getState().objects[0].configurations[0].experiments[0].trials.find(t=>t.id===id);
  const records=structuredClone(trial(first).records);
  const ids=['0D','0.25D','0.5D','0.75D'].map(name=>s.addTrialSetting(first,{name,fields:[]}));
  s.updateTrialSetting(first,ids[0],{name:'0D 修改'});
  assert.deepEqual(trial(first).settings.map(s=>s.name),['0D 修改','0.25D','0.5D','0.75D']);
  assert.equal(trial(second).settings,undefined);assert.deepEqual(trial(first).records,records);
  assert.throws(()=>s.updateTrialSetting(second,ids[0],{name:'跨试验'}),/不存在/);
  assert.throws(()=>s.addTrialSetting('missing',{name:'错误',fields:[]}),/不存在/);
  await p.persist.rehydrate();assert.equal(trial(first).settings.length,4);
});
