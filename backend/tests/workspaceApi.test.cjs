const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const express = require('express');

const category = (id, name) => ({ id, name, type: name, description: '', configurations: [], legacyCategories: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const envelope = state => ({ state, version: 6 });
const seeds = () => envelope({ objects: [['category-fan','涵道风扇'],['category-motor','电机'],['category-propulsion','电推进']].map(x => category(...x)) });
const record = id => ({ id, name: id, executionNumber: 1, createdAt: 'now', actualConditions: [], measurements: [], rawFiles: [{ id: `file-${id}`, name: '原始.csv', headers: ['x','y'], size: 8, mimeType: 'text/csv', rowCount: 1, addedAt: 'now' }], tables: [] });
const fixture = () => {
  const p = seeds();
  p.state.objects[0].configurations.push({ id:'config', name:'object', description:'', parameters:[], materials:[], children:[], designs:[], models:[], experiments:[{ id:'experiment', name:'setup', parameters:[], trials:[{ id:'trial', name:'trial', loadSpectrum:'load-1', records:[record('r1'),record('r2')], charts:[] }] }] });
  return p;
};
const trial = p => p.state.objects[0].configurations[0].experiments[0].trials[0];
const scope = recordId => ({ physicalObjectId:'config', experimentId:'experiment', trialId:'trial', ...(recordId ? {testRecordId:recordId} : {}) });
const project = (name='result', source=scope('r1')) => ({ state:{projects:[{ id:'project', artifacts:[{id:'artifact',projectId:'project',type:'analysis', title:name, payload:{sourceScope:source,results:[{id:'result',name,kind:'metric',value:1}]} }]}]}, version:1 });
async function start(t, options={}) {
  const { createWorkspaceApi } = require('../src/workspaceApi');
  const dir = options.dir ?? fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-api-'));
  const api = await createWorkspaceApi({ dbPath: path.join(dir,'workspace.sqlite'), ...options });
  const app = express(); app.use(express.json()); app.use('/api/workspace',api.router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api/workspace`;
  const request=async (suffix='',body,headers={}) => {
    const res = await fetch(base+suffix, body === undefined ? undefined : {method:'PUT',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
    return {status:res.status,body:await res.json()};
  };
  t.after(async () => { await new Promise(resolve => server.close(resolve)); api.close(); });
  return {api,dir,base,request};
}

test('workspace API is available as a mountable module', () => {
  assert.ok(fs.existsSync(path.join(__dirname,'../src/workspaceApi.js')), 'workspace API implementation is missing');
});
test('default role comes from deployment config and unchanged seed categories save', async t => {
  const s=await start(t,{role:'experimenter'});
  const initial=await s.request();
  assert.equal(initial.body.data.access.role,'experimenter');
  assert.equal(initial.body.data.revisions.physical,0);
  assert.deepEqual(initial.body.data.states.projects,null);
  const initialPhysical=initial.body.data.states.physical;
  assert.equal((await s.request('/physical',{value:initialPhysical,revision:0})).status,200);
  const forged=structuredClone(initialPhysical); forged.state.objects[0].name='篡改类别';
  assert.equal((await s.request('/physical',{value:forged,revision:1,role:'admin'},{'X-Role':'admin','X-Workspace-Role':'admin'})).status,403);
  assert.deepEqual((await s.request()).body.data.states.physical,initialPhysical);
});
test('default workspace starts with two ducted fans and two named test configurations each', async t => {
  const s=await start(t,{role:'experimenter'});
  const physical=(await s.request()).body.data.states.physical.state.objects[0];
  assert.equal(physical.name,'涵道风扇');
  assert.deepEqual(physical.configurations.map(object=>object.name),['涵道风扇 01','涵道风扇 02']);
  assert.deepEqual(physical.configurations.map(object=>object.experiments.map(configuration=>configuration.name)),[['试验构型 A','试验构型 B'],['试验构型 A','试验构型 B']]);
});
test('experimenters may add categories, objects and configurations but cannot edit existing metadata', async t => {
  const s=await start(t,{role:'experimenter'});
  const p=(await s.request()).body.data.states.physical;
  p.state.objects.push(category('new-category','新增类别'));
  p.state.objects[0].configurations.push({id:'new-fan',name:'新增风扇',description:'',parameters:[],materials:[],children:[],designs:[],models:[],experiments:[]});
  assert.equal((await s.request('/physical',{value:p,revision:0})).status,200);
  const p2=(await s.request()).body.data.states.physical;
  p2.state.objects[0].configurations.find(item=>item.id==='new-fan').experiments.push({id:'new-setup',name:'新构型',parameters:[],trials:[]});
  assert.equal((await s.request('/physical',{value:p2,revision:1})).status,200);
  const p3=(await s.request()).body.data.states.physical;
  p3.state.objects[0].configurations[0].name='篡改已有对象';
  assert.equal((await s.request('/physical',{value:p3,revision:2})).status,403);
});
test('admin writes survive reopening SQLite and concurrent stale writes return 409', async t => {
  const s=await start(t,{role:'admin'}); const p=fixture();
  const responses=await Promise.all([s.request('/physical',{value:p,revision:0}),s.request('/physical',{value:p,revision:0})]);
  assert.deepEqual(responses.map(x=>x.status).sort(),[200,409]);
  const restarted=await start(t,{dir:s.dir,role:'experimenter'});
  assert.deepEqual((await restarted.request()).body.data.states.physical,p);
  trial(p).records.push(record('r3'));
  assert.equal((await restarted.request('/physical',{value:p,revision:1})).status,200);
  p.state.objects[0].configurations[0].experiments[0].name='forged configuration';
  assert.equal((await restarted.request('/physical',{value:p,revision:2})).status,403);
});
test('malformed states are rejected without incrementing revision', async t => {
  const s=await start(t,{role:'admin'});
  for (const body of [{value:[],revision:0},{value:{state:{objects:[null]}},revision:0},{value:fixture(),revision:-1},{value:null,revision:0}]) assert.equal((await s.request('/physical',body)).status,400);
  assert.equal((await s.request('/bogus',{value:{},revision:0})).status,404);
  assert.equal((await s.request()).body.data.revisions.physical,0);
});
test('CSV charts and tables cannot point across records or reuse names within a trial', async t => {
  const s=await start(t,{role:'admin'}); const p=fixture();
  await s.request('/physical',{value:p,revision:0});
  trial(p).charts.push({id:'chart',name:'Curve',sourceRecordId:'r1',rawFileId:'file-r2',xField:'x',yField:'y'});
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,400);
  trial(p).charts[0].rawFileId='file-r1';
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,200);
  trial(p).records[1].tables.push({id:'table',name:' curve ',rawFileId:'file-r2',fields:['x']});
  assert.equal((await s.request('/physical',{value:p,revision:2})).status,409);
  trial(p).records[1].tables[0].name='Table'; trial(p).records[1].tables[0].rawFileId='file-r1';
  assert.equal((await s.request('/physical',{value:p,revision:2})).status,400);
  trial(p).records[1].tables=[]; trial(p).charts[0].sourceRecordId='r2'; trial(p).charts[0].rawFileId='file-r2';
  assert.equal((await s.request('/physical',{value:p,revision:2})).status,400);
});
test('moving existing records between trials is rejected even for admin', async t => {
  const s=await start(t,{role:'admin'}); const p=fixture(); await s.request('/physical',{value:p,revision:0});
  const original=trial(p); p.state.objects[0].configurations[0].experiments[0].trials.push({id:'trial2',name:'other',loadSpectrum:'load2',charts:[],records:[original.records.pop()]});
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,400);
});
test('project result names share a trial namespace and source snapshots cannot be reparented', async t => {
  const s=await start(t,{role:'admin'}); const p=fixture(); trial(p).records[0].tables.push({id:'table',name:'Table',rawFileId:'file-r1',fields:['x']});
  await s.request('/physical',{value:p,revision:0});
  assert.equal((await s.request('/projects',{value:project(' table '),revision:0})).status,409);
  const pr=project(); assert.equal((await s.request('/projects',{value:pr,revision:0})).status,200);
  pr.state.projects[0].artifacts[0].payload.sourceScope=scope('r2');
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
  pr.state.projects[0].artifacts[0].payload.sourceScope=scope('r1');
  pr.state.projects[0].artifacts[0].payload.sourceContext={scope:scope('r1'),rawFiles:[{id:'file-r2'}]};
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
  pr.state.projects[0].artifacts[0].payload.sourceContext.rawFiles[0].sourceRecordId='r2';
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,200);
  pr.state.projects[0].artifacts[0].payload.sourceContext.rawFiles[0].sourceRecordId='r1';
  assert.equal((await s.request('/projects',{value:pr,revision:2})).status,400);
});
test('multi-store commit is atomic on conflicts and validates the combined reference graph', async t => {
  const s=await start(t,{role:'admin'});
  const commit=async changes => { const r=await fetch(s.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes})}); return {status:r.status,body:await r.json()}; };
  assert.equal((await commit({physical:{value:fixture(),revision:0},projects:{value:project(),revision:0}})).status,200);
  assert.equal((await commit({physical:{value:fixture(),revision:1},projects:{value:project(),revision:0}})).status,409);
  assert.deepEqual((await s.request()).body.data.revisions,{physical:1,projects:1,tasks:0,sessions:0});
});
test('CSV and task PDF blobs persist exact bytes and cannot be attached to another owner', async t => {
  const s=await start(t,{role:'admin'}); await s.request('/physical',{value:fixture(),revision:0});
  await s.request('/tasks',{value:{state:{tasks:[{id:'task',title:'Task',projectId:'project',requirements:[],reportDraft:{sections:[]}}]},version:1},revision:0});
  const upload=async (id,fields,bytes,name,type) => { const form=new FormData();form.set('file',new Blob([bytes],{type}),name); for (const [k,v] of Object.entries(fields)) form.set(k,v); return fetch(s.base+'/files/'+id,{method:'POST',body:form}); };
  const csv=Buffer.from('x,y\n1,2\n');
  assert.equal((await upload('file-r1',{trialId:'trial',recordId:'r1'},csv,'原始.csv','text/csv')).status,200);
  assert.equal((await upload('file-r1',{trialId:'trial',recordId:'r2'},csv,'bad.csv','text/csv')).status,400);
  assert.equal((await upload('new',{trialId:'trial',recordId:'missing'},csv,'bad.csv','text/csv')).status,400);
  const pdf=Buffer.from('%PDF-1.7\n\x00\xff','binary');
  assert.equal((await upload('task',{taskId:'task'},pdf,'任务书.pdf','application/pdf')).status,200);
  const restarted=await start(t,{dir:s.dir});
  const downloaded=await fetch(restarted.base+'/files/file-r1');
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),csv);
  assert.equal(decodeURIComponent(downloaded.headers.get('content-disposition').split("filename*=UTF-8''")[1]),'原始.csv');
  assert.deepEqual(Buffer.from(await (await fetch(restarted.base+'/files/task')).arrayBuffer()),pdf);
  assert.equal((await fetch(restarted.base+'/files/missing')).status,404);
  assert.equal((await s.request()).body.data.states.physical.state.objects[0].configurations[0].experiments[0].trials[0].records.length,2);
});
test('failed database replacement returns 500 and preserves the last acknowledged state', async t => {
  const s=await start(t,{role:'admin'}); await s.request('/physical',{value:fixture(),revision:0});
  const database=path.join(s.dir,'workspace.sqlite'); const backup=database+'.backup';
  fs.renameSync(database,backup); fs.mkdirSync(database);
  const failed=await s.request('/physical',{value:fixture(),revision:1}); assert.equal(failed.status,500);
  fs.rmdirSync(database); fs.renameSync(backup,database);
  assert.equal((await s.request()).body.data.revisions.physical,1);
});
test('atomic file replacement errors roll back both snapshots and blob writes', async t => {
  const s=await start(t,{role:'admin'}); await s.request('/physical',{value:fixture(),revision:0});
  const rename=fs.renameSync;
  fs.renameSync=(from,to)=>{ if(to === path.join(s.dir,'workspace.sqlite')) { const error=new Error('disk write failure');error.code='EIO';throw error; }return rename(from,to); };
  try {
    const p=fixture();trial(p).records.push(record('r3'));
    assert.equal((await s.request('/physical',{value:p,revision:1})).status,500);
    const form=new FormData();form.set('file',new Blob(['x,y\n1,2']),'raw.csv');form.set('trialId','trial');form.set('recordId','r1');
    assert.equal((await fetch(s.base+'/files/file-r1',{method:'POST',body:form})).status,500);
  } finally {fs.renameSync=rename;}
  assert.equal((await s.request()).body.data.revisions.physical,1);
  assert.equal((await fetch(s.base+'/files/file-r1')).status,404);
  assert.equal(fs.readdirSync(s.dir).filter(file=>file.endsWith('.tmp') || file.endsWith('.lock')).length,0);
});
test('nested malformed data returns 400 and cannot poison the saved graph', async t => {
  const s=await start(t,{role:'admin'});
  for(const value of [
    {state:{tasks:[{id:'task',requirements:[null],reportDraft:{sections:[]}}]},version:1},
    {state:{projects:[{id:'project',artifacts:[null]}]},version:1},
    {state:{projects:[{id:'project',artifacts:[{id:'artifact',projectId:'project',payload:{results:[null]}}]}]},version:1},
  ]) {
    const kind=value.state.tasks ? 'tasks' : 'projects';
    assert.equal((await s.request('/'+kind,{value,revision:0})).status,400);
  }
  assert.equal((await s.request()).body.data.revisions.tasks,0);
  assert.equal((await s.request()).body.data.revisions.projects,0);
});

test('production server mounts the initialized workspace API', async t => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'workspace-start-'));
  const oldPort=process.env.PORT,oldDb=process.env.PROTANGRAM_WORKSPACE_DB;
  process.env.PORT='0';process.env.PROTANGRAM_WORKSPACE_DB=path.join(dir,'workspace.sqlite');
  let server;
  try {
    const {start}=require('../src/index');server=await start();
    if(!server.listening) await new Promise(resolve=>server.on('listening',resolve));
    const res=await fetch(`http://127.0.0.1:${server.address().port}/api/workspace`);
    assert.equal(res.status,200);assert.equal((await res.json()).data.access.role,'experimenter');
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    if(oldPort===undefined) delete process.env.PORT;else process.env.PORT=oldPort;
    if(oldDb===undefined) delete process.env.PROTANGRAM_WORKSPACE_DB;else process.env.PROTANGRAM_WORKSPACE_DB=oldDb;
  }
});
test('unknown and forged source paths are rejected without changing projects', async t => {
  const s=await start(t,{role:'admin'});await s.request('/physical',{value:fixture(),revision:0});
  for(const invalidScope of [
    {...scope('r1'),physicalObjectId:'missing'},
    {...scope('r1'),experimentId:'missing'},
    {...scope('r1'),trialId:'missing'},
    {...scope('r1'),testRecordId:'missing'},
  ]) assert.equal((await s.request('/projects',{value:project('result',invalidScope),revision:0})).status,400);
  assert.equal((await s.request()).body.data.revisions.projects,0);
});
test('admin role is enabled only by explicit server configuration', async t => {
  const previous=process.env.PROTANGRAM_WORKSPACE_ROLE;
  try {
    delete process.env.PROTANGRAM_WORKSPACE_ROLE;
    const defaults=await start(t);assert.equal((await defaults.request()).body.data.access.role,'experimenter');
    process.env.PROTANGRAM_WORKSPACE_ROLE='admin';
    const configured=await start(t);assert.equal((await configured.request()).body.data.access.role,'admin');
    assert.equal((await configured.request('/physical',{value:fixture(),revision:0})).status,200);
  } finally { if(previous===undefined)delete process.env.PROTANGRAM_WORKSPACE_ROLE;else process.env.PROTANGRAM_WORKSPACE_ROLE=previous; }
});
test('task-book PDF replacement preserves stable ownership, original names, and exact new bytes', async t => {
  const s=await start(t,{role:'admin'}); await s.request('/physical',{value:fixture(),revision:0});
  await s.request('/tasks',{value:{state:{tasks:['task','other'].map(id=>({id,title:id,projectId:'project',requirements:[],reportDraft:{sections:[]}}))},version:1},revision:0});
  const upload=async (id,fields,bytes,name='更新任务书.pdf',type='application/pdf')=>{const form=new FormData();form.set('file',new Blob([bytes],{type}),name);for(const [key,value] of Object.entries(fields))form.set(key,value);return fetch(s.base+'/files/'+id,{method:'POST',body:form});};
  const id='taskbook-task';
  assert.equal((await upload(id,{taskId:'task'},'old PDF')).status,200);
  const bytes=Buffer.from('%PDF-1.7\nnew\x00\xff','binary');
  assert.equal((await upload(id,{taskId:'task',revision:'1'},bytes)).status,200);
  const restarted=await start(t,{dir:s.dir});const downloaded=await fetch(restarted.base+'/files/'+id);
  assert.deepEqual(Buffer.from(await downloaded.arrayBuffer()),bytes);
  assert.equal(decodeURIComponent(downloaded.headers.get('content-disposition').split("filename*=UTF-8''")[1]),'更新任务书.pdf');
  assert.equal((await upload(id,{taskId:'other'},'owner forged')).status,400);
  assert.equal((await upload(id,{trialId:'trial',recordId:'r1'},'owner forged','raw.csv','text/csv')).status,400);
  assert.equal((await upload('file-r1',{trialId:'trial',recordId:'r1'},'x,y\n1,2','raw.csv','text/csv')).status,200);
  assert.equal((await upload('file-r1',{trialId:'trial',recordId:'r1'},'x,y\n3,4','raw.csv','text/csv')).status,409);
  assert.equal((await upload('file-r1',{taskId:'task'},'owner forged')).status,400);
  assert.deepEqual(Buffer.from(await (await fetch(s.base+'/files/'+id)).arrayBuffer()),bytes);
});
test('CAS conflicts expose REVISION_CONFLICT while duplicate-result conflicts do not', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();await s.request('/physical',{value:p,revision:0});
  const stale=await s.request('/physical',{value:p,revision:0});assert.equal(stale.status,409);assert.equal(stale.body.code,'REVISION_CONFLICT');
  trial(p).charts.push({id:'chart',name:'same',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  trial(p).records[1].tables.push({id:'table',name:'same',rawFileId:'file-r2',fields:['x']});
  const duplicate=await s.request('/physical',{value:p,revision:1});assert.equal(duplicate.status,409);assert.notEqual(duplicate.body.code,'REVISION_CONFLICT');
});
test('new trials need a spectrum and recorded trials cannot change a nonblank spectrum', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();trial(p).loadSpectrum='  ';
  assert.equal((await s.request('/physical',{value:p,revision:0})).status,400);
  trial(p).loadSpectrum='load-1';assert.equal((await s.request('/physical',{value:p,revision:0})).status,200);
  trial(p).loadSpectrum='load-2';assert.equal((await s.request('/physical',{value:p,revision:1})).status,400);
  trial(p).loadSpectrum='';assert.equal((await s.request('/physical',{value:p,revision:1})).status,400);
  assert.equal((await s.request()).body.data.revisions.physical,1);
});
test('legacy blank-spectrum trials remain readable but cannot gain records until filled', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();trial(p).records=[];await s.request('/physical',{value:p,revision:0});
  // Represent an already stored legacy trial, rather than inventing one through the new API.
  const SQL=await require('sql.js')();const database=path.join(s.dir,'workspace.sqlite');const db=new SQL.Database(fs.readFileSync(database));
  trial(p).loadSpectrum='';db.run('UPDATE workspace_states SET value=? WHERE kind=?',[JSON.stringify(p),'physical']);fs.writeFileSync(database,Buffer.from(db.export()));db.close();
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,200);
  trial(p).records.push(record('r1'));assert.equal((await s.request('/physical',{value:p,revision:2})).status,400);
  trial(p).loadSpectrum='confirmed';assert.equal((await s.request('/physical',{value:p,revision:2})).status,200);
});

