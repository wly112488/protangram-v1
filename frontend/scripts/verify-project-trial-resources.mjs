import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const {chromium}=createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT)('playwright');
const base=process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5193';
const output=resolve(process.env.PROTANGRAM_VERIFY_OUTPUT ?? '/tmp/protangram-verification/project-trial-resources');
await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PROTANGRAM_CHROMIUM_PATH,args:['--no-sandbox']});
const context=await browser.newContext({viewport:{width:1440,height:1100}});
const errors=[],writes=[];
await context.route('**/*',route=>{
  if(['POST','PUT','PATCH','DELETE'].includes(route.request().method())) {writes.push(route.request().url());return route.abort();}
  return new URL(route.request().url()).pathname.startsWith('/api/')?route.fulfill({json:{success:true,data:[]}}):route.continue();
});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
const go=path=>page.goto(base+path,{waitUntil:'networkidle'});
const choose=async(name,text)=>{
  const input=page.getByRole('combobox',{name,exact:true});await input.click();await input.fill(text);
  const id=await input.getAttribute('aria-controls');
  await page.locator('.ant-select-dropdown:visible').filter({has:page.locator(`[id="${id}"]`)}).locator('.ant-select-item-option:visible').filter({hasText:text}).first().click();
};
const artifacts=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.flatMap(p=>p.artifacts));
try {
  await go('/sessions/demo-session-1/doe');
  const seed=await page.evaluate(async()=>{
    // Reuse the application's module URL, including Vite's HMR timestamp.
    // Importing an old bare URL can otherwise instantiate a second store.
    const load=path=>import(performance.getEntriesByType('resource').find(entry=>new URL(entry.name).pathname===path)?.name ?? path);
    const {useTrialConfigurationStore:c}=await load('/src/workspace/trialConfigurationStore.ts');
    const {usePhysicalObjectStore:p}=await load('/src/workspace/physicalObjectStore.ts');
    const {useSessionStore:s}=await load('/src/workspace/sessionStore.ts');
    const {useProjectStore:projects}=await load('/src/workspace/projectStore.ts');
    const cfg=c.getState().createConfiguration({name:'项目试验 CFG',members:[{objectId:'demo-fan-A',role:'tested'}]});
    const trial=p.getState().addConcreteTrial('demo-configuration-1',{name:'同一构型的另一次试验',loadSpectrum:'LS-OTHER',cfgId:cfg});
    const session=s.getState().createSession({title:'另一次试验',projectId:'demo-project-fan-validation',businessScope:{physicalObjectId:'demo-fan-A',experimentId:'demo-configuration-1',trialId:trial,cfgId:cfg}});
    const storage=s.getState().sessions.find(item=>item.id===session).storageProjectId;
    const marker=projects.getState().addArtifact(storage,{type:'design',title:'另一试验专属方案',source:'test',summary:'',payload:{resourceOwner:{kind:'cfg',cfgId:cfg},sourceSessionId:session,sourceScope:{physicalObjectId:'demo-fan-A',experimentId:'demo-configuration-1',trialId:trial,cfgId:cfg},results:[{id:'r',kind:'metric',name:'另一试验专属结果',value:1}]}});
    return {cfg,trial,session,marker,objects:structuredClone(p.getState().objects)};
  });
  await choose('本次选择 CFG','项目试验 CFG');
  await page.getByRole('button',{name:'确认使用',exact:true}).click();
  for(const item of await page.locator('.workspace-preparation-item').all()) {
    await item.click();const dialog=page.getByRole('dialog').last();
    await dialog.getByRole('button',{name:/确\s*定/}).click();await dialog.waitFor({state:'hidden'});
  }
  await page.getByRole('button',{name:/生成推荐方案$/}).click();
  await page.getByRole('button',{name:'确认方案并创建试验任务',exact:true}).waitFor();
  await page.getByRole('button',{name:'确认方案并创建试验任务',exact:true}).click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.some(p=>p.artifacts.some(a=>a.payload.sourceSessionId==='demo-session-1' && a.type==='design')));
  const design=(await artifacts()).find(a=>a.payload.sourceSessionId==='demo-session-1' && a.type==='design');
  assert.equal(design.payload.sourceScope.trialId,'demo-trial-1');
  assert.equal(design.payload.trialContext.trialId,'demo-trial-1');
  console.log('PASS actual DOE action in the user-provided demo session retains its legacy trial ID');

  await go('/sessions/demo-session-1/virtual-condition');
  await page.getByRole('button',{name:'配置 气动性能通用模型（演示）',exact:true}).click();
  await choose('模型配置 CFG','项目试验 CFG');
  await page.getByRole('button',{name:/执行演示预览$/}).click();
  await page.locator('.cfg-model-result').getByText('演示结果',{exact:true}).waitFor();
  await page.getByRole('button',{name:'保存演示成果',exact:true}).click();
  await page.locator('.cfg-model-result').getByText('已保存到共享成果',{exact:true}).waitFor();
  const prediction=(await artifacts()).find(a=>a.payload.sourceSessionId==='demo-session-1' && a.type==='virtualCondition');
  assert.equal(prediction.payload.sourceScope.trialId,'demo-trial-1');
  assert.equal(prediction.payload.modelPlan.trialId,'demo-trial-1');
  console.log('PASS virtual condition captures the concrete trial in both source metadata and model snapshot');

  await go('/sessions/demo-session-1/tools');
  await page.locator('.session-data-workspace input[type=file]').setInputFiles({name:'trial-note.csv',mimeType:'text/csv',buffer:Buffer.from('x,y\n1,2\n2,3\n')});
  await page.getByRole('table',{name:'工作表 trial-note.csv',exact:true}).waitFor();
  const generic=(await artifacts()).find(a=>a.title==='trial-note.csv');
  assert.equal(generic.payload.resourceOwner.kind,'session');
  assert.equal(generic.payload.sourceScope,undefined);
  assert.equal(generic.payload.trialContext.trialId,'demo-trial-1');
  const legacy=await page.evaluate(async cfgId=>{
    const {useProjectStore:p}=await import('/src/workspace/projectStore.ts');
    return p.getState().addArtifact('demo-project-fan-validation',{id:'lost-trial-link',type:'design',title:'待恢复关联的旧方案',source:'智能试验设计',summary:'',payload:{resourceOwner:{kind:'cfg',cfgId},sourceSessionId:'demo-session-1',sourceScope:{physicalObjectId:'demo-fan-A',cfgId},results:[{id:'r',kind:'metric',name:'恢复后的旧方案',value:1}]}});
  },seed.cfg);
  await go('/projects?projectId=demo-project-fan-validation&view=resources&trialId=demo-trial-1');
  const directory=()=>page.locator('.result-catalog-directory');
  for(const name of ['通用','项目试验 CFG','trial-note.csv','恢复后的旧方案','虚拟工况扩展']) await directory().getByText(name,{exact:true}).waitFor();
  await directory().getByText('最大化性能 · 智能推荐方案',{exact:true}).waitFor();
  assert.equal(await directory().getByText('trial-note.csv',{exact:true}).count(),1);
  assert.equal(await directory().getByText('另一试验专属结果',{exact:true}).count(),0);
  assert.doesNotMatch(await directory().innerText(),/未关联试验的历史成果/);
  await page.screenshot({path:resolve(output,'trial-specific-resources.png'),fullPage:true});
  assert.deepEqual((await artifacts()).find(a=>a.id===legacy.id),legacy);
  console.log('PASS project trial directory shows generic/CFG groups and read-only recovery without mixing the other trial');

  await go(`/projects?projectId=demo-project-fan-validation&view=resources&trialId=${seed.trial}`);
  await directory().getByText('另一试验专属结果',{exact:true}).waitFor();
  assert.equal(await directory().getByText('虚拟工况扩展',{exact:true}).count(),0);
  assert.equal(await directory().getByText('恢复后的旧方案',{exact:true}).count(),0);
  await go('/projects?projectId=demo-project-fan-validation&view=resources');
  const panels=page.locator('.project-trial-resource-catalog > .ant-collapse-item');
  await panels.filter({has:page.locator('.ant-collapse-header').getByText('变转速性能验证（演示）',{exact:true})}).waitFor();
  await panels.filter({has:page.locator('.ant-collapse-header').getByText('同一构型的另一次试验',{exact:true})}).waitFor();
  await page.screenshot({path:resolve(output,'project-trial-panels.png'),fullPage:true});
  await go('/projects?projectId=demo-project-fan-validation&view=trials');
  const row=page.locator('tr.ant-table-row').filter({has:page.getByRole('button',{name:'变转速性能验证（演示）',exact:true})});
  await row.locator('.ant-table-row-expand-icon').click();
  await page.locator('.ant-table-expanded-row').getByText('共享数据与成果',{exact:true}).waitFor();
  await page.locator('.ant-table-expanded-row .result-catalog-directory').getByText('恢复后的旧方案',{exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'trial-row-directory.png'),fullPage:true});
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
  assert.deepEqual(after,seed.objects);
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(resolve(output,'acceptance.json'),JSON.stringify({base,seed,design,prediction,generic,legacy,errors,writes},null,2));
  console.log('PASS every project trial has a separate directory in both project resources and expanded trial rows');
} catch(error) {
  await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});
  console.log(await page.evaluate(()=>({sessions:JSON.parse(localStorage.getItem('protangram-work-sessions-v1')).sessions.map(s=>({id:s.id,projectId:s.projectId,scope:s.businessScope})),trials:JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects.flatMap(c=>c.configurations).flatMap(o=>o.experiments).flatMap(e=>e.trials).map(t=>({id:t.id,name:t.name}))})));
  console.log((await page.locator('body').innerText()).slice(-6500));console.log({errors,writes});throw error;
} finally {await browser.close();}
