import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5190';
const output = resolve('node_modules/.tmp/shared-trial-charts'); await mkdir(output,{recursive:true});
const browser = await chromium.launch({headless:true,args:['--no-sandbox'],executablePath:process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',env:{...process.env,LD_LIBRARY_PATH:'/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu',FONTCONFIG_FILE:'/tmp/protangram-browser-check/windows-fonts.conf'}});
const context=await browser.newContext({viewport:{width:1440,height:1100},acceptDownloads:true});
const errors=[],writes=[],passed=[],downloads=[];
const guard=async target=>{await target.route('**/*',route=>['POST','PUT','PATCH','DELETE'].includes(route.request().method())?(writes.push(route.request().url()),route.abort()):route.continue());};
await guard(context); const page=await context.newPage(); page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));page.on('download',download=>downloads.push(download));
const test=async(name,work)=>{await work();passed.push(name);console.log(`PASS ${name}`);};
const dialog=()=>page.getByRole('dialog');const main=()=>page.locator('.physical-flow-main');
const save=async()=>{await dialog().getByRole('button',{name:/保\s*存(?:成果)?$/}).click();await dialog().waitFor({state:'hidden'});};
const choose=async(select,label)=>{await select.click();const id=await select.getAttribute('aria-controls');const dropdown=page.locator('.ant-select-dropdown:visible').filter({has:page.locator(`[id="${id}"]`)});await dropdown.locator('.ant-select-item-option').filter({hasText:label}).first().click();};
const go=(trial='trial',record)=>page.goto(`${baseURL}/physical-objects?${new URLSearchParams({objectId:'category',configurationId:'device',experimentId:'setup',trialId:trial,...(record?{recordId:record}:{})})}`,{waitUntil:'networkidle'});
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('protangram-physical-objects-v1')));
const trial=async(id='trial')=>(await saved()).state.objects[0].configurations[0].experiments[0].trials.find(item=>item.id===id);
const csv=(name,text)=>({name,mimeType:'text/csv',buffer:Buffer.from(text)});
const firstCsv='time,speed,thrust\n0,1000,10\n1,2000,20\n2,3000,30\n';
const secondCsv='time,speed,thrust\n0,1500,15\n1,2500,25\n2,3500,35\n';
const verifyPng=async(download,name)=>{assert.equal(download.suggestedFilename(),`${name}.png`);const path=`${output}/${name}.png`;await download.saveAs(path);const buffer=await readFile(path);assert.equal(buffer.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(buffer.readUInt32BE(16),2000);assert.equal(buffer.readUInt32BE(20),1200);assert.ok(buffer.length>10000);};
let first,second,taskId;
try{
  await test('具体试验只管理记录和共享成果，记录导入多个真实 CSV，不重复选择业务来源',async()=>{
    await page.goto(baseURL,{waitUntil:'networkidle'});
    await page.evaluate(()=>{
      const trial=id=>({id,name:id==='trial'?'性能试验 001':'性能试验 002',loadSpectrum:`LS-${id}`,records:[],charts:[]});
      const device={id:'device',name:'电涵道风扇',description:'',parameters:[],materials:[],children:[],designs:[],models:[],experiments:[{id:'setup',name:'试验构型 01',parameters:[],trials:[trial('trial'),trial('other')]}]};
      localStorage.setItem('protangram-physical-objects-v1',JSON.stringify({version:6,state:{objects:[{id:'category',name:'涵道风扇',type:'涵道风扇',description:'',configurations:[device],parameters:[],materials:[],children:[],designs:[],experiments:[],models:[]}]}}));
    });
    await go(); assert.equal(await main().getByRole('button',{name:'新建图表',exact:true}).count(),0);
    await main().getByRole('button',{name:'创建第 1 次记录'}).click();
    await dialog().locator('input[type=file]').setInputFiles([csv('record1.csv',firstCsv),csv('record1-extra.csv',firstCsv)]);await save();
    first=(await trial()).records[0];assert.equal(first.rawFiles.length,2);assert.equal((await trial()).records.length,1);
    await main().getByRole('button',{name:'新建图表',exact:true}).click();
    assert.equal(await dialog().getByRole('combobox').count(),5); // CSV, X/Y, chart type, smoothing only.
    await dialog().getByLabel('图表名称').fill('转速曲线');
    assert.match(await dialog().locator('.ant-select').first().innerText(),/record1.csv/);
  });
  await test('图表预览来自实际字段，保存进入试验集合，真实 PNG 可下载',async()=>{
    const before=structuredClone((await trial()).records);
    await dialog().getByRole('button',{name:'生成预览'}).click();await dialog().locator('.physical-chart-preview canvas').waitFor();
    assert.equal((await trial()).charts.length,0);await save();
    const current=await trial();assert.equal(current.charts.length,1);assert.equal(current.charts[0].sourceRecordId,first.id);
    assert.deepEqual(current.records,before);assert.equal(current.records[0].charts,undefined);
    const points=await page.evaluate(async({chart,file})=>{const module=await (new Function('path','return import(path)'))('/src/workspace/trialChartOutput.ts');return (await module.loadTrialChartOption(chart,file)).series[0].data;},{chart:current.charts[0],file:first.rawFiles[0]});
    assert.deepEqual(points,[[0,1000],[1,2000],[2,3000]]);
    const download=page.waitForEvent('download');await main().getByRole('button',{name:'导出 PNG',exact:true}).click();await verifyPng(await download,'转速曲线');
    await main().getByRole('button',{name:'返回具体试验',exact:true}).click();
    const row=main().locator('.physical-shared-charts .ant-table-row').filter({hasText:'转速曲线'});
    await row.getByText('record1.csv',{exact:true}).waitFor();await row.getByRole('button',{name:'查看',exact:true}).click();
    await dialog().locator('canvas').waitFor();await dialog().getByText(`记录 ID：${first.id} · 文件 ID：${first.rawFiles[0].id}`,{exact:true}).waitFor();
    await dialog().getByRole('button',{name:/关\s*闭$/}).click();
  });
  await test('跨记录同名保存和导出均提示且不覆盖，改名后进入同一成果集合',async()=>{
    await main().getByRole('button',{name:'新增一次记录'}).click();await dialog().locator('input[type=file]').setInputFiles([csv('record2.csv',secondCsv)]);await save();
    second=(await trial()).records[1];await main().getByRole('button',{name:'新建图表',exact:true}).click();
    await dialog().getByLabel('图表名称').fill('转速曲线');await choose(dialog().getByLabel('Y 轴字段'),'thrust');
    const before=structuredClone(await trial()),downloadCount=downloads.length;
    for(const button of ['保存成果','保存并导出 PNG']){
      await dialog().getByRole('button',{name:button,exact:true}).click();
      await dialog().getByText('本具体试验已有同名图表，请使用其他名称。',{exact:true}).waitFor();
      assert.deepEqual(await trial(),before);assert.equal(downloads.length,downloadCount);
    }
    await dialog().getByLabel('图表名称').fill('推力曲线');const download=page.waitForEvent('download');
    await dialog().getByRole('button',{name:'保存并导出 PNG',exact:true}).click();await dialog().waitFor({state:'hidden'});await verifyPng(await download,'推力曲线');
    const current=await trial();assert.deepEqual(current.charts.map(item=>[item.name,item.sourceRecordId]),[['转速曲线',first.id],['推力曲线',second.id]]);
    assert.deepEqual(current.records,before.records);
  });
  await test('共享集合可查看两份来源；编辑当前成果不覆盖其他图表和原始 CSV，刷新可复用',async()=>{
    const before=structuredClone(await trial());
    const card=main().locator('.physical-charts-grid .ant-card').filter({hasText:'推力曲线'});
    await card.getByRole('button',{name:'配置',exact:true}).click();await dialog().getByLabel('Y 缩放').fill('2');await save();
    assert.deepEqual((await trial()).charts[0],before.charts[0]);assert.deepEqual((await trial()).records,before.records);
    await main().getByRole('button',{name:'返回具体试验',exact:true}).click();await page.reload({waitUntil:'networkidle'});
    assert.equal(await main().locator('.physical-shared-charts .ant-table-row').count(),2);
    const row=main().locator('.physical-shared-charts .ant-table-row').filter({hasText:'推力曲线'});
    await row.getByText('record2.csv',{exact:true}).waitFor();await row.getByRole('button',{name:'查看',exact:true}).click();await dialog().locator('canvas').waitFor();
    await dialog().getByText('字段：time / thrust · 数据行：1–末尾 · Y 缩放：2 · 偏移：0',{exact:true}).waitFor();
    await dialog().getByRole('button',{name:'前往来源记录'}).click();assert.equal(new URL(page.url()).searchParams.get('recordId'),second.id);
    assert.equal(await main().locator('.physical-charts-grid .ant-card').count(),1);
    await main().getByRole('button',{name:'返回具体试验',exact:true}).click();await page.screenshot({path:`${output}/shared-results.png`,fullPage:true});
  });
  await test('不同具体试验允许同名；集合与记录引用不串用',async()=>{
    await go('other');await main().getByRole('button',{name:'创建第 1 次记录'}).click();await dialog().locator('input[type=file]').setInputFiles([csv('other.csv',firstCsv)]);await save();
    await main().getByRole('button',{name:'新建图表',exact:true}).click();await dialog().getByLabel('图表名称').fill('转速曲线');await save();
    assert.equal((await trial('other')).charts.length,1);assert.equal((await trial()).charts.length,2);
    await go();assert.equal(await main().locator('.physical-shared-charts .ant-table-row').count(),2);
  });
  await test('任务书字段可编辑，删除重复跳转；任务工作台及旧报告引用仍读取同一集合',async()=>{
    await page.getByRole('button',{name:/任务书工作台$/}).click();await page.getByRole('button',{name:/新建任务书$/}).click();
    await dialog().getByRole('textbox').fill('共享图表验收任务');await dialog().getByRole('button',{name:'创建任务书',exact:true}).click();await dialog().waitFor({state:'hidden'});
    taskId=new URL(page.url()).searchParams.get('taskId');await go();await main().getByRole('button',{name:'编辑具体试验'}).click();await choose(dialog().getByLabel('任务书（可选，仅关联 ID）'),'共享图表验收任务');await save();
    assert.equal((await trial()).taskBookId,taskId);assert.equal(await page.getByRole('button',{name:'查看任务书汇总'}).count(),0);
    await page.locator('.business-task-link').filter({hasText:'共享图表验收任务'}).click();
    await page.locator('.taskbook-record-items').getByText('转速曲线',{exact:true}).waitFor();await page.locator('.taskbook-record-items').getByText('推力曲线',{exact:true}).waitFor();
    const resolved=await page.evaluate(async taskId=>{const load=new Function('path','return import(path)');const store=await load('/src/workspace/physicalObjectStore.ts');const model=await load('/src/workspace/taskTrialModel.ts');const context=await load('/src/workspace/physicalBusinessContext.ts');const objects=store.usePhysicalObjectStore.getState().objects;const sources=model.getTaskTrialSources(model.getTaskTrials(objects,[],[],taskId));return sources.charts.map(item=>({name:item.chart.name,source:item.reference.testRecordId,file:context.resolveRecordChart(objects,item.reference).rawFile.id}));},taskId);
    assert.deepEqual(resolved.map(item=>item.source),[first.id,second.id]);assert.deepEqual(resolved.map(item=>item.file),[first.rawFiles[0].id,second.rawFiles[0].id]);
  });
  await test('v5 旧图表完整迁移，历史同名和旧 ID 保留；重命名后保存不覆盖另一条来源',async()=>{
    const legacy=await browser.newContext({viewport:{width:1440,height:1000}});await guard(legacy);const oldPage=await legacy.newPage();oldPage.on('pageerror',error=>errors.push(error.message));
    try{
      await oldPage.goto(baseURL,{waitUntil:'networkidle'});
      await oldPage.evaluate(async()=>{
        const {saveTrialFile}=await (new Function('path','return import(path)'))('/src/workspace/trialDataFiles.ts');
        const records=[];
        for(let index=1;index<=2;index++){
          const fileId=`old-csv-${index}`;await saveTrialFile(fileId,new File([`time,speed\n0,${index*100}\n1,${index*200}\n`],`old-${index}.csv`,{type:'text/csv'}));
          records.push({id:`old-record-${index}`,name:`旧记录 ${index}`,executionNumber:index,createdAt:'2026-10-14',actualConditions:[],measurements:[],tables:[],rawFiles:[{id:fileId,name:`old-${index}.csv`,headers:['time','speed'],rowCount:2}],charts:[{id:'old-chart',name:'历史同名',rawFileId:fileId,xField:'time',yField:'speed',chartType:'line',startRow:0,endRow:0,scale:1,offset:0,color:'#1677ff',smooth:false,createdAt:'2026-10-14',updatedAt:'2026-10-14',modelId:'preserved-model'}]});
        }
        const device={id:'old-device',name:'旧风扇',parameters:[],materials:[],children:[],designs:[],models:[],experiments:[{id:'old-setup',name:'旧构型',parameters:[],trials:[{id:'old-trial',name:'旧试验',loadSpectrum:'LS-old',records}]}]};
        localStorage.setItem('protangram-physical-objects-v1',JSON.stringify({version:5,state:{objects:[{id:'old-category',name:'涵道风扇',type:'涵道风扇',configurations:[device]}]}}));
      });
      const legacyURL=`${baseURL}/physical-objects?objectId=old-category&configurationId=old-device&experimentId=old-setup&trialId=old-trial`;
      await oldPage.goto(legacyURL,{waitUntil:'networkidle'});
      assert.equal(await oldPage.locator('.physical-shared-charts .ant-table-row').count(),2);
      assert.equal(await oldPage.locator('.physical-shared-charts').getByText('历史重名',{exact:true}).count(),2);
      const oldState=await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('protangram-physical-objects-v1')));assert.equal(oldState.version,6);
      const oldTrial=oldState.state.objects[0].configurations[0].experiments[0].trials[0];assert.equal(oldTrial.charts.length,2);assert.equal(oldTrial.records[0].charts,undefined);assert.equal(oldTrial.charts[1].modelId,'preserved-model');
      await oldPage.locator('.physical-shared-charts .ant-table-row').nth(1).getByRole('button',{name:'查看',exact:true}).click();await oldPage.getByRole('dialog').locator('canvas').waitFor();
      await oldPage.getByRole('dialog').getByText('原始 CSV：old-2.csv',{exact:true}).waitFor();await oldPage.getByRole('dialog').getByRole('button',{name:'前往来源记录'}).click();
      const before=JSON.stringify(oldTrial.records);await oldPage.locator('.physical-charts-grid').getByRole('button',{name:'导出 PNG',exact:true}).click();await oldPage.getByText('本具体试验已有同名图表，请使用其他名称。',{exact:true}).waitFor();
      await oldPage.locator('.physical-charts-grid').getByRole('button',{name:'配置',exact:true}).click();await oldPage.getByRole('dialog').getByLabel('图表名称').fill('旧记录二曲线');await oldPage.getByRole('dialog').getByRole('button',{name:'保存成果',exact:true}).click();await oldPage.getByRole('dialog').waitFor({state:'hidden'});
      await oldPage.goto(legacyURL,{waitUntil:'networkidle'});const after=await oldPage.evaluate(()=>JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects[0].configurations[0].experiments[0].trials[0]);
      assert.deepEqual(after.charts.map(item=>[item.id,item.sourceRecordId,item.name]),[['old-chart','old-record-1','历史同名'],['old-chart','old-record-2','旧记录二曲线']]);assert.equal(JSON.stringify(after.records),before);
      const reference=await oldPage.evaluate(async()=>{const load=new Function('path','return import(path)');const {usePhysicalObjectStore}=await load('/src/workspace/physicalObjectStore.ts');const {resolveRecordChart}=await load('/src/workspace/physicalBusinessContext.ts');return resolveRecordChart(usePhysicalObjectStore.getState().objects,{physicalObjectId:'old-device',experimentId:'old-setup',testRecordId:'old-record-1',chartId:'old-chart'}).rawFile.id;});assert.equal(reference,'old-csv-1');
    }finally{await legacy.close();}
  });
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);
  await writeFile(`${output}/results.json`,JSON.stringify({baseURL,passed,pageErrors:errors,blockedWrites:writes,downloads:downloads.map(item=>item.suggestedFilename())},null,2));
}catch(error){await page.screenshot({path:`${output}/failure.png`,fullPage:true}).catch(()=>{});await writeFile(`${output}/failure.txt`,`${error.stack}\n${page.url()}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`);throw error;}
finally{await browser.close();}
