import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage = new MemoryStorage();
const api = await loadWorkspace("export * from './src/workspace/physicalObjectStore';export * from './src/workspace/physicalBusinessContext';export * from './src/workspace/projectStore';export * from './src/workspace/sessionStore';export * from './src/workspace/taskStore';export * from './src/workspace/taskTrialWorkflow';export * from './src/workspace/taskAnalysisModel';export * from './src/workspace/demoData';export * from './src/workspace/cfgTrialBridge';export * from './src/workspace/trialConfigurationStore';export * from './src/workspace/professionalScopeModel';export * from './src/workspace/sessionResourceStore';export * from './src/workspace/sessionResourceModel';export * from './src/workspace/projectTrialModel';export * from './src/workspace/equipmentCompositionModel';export * from './src/workspace/sessionTrialAssociationModel';export * from './src/workspace/artifactTrialContext';");
const p=api.usePhysicalObjectStore,j=api.useProjectStore,s=api.useSessionStore,t=api.useTaskStore,c=api.useTrialConfigurationStore;
beforeEach(()=>{localStorage.values.clear();p.setState({objects:[]});j.setState({projects:[],activeProjectId:null});s.setState({sessions:[],activeSessionId:null,saveError:null});t.setState({tasks:[]});c.setState({configurations:[],categories:[]});});
const devices=()=>api.flattenEquipment(p.getState().objects);
function fixture(){const category=p.getState().addRoot({name:'涵道风扇',type:'涵道风扇'});const fan=p.getState().addConfiguration(category,{name:'风扇甲'});const other=p.getState().addConfiguration(category,{name:'风扇乙'});const project=j.getState().createProject({name:'正式项目'});return {category,fan,other,project};}

test('LAN HTTP without randomUUID can create projects, sessions, CFG categories/combinations and confirmed task trials',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');
 Object.defineProperty(globalThis,'crypto',{configurable:true,value:undefined});
 try {
  const f=fixture();const categoryId=c.getState().createCategory('用户分类');
  const cfgId=c.getState().createConfiguration({name:'用户构型',categoryId,primaryObjectId:f.fan,members:[{objectId:f.fan,role:'tested'}]});
  const work=s.getState().createSession({title:'独立探索'});
  const preview=api.createTaskAnalysisPreview('任务.txt','试验名称：候选试验\n物理对象：风扇甲',p.getState().objects);
  const taskId=t.getState().createTask({title:'任务书',projectId:f.project,requirementTexts:[]});t.getState().setAnalysisPlan(taskId,preview.requirements,preview.trialDrafts);
  const confirmed=api.confirmTaskTrialDraft(taskId,preview.trialDrafts[0].id,{name:'确认试验',physicalObjectId:f.fan});
  assert.notEqual(work,confirmed);assert.equal(c.getState().getConfiguration(cfgId).categoryId,categoryId);
  assert.equal(new Set([f.project,f.category,f.fan,f.other,categoryId,cfgId,work,taskId,confirmed]).size,9);
  assert.ok(s.getState().sessions.find(item=>item.id===confirmed).businessScope.trialId);
 } finally { if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto; }
});

