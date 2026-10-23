import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const api=await loadWorkspace("export * from './src/workspace/sessionResourceModel';");
const metric=(id,owner,sessionId)=>({id,projectId:'p',type:'analysis',title:id,payload:{resourceOwner:owner,sourceSessionId:sessionId,results:[{id:'r',kind:'metric',name:id,value:1}]}});

test('generic resources stay within the originating session, including shared project storage',()=>{
  const a=metric('a',{kind:'session',sessionId:'s1'},'s1');
  const b=metric('b',{kind:'session',sessionId:'s2'},'s2');
  const projects=[{id:'p',artifacts:[a,b]}];
  const session={id:'s1',storageProjectId:'p',resourceRefs:[],cfgIds:[]};
  const groups=api.collectSessionResourceGroups(projects,[session],[],[],session.id);
  assert.deepEqual(groups.map(g=>g.id),['generic']);
  assert.deepEqual(groups[0].entries.map(e=>e.artifact.id),['a']);
});

test('CFG resources are independent of models and available in every explicitly linked session',()=>{
  const cfg={id:'cfg-A',name:'气动构型',members:[]};
  const chart=metric('csv-chart',{kind:'cfg',cfgId:cfg.id},'s1');
  const generic=metric('generic',{kind:'session',sessionId:'s1'},'s1');
  const projects=[{id:'p',artifacts:[chart,generic]}];
  const sessions=[{id:'s1',storageProjectId:'p',cfgIds:[cfg.id]},{id:'s2',storageProjectId:'p',cfgIds:[cfg.id]}];
  const groups=api.collectSessionResourceGroups(projects,sessions,[],[cfg],'s2');
  assert.deepEqual(groups.map(g=>g.id),['generic',cfg.id]);
  assert.deepEqual(groups[0].entries,[]);
  assert.equal(groups[1].entries[0].artifact,chart);
  assert.equal(chart.payload.model,undefined);
  assert.equal(api.collectSessionResourceGroups(projects,sessions,[],[cfg],'missing').length,0);
});

test('file-only imports are listed once and keep their original identity; invalid CFG links remain visible',()=>{
  const file={id:'file-a',name:'a.csv',headers:['x'],rowCount:1};
  const artifact={...metric('import',{kind:'cfg',cfgId:'deleted'},'s'),payload:{resourceOwner:{kind:'cfg',cfgId:'deleted'},dataFile:file,results:[]}};
  const session={id:'s',storageProjectId:'p',cfgIds:['deleted']};
  const groups=api.collectSessionResourceGroups([{id:'p',artifacts:[artifact]}],[session],[],[],'s');
  assert.equal(groups[1].id,'deleted');
  assert.equal(groups[1].missing,true);
  assert.deepEqual(groups[1].files,[file]);
});

test('legacy predictions in a session space retain all selected CFGs without rewriting old artifacts',()=>{
  const artifact={...metric('old'),payload:{sourceScope:{cfgId:'B',trialId:'trial-A'},modelPlan:{cfgId:'B'},results:[{id:'r',kind:'metric',name:'旧预测',value:1}]}};
  const session={id:'old-session',storageProjectId:'p',businessScope:{cfgId:'A',trialId:'trial-A'}};
  const projects=[{id:'p',sessionOwnerId:session.id,artifacts:[artifact]}];
  const before=structuredClone(artifact);
  const view=api.collectSessionResourceGroups(projects,[session],[],[{id:'A',name:'A'},{id:'B',name:'B'}],session.id);
  assert.deepEqual(view.map(group=>group.id),['generic','A','B']);
  assert.equal(view[2].entries[0].artifact,artifact);
  assert.deepEqual(artifact,before);
});
