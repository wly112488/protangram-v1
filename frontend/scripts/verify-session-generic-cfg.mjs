import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir,mkdtemp,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';

if(!process.env.PROTANGRAM_PLAYWRIGHT_ROOT) throw new Error('Set PROTANGRAM_PLAYWRIGHT_ROOT');
const {chromium}=createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT)('playwright');
const baseURL=process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5193';
const output=resolve(process.env.PROTANGRAM_VERIFY_OUTPUT ?? '/tmp/protangram-verification/session-generic-cfg');
await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),'protangram-session-resource-'));
const launch=()=>chromium.launchPersistentContext(profile,{headless:true,executablePath:process.env.PROTANGRAM_CHROMIUM_PATH,args:['--no-sandbox'],viewport:{width:1440,height:1100}});
let context=await launch(),page;
const errors=[],writes=[],passed=[];
const attach=async()=>{
  await context.route('**/*',route=>{
    if(['POST','PUT','PATCH','DELETE'].includes(route.request().method())) {writes.push(route.request().url());return route.abort();}
    return new URL(route.request().url()).pathname.startsWith('/api/')?route.fulfill({json:{success:true,data:[]}}):route.continue();
  });
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
};
await attach();
const go=path=>page.goto(baseURL+path,{waitUntil:'networkidle'});
const pass=name=>{passed.push(name);console.log(`PASS ${name}`);};
const choose=async(input,text)=>{
  await input.click();await input.fill(text);
  const id=await input.getAttribute('aria-controls');
  await page.locator('.ant-select-dropdown:visible').filter({has:page.locator(`[id="${id}"]`)}).locator('.ant-select-item-option:visible').filter({hasText:text}).first().click();
};
const cfgConfirm=async label=>{
  assert.equal(await page.getByRole('button',{name:'确认使用',exact:true}).isDisabled(),true);
  await choose(page.getByRole('combobox',{name:'本次选择 CFG',exact:true}),label);
  await page.getByRole('button',{name:'确认使用',exact:true}).click();
};
const state=()=>page.evaluate(()=>({
  sessions:JSON.parse(localStorage.getItem('protangram-work-sessions-v1')).sessions,
  projects:JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects,
  objects:JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects,
}));
const artifacts=async()=> (await state()).projects.flatMap(p=>p.artifacts);
const importCsv=async name=>{
  await page.locator('.session-data-workspace input[type=file]').setInputFiles({name,mimeType:'text/csv',buffer:Buffer.from('time,thrust\n0,10\n1,15\n2,20\n')});
  await page.getByRole('table',{name:`工作表 ${name}`}).waitFor();
};
const chart=async name=>{
  const grid=page.locator('.csv-worksheet-grid');
  await grid.locator('th').filter({hasText:'time'}).click();
  await grid.locator('th').filter({hasText:'thrust'}).click({modifiers:['Control']});
  await page.getByRole('button',{name:'绘图',exact:true}).click();
  await page.getByRole('menuitem',{name:'多曲线折线图',exact:true}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'图表名称',exact:true}).fill(name);
  await page.getByRole('dialog').getByRole('button',{name:'生成预览',exact:true}).click();
  await page.locator('.session-data-preview').getByRole('button',{name:'保存图表',exact:true}).click();
  await page.waitForFunction(title=>JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.some(p=>p.artifacts.some(a=>a.title===title)),name);
};
try {
  await go('/');
  const original=(await state()).objects;
  const cfgs=await page.evaluate(async()=>{
    const {useTrialConfigurationStore:c}=await import('/src/workspace/trialConfigurationStore.ts');
    const a=c.getState().createConfiguration({name:'气动 CFG A',members:[{objectId:'demo-fan-A',role:'tested'}]});
    const b=c.getState().createConfiguration({name:'气动 CFG B',members:[{objectId:'demo-fan-B',role:'tested'}]});
    return {a,b};
  });
  await page.locator('.trial-workbench-actions').getByRole('button',{name:'新建会话',exact:true}).click();
  await page.waitForURL(/\/sessions\//);
  const sessionId=new URL(page.url()).pathname.split('/')[2];
  await page.locator('.session-general-actions').getByRole('button',{name:'通用工具',exact:true}).click();
  assert.equal(await page.getByRole('combobox',{name:/CFG/}).count(),0);
  await importCsv('generic.csv');await chart('通用曲线');
  const generic=(await artifacts()).find(a=>a.title==='通用曲线');
  assert.deepEqual(generic.payload.resourceOwner,{kind:'session',sessionId});
  assert.equal(generic.payload.sourceScope,undefined);assert.equal(generic.payload.model,undefined);
  await page.locator('.csv-worksheet-grid tbody tr.ant-table-row').first().locator('td').nth(2).dblclick();
  await page.getByRole('textbox',{name:'编辑第1行 thrust',exact:true}).fill('42');
  await page.getByRole('textbox',{name:'编辑第1行 thrust',exact:true}).press('Enter');
  await page.getByRole('button',{name:/保存工作副本$/}).click();
  await page.getByRole('dialog').getByRole('textbox',{name:'工作副本文件名',exact:true}).fill('generic-copy.csv');
  await page.getByRole('dialog').getByRole('button',{name:'保存到本机',exact:true}).click();
  await page.getByRole('table',{name:'工作表 generic-copy.csv',exact:true}).waitFor();
  const copy=(await artifacts()).find(a=>a.payload.dataFile?.name==='generic-copy.csv');
  assert.equal(copy.payload.resourceOwner.sessionId,sessionId);
  assert.equal(copy.payload.dataFile.sourceRawFileId,generic.payload.sourceContext.rawFiles[0].id);
  await page.getByRole('button',{name:'新建数据表',exact:true}).click();
  await page.getByRole('dialog').getByLabel('数据表名称',{exact:true}).fill('manual');
  await page.getByRole('dialog').getByLabel('数据内容',{exact:true}).fill('x,y\n1,2\n2,3');
  await page.getByRole('dialog').getByRole('button',{name:'保存数据表',exact:true}).click();
  await page.getByRole('table',{name:'工作表 manual.csv',exact:true}).waitFor();
  await page.screenshot({path:resolve(output,'generic-tools.png'),fullPage:true});
  pass('generic CSV editing and plotting saves to the session without a trial, CFG or model');

  for(const path of ['doe','analysis','report']) {
    await go(`/sessions/${sessionId}/${path}`);
    await page.getByRole('combobox',{name:'本次选择 CFG',exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'确认使用',exact:true}).isDisabled(),true);
  }
  await cfgConfirm('气动 CFG A');
  await page.getByRole('heading',{name:/创建.*报告|新建.*报告|报告编制/}).first().waitFor();
  await go(`/sessions/${sessionId}/analysis`);await cfgConfirm('气动 CFG A');
  await importCsv('cfg-a.csv');await chart('构型曲线');
  const cfgChart=(await artifacts()).find(a=>a.title==='构型曲线');
  assert.deepEqual(cfgChart.payload.resourceOwner,{kind:'cfg',cfgId:cfgs.a});
  assert.equal(cfgChart.payload.model,undefined);assert.equal(cfgChart.payload.modelPlan,undefined);
  assert.equal(cfgChart.payload.sourceScope.trialId,undefined);
  pass('design, analysis and report require CFG; a CFG can own imported data and charts unrelated to models');

  await go(`/sessions/${sessionId}/report`);await cfgConfirm('气动 CFG A');
  await page.getByLabel('选择报告模板',{exact:true}).click();
  await page.locator('.ant-select-dropdown:visible').getByText('航空装备地面综合试验报告',{exact:true}).click();
  await page.getByRole('button',{name:/进入报告编制$/}).click();
  await page.waitForURL(/\/report\/generate\//);
  await page.getByRole('button',{name:/正式生成报告$/}).click();
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.some(p=>p.artifacts.some(a=>a.type==='report' && a.payload.sourceSessionId===id)),sessionId);
  const report=(await artifacts()).find(a=>a.type==='report' && a.payload.sourceSessionId===sessionId);
  assert.equal(report.payload.resourceOwner.cfgId,cfgs.a);
  assert.equal(report.payload.model,undefined);
  pass('a CFG report can cite generic and CFG charts and saves to the same session catalog');

  await go(`/sessions/${sessionId}/virtual-condition`);
  await page.getByRole('heading',{name:'虚拟工况 · 通用模型',exact:true}).waitFor();
  assert.equal(await page.getByRole('combobox',{name:/CFG/}).count(),0);
  await page.screenshot({path:resolve(output,'virtual-model-library.png'),fullPage:true});
  await page.getByRole('button',{name:'配置 气动性能通用模型（演示）',exact:true}).click();
  const modelCfg=page.getByRole('combobox',{name:'模型配置 CFG',exact:true});
  await modelCfg.waitFor();
  assert.equal(await page.getByRole('button',{name:/执行演示预览$/}).count(),0);
  await choose(modelCfg,'气动 CFG B');
  await page.getByRole('button',{name:/执行演示预览$/}).click();
  await page.locator('.cfg-model-result').getByText('演示结果',{exact:true}).waitFor();
  await page.evaluate(async()=>{const {useProjectStore:p}=await import('/src/workspace/projectStore.ts');window.restoreArchive=p.getState().addArtifact;p.setState({addArtifact:()=>null});});
  await page.getByRole('button',{name:/保存并返回工作台$/}).click();
  await page.getByText('本次成果未保存，请重试',{exact:true}).waitFor();
  assert.equal(new URL(page.url()).pathname,`/sessions/${sessionId}/virtual-condition`);
  await page.evaluate(async()=>{const {useProjectStore:p}=await import('/src/workspace/projectStore.ts');p.setState({addArtifact:window.restoreArchive});delete window.restoreArchive;});
  await page.getByRole('button',{name:/保存并返回工作台$/}).click();
  await page.waitForURL(`**/sessions/${sessionId}`);
  const prediction=(await artifacts()).find(a=>a.payload.sourceSessionId===sessionId && a.type==='virtualCondition');
  assert.equal(prediction.payload.resourceOwner.cfgId,cfgs.b);
  assert.equal(prediction.payload.modelPlan.cfgId,cfgs.b);
  assert.equal(prediction.payload.modelPlan.trialId,undefined);
  await page.locator('.result-catalog-directory').getByText('通用',{exact:true}).waitFor();
  for(const name of ['气动 CFG A','气动 CFG B','通用曲线','构型曲线','虚拟工况扩展']) await page.locator('.result-catalog-directory').getByText(name,{exact:true}).waitFor();
  await page.locator('.result-catalog-directory').getByText('通用曲线',{exact:true}).click();
  await page.locator('.result-catalog-preview canvas').waitFor();
  const genericAfter=(await artifacts()).find(a=>a.id===generic.id);
  assert.deepEqual(genericAfter,generic);
  assert.doesNotMatch(await page.locator('.result-catalog-directory').innerText(),/CFG：无|关联会话/);
  await page.screenshot({path:resolve(output,'session-shared-groups.png'),fullPage:true});
  pass('virtual condition chooses MODEL before configuring CFG, retries failed saves, and shares generic/A/B resources in one session');

  await go(`/sessions/${sessionId}/digital-twin`);
  await page.getByRole('button',{name:'配置 气动性能通用模型（演示）',exact:true}).click();
  await choose(page.getByRole('combobox',{name:'模型配置 CFG',exact:true}),'气动 CFG A');
  await page.getByLabel('目标转速 / rpm',{exact:true}).fill('6400');
  await page.getByRole('button',{name:/执行演示预览$/}).click();
  await page.locator('.cfg-model-result').getByText('演示结果',{exact:true}).waitFor();
  await page.getByRole('button',{name:'保存演示成果',exact:true}).click();
  await page.locator('.cfg-model-result').getByText('已保存到共享成果',{exact:true}).waitFor();
  await go('/');
  await page.locator('.trial-workbench-actions').getByRole('button',{name:'新建会话',exact:true}).click();
  await page.waitForURL(/\/sessions\//);
  const secondSession=new URL(page.url()).pathname.split('/')[2];
  await go(`/sessions/${secondSession}/analysis`);await cfgConfirm('气动 CFG A');
  await page.getByRole('table',{name:'工作表 cfg-a.csv',exact:true}).waitFor();
  await page.getByRole('button',{name:'数据与成果',exact:true}).click();
  await page.locator('.result-catalog-directory').getByText('构型曲线',{exact:true}).waitFor();
  assert.equal(await page.locator('.result-catalog-directory').getByText('通用曲线',{exact:true}).count(),0);
  const cfgChartAgain=(await artifacts()).filter(a=>a.id===cfgChart.id);
  assert.equal(cfgChartAgain.length,1);
  await go(`/shared?cfgId=${cfgs.a}`);
  await page.locator('.result-catalog-directory').getByText('构型曲线',{exact:true}).waitFor();
  assert.equal(await page.locator('.result-catalog-directory').getByText('通用曲线',{exact:true}).count(),0);
  pass('digital twin requires CFG; a second session and CFG library reuse the same resources without receiving another session’s generic data');

  const before=await state();
  await context.close();context=await launch();await attach();
  await go(`/sessions/${sessionId}`);
  for(const name of ['通用曲线','构型曲线','虚拟工况扩展']) await page.locator('.result-catalog-directory').getByText(name,{exact:true}).waitFor();
  const stable=data=>({...data,sessions:data.sessions.map(({capability,...session})=>session)});
  assert.deepEqual(stable(await state()),stable(before));
  assert.deepEqual((await state()).objects,original);
  const file=generic.payload.sourceContext.rawFiles[0];
  const restored=await page.evaluate(async id=>{const {readTrialFile}=await import('/src/workspace/trialDataFiles.ts');return readTrialFile(id);},file.id);
  assert.deepEqual(restored.headers,['time','thrust']);assert.equal(restored.rows.length,3);
  await go(`/sessions/${sessionId}/virtual-condition`);
  await page.getByRole('button',{name:'配置 气动性能通用模型（演示）',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/执行演示预览$/}).count(),0);
  await page.screenshot({path:resolve(output,'model-cfg-configuration.png'),fullPage:true});
  await go(`/sessions/${sessionId}/digital-twin`);
  await page.getByRole('button',{name:'配置 气动性能通用模型（演示）',exact:true}).click();
  assert.equal(await page.getByRole('button',{name:/执行演示预览$/}).count(),0);
  await choose(page.getByRole('combobox',{name:'模型配置 CFG',exact:true}),'气动 CFG A');
  assert.equal(await page.getByLabel('目标转速 / rpm',{exact:true}).inputValue(),'6400');
  assert.equal(await page.locator('.cfg-model-result').count(),0);
  pass('reopening preserves resource identities and original trial data; model configuration never silently restores a confirmed CFG');
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(resolve(output,'acceptance.json'),JSON.stringify({baseURL,profile,sessionId,secondSession,cfgs,generic,cfgChart,prediction,passed,errors,writes},null,2));
  console.log(JSON.stringify({output,passed:passed.length}));
} catch(error) {
  await page.screenshot({path:resolve(output,'failure.png'),fullPage:true});
  console.log((await page.locator('body').innerText()).slice(-6500));console.log({errors,writes});throw error;
} finally {await context.close();}
