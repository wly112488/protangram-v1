import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage = new MemoryStorage();
const api = await loadWorkspace(`export * from './src/workspace/projectNavigationModel';export * from './src/workspace/cfgTrialBridge';export * from './src/workspace/physicalObjectStore';export * from './src/workspace/projectStore';export * from './src/workspace/sessionStore';export * from './src/workspace/taskStore';export * from './src/workspace/trialConfigurationStore';export * from './src/workspace/sessionResourceStore';export * from './src/workspace/sessionResourceModel';export * from './src/workspace/sessionTrialAssociationModel';export * from './src/workspace/professionalContext';export * from './src/workspace/sharedResourcesModel';`);
const p=api.usePhysicalObjectStore,j=api.useProjectStore,s=api.useSessionStore,t=api.useTaskStore,c=api.useTrialConfigurationStore;
beforeEach(()=>{localStorage.values.clear();p.setState({objects:[]});j.setState({projects:[],activeProjectId:null});s.setState({sessions:[],activeSessionId:null,saveError:null});t.setState({tasks:[]});c.setState({configurations:[],categories:[]});});
function setup(){
 const category=p.getState().addRoot({name:'涵道风扇',type:'涵道风扇'}),fan=p.getState().addConfiguration(category,{name:'风扇甲'});
 const project=j.getState().createProject({name:'同层级的长名称项目'});
 const a=api.createTrialForEquipment(fan,{name:'试验甲'}),b=api.createTrialForEquipment(fan,{name:'试验乙'});
 const sessionA=s.getState().ensureProjectSession(project,a),sessionB=s.getState().ensureProjectSession(project,b);
 const cfg=c.getState().createConfiguration({name:'共用构型',members:[{objectId:fan,role:'tested'}]});
 return {project,a,b,sessionA,sessionB,cfg};
}
const state=()=>[j.getState().projects,s.getState().sessions,p.getState().objects,c.getState().configurations];
const entries=groups=>groups.flatMap(group=>group.entries).flatMap(entry=>entry.artifact?[entry.artifact.id]:[]);
function save(sessionId,scope,cfg,title){return api.saveOwnedArtifact(sessionId,{kind:'cfg',cfgId:cfg},{type:'analysis',title,source:'数字孪生',summary:'模拟结果',payload:{sourceScope:{...scope,cfgId:cfg},execution:{id:title,cfgId:cfg,trialId:scope?.trialId},results:[{id:title,name:title,kind:'metric',value:1}]}});}

test('project tree projects real ownership into three levels with parallel groups, independent of name length',()=>{
 const f=setup();const short=j.getState().createProject({name:'11'});
 const task=t.getState().createTask({title:'任务书甲',projectId:f.project,requirementTexts:[]});
 const draft=s.getState().createSession({title:'草稿',projectId:f.project,creationSource:'project'});
 const independent=s.getState().createSession({title:'独立探索'});
 const before=JSON.stringify(state());const tree=api.buildProjectNavigation(j.getState().projects,s.getState().sessions,p.getState().objects,t.getState().tasks);
 assert.deepEqual(tree.map(node=>node.projectId),[f.project,short]);
 for(const root of tree){assert.equal(root.kind,'project');assert.deepEqual(root.children.map(node=>node.kind),['trials','analysis']);}
 assert.equal(tree[0].count,2);assert.equal(tree[1].count,0);
 assert.deepEqual(new Set(tree[0].children[0].children.map(node=>node.targetId)),new Set([f.a.trialId,f.b.trialId,draft]));
 assert.deepEqual(tree[0].children[1].children.map(node=>node.targetId),[task]);assert.ok(!JSON.stringify(tree).includes(independent));
 assert.equal(JSON.stringify(state()),before);
});

test('same CFG across two tasks isolates workspace results and professional inputs while preserving multiple feature runs',()=>{
 const f=setup();const runA=save(f.sessionA,f.a,f.cfg,'甲-孪生'),runB=save(f.sessionB,f.b,f.cfg,'乙-孪生');
 const second=save(f.sessionA,f.a,f.cfg,'甲-虚拟工况');
 const workspace=api.collectWorkspaceResourceGroups(...state(),f.sessionA);
 assert.deepEqual(new Set(entries(workspace)),new Set([runA.id,second.id]));assert.ok(!entries(workspace).includes(runB.id));
 const context=api.getProfessionalSources(p.getState().objects,j.getState().projects,s.getState().sessions,{...f.a,cfgId:f.cfg,sessionId:f.sessionA},c.getState().configurations);
 assert.deepEqual(new Set(context.results.flatMap(entry=>entry.artifact?[entry.artifact.id]:[])),new Set([runA.id,second.id]));
 const draft=s.getState().createSession({title:'未关联探索'});s.getState().linkConfiguration(draft,f.cfg);
 const own=save(draft,{},f.cfg,'探索成果');
 assert.deepEqual(entries(api.collectWorkspaceResourceGroups(...state(),draft)),[own.id]);
 assert.deepEqual(new Set(entries(api.collectWorkspaceResourceGroups(...state(),f.sessionB))),new Set([runB.id]));
 assert.equal(j.getState().projects.flatMap(project=>project.artifacts).length,4);
});

test('session and artifact result links return to the originating task session',()=>{
 const f=setup();const artifact=save(f.sessionA,f.a,f.cfg,'甲成果');const session=s.getState().sessions.find(item=>item.id===f.sessionA);
 assert.equal(api.sessionResourcesPath(session,j.getState().projects),`/sessions/${session.id}/resources`);
 assert.equal(api.artifactResourcesPath(artifact,j.getState().projects,s.getState().sessions),`/sessions/${session.id}/resources`);
});
