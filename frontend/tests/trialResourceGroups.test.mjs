import assert from 'node:assert/strict';
import test from 'node:test';
import {loadWorkspace} from './helpers/workspaceTest.mjs';
const {collectTrialResourceGroups,resolveArtifactTrialScope,buildResultCatalog}=await loadWorkspace("export * from './src/workspace/sessionResourceModel';export * from './src/workspace/artifactTrialContext';export * from './src/workspace/resultCatalogModel';");
const trial=(id)=>({id,name:id,loadSpectrum:`LS-${id}`,records:[],charts:[]});
const t1=trial('t1'),t2=trial('t2');
const objects=[{id:'cat',name:'装备',configurations:[{id:'fan',name:'风扇',experiments:[{id:'setup',name:'历史试验布置',trials:[t1,t2]}]}]}];
const cfgs=[{id:'cfg',name:'气动 CFG',members:[{objectId:'fan',role:'tested'}]}];
const scope=id=>({physicalObjectId:'fan',experimentId:'setup',trialId:id});
const sessions=[{id:'s1',projectId:'p',storageProjectId:'p',businessScope:scope('t1')},{id:'s2',projectId:'p',storageProjectId:'p',businessScope:scope('t2')}];
const artifact=(id,trialId,sessionId='s1',owner={kind:'cfg',cfgId:'cfg'})=>({id,projectId:'p',type:'design',title:id,payload:{resourceOwner:owner,sourceSessionId:sessionId,sourceScope:{physicalObjectId:'fan',cfgId:'cfg',...(trialId?{experimentId:'setup',trialId}: {})},results:[{id:'r',name:id,kind:'metric',value:1}]}});

test('each project trial gets its own generic and CFG catalog, even when two trials use the same CFG',()=>{
  const a=artifact('a','t1'),b=artifact('b','t2','s2');
  const generic={...artifact('generic',undefined,'s1',{kind:'session',sessionId:'s1'}),payload:{resourceOwner:{kind:'session',sessionId:'s1'},sourceSessionId:'s1',trialContext:scope('t1'),results:[{id:'r',name:'generic',kind:'metric',value:1}]}};
  const free=artifact('cfg-only',undefined,'free');
  const projects=[{id:'p',artifacts:[a,b,generic,free]}];
  const first=collectTrialResourceGroups(projects,sessions,objects,cfgs,{projectId:'p',trialId:'t1'});
  assert.deepEqual(first.find(g=>g.id==='generic').entries.map(e=>e.artifact.id),['generic']);
  assert.deepEqual(first.find(g=>g.id==='cfg').entries.map(e=>e.artifact.id),['a']);
  const second=collectTrialResourceGroups(projects,sessions,objects,cfgs,{projectId:'p',trialId:'t2'});
  assert.deepEqual(second.flatMap(g=>g.entries.map(e=>e.artifact.id)),['b']);
});

test('results that lost a legacy trial ID can be resolved through their exact originating trial session without rewriting saved data',()=>{
  const a=artifact('lost');const before=structuredClone(a);
  const projects=[{id:'p',artifacts:[a]}];
  assert.equal(resolveArtifactTrialScope(a,sessions,objects,cfgs)?.trialId,'t1');
  const groups=collectTrialResourceGroups(projects,sessions,objects,cfgs,{projectId:'p',trialId:'t1'});
  const group=groups.find(g=>g.id==='cfg');
  assert.equal(group.entries[0].artifact,a);
  const catalog=buildResultCatalog(group.entries,group.trials);
  assert.equal(catalog[0].key,'t1');assert.equal(catalog[0].trialName,'t1');
  assert.deepEqual(a,before);
});

test('a broken explicit source, different equipment or mutable task session never gets reassigned to the current trial',()=>{
  const invalid=artifact('invalid','missing');
  assert.equal(resolveArtifactTrialScope(invalid,sessions,objects,cfgs),undefined);
  const other=artifact('other');other.payload.sourceScope.physicalObjectId='another-object';
  assert.equal(resolveArtifactTrialScope(other,sessions,objects,cfgs),undefined);
  assert.equal(resolveArtifactTrialScope(artifact('task'),sessions.map(s=>({...s,taskId:'task'})),objects,cfgs),undefined);
});