test('explicit initial admin legacy import preserves repeated chart identities and names without allowing new collisions', async t => {
  const s=await start(t,{role:'admin'}); const p=fixture();
  trial(p).loadSpectrum='';
  for(const record of trial(p).records) trial(p).charts.push({id:'old-chart',name:'同名曲线',sourceRecordId:record.id,rawFileId:record.rawFiles[0].id,xField:'x',yField:'y',modelId:'legacy-model',modelInputs:[{id:'input',value:'5'}]});
  const projects=project('报告'); projects.state.projects[0].artifacts[0].type='report';projects.state.projects[0].artifacts[0].payload.chartReferences=trial(p).records.map(record=>({...scope(record.id),chartId:'old-chart'}));
  const changes={physical:{value:p,revision:0},projects:{value:projects,revision:0}};
  const commit=async legacyImport=>{const response=await fetch(s.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes,legacyImport})});return {status:response.status,body:await response.json()};};
  assert.equal((await commit(false)).status,400);
  const imported=await commit(true);assert.equal(imported.status,200);assert.ok(imported.body.data.warnings.length);
  const readback=(await s.request()).body.data.states;
  assert.deepEqual(readback.physical,p);assert.deepEqual(readback.projects,projects);
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,200);
  trial(p).charts.push({id:'new-chart',name:' 同名曲线 ',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  assert.equal((await s.request('/physical',{value:p,revision:2})).status,409);
  trial(p).charts.pop();trial(p).charts[0].name='重命名曲线';
  assert.equal((await s.request('/physical',{value:p,revision:2})).status,200);
  trial(p).charts[0].name='同名曲线';assert.equal((await s.request('/physical',{value:p,revision:3})).status,409);
  changes.physical.revision=3;changes.projects.revision=1;assert.equal((await commit(true)).status,409);
  const ordinary=await start(t,{role:'experimenter'});
  const denied=await fetch(ordinary.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:{physical:{value:p,revision:0}},legacyImport:true})});
  assert.equal(denied.status,403);
});
test('PDF replacement requires file revision CAS and schema migration retains preexisting blobs', async t => {
  const s=await start(t,{role:'admin'});
  await s.request('/tasks',{value:{state:{tasks:[{id:'task',requirements:[],reportDraft:{sections:[]}}]},version:1},revision:0});
  const upload=async revision=>{const form=new FormData();form.set('file',new Blob(['new PDF']),'任务书.pdf');form.set('taskId','task');if(revision!==undefined)form.set('revision',revision);return fetch(s.base+'/files/taskbook-task',{method:'POST',body:form});};
  assert.equal((await upload()).status,200);
  assert.equal((await fetch(s.base+'/files/taskbook-task')).headers.get('X-Workspace-File-Revision'),'1');
  assert.equal((await upload()).status,400);
  assert.equal((await upload('bad')).status,400);
  const first=await upload('1');assert.equal(first.status,200);assert.equal((await first.json()).data.revision,2);
  const stale=await upload('1');assert.equal(stale.status,409);assert.equal((await stale.json()).code,'REVISION_CONFLICT');
  assert.equal((await fetch(s.base+'/files/taskbook-task')).headers.get('X-Workspace-File-Revision'),'2');
  const SQL=await require('sql.js')();const database=path.join(s.dir,'workspace.sqlite');const db=new SQL.Database(fs.readFileSync(database));
  db.run('ALTER TABLE workspace_files DROP COLUMN revision');fs.writeFileSync(database,Buffer.from(db.export()));db.close();
  const reopened=await start(t,{dir:s.dir});const migrated=await fetch(reopened.base+'/files/taskbook-task');
  assert.equal(migrated.headers.get('X-Workspace-File-Revision'),'1');assert.equal(await migrated.text(),'new PDF');
});
test('rendered legacy DOE and derived artifact names participate in trial conflicts', async t => {
  const s=await start(t,{role:'admin'});await s.request('/physical',{value:fixture(),revision:0});
  const pr=project('DOE');pr.state.projects[0].artifacts[0].payload={sourceScope:scope('r1'),factors:[{name:'Speed',range:'0-1'}]};
  assert.equal((await s.request('/projects',{value:pr,revision:0})).status,200);
  const p=fixture();trial(p).charts.push({id:'chart',name:'DOE · 设计因子',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,409);
  const dup=project();dup.state.projects[0].artifacts[0].payload.results.push({id:'other-result',name:' RESULT ',kind:'metric',value:2});
  assert.equal((await s.request('/projects',{value:dup,revision:1})).status,409);
  dup.state.projects[0].artifacts[0].payload.results[1]={id:'result',name:'Other',kind:'metric',value:2};
  assert.equal((await s.request('/projects',{value:dup,revision:1})).status,400);
});
test('session snapshots require working drafts, handoffs, canonical capability and real storage project', async t => {
  const s=await start(t,{role:'admin'});await s.request('/physical',{value:fixture(),revision:0});await s.request('/projects',{value:project(),revision:0});
  const valid={id:'session',title:'Session',storageProjectId:'project',capability:'overview',drafts:{},handoffs:{},createdAt:'2026-10-19',updatedAt:'2026-10-19'};
  for(const session of [{id:'broken'},{...valid,drafts:null},{...valid,handoffs:[]},{...valid,storageProjectId:'missing'},{...valid,capability:'invalid'},{...valid,title:7},{...valid,createdAt:3}]) {
    assert.equal((await s.request('/sessions',{value:{version:1,sessions:[session],activeSessionId:'session'},revision:0})).status,400);
  }
  assert.equal((await s.request('/sessions',{value:{version:1,sessions:[valid],activeSessionId:'session'},revision:0})).status,200);
});
test('all rendered legacy artifact formats reserve their displayed result names', async t => {
  const s=await start(t,{role:'admin'});await s.request('/physical',{value:fixture(),revision:0});
  const cases=[
    [{charts:[{id:'plot',title:'Legacy plot',option:{}}]},'Legacy plot'],
    [{anomalies:[{event:'event'}]},'Legacy · 异常事件'],
    [{candidates:[{reason:'reason'}]},'Legacy · 根因候选'],
    [{plan:[{value:1}]},'Legacy'],[{conditions:[{value:1}]},'Legacy'],
    [{factors:[{name:'factor'}]},'Legacy · 设计因子'],
    [{credibility:80},'可信度'],[{errorLimit:'0.1'},'校准结果'],[{trustedRange:'0-1'},'可信范围'],
    [{conclusion:'text'},'Legacy'],[{confirmedRootCause:{reason:'text'}},'Legacy'],[{},'Legacy'],
  ];
  let revision=0;
  for(const [payload,name] of cases) {
    const pr=project('Legacy');pr.state.projects[0].artifacts[0].payload={sourceScope:scope('r1'),...payload};
    assert.equal((await s.request('/projects',{value:pr,revision:revision++})).status,200);
    const p=fixture();trial(p).charts.push({id:'chart',name,sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
    assert.equal((await s.request('/physical',{value:p,revision:1})).status,409,`rendered name: ${name}`);
  }
});
test('legacy artifact names inherit their original physical session provenance', async t => {
  const s=await start(t,{role:'admin'});await s.request('/physical',{value:fixture(),revision:0});
  const pr=project('Legacy');delete pr.state.projects[0].artifacts[0].payload.sourceScope;
  const session={id:'session',title:'Legacy',storageProjectId:'project',capability:'overview',drafts:{},handoffs:{},createdAt:'2026-10-19',updatedAt:'2026-10-19',businessScope:scope('r1')};
  const response=await fetch(s.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:{projects:{value:pr,revision:0},sessions:{value:{version:1,sessions:[session]},revision:0}}})});assert.equal(response.status,200);
  const p=fixture();trial(p).charts.push({id:'chart',name:'Legacy',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  assert.equal((await s.request('/physical',{value:p,revision:1})).status,409);
});
test('initial legacy import preserves category/device ID aliases with typed ownership', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();
  p.state.objects[0].configurations[0].id=p.state.objects[0].id;
  const response=await fetch(s.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({legacyImport:true,changes:{physical:{value:p,revision:0}}})});
  assert.equal(response.status,200);assert.deepEqual((await s.request()).body.data.states.physical,p);
  trial(p).records.push(record('r3'));assert.equal((await s.request('/physical',{value:p,revision:1})).status,200);
  trial(p).records[2].id='r1';assert.equal((await s.request('/physical',{value:p,revision:2})).status,400);
});
test('reports validate chart pairs and reject malformed or foreign trial references in either saved copy', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();
  trial(p).charts.push({id:'chart',name:'Measured',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  p.state.objects[0].configurations[0].experiments[0].trials.push({id:'foreign-trial',name:'foreign',loadSpectrum:'foreign',records:[record('foreign-record')],charts:[{id:'chart',name:'Foreign',sourceRecordId:'foreign-record',rawFileId:'file-foreign-record',xField:'x',yField:'y'}]});
  await s.request('/physical',{value:p,revision:0});
  const ref={...scope('r1'),chartId:'chart'};
  const pr=project();pr.state.projects[0].artifacts.push({id:'report',projectId:'project',type:'report',title:'Report',payload:{sourceScope:scope(),chartRefs:[ref],artifactRefs:[{projectId:'project',artifactId:'artifact'}],reportDefinition:{chartRefs:[ref]}}});
  assert.equal((await s.request('/projects',{value:pr,revision:0})).status,200);
  const report=pr.state.projects[0].artifacts[1];
  for(const invalid of [null,{...ref,chartId:'missing'},{...ref,testRecordId:'r2'},{...ref,physicalObjectId:'missing'},{...ref,trialId:'foreign-trial',testRecordId:'foreign-record'}]) {
    report.payload.chartRefs=[invalid];assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
  }
  report.payload.chartRefs=[ref];report.payload.reportDefinition.chartRefs=[{...ref,trialId:'foreign-trial',testRecordId:'foreign-record'}];
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
  report.payload.reportDefinition.chartRefs=[ref];report.payload.artifactRefs=[{projectId:'project',artifactId:'missing'}];
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
});
test('task reports accept associated trial evidence and reject other task trials and artifacts', async t => {
  const s=await start(t,{role:'admin'});const p=fixture();trial(p).taskBookId='task';
  trial(p).charts.push({id:'chart',name:'Measured',sourceRecordId:'r1',rawFileId:'file-r1',xField:'x',yField:'y'});
  p.state.objects[0].configurations[0].experiments[0].trials.push({id:'foreign-trial',name:'foreign',loadSpectrum:'foreign',taskBookId:'other',records:[record('foreign-record')],charts:[{id:'chart',name:'Foreign',sourceRecordId:'foreign-record',rawFileId:'file-foreign-record',xField:'x',yField:'y'}]});
  const tasks={state:{tasks:['task','other'].map(id=>({id,title:id,projectId:'project',requirements:[],reportDraft:{sections:[]}}))},version:1};
  const initial=await fetch(s.base+'/commit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({changes:{physical:{value:p,revision:0},tasks:{value:tasks,revision:0}}})});assert.equal(initial.status,200);
  const ref={...scope('r1'),chartId:'chart'};const pr=project();
  pr.state.projects[0].artifacts.push({id:'report',projectId:'project',type:'report',title:'Task report',payload:{sourceScope:{mode:'task',taskId:'task'},chartRefs:[ref],reportDefinition:{taskId:'task',chartRefs:[ref]}}});
  assert.equal((await s.request('/projects',{value:pr,revision:0})).status,200);
  const report=pr.state.projects[0].artifacts[1];report.payload.chartRefs=[{...ref,trialId:'foreign-trial',testRecordId:'foreign-record'}];
  assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
  report.payload.chartRefs=[ref];pr.state.projects[0].artifacts.push({id:'foreign-artifact',projectId:'project',type:'analysis',title:'Foreign',payload:{sourceScope:{...scope('foreign-record'),trialId:'foreign-trial'},results:[{id:'foreign-result',name:'Foreign result',kind:'metric',value:1}]}});
  report.payload.artifactRefs=[{projectId:'project',artifactId:'foreign-artifact'}];assert.equal((await s.request('/projects',{value:pr,revision:1})).status,400);
});