test('project work starts as a draft; confirming a trial binds the same session and preserves inputs, resources and project ownership',()=>{
 const f=fixture();const id=s.getState().createSession({title:'项目内新试验',projectId:f.project,creationSource:'project'});
 const before=s.getState().sessions.find(item=>item.id===id);const storageId=before.storageProjectId;
 s.getState().updateDraft(id,'digitalTwin','modelInputs',{speed:4321,mesh:'已填网格'});
 assert.equal(before.businessScope,undefined);assert.equal(devices().flatMap(item=>item.equipment.experiments.flatMap(x=>x.trials)).length,0);
 assert.deepEqual(api.getProjectTrialDraftSessions(f.project,s.getState().sessions).map(item=>item.id),[id]);
 const old=api.saveOwnedArtifact(id,{kind:'session',sessionId:id},{type:'analysis',title:'关联前成果',source:'通用工具',summary:'已有数据',payload:{marker:'retained',dataFile:{id:'before-trial-csv',name:'原始输入.csv',status:'available',headers:['rpm'],rowCount:1}}});
 const legacy=j.getState().addArtifact(storageId,{type:'analysis',title:'历史未关联成果',source:'通用工具',summary:'原有数据',payload:{sourceSessionId:id,marker:'legacy'}});
 const scope=api.createTrialForEquipment(f.fan,{name:'用户确认的试验'});
 s.getState().bindTrialToSession(id,scope,f.project);
 const linked=s.getState().sessions.find(item=>item.id===id);
 assert.equal(s.getState().sessions.length,1);assert.equal(linked.storageProjectId,storageId);assert.equal(linked.projectId,f.project);assert.equal(linked.businessScope.trialId,scope.trialId);assert.equal(linked.businessScope.cfgId,undefined);
 assert.deepEqual(linked.drafts.digitalTwin.modelInputs,{speed:4321,mesh:'已填网格'});assert.equal(api.getProjectTrialDraftSessions(f.project,s.getState().sessions).length,0);
 assert.equal(api.getProjectTrialEntries(f.project,p.getState().objects,j.getState().projects,s.getState().sessions)[0].trial.id,scope.trialId);
 assert.equal(s.getState().ensureProjectSession(f.project,scope),id);assert.equal(s.getState().sessions.length,1);
 const artifacts=j.getState().projects.flatMap(project=>project.artifacts);
 for(const item of [old,legacy]){const retained=artifacts.find(artifact=>artifact.id===item.id);assert.equal(retained.payload.marker,item.payload.marker);assert.equal(api.resolveArtifactTrialScope(retained,s.getState().sessions,p.getState().objects,[]),undefined);assert.equal(retained.payload.trialContext,null);}
 const fresh=api.saveOwnedArtifact(id,{kind:'session',sessionId:id},{type:'analysis',title:'关联后成果',source:'数据分析',summary:'新的运行',payload:{sourceScope:scope}});
 assert.equal(fresh.payload.trialContext.trialId,scope.trialId);
 const workspace=api.collectWorkspaceResourceGroups(j.getState().projects,s.getState().sessions,p.getState().objects,[],id);
 assert.ok(workspace.flatMap(group=>group.files).some(file=>file.id==='before-trial-csv'));
 assert.ok(!api.collectTrialResourceGroups(j.getState().projects,s.getState().sessions,p.getState().objects,[],{trialId:scope.trialId}).flatMap(group=>group.entries).some(entry=>entry.artifact?.id===old.id));
 const earlierRun=api.saveOwnedArtifact(id,{kind:'session',sessionId:id},{type:'analysis',title:'关联前运行、关联后保存',source:'数字孪生',summary:'按实际运行来源保存',payload:{sourceScope:{physicalObjectId:f.fan,trialId:undefined},execution:{id:'earlier-run',inputs:{speed:1111}}}});
 assert.equal(earlierRun.payload.trialContext,null);assert.equal(api.resolveArtifactTrialScope(earlierRun,s.getState().sessions,p.getState().objects,[]),undefined);
 const other=api.createTrialForEquipment(f.other,{name:'其他试验'});assert.throws(()=>s.getState().bindTrialToSession(id,other),/已关联其他具体试验/);
 s.getState().reloadFromStorage();assert.equal(s.getState().sessions.find(item=>item.id===id).businessScope.trialId,scope.trialId);
});

test('trial association rejects another project and invalid task-book ownership without mutating existing work',()=>{
 const f=fixture();const second=j.getState().createProject({name:'另一个项目'});const scope=api.createTrialForEquipment(f.fan,{name:'正式项目试验'});
 const owner=s.getState().createSession({title:'原工作',projectId:f.project});s.getState().bindTrialToSession(owner,scope,f.project);
 const work=s.getState().createSession({title:'另一个项目工作',projectId:second});const before=structuredClone(s.getState().sessions.find(item=>item.id===work));
 assert.throws(()=>s.getState().bindTrialToSession(work,scope),/归属不匹配/);assert.deepEqual(s.getState().sessions.find(item=>item.id===work),before);
 const orphan=api.createTrialForEquipment(f.other,{name:'旧任务书试验',taskBookId:'missing-task'});
 assert.throws(()=>s.getState().bindTrialToSession(work,orphan),/归属不匹配/);
 const independent=s.getState().createSession({title:'独立探索'});s.getState().bindTrialToSession(independent,scope);
 assert.equal(s.getState().sessions.find(item=>item.id===independent).projectId,f.project);
 assert.equal(s.getState().sessions.find(item=>item.id===independent).creationSource,'standalone');
});

