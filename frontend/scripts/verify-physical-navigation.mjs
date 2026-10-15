import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5175';
const output = resolve('node_modules/.tmp/physical-navigation');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'],
  executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell',
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu',
    ...(existsSync('/tmp/protangram-browser-check/windows-fonts.conf') ? { FONTCONFIG_FILE: '/tmp/protangram-browser-check/windows-fonts.conf' } : {}) } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const errors = [], writes = [], passed = [];
await context.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? (writes.push(route.request().url()), route.abort()) : route.continue());
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.on('pageerror', error => errors.push(error.message));
const test = async (name, work) => { await work(); passed.push(name); console.log(`PASS ${name}`); };
const main = () => page.locator('.physical-flow-main');
const dialog = () => page.getByRole('dialog');
const tree = () => page.getByRole('tree');
const selected = () => page.locator('.business-object-tree .ant-tree-node-selected');
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
const save = async () => { await dialog().getByRole('button', { name: /保\s*存(?:成果)?$/ }).click(); await dialog().waitFor({ state: 'hidden' }); };
const choose = async (select, label) => {
  await select.click();
  const id = await select.getAttribute('aria-controls');
  const dropdown = page.locator('.ant-select-dropdown:visible').filter({ has: page.locator(`[id="${id}"]`) });
  const exact = dropdown.locator('.ant-select-item-option').filter({ has: page.getByText(label, { exact: true }) });
  await (await exact.count() ? exact : dropdown.locator('.ant-select-item-option').filter({ hasText: label })).first().click();
};
const csv = (name, contents = 'time,thrust\n0,10\n1,20\n2,30\n') => ({ name, mimeType: 'text/csv', buffer: Buffer.from(contents) });
let category, object, experiment, trial, first, second, taskId;
const route = extra => `${baseURL}/physical-objects?${new URLSearchParams({ objectId: category.id, configurationId: object.id, experimentId: experiment.id, ...extra })}`;
const currentTrial = async () => (await saved()).find(item => item.id === category.id).configurations.find(item => item.id === object.id).experiments.find(item => item.id === experiment.id).trials[0];

