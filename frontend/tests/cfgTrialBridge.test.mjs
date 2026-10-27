import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage = new MemoryStorage();
const api = await loadWorkspace("export * from './src/workspace/cfgTrialBridge'; export * from './src/workspace/projectStore'; export * from './src/workspace/physicalObjectStore'; export * from './src/workspace/trialConfigurationStore'; export * from './src/workspace/physicalBusinessContext'; export * from './src/workspace/physicalNavigation'; export * from './src/workspace/taskTrialWorkflow'; export * from './src/workspace/taskStore'; export * from './src/workspace/sessionStore'; export * from './src/workspace/taskTrialModel';");
const p=api.usePhysicalObjectStore, c=api.useTrialConfigurationStore, tasks=api.useTaskStore, sessions=api.useSessionStore;
beforeEach(()=>{p.setState({objects:[]});c.setState({configurations:[]});tasks.setState({tasks:[]});api.useProjectStore.setState({projects:[{id:'p',name:'项目',artifacts:[],datasets:[],trialSources:[],basicInfo:{}}]});sessions.setState({sessions:[],activeSessionId:null,saveError:null});});
function fixture(nested=false) {
  const s=p.getState(), category=s.addRoot({name:'装备',type:'风扇'});
  const fan=s.addConfiguration(category,{name:'风扇'});
  const object=nested?s.addComponent(fan,{name:'转子'}):fan;
  const cfg=c.getState().createConfiguration({name:'CFG',members:[{objectId:object,role:'tested'}]});
  return {category,fan,object,cfg};
}
test('shared CFG creates distinct trials using one compatibility container and keeps original source IDs',()=>{
  const f=fixture();
  const a=api.createTrialFromCfg(f.cfg,{name:'A'}), b=api.createTrialFromCfg(f.cfg,{name:'B'});
  assert.equal(a.cfgId,f.cfg);assert.notEqual(a.experimentId,f.cfg);assert.notEqual(a.trialId,b.trialId);assert.equal(a.experimentId,b.experimentId);
  const source=api.resolvePhysicalSource(p.getState().objects,a);
  assert.equal(source.trial.cfgId,undefined);assert.equal(source.trial.loadSpectrum,'');
  const record=p.getState().addTrialRecord(a.trialId,{});
  assert.equal(api.resolvePhysicalSource(p.getState().objects,{...a,testRecordId:record}).record.id,record);
  assert.equal(p.getState().objects[0].configurations[0].experiments.length,1);
});
test('missing and ambiguous references fail before creating a trial/container, never selecting the first member',()=>{
  const f=fixture(), second=p.getState().addConfiguration(f.category,{name:'另一台'});
  const ambiguous=c.getState().createConfiguration({name:'两台',members:[{objectId:f.object,role:'tested'},{objectId:second,role:'tested'}]});
  const before=structuredClone(p.getState().objects);
  assert.throws(()=>api.createTrialFromCfg('missing',{name:'错误'}),/不存在|失效/);
  assert.throws(()=>api.createTrialFromCfg(ambiguous,{name:'错误'}),/主被试对象/);
  assert.throws(()=>api.createTrialFromCfg(f.cfg,{name:'  '}),/名称/);
  assert.deepEqual(p.getState().objects,before);
  const selected=c.getState().createConfiguration({name:'选定主对象',members:[{objectId:f.object,role:'tested'},{objectId:second,role:'tested'}],primaryObjectId:second});
  assert.equal(api.createTrialFromCfg(selected,{name:'正确'}).physicalObjectId,second);
  p.setState({objects:[]});
  assert.throws(()=>api.createTrialFromCfg(f.cfg,{name:'失效'}),/失效/);
});
test('nested primary equipment works through record writes, source navigation and task projections',()=>{
  const f=fixture(true);
  const taskId=tasks.getState().createTask({title:'任务',projectId:'p',requirementTexts:[]});
  const source=api.createTrialFromCfg(f.cfg,{name:'部件试验',taskBookId:taskId});
  const recordId=p.getState().addTrialRecord(source.trialId,{});
  assert.equal(source.physicalObjectId,f.object);
  const nav=api.resolvePhysicalNavigation(p.getState().objects,new URLSearchParams({objectId:f.category,configurationId:f.object,experimentId:source.experimentId,trialId:source.trialId,recordId}));
  assert.equal(nav.record.id,recordId);
  assert.equal(api.getTaskTrials(p.getState().objects,[],[],taskId)[0].trial.id,source.trialId);
});
test('legacy trials remain unchanged and task draft confirmation propagates CFG once without requiring spectrum',()=>{
  const f=fixture(), s=p.getState();
  const experiment=s.addExperiment(f.object,{name:'旧构型',parameters:[]});
  const old=s.addConcreteTrial(experiment,{name:'历史',loadSpectrum:'旧谱'});
  const snapshot=structuredClone(api.resolvePhysicalSource(p.getState().objects,{physicalObjectId:f.object,experimentId:experiment,trialId:old}).trial);
  const taskId=tasks.getState().createTask({title:'正式任务',projectId:'p',requirementTexts:[]});
  tasks.getState().setAnalysisPlan(taskId,[],[{id:'draft',name:'任务试验',loadSpectrum:'',requirementIds:[]}]);
  const values={name:'任务试验',cfgId:f.cfg};
  const session=api.confirmTaskTrialDraft(taskId,'draft',values);
  assert.equal(api.confirmTaskTrialDraft(taskId,'draft',values),session);
  const scope=sessions.getState().sessions.find(item=>item.id===session).businessScope;
  assert.equal(scope.cfgId,f.cfg);
  assert.equal(api.resolvePhysicalSource(p.getState().objects,scope).trial.cfgId,undefined);
  assert.equal(api.resolvePhysicalSource(p.getState().objects,{physicalObjectId:f.object,experimentId:experiment,trialId:old}).trial.cfgId,undefined);
  assert.deepEqual(api.resolvePhysicalSource(p.getState().objects,{physicalObjectId:f.object,experimentId:experiment,trialId:old}).trial,snapshot);
});