test('v6 hydration merges the demo into the existing fan category, retaining all IDs, parameters, descendants and references idempotently',async()=>{
 const demo=api.createDemoData();
 const existing={...structuredClone(demo.objects[0]),id:'category-fan',name:'涵道风扇',configurations:[{...structuredClone(demo.objects[0].configurations[0]),id:'user-fan',name:'电涵道风扇',experiments:[],children:[{id:'rotor',name:'转子',type:'组成对象',configurations:[],parameters:[{id:'angle',name:'角度',value:'35',form:'单值'}],materials:[],children:[],designs:[],experiments:[],models:[]}]},...['1223','13131'].map(name=>({id:name,name,description:'',parameters:[],materials:[],children:[],designs:[],experiments:[],models:[]}))]};
 const legacy={...structuredClone(demo.objects[0]),id:'demo-category-fan',name:'涵道风扇（演示）'};
 const before={objects:[legacy,existing]};const snapshot=structuredClone(before);
 j.setState({projects:structuredClone(demo.projects)});s.setState({sessions:structuredClone(demo.sessions)});t.setState({tasks:structuredClone(demo.tasks)});
 const external=JSON.stringify({sessions:s.getState().sessions,projects:j.getState().projects,tasks:t.getState().tasks});
 localStorage.setItem('protangram-physical-objects-v1',JSON.stringify({version:6,state:before}));await p.persist.rehydrate();
 const fan=p.getState().objects.find(item=>item.id==='category-fan');assert.ok(fan);assert.equal(p.getState().objects.filter(item=>item.name==='涵道风扇').length,1);assert.equal(p.getState().objects.some(item=>item.name==='涵道风扇（演示）'),false);
 assert.deepEqual(new Set(fan.configurations.map(item=>item.id)),new Set(['user-fan','1223','13131','demo-fan-A','demo-fan-B']));
 for(const object of [...existing.configurations,...legacy.configurations])assert.deepEqual(JSON.parse(JSON.stringify(fan.configurations.find(item=>item.id===object.id))),JSON.parse(JSON.stringify(object)));
 assert.equal(api.findObjectCategory(p.getState().objects,'demo-category-fan').id,'category-fan');
 const migrated={objects:p.getState().objects};assert.deepEqual(api.migratePhysicalState(migrated),migrated);assert.deepEqual(api.migratePhysicalState(api.migratePhysicalState(before)),migrated);
 assert.deepEqual(before,snapshot);assert.equal(JSON.stringify({sessions:s.getState().sessions,projects:j.getState().projects,tasks:t.getState().tasks}),external);for(const session of s.getState().sessions)assert.equal(api.resolvePhysicalSource(p.getState().objects,session.businessScope).trial.id,session.businessScope.trialId);assert.equal(JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).version,7);
});

test('task parsing and plan persistence create no trial; explicit candidate confirmation creates once under its own project without a fixed CFG',()=>{
 const f=fixture();const preview=api.createTaskAnalysisPreview('正式任务.txt','试验名称：建议名称\n物理对象：风扇甲',p.getState().objects);
 const taskId=t.getState().createTask({title:'正式任务',projectId:f.project,requirementTexts:[]});t.getState().setAnalysisPlan(taskId,preview.requirements,preview.trialDrafts);
 assert.equal(devices().flatMap(x=>x.equipment.experiments).flatMap(x=>x.trials).length,0);assert.equal(s.getState().sessions.length,0);
 const values={name:'用户确认名称',physicalObjectId:f.fan};const id=api.confirmTaskTrialDraft(taskId,preview.trialDrafts[0].id,values);assert.equal(api.confirmTaskTrialDraft(taskId,preview.trialDrafts[0].id,values),id);
 const entries=api.getProjectTrialEntries(f.project,p.getState().objects,j.getState().projects,s.getState().sessions);assert.equal(entries.length,1);assert.equal(entries[0].trial.name,'用户确认名称');assert.equal(entries[0].trial.taskBookId,taskId);assert.equal(entries[0].trial.cfgId,undefined);assert.equal(entries[0].trial.settings,undefined);
});

