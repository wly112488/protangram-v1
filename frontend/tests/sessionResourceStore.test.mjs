import assert from 'node:assert/strict';
import test from 'node:test';
import {loadWorkspace,MemoryStorage} from './helpers/workspaceTest.mjs';
globalThis.localStorage=new MemoryStorage();
const {saveOwnedArtifact:save,useSessionStore:s,useProjectStore:p,usePhysicalObjectStore:e,useTrialConfigurationStore:c,collectSessionResourceGroups:groups}=await loadWorkspace("export * from './src/workspace/sessionResourceStore';export * from './src/workspace/sessionResourceModel';export * from './src/workspace/sessionStore';export * from './src/workspace/projectStore';export * from './src/workspace/physicalObjectStore';export * from './src/workspace/trialConfigurationStore';");
const input=id=>({id,type:'analysis',title:id,source:'test',summary:'',payload:{results:[{id:'r',name:id,kind:'metric',value:1}]}});

test('ownership and stable session references persist; a shared project never leaks generic results',()=>{
  const a=s.getState().createSession({title:'A'}),b=s.getState().createSession({title:'B'});
  const storage=s.getState().sessions.find(item=>item.id===a).storageProjectId;
  s.setState({sessions:s.getState().sessions.map(item=>item.id===b?{...item,storageProjectId:storage}:item)});
  const category=e.getState().addRoot({name:'装备',type:'装备'});
  const object=e.getState().addConfiguration(category,{name:'风扇'});
  const cfg=c.getState().createConfiguration({name:'气动构型',members:[{objectId:object,role:'tested'}]});
  save(a,{kind:'session',sessionId:a},input('generic-a'));
  const owner={kind:'cfg',cfgId:cfg};
  const result=save(a,owner,input('cfg-chart'));owner.cfgId='changed';
  assert.equal(result.payload.resourceOwner.cfgId,cfg);
  s.getState().linkConfiguration(b,cfg);
  s.getState().reloadFromStorage();
  assert.equal(s.getState().sessions.find(item=>item.id===a).resourceRefs.length,2);
  const view=groups(p.getState().projects,s.getState().sessions,e.getState().objects,c.getState().configurations,b);
  assert.equal(view[0].entries.length,0);
  assert.equal(view.find(item=>item.id===cfg).entries[0].artifact.id,'cfg-chart');
  assert.throws(()=>save(a,{kind:'session',sessionId:b},input('wrong')),/其他会话/);
  assert.throws(()=>save(a,{kind:'cfg',cfgId:'deleted'},input('wrong')),/失效/);
});

test('failed archive and storage quota errors do not leave new resources or session references',()=>{
  const id=s.getState().createSession({title:'失败重试'});
  const beforeProjects=structuredClone(p.getState().projects);
  const beforeSessions=structuredClone(s.getState().sessions);
  const original=p.getState().addArtifact;
  p.setState({addArtifact:()=>null});
  assert.throws(()=>save(id,{kind:'session',sessionId:id},input('failure')),/未保存/);
  p.setState({addArtifact:original});
  assert.deepEqual(s.getState().sessions,beforeSessions);
  const setItem=localStorage.setItem;
  localStorage.setItem=()=>{throw new Error('quota exceeded');};
  assert.throws(()=>save(id,{kind:'session',sessionId:id},input('quota')),/quota|保存失败/);
  assert.deepEqual(p.getState().projects,beforeProjects);
  assert.deepEqual(s.getState().sessions,beforeSessions);
  localStorage.setItem=setItem;
  const saved=save(id,{kind:'session',sessionId:id},input('retry'));
  assert.equal(saved.id,'retry');
  assert.equal(s.getState().sessions.find(item=>item.id===id).resourceRefs.length,1);
});

test('updating a referenced CFG resource preserves one identity and cannot change its owner',()=>{
  const existing=p.getState().projects.flatMap(project=>project.artifacts).find(artifact=>artifact.id==='cfg-chart');
  const session=s.getState().createSession({title:'引用已有成果'});
  const owner=existing.payload.resourceOwner;
  const updated=save(session,owner,{...input(existing.id),summary:'更新摘要'});
  assert.equal(updated.projectId,existing.projectId);
  assert.equal(p.getState().projects.flatMap(project=>project.artifacts).filter(artifact=>artifact.id===existing.id).length,1);
  assert.equal(s.getState().sessions.find(item=>item.id===session).resourceRefs[0].projectId,existing.projectId);
  assert.throws(()=>save(session,{kind:'session',sessionId:session},input(existing.id)),/已有归属/);
  assert.deepEqual(p.getState().projects.flatMap(project=>project.artifacts).find(artifact=>artifact.id===existing.id).payload.resourceOwner,owner);
});