try {
  await test('类别只展开收起；从类别旁入口创建物理对象，不产生类别列表页', async () => {
    await page.goto(baseURL, { waitUntil: 'networkidle' });
    const before = page.url();
    await tree().getByRole('button', { name: '涵道风扇', exact: true }).click();
    assert.equal(page.url(), before);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(await tree().getByRole('button', { name: '涵道风扇', exact: true }).getAttribute('aria-expanded'), 'false');
    await tree().getByRole('button', { name: '涵道风扇', exact: true }).click();
    await tree().getByRole('button', { name: '在涵道风扇下新建具体物理对象' }).click();
    await page.waitForURL(url => url.pathname === '/physical-objects' && !url.searchParams.has('create'));
    await dialog().getByLabel('名称', { exact: true }).fill('电涵道风扇'); await save();
    category = (await saved()).find(item => item.name === '涵道风扇'); object = category.configurations[0];
    await main().getByRole('heading', { name: object.name, exact: true }).waitFor();
    assert.equal(await main().getByRole('button', { name: '查看', exact: true }).count(), 0);
    assert.equal(await main().getByRole('button', { name: '返回对象类别' }).count(), 0);
    assert.equal(await selected().innerText(), object.name);
  });
  await test('技术参数增改、创建试验构型保留；树展示第三层，右侧不重复列下级对象', async () => {
    await main().getByRole('button', { name: '新增参数' }).click();
    await dialog().getByRole('textbox', { name: '参数名称', exact: true }).fill('直径');
    await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('600');
    await dialog().getByRole('textbox', { name: '单位', exact: true }).fill('mm'); await save();
    const parameter = (await saved()).find(item => item.id === category.id).configurations[0].parameters[0];
    await main().locator('.physical-field-row').getByRole('button', { name: /编\s*辑/ }).click();
    await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('650'); await save();
    assert.equal((await saved()).find(item => item.id === category.id).configurations[0].parameters[0].id, parameter.id);
    for (const name of ['试验构型 01', '试验构型 02']) {
      await tree().getByText(object.name, { exact: true }).click();
      await main().getByRole('button', { name: '新建试验构型' }).click();
      await dialog().getByLabel('名称', { exact: true }).fill(name);
      await choose(dialog().getByLabel('适用试验类型'), '推力试验');
      await dialog().getByRole('textbox', { name: '参数名称', exact: true }).fill('探针数');
      await dialog().getByRole('textbox', { name: '参数内容', exact: true }).fill('2'); await save();
      await tree().getByText(name, { exact: true }).waitFor(); assert.equal(await selected().innerText(), name);
    }
    experiment = (await saved()).find(item => item.id === category.id).configurations[0].experiments[0];
    await tree().getByText(object.name, { exact: true }).click();
    assert.equal(await main().locator('.physical-list-row').count(), 0);
    await tree().getByText(experiment.name, { exact: true }).click();
    await main().getByRole('heading', { name: experiment.name, exact: true }).waitFor();
    await main().getByRole('button', { name: '编辑试验构型' }).click();
    await dialog().getByLabel('说明', { exact: true }).fill('导航验收构型'); await save();
    assert.equal(await selected().innerText(), experiment.name);
  });
  await test('从构型表格创建具体试验和记录，完整路径与树定位一致', async () => {
    await main().getByRole('button', { name: '新建具体试验' }).click();
    await dialog().getByLabel('名称', { exact: true }).fill('性能试验 001');
    await dialog().getByLabel('载荷谱名称或编号').fill('LS-001'); await save();
    trial = await currentTrial(); assert.equal(trial.taskBookId, undefined);
    await main().getByRole('button', { name: '创建第 1 次记录' }).click();
    await dialog().locator('input[type=file]').setInputFiles([csv('first-a.csv'), csv('first-b.csv')]); await save();
    first = (await currentTrial()).records[0];
    assert.equal(first.rawFiles.length, 2); assert.equal((await currentTrial()).records.length, 1);
    assert.match(await page.getByRole('navigation', { name: '业务路径' }).innerText(), /涵道风扇[\s\S]*电涵道风扇[\s\S]*试验构型 01[\s\S]*性能试验 001[\s\S]*第 1 次试验记录/);
    assert.equal(await selected().innerText(), experiment.name);
    assert.equal(await tree().getByText(trial.name, { exact: true }).count(), 0);
    assert.equal(await tree().getByText(first.name, { exact: true }).count(), 0);
  });
  await test('同一记录的两张图表独立保存；专业入口和返回保持同一记录', async () => {
    for (const [name, scale] of [['C001', '1'], ['C002', '2']]) {
      await main().getByRole('button', { name: '新建图表', exact: true }).click();
      await dialog().getByLabel('图表名称').fill(name);
      await choose(dialog().getByLabel('本次记录的 CSV 文件'), 'first-a.csv');
      await dialog().getByLabel('Y 缩放').fill(scale); await save();
    }
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
    const charts = (await currentTrial()).charts.filter(chart => chart.sourceRecordId === first.id);
    assert.deepEqual(charts.map(item => item.scale), [1, 2]); assert.notEqual(charts[0].id, charts[1].id);
    assert.deepEqual((await currentTrial()).records[0].rawFiles, first.rawFiles);
    await main().getByRole('button', { name: '数据分析', exact: true }).click();
    await page.locator('.physical-source-panel').getByRole('button', { name: '返回原始记录' }).waitFor();
    assert.equal(await selected().innerText(), experiment.name);
    await page.locator('.physical-source-panel').getByRole('button', { name: '返回原始记录' }).click();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), first.id);
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
  });
  await test('返回具体试验管理多次执行；记录列表与数据分别独立，刷新仍定位原构型', async () => {
    await main().getByRole('button', { name: '返回具体试验', exact: true }).click();
    assert.equal(await main().locator('.physical-record-heading').count(), 0);
    await main().locator('.physical-execution-table').getByRole('button', { name: first.name, exact: true }).waitFor();
    await main().getByRole('button', { name: '新增一次记录' }).click();
    await dialog().locator('input[type=file]').setInputFiles([csv('second.csv', 'time,thrust\n0,90\n1,95\n')]); await save();
    second = (await currentTrial()).records[1];
    assert.equal(second.executionNumber, 2); assert.equal((await currentTrial()).charts.filter(chart => chart.sourceRecordId === second.id).length, 0);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal(new URL(page.url()).searchParams.get('recordId'), second.id);
    assert.equal(await selected().innerText(), experiment.name);
    assert.equal(await main().locator('.physical-charts-grid').count(), 0);
    await main().getByRole('button', { name: '返回具体试验', exact: true }).click();
    await main().locator('.physical-execution-table').getByRole('button', { name: first.name, exact: true }).click();
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
    assert.deepEqual((await currentTrial()).records[0].rawFiles, first.rawFiles);
    await page.getByRole('navigation', { name: '业务路径' }).getByRole('button', { name: experiment.name, exact: true }).click();
    await main().getByRole('heading', { name: experiment.name, exact: true }).waitFor();
  });
  await test('可选任务书通过同一具体试验关联，任务书入口指向同一记录与成果', async () => {
    await page.getByRole('button', { name: /任务书工作台$/ }).click();
    await page.getByRole('button', { name: /新建任务书$/ }).click();
    await dialog().getByRole('textbox').fill('导航验收任务书');
    await dialog().getByRole('button', { name: '创建任务书' }).click(); await dialog().waitFor({ state: 'hidden' });
    taskId = new URL(page.url()).searchParams.get('taskId'); assert.ok(taskId);
    await page.goto(route({ trialId: trial.id }), { waitUntil: 'networkidle' });
    await main().getByRole('button', { name: '编辑具体试验' }).click();
    await choose(dialog().getByLabel('任务书（可选，仅关联 ID）'), '导航验收任务书'); await save();
    assert.equal((await currentTrial()).taskBookId, taskId);
    await page.locator('.business-task-link').filter({hasText:'导航验收任务书'}).click();
    await page.getByRole('button', { name: '查看同一记录与成果' }).first().click();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), first.id);
    assert.equal(await selected().innerText(), experiment.name);
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
  });
  await test('1001 项具体试验只渲染当前页；名称、载荷谱、任务书查询及筛选有效', async () => {
    // Large-volume fixture is isolated to this browser context. Existing records
    // and their file IDs remain untouched; all other trials have no execution.
    await page.evaluate(({ categoryId, objectId, experimentId, taskId }) => {
      const data = JSON.parse(localStorage.getItem('protangram-physical-objects-v1'));
      const setup = data.state.objects.find(item => item.id === categoryId).configurations.find(item => item.id === objectId).experiments.find(item => item.id === experimentId);
      for (let index = 2; index <= 1001; index++) setup.trials.push({ id: `bulk-${index}`, name: `性能试验 ${String(index).padStart(4, '0')}`, loadSpectrum: `LS-${index}`, taskBookId: index % 2 ? taskId : undefined, records: [], charts: [] });
      localStorage.setItem('protangram-physical-objects-v1', JSON.stringify(data));
    }, { categoryId: category.id, objectId: object.id, experimentId: experiment.id, taskId });
    await page.goto(route({}), { waitUntil: 'networkidle' });
    assert.equal(await main().locator('.physical-trials-table .ant-table-row').count(), 10);
    assert.ok(await tree().getByRole('treeitem').count() < 10);
    const query = main().getByRole('textbox', { name: '搜索具体试验' });
    await query.fill('LS-1001');
    await main().getByRole('button', { name: '性能试验 1001', exact: true }).waitFor();
    assert.equal(await main().locator('.physical-trials-table .ant-table-row').count(), 1);
    await query.fill('导航验收任务书');
    await main().locator('.ant-pagination-total-text').getByText('共 501 项 / 全部 1001 项', { exact: true }).waitFor();
    await query.fill('');
    await choose(main().getByRole('combobox', { name: '筛选关联任务书' }), '自主试验');
    await main().locator('.ant-pagination-total-text').getByText('共 500 项 / 全部 1001 项', { exact: true }).waitFor();
    await main().getByRole('button', { name: '重置筛选' }).click();
  });
  await test('分页、筛选与展开状态在进入详情、返回、刷新时保留，不复制数据', async () => {
    await main().locator('.ant-pagination-item-2').click();
    await page.waitForURL(url => url.searchParams.get('trialPage') === '2');
    await choose(main().locator('.ant-pagination-options').getByRole('combobox'), '50 条/页');
    await page.waitForURL(url => url.searchParams.get('trialPageSize') === '50' && url.searchParams.get('trialPage') === '1');
    await main().locator('.ant-pagination-item-3').click();
    await page.waitForURL(url => url.searchParams.get('trialPage') === '3');
    assert.equal(await main().locator('.physical-trials-table .ant-table-row').count(), 50);
    await main().getByRole('button', { name: '性能试验 0101', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('trialId'), 'bulk-101');
    await main().getByRole('button', { name: '返回试验构型', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('trialPage'), '3');
    await page.reload({ waitUntil: 'networkidle' });
    await main().getByRole('button', { name: '性能试验 0101', exact: true }).waitFor();
    assert.equal(await selected().innerText(), experiment.name);
    const snapshot = await saved();
    await tree().getByRole('button', { name: category.name, exact: true }).click();
    await tree().getByText(experiment.name, { exact: true }).waitFor({ state: 'hidden' });
    await page.reload({ waitUntil: 'networkidle' });
    await tree().getByText(experiment.name, { exact: true }).waitFor();
    await tree().getByText('试验构型 02', { exact: true }).click();
    await main().getByRole('heading', { name: '试验构型 02', exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('trialPage'), false);
    assert.equal(await selected().innerText(), '试验构型 02');
    await page.goBack({ waitUntil: 'networkidle' });
    assert.equal(await selected().innerText(), experiment.name);
    assert.deepEqual(await saved(), snapshot);
    await page.screenshot({ path: `${output}/trial-table.png`, fullPage: true });
  });
  await test('失效与冲突 ID 不回退到其他试验，旧记录链接仍可准确恢复', async () => {
    const sibling = (await saved()).find(item => item.id === category.id).configurations[0].experiments[1];
    await page.goto(route({ experimentId: sibling.id, trialId: trial.id, recordId: first.id }), { waitUntil: 'networkidle' });
    await page.getByRole('alert').getByText(/指定的试验记录不存在/).waitFor();
    assert.equal(await main().getByRole('button').count(), 0);
    assert.equal(await main().locator('.physical-record-heading').count(), 0);
    assert.equal(await selected().innerText(), sibling.name);
    await page.goto(route({ trialId: trial.id, recordId: 'missing-record' }), { waitUntil: 'networkidle' });
    await page.getByRole('alert').getByText(/指定的试验记录不存在/).waitFor();
    await page.getByRole('button', { name: '返回所属具体试验', exact: true }).click();
    assert.equal(await selected().innerText(), experiment.name);
    await main().locator('.physical-execution-table').getByRole('button', { name: first.name, exact: true }).waitFor();
    await page.goto(route({ recordId: first.id }), { waitUntil: 'networkidle' });
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
    assert.equal(await selected().innerText(), experiment.name);
    assert.equal((await currentTrial()).records.length, 2);
  });
  await test('窄屏表格独立滚动，移动导航与当前构型一致，无运行时异常', async () => {
    await page.goto(route({}), { waitUntil: 'networkidle' });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.getByRole('button', { name: '打开业务导航' }).click();
    await page.waitForFunction(() => Math.abs(document.querySelector('.business-sidebar').getBoundingClientRect().left) < 1);
    await selected().waitFor(); assert.equal(await selected().innerText(), experiment.name);
    await page.screenshot({ path: `${output}/mobile-navigation.png`, fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  });
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, passed, pageErrors: errors, blockedWrites: writes }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\n${page.url()}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`);
  throw error;
} finally { await browser.close(); }