test('one trial keeps independent snapshots and shared references for two CFG runs, including another primary equipment and exact record IDs',async()=>{
 const f=fixture();const source=api.createTrialForEquipment(f.fan,{name:'共同试验'});const record=p.getState().addTrialRecord(source.trialId,{});const session=s.getState().ensureProjectSession(f.project,{...source,testRecordId:record});
 const cfgs=[f.fan,f.other].map((objectId,index)=>c.getState().createConfiguration({name:'组合'+index,members:[{objectId,role:'tested'}]}));
 for(const [index,cfgId] of cfgs.entries()){
  const cfg=c.getState().getConfiguration(cfgId);const scope=api.cfgOperationScope(cfg,p.getState().objects,{...source,testRecordId:record});assert.equal(scope.trialId,source.trialId);assert.equal(scope.testRecordId,record);assert.equal(scope.physicalObjectId,f.fan);
  const payload={sourceScope:structuredClone(scope),execution:{id:'run-'+index,inputs:{speed:3000+index},cfgId,trialId:source.trialId,testRecordId:record},resultMode:'demo',results:[{id:'r',name:'运行'+index,kind:'metric',value:index}]};
  const artifact=api.saveOwnedArtifact(session,{kind:'cfg',cfgId},{id:'run-'+index,type:'analysis',title:'运行'+index,source:'演示',summary:'模拟结果',payload});payload.execution.inputs.speed=99999;assert.equal(artifact.payload.execution.inputs.speed,3000+index);
 }
 const artifacts=j.getState().projects.flatMap(project=>project.artifacts);assert.equal(artifacts.length,2);assert.notEqual(artifacts[0].payload.execution.cfgId,artifacts[1].payload.execution.cfgId);
 const groups=api.collectTrialResourceGroups(j.getState().projects,s.getState().sessions,p.getState().objects,c.getState().configurations,{projectId:f.project,trialId:source.trialId});
 assert.deepEqual(groups.filter(g=>g.entries.some(e=>e.artifact)).map(g=>g.id),cfgs);
 await p.persist.rehydrate();await j.persist.rehydrate();s.getState().reloadFromStorage();assert.equal(j.getState().projects.flatMap(project=>project.artifacts).length,2);assert.equal(devices().find(x=>x.id===f.fan).equipment.experiments[0].trials[0].cfgId,undefined);
});

test('unassigned legacy tasks require explicit project recovery, preserving task, source session and artifact identities',()=>{
 const f=fixture();const task=t.getState().createTask({title:'历史任务',projectId:'',requirementTexts:[]});t.getState().setAnalysisPlan(task,[],[{id:'draft',name:'历史候选',loadSpectrum:'',requirementIds:[]}]);
 assert.throws(()=>api.confirmTaskTrialDraft(task,'draft',{name:'不得独立创建正式试验',physicalObjectId:f.fan}),/必须归属有效项目/);
 const session=s.getState().ensureTaskSession(t.getState().tasks[0]);const storageId=s.getState().sessions[0].storageProjectId;const artifact=j.getState().addArtifact(storageId,{type:'report',title:'旧成果',source:'报告',summary:'保留',payload:{}});
 api.assignLegacyTaskProject(task,f.project);assert.equal(t.getState().tasks[0].projectId,f.project);assert.equal(s.getState().sessions.find(x=>x.id===session).storageProjectId,storageId);assert.equal(s.getState().sessions.find(x=>x.id===session).projectId,f.project);assert.ok(j.getState().projects.find(x=>x.id===storageId).artifacts.some(x=>x.id===artifact.id));assert.throws(()=>api.assignLegacyTaskProject(task,f.project),/已有项目归属/);
});
