import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
const output = resolve('node_modules/.tmp/physical-source-interactions');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium-1248/chrome-linux64/chrome', env: { ...process.env, ...(existsSync('/tmp/protangram-browser-check/windows-fonts.conf') ? { FONTCONFIG_FILE: '/tmp/protangram-browser-check/windows-fonts.conf' } : {}), LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu' } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage();page.setDefaultTimeout(20000);
const errors = [], blockedWrites = [], results = [], consoleErrors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') consoleErrors.push(message.text()); });
await context.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? (blockedWrites.push(route.request().url()), route.abort()) : route.continue());
const test = async (name, work) => { await work();results.push(name);console.log(`PASS ${name}`); };
const state = () => page.evaluate(() => ({ objects: JSON.parse(localStorage.getItem('protangram-physical-objects-v1') ?? '{}').state?.objects ?? [], sessions: JSON.parse(localStorage.getItem('protangram-work-sessions-v1') ?? '{}').sessions ?? [] }));
const main = () => page.locator('.physical-flow-main'), dialog = () => page.getByRole('dialog'), panel = () => page.locator('.physical-source-panel');
const save = async () => { await dialog().getByRole('button', { name: /保\s*存(?:成果)?$/ }).click();await dialog().waitFor({ state: 'hidden' }); };
const choose = async (select, label) => { await select.click();const controls = await select.getAttribute('aria-controls');const dropdown = controls ? page.locator('.ant-select-dropdown').filter({ has: page.locator(`[id="${controls}"]`) }) : page.locator('.ant-select-dropdown:visible');await dropdown.locator('.ant-select-item-option').filter({ hasText: label }).first().click(); };
const go = path => page.goto(baseURL + path, { waitUntil: 'networkidle' });
const route = (objectId, configurationId, experimentId, trialId, recordId) => '/physical-objects?' + new URLSearchParams(Object.fromEntries(Object.entries({ objectId, configurationId, experimentId, trialId, recordId }).filter(([, value]) => value !== undefined)));
const csv = (name, contents = 'speed,thrust\n1000,10\n2000,20\n3000,30\n') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(contents) });
let family, a, b, experiment, trial, first, second, sessionA, sessionB, taskId;
const currentTrial = async () => (await state()).objects[0].configurations[0].experiments[0].trials[0];
try {
  await test('左侧常驻类别与对象，类别内创建 A/B 设备并继承父级', async () => {
    await go('/');assert.equal(await page.locator('.business-sidebar').getByRole('button', { name: '专业功能', exact: true }).count(), 0);
    for (const category of ['涵道风扇', '电机', '电推进']) await page.getByRole('tree').getByText(category, {exact:true}).waitFor();
    family = { id: 'category-fan' };
    for (const name of ['验收风扇 A', '验收风扇 B']) {
      await page.getByRole('tree').getByRole('button', { name: '在涵道风扇下新建具体物理对象' }).click();await page.waitForURL(url => !url.searchParams.has('create'));assert.equal(await dialog().getByRole('combobox').count(), 0);await dialog().getByLabel('名称', { exact: true }).fill(name);await save();
    }
    [a, b] = (await state()).objects[0].configurations;assert.notEqual(a.id, b.id);for (const object of [a,b]) await page.getByRole('tree').getByText(object.name, {exact:true}).waitFor();
    await go(route(family.id, a.id));assert.equal(await main().getByRole('button', { name: '模型定义', exact: true }).count(), 0);assert.equal(await main().getByRole('combobox').count(), 0);
  });
  await test('技术参数批量添加、独立描述和 ID 编辑，编辑按钮位于最右侧', async () => {
    await main().getByRole('button', { name: '新增参数' }).click();
    for (const [index, name, value, unit, description] of [[0,'转速','1200','r/min','转速说明'],[1,'直径','600','mm','直径说明']]) {
      if (index) await dialog().getByRole('button', { name: '增加参数行' }).first().click();
      await dialog().getByRole('textbox', { name: '参数名称', exact: true }).nth(index).fill(name);await dialog().getByRole('textbox', { name: '参数内容', exact: true }).nth(index).fill(value);await dialog().getByRole('textbox', { name: '单位', exact: true }).nth(index).fill(unit);await dialog().getByRole('textbox', { name: '参数描述', exact: true }).nth(index).fill(description);
    }
    await save();const fields = (await state()).objects[0].configurations[0].parameters;
    for (const field of fields) { await main().getByText(field.name, { exact: true }).hover();await page.getByRole('tooltip').getByText(field.description, { exact: true }).waitFor(); }
    const row = main().locator('.physical-field-row').filter({ hasText: '转速' });const bounds = await row.boundingBox(), button = await row.getByRole('button').boundingBox();assert.ok(button.x + button.width > bounds.x + bounds.width - 30);
    await row.getByRole('button', { name: /编\s*辑/ }).click();await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('1300');await save();assert.equal((await state()).objects[0].configurations[0].parameters[0].id, fields[0].id);
  });
  await test('试验构型使用单一批量参数表，编辑后父级和字段 ID 保持正确', async () => {
    await main().getByRole('button', { name: '新建试验构型' }).click();await dialog().getByLabel('名称', { exact: true }).fill('验收探针布置');await choose(dialog().getByLabel('适用试验类型'), '推力试验');await dialog().getByRole('textbox', { name: '参数名称', exact: true }).fill('探针数量');await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('2');await save();
    experiment = (await state()).objects[0].configurations[0].experiments[0];assert.equal(experiment.settings, undefined);assert.equal((await state()).objects[0].configurations[1].experiments.length, 0);
    await main().getByRole('button', { name: '编辑试验构型' }).click();await dialog().getByLabel('名称', { exact: true }).fill('验收探针布置已编辑');await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('3');await save();const edited = (await state()).objects[0].configurations[0].experiments[0];assert.equal(edited.parameters[0].id, experiment.parameters[0].id);experiment = edited;await page.getByRole('tree').getByText(experiment.name, { exact: true }).waitFor();await page.getByRole('tree').getByText(a.name, {exact:true}).waitFor();
  });
  await test('自主具体试验只需载荷谱标识，首次记录可上传多个 CSV', async () => {
    await main().getByRole('button', { name: '新建具体试验' }).click();await dialog().getByLabel('名称', { exact: true }).fill('验收起飞试验');await dialog().getByLabel('载荷谱名称或编号').fill('载荷谱 01');assert.equal(await dialog().getByPlaceholder('目标值').count(), 0);await save();trial = await currentTrial();await main().getByRole('button', { name: '返回试验构型' }).click();await main().getByRole('button', { name: '编辑试验构型' }).click();assert.equal(await dialog().getByRole('textbox', { name: '参数内容', exact: true }).isEnabled(), true);await dialog().getByRole('button', { name: /取\s*消/ }).click();await go(route(family.id, a.id, experiment.id, trial.id));assert.equal(trial.taskBookId, undefined);assert.equal(trial.loadSpectrum, '载荷谱 01');
    await main().getByRole('button', { name: '创建第 1 次记录' }).click();await dialog().locator('input[type=file]').setInputFiles([csv('run1-a.csv'),csv('run1-b.csv', 'key,speed,thrust\nrow-a,1000,10\nrow-b,2000,20\nrow-c,3000,30\n')]);await save();first = (await currentTrial()).records[0];assert.equal(first.executionNumber, 1);assert.equal(first.rawFiles.length, 2);assert.equal(first.name, '第 1 次试验记录');
    assert.equal(await main().locator('.physical-execution-list').count(), 0);
  });
  await test('同一记录生成多张图表和可保存数据表，配置独立且刷新恢复', async () => {
    for (const [name, scale] of [['推力趋势','1'],['修正推力','2']]) {
      await main().getByRole('button', { name: '新建图表', exact: true }).click();await dialog().getByLabel('图表名称').fill(name);await choose(dialog().getByLabel('本次记录的 CSV 文件'), 'run1-a.csv');await dialog().getByLabel('Y 缩放').fill(scale);await save();
    }
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();await main().locator('.physical-charts-grid .ant-card').filter({ hasText: '推力趋势' }).getByRole('button', { name: /配\s*置/ }).click();await dialog().getByLabel('Y 缩放').fill('3');await save();
    await main().getByRole('button', { name: '新建数据表' }).click();await choose(dialog().getByLabel('本次记录的 CSV 文件'), 'run1-b.csv');await save();await main().locator('.physical-data-table tbody').getByText('1000', { exact: true }).waitFor();await main().locator('.physical-data-table tbody').getByText('row-a', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' });first = (await currentTrial()).records[0];assert.equal((await currentTrial()).charts.filter(chart => chart.sourceRecordId === first.id)[0].scale, 3);assert.equal((await currentTrial()).charts.filter(chart => chart.sourceRecordId === first.id)[1].scale, 2);assert.equal(first.tables.length, 1);assert.equal(first.rawFiles.length, 2);await main().locator('.physical-charts-grid canvas').nth(1).waitFor();await page.screenshot({ path: `${output}/record-charts-table.png`, fullPage: true });
  });
  await test('复测建立第 2 次记录，两次执行的 CSV、图表与数据表互不影响', async () => {
    const before = structuredClone(first);await main().getByRole('button', { name: '返回具体试验', exact: true }).click();await main().getByRole('button', { name: '新增一次记录' }).click();await dialog().locator('input[type=file]').setInputFiles(csv('run2.csv', 'speed,thrust\n1500,40\n2500,50\n'));await save();second = (await currentTrial()).records[1];assert.notEqual(first.id, second.id);assert.equal(second.executionNumber, 2);assert.equal((await currentTrial()).charts.filter(chart => chart.sourceRecordId === second.id).length, 0);assert.equal(second.tables.length, 0);assert.deepEqual((await currentTrial()).records[0], before);
    await main().getByRole('button', { name: '新建图表', exact: true }).click();await choose(dialog().getByLabel('本次记录的 CSV 文件'), 'run2.csv');assert.equal(await page.getByRole('option', { name: /run1/ }).count(), 0);await save();assert.equal((await currentTrial()).charts.filter(chart => chart.sourceRecordId === second.id).length, 1);
    await go(route(family.id, a.id, experiment.id, trial.id));assert.equal(await main().locator('.physical-record-heading').count(), 0);await main().locator('.physical-execution-table').waitFor();await main().getByRole('button', { name: /第 1 次/ }).click();await main().locator('.physical-data-table').waitFor();assert.equal(new URL(page.url()).searchParams.get('recordId'), first.id);
  });
  await test('记录来源严格匹配，失效 ID 不回退；有效记录返回和重新进入正确', async () => {
    for (const id of ['missing','']) { await go(route(family.id, a.id, experiment.id, trial.id, id));await page.getByText('指定的试验记录不存在或已失效，未切换到其他记录。', { exact: true }).waitFor();assert.equal(await main().locator('.physical-record-heading').count(), 0); }
    await page.getByRole('button', { name: '返回所属具体试验' }).click();assert.equal(await main().locator('.physical-record-heading').count(), 0);await main().getByRole('button', { name: /第 2 次/ }).click();assert.equal(new URL(page.url()).searchParams.get('recordId'), second.id);await page.reload({ waitUntil: 'networkidle' });await main().getByText(/run2.csv/).first().waitFor();
  });
  await test('从两次记录分别进入专业功能，会话按记录隔离并继承各自来源', async () => {
    await main().getByRole('button', { name: '数据分析', exact: true }).click();await panel().getByText(/当前来源：/).waitFor();sessionB = new URL(page.url()).pathname.split('/')[2];assert.equal(await panel().getByRole('combobox', { name: '选择已有业务来源' }).count(), 0);
    await page.locator('.session-capability-tabs').getByRole('button', { name: /数字孪生$/ }).click();await panel().getByText(/当前来源：/).waitFor();assert.equal(new URL(page.url()).pathname.split('/')[2], sessionB);await panel().getByRole('button', { name: '返回原始记录' }).click();assert.equal(new URL(page.url()).searchParams.get('recordId'), second.id);
    await main().getByRole('button', { name: '返回具体试验', exact: true }).click();await main().getByRole('button', { name: /第 1 次/ }).click();await main().getByRole('button', { name: '数据分析', exact: true }).click();await panel().getByText(/当前来源：/).waitFor();sessionA = new URL(page.url()).pathname.split('/')[2];assert.notEqual(sessionA, sessionB);await panel().getByText(/对象参数与原始记录/).click();await panel().getByText(/转速：1300/).waitFor();assert.equal(await panel().getByText(/run2.csv/).count(), 0);
    await page.reload({ waitUntil: 'networkidle' });const scope = (await state()).sessions.find(item => item.id === sessionA).businessScope;assert.equal(scope.testRecordId, first.id);assert.equal(scope.trialId, trial.id);
  });
  await test('已有执行后编辑不覆盖试验构型参数或载荷谱，名称与说明仍可修改', async () => {
    const before = await currentTrial();await go(route(family.id, a.id, experiment.id));await main().getByRole('button', { name: '编辑试验构型' }).click();assert.equal(await dialog().getByRole('textbox', { name: '参数内容', exact: true }).isDisabled(), true);await dialog().getByLabel('名称', { exact: true }).fill('验收布置名称更正');await save();
    await go(route(family.id, a.id, experiment.id, trial.id));await main().getByRole('button', { name: '编辑具体试验' }).click();assert.equal(await dialog().getByLabel('载荷谱名称或编号').isDisabled(), true);await dialog().getByLabel('说明', { exact: true }).fill('说明更正');await save();assert.deepEqual((await currentTrial()).records, before.records);
  });
  await test('任务书工作台发起试验和关联自主试验，共用同一层级与记录结构', async () => {
    await go('/task-center');await page.getByRole('button', { name: '新建任务书' }).click();await dialog().getByRole('textbox').fill('验收任务书');await dialog().getByRole('button', { name: '创建任务书' }).click();await dialog().waitFor({ state: 'hidden' });taskId = new URL(page.url()).searchParams.get('taskId');
    await page.getByRole('button', { name: '添加关联试验' }).click();await choose(page.getByRole('combobox', { name: '选择尚未关联任务书的具体试验' }), '验收起飞试验');await page.getByRole('button', { name: '关联已有试验', exact: true }).click();await page.locator('.physical-book-tests').getByText(/第 2 次/).waitFor();assert.equal((await currentTrial()).taskBookId, taskId);
    await page.getByRole('button', { name: '添加关联试验' }).click();await choose(page.getByRole('combobox', { name: '选择开展试验的试验构型' }), '验收布置名称更正');await page.getByRole('button', { name: '发起具体试验' }).click();await dialog().getByLabel('名称', { exact: true }).fill('验收任务驱动试验');await dialog().getByLabel('载荷谱名称或编号').fill('载荷谱 02');assert.match(await dialog().locator('.ant-select').first().innerText(), /验收任务书/);await save();
    const taskTrial = (await state()).objects[0].configurations[0].experiments[0].trials[1];assert.equal(taskTrial.taskBookId, taskId);assert.equal(taskTrial.loadSpectrum, '载荷谱 02');assert.equal(taskTrial.records.length, 0);
    await go('/physical-objects?view=taskbooks&taskId='+taskId);await page.locator('.physical-book-tests').getByRole('button', { name: '查看同一记录与成果' }).nth(1).click();assert.equal(new URL(page.url()).searchParams.get('recordId'), second.id);
  });
  await test('独立工具入口可选来源，更换 B 构型不会沿用 A 的记录或参数', async () => {
    await go('/physical-objects?view=tools');await page.locator('.physical-tool-grid .ant-card').filter({ hasText: '数据分析' }).getByRole('button', { name: /打\s*开/ }).click();await panel().getByRole('combobox', { name: '选择已有业务来源' }).waitFor();await choose(panel().getByRole('combobox', { name: '选择已有业务来源' }), '第 1 次试验记录');await panel().getByText(/当前来源：/).waitFor();assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
    await panel().getByRole('button', { name: '更换来源' }).click();await choose(panel().getByRole('combobox', { name: '选择已有业务来源' }), '验收风扇 B（技术参数）');await panel().getByRole('button', { name: '返回来源', exact: true }).click();await main().getByRole('heading', { name: b.name, exact: true }).waitFor();assert.equal(await main().getByText('转速', { exact: true }).count(), 0);assert.equal(await main().locator('.physical-record-heading').count(), 0);
  });
  await test('v3 浏览器迁移保留旧记录、CSV、图表和原 URL，历史记录并入执行列表', async () => {
    const legacyContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await legacyContext.route('**/*', route => ['POST','PUT','PATCH','DELETE'].includes(route.request().method()) ? route.abort() : route.continue());
    await legacyContext.addInitScript(() => {
      if (localStorage.getItem('protangram-physical-objects-v1')) return;
      const file = { id:'legacy-csv',name:'legacy.csv',headers:['speed','thrust'],rowCount:2,size:30,mimeType:'text/csv',addedAt:'2026-10-13' };
      const chart = { id:'legacy-chart',name:'保留旧图表',rawFileId:file.id,xField:'speed',yField:'thrust',chartType:'line',startRow:0,endRow:0,scale:1,offset:0,color:'#1677ff',smooth:false,createdAt:'2026-10-13',updatedAt:'2026-10-13' };
      const record = { id:'legacy-record',name:'旧当前记录',createdAt:'2026-10-13',rawFiles:[file],charts:[chart],actualConditions:[],measurements:[] };
      const common = {parameters:[],materials:[],children:[],designs:[],models:[],experiments:[]};
      localStorage.setItem('protangram-physical-objects-v1',JSON.stringify({version:3,state:{objects:[{...common,id:'legacy-object',name:'旧物理对象',type:'涵道风扇',configurations:[{...common,id:'legacy-config',name:'旧具体构型',description:'',experiments:[{id:'legacy-experiment',name:'旧试验布置',settings:[{id:'old-setting',name:'旧布置参数',value:'出口',form:'单值'}],parameters:[],trials:[{id:'legacy-trial',name:'旧具体试验',designs:[],record,archivedRecords:[{...record,id:'legacy-archive',name:'旧历史记录',createdAt:'2026-10-12',rawFiles:[],charts:[]}]}]}]}]}]}}));
    });
    const legacyPage = await legacyContext.newPage();legacyPage.setDefaultTimeout(12000);legacyPage.on('pageerror', error => errors.push(error.message));
    const oldURL = baseURL + '/physical-objects?objectId=legacy-object&configurationId=legacy-config&experimentId=legacy-experiment&recordId=legacy-record';
    try {
      await legacyPage.goto(oldURL, {waitUntil:'networkidle'});
      await legacyPage.evaluate(async () => {
        const db = await new Promise((resolve,reject) => {const request=indexedDB.open('protangram-trial-files',1);request.onupgradeneeded=()=>request.result.createObjectStore('files',{keyPath:'id'});request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
        await new Promise((resolve,reject) => {const transaction=db.transaction('files','readwrite');transaction.objectStore('files').put({id:'legacy-csv',blob:new Blob(['speed,thrust\n1000,10\n2000,20\n'],{type:'text/csv'})});transaction.oncomplete=resolve;transaction.onerror=()=>reject(transaction.error);});db.close();
      });
      await legacyPage.reload({waitUntil:'networkidle'});await legacyPage.locator('.physical-charts-grid canvas').waitFor();
      const migrated=await legacyPage.evaluate(()=>JSON.parse(localStorage.getItem('protangram-physical-objects-v1')));const experiment=migrated.state.objects[0].configurations[0].experiments[0];
      assert.equal(migrated.version,6);assert.equal(experiment.parameters[0].id,'old-setting');assert.equal(experiment.trials[0].id,'legacy-trial');assert.deepEqual(experiment.trials[0].records.map(record=>record.id),['legacy-archive','legacy-record']);assert.equal(experiment.trials[0].charts.find(chart => chart.sourceRecordId === "legacy-record").id,'legacy-chart');
      await legacyPage.locator('.physical-flow-main').getByRole('button',{name:'数据分析',exact:true}).click();await legacyPage.locator('.physical-source-panel').getByRole('button',{name:'返回原始记录'}).click();assert.equal(new URL(legacyPage.url()).searchParams.get('recordId'),'legacy-record');assert.equal(new URL(legacyPage.url()).searchParams.get('trialId'),'legacy-trial');
      await legacyPage.getByRole('button',{name:'返回具体试验',exact:true}).click();await legacyPage.locator('.physical-execution-table').getByRole('button',{name:/旧历史记录/}).click();await legacyPage.locator('.physical-flow-main').getByRole('button',{name:'编辑记录 / 添加文件'}).click();await legacyPage.getByRole('dialog').getByRole('button',{name:/取\s*消/}).click();
    } catch (error) { await writeFile(`${output}/legacy-failure.txt`, `${error.stack}\n${legacyPage.url()}\n${JSON.stringify(await legacyPage.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1'))))}\n${await legacyPage.locator('body').innerText()}`);throw error; } finally { await legacyContext.close(); }
  });
  await test('前端无运行时异常，窄屏导航正常，测试未向服务端写数据', async () => {
    assert.deepEqual(errors, []);assert.deepEqual(blockedWrites, []);await page.setViewportSize({ width: 390, height: 844 });await page.getByRole('button', { name: '打开业务导航' }).click();await page.waitForFunction(() => Math.abs(document.querySelector('.business-sidebar').getBoundingClientRect().left) < 1);assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);await page.screenshot({ path: `${output}/mobile-navigation.png`, fullPage: true });
  });
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, passed: results, pageErrors: errors, blockedWrites }, null, 2));console.log(`Passed ${results.length} browser scenarios`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});await writeFile(`${output}/failure.txt`, `${error.stack}\nURL: ${page.url()}\nPage errors: ${JSON.stringify(errors)}\nConsole: ${JSON.stringify(consoleErrors)}\n${await page.locator('body').innerText()}`);throw error;
} finally { await browser.close(); }
