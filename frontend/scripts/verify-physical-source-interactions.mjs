import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5174';
const output = resolve('node_modules/.tmp/physical-source-interactions');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true,
  executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium-1248/chrome-linux64/chrome',
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu' },
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const results = [];
const test = async (name, work) => {
  await work(); results.push(name); console.log(`PASS ${name}`);
};
const state = () => page.evaluate(() => ({
  physical: JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state,
  sessions: JSON.parse(localStorage.getItem('protangram-work-sessions-v1') ?? '{}'),
}));
const route = (config = 'a', experiment = `e-${config}`, trial = `t-${config}`, record) => {
  const query = new URLSearchParams({ objectId: config === 'c' ? 'object-2' : 'object-1', configurationId: `config-${config}` });
  if (experiment) query.set('experimentId', experiment);
  if (trial) query.set('trialId', trial);
  if (record !== undefined) query.set('recordId', record);
  return `${baseURL}/physical-objects?${query}`;
};
const main = () => page.locator('.physical-flow-main');
const panel = () => page.locator('.physical-source-panel');
const dialog = () => page.getByRole('dialog');
const save = async () => { await dialog().getByRole('button', { name: /保\s*存/ }).click(); await dialog().waitFor({ state: 'hidden' }); };
const choose = async (select, label) => {
  await select.click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).first().click();
};
const sourceSelector = () => panel().getByRole('combobox', { name: '选择已有业务来源' });
let sessionA;
try {
  // Each launch uses an isolated browser context. Reload keeps this fixture's edits.
  await page.addInitScript(() => {
    if (localStorage.getItem('protangram-physical-objects-v1')) return;
    const common = { materials: [], children: [], designs: [], experiments: [], models: [] };
    const field = (id, name, value, form = '单值') => ({ id, name, value, unit: '', form, description: '字段说明', source: '手工录入' });
    const record = key => ({ id: `r-${key}`, name: `${key.toUpperCase()}当前记录`, createdAt: '2026-10-14', actualConditions: [], measurements: [field(`m-${key}`, '推力', key === 'a' ? '800' : '900')], rawFiles: [], charts: [] });
    const makeConfig = key => ({ ...common, id: `config-${key}`, name: `风扇 ${key.toUpperCase()}`, description: '', parameters: [field(`p-${key}`, '直径', key === 'a' ? '600' : '700')], experiments: [{
      id: `e-${key}`, name: `${key.toUpperCase()}试验布置`, description: '原说明', category: '性能与功能类', settings: [field(`s-${key}`, '探针布置', '出口')], parameters: [field(`ep-${key}`, '探针数量', '2')],
      trials: [{ id: `t-${key}`, name: `${key.toUpperCase()}具体试验`, designs: [], record: record(key), archivedRecords: [] }],
    }] });
    const a = makeConfig('a');
    a.experiments[0].trials[0].archivedRecords = [{ ...record('old'), name: 'A历史记录' }];
    a.experiments.push({ id: 'e-empty', name: '待开展试验布置', description: '', category: '性能与功能类', settings: [field('s-empty', '测量截面', '左/右', '分组')], parameters: [field('ep-empty', '采样率', '100')], trials: [] });
    const current = a.experiments[0].trials[0].record;
    current.rawFiles = [{ id: 'csv-a', name: 'shared.csv', mimeType: 'text/csv', size: 30, addedAt: '2026-10-14', headers: ['speed', 'thrust'], rowCount: 3 }];
    current.charts = [1, 2].map(scale => ({ id: `chart-${scale}`, name: `图表 ${scale}`, rawFileId: 'csv-a', xField: 'speed', yField: 'thrust', chartType: 'line', startRow: 0, endRow: 0, scale, offset: 0, color: '#1677ff', smooth: false, createdAt: '2026-10-14', updatedAt: '2026-10-14' }));
    const object = (id, name, configs) => ({ ...common, id, name, type: '涵道风扇', description: '', parameters: [], configurations: configs });
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ state: { objects: [object('object-1', '电涵道风扇', [a, makeConfig('b')]), object('object-2', '另一物理对象', [makeConfig('c')])] }, version: 3 }));
  });
  await test('失效或空记录 ID 不回退，显式返回后才显示当前记录', async () => {
    for (const id of ['missing', '', 'r-b']) {
      await page.goto(route('a', 'e-a', 't-a', id));
      await page.getByText('指定的试验记录不存在或已失效，未切换到其他记录。', { exact: true }).waitFor();
      assert.equal(await main().getByText('A当前记录', { exact: true }).count(), 0);
      assert.equal(await main().locator('.physical-charts-grid').count(), 0);
      assert.equal(await main().getByRole('button', { name: '创建唯一记录' }).count(), 0);
    }
    await page.getByRole('button', { name: '返回所属具体试验' }).click();
    await main().getByText('A当前记录', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.has('recordId'), false);
  });
  // Prepare real CSV bytes in the same isolated origin for chart rendering.
  await page.evaluate(async () => {
    const db = await new Promise((ok, fail) => { const r = indexedDB.open('protangram-trial-files', 1); r.onupgradeneeded = () => r.result.createObjectStore('files', { keyPath: 'id' }); r.onsuccess = () => ok(r.result); r.onerror = () => fail(r.error); });
    await new Promise((ok, fail) => { const t = db.transaction('files', 'readwrite'); t.objectStore('files').put({ id: 'csv-a', blob: new Blob(['speed,thrust\n1000,10\n2000,20\n3000,30\n'], { type: 'text/csv' }) }); t.oncomplete = ok; t.onerror = () => fail(t.error); });
    db.close();
  });
  await test('有效与历史记录严格匹配，原始 CSV 的两张图表正常显示', async () => {
    await page.goto(route('a', 'e-a', 't-a', 'r-a'));
    await main().getByText('A当前记录', { exact: true }).waitFor();
    await main().locator('.physical-charts-grid canvas').nth(1).waitFor();
    await page.goto(route('a', 'e-a', 't-a', 'r-old'));
    await main().getByText('A历史记录', { exact: true }).waitFor();
    assert.equal(await main().getByText('A当前记录', { exact: true }).count(), 0);
    assert.equal(await main().getByRole('button', { name: '编辑记录 / 添加文件' }).isDisabled(), true);
    await main().getByRole('button', { name: '数据分析', exact: true }).click();
    await panel().getByText(/当前来源：.*A历史记录/).waitFor();
    assert.equal(await sourceSelector().count(), 0);
    await panel().getByRole('button', { name: '更换来源', exact: true }).click();
    assert.match(await panel().locator('.ant-select').first().innerText(), /A历史记录/);
    await panel().getByRole('button', { name: '取消更换' }).click();
    await panel().getByRole('button', { name: '返回原始记录' }).click();
    await main().getByText('A历史记录', { exact: true }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), 'r-old');
  });
  await test('未开展的试验构型可编辑全部设置，字段 ID、形式和来源保留', async () => {
    await page.goto(route('a', 'e-empty', ''));
    await main().getByRole('button', { name: '编辑试验构型', exact: true }).click();
    await dialog().getByLabel('名称', { exact: true }).fill('已编辑试验布置');
    await dialog().getByLabel('说明', { exact: true }).fill('手工修改共用设置');
    await choose(dialog().locator('.ant-select'), '综合与考核类');
    await dialog().locator('.physical-form-list').nth(0).getByPlaceholder('内容', { exact: true }).fill('前/后');
    await dialog().locator('.physical-form-list').nth(1).getByPlaceholder('内容', { exact: true }).fill('200');
    await save();
    await main().getByRole('heading', { name: '已编辑试验布置' }).waitFor();
    await page.getByRole('tree').getByText('已编辑试验布置', { exact: true }).waitFor();
    const item = (await state()).physical.objects[0].configurations[0].experiments[1];
    assert.equal(item.id, 'e-empty'); assert.equal(item.category, '综合与考核类'); assert.equal(item.settings[0].id, 's-empty');
    assert.equal(item.settings[0].value, '前/后'); assert.equal(item.settings[0].form, '分组'); assert.equal(item.settings[0].source, '手工录入');
    await page.reload(); await main().getByText('手工修改共用设置', { exact: true }).waitFor();
    await main().getByRole('button', { name: '新建具体试验' }).click();
    await dialog().getByLabel('名称', { exact: true }).fill('新增具体试验');
    await dialog().getByPlaceholder('名称', { exact: true }).fill('设计点');
    await dialog().getByPlaceholder('目标值').fill('起飞');
    await save(); await main().getByRole('heading', { name: '新增具体试验' }).waitFor();
  });
  await test('记录进入专业功能无需再选来源，能力切换保留同一会话', async () => {
    await page.goto(route('a', 'e-a', 't-a', 'r-a'));
    await main().getByRole('button', { name: '数据分析', exact: true }).click();
    await panel().getByText(/当前来源：.*A当前记录/).waitFor();
    sessionA = new URL(page.url()).pathname.split('/')[2];
    assert.equal(await sourceSelector().count(), 0);
    await page.locator('.session-capability-tabs').getByRole('button', { name: /数字孪生$/ }).click();
    await panel().getByText(/当前来源：.*A当前记录/).waitFor();
    assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
    assert.equal(await sourceSelector().count(), 0);
  });
  await test('已有试验的构型可更正名称说明，历史设置锁定且会话引用更新', async () => {
    const before = (await state()).physical.objects[0].configurations[0].experiments[0];
    await page.goto(route('a', 'e-a', ''));
    await main().getByRole('button', { name: '编辑试验构型' }).click();
    await dialog().getByText(/类别、共用设置与参数已锁定/).waitFor();
    assert.equal(await dialog().getByRole('combobox').isDisabled(), true);
    for (const input of await dialog().locator('.physical-form-list .ant-form-item:not(.ant-form-item-hidden) input').all()) assert.equal(await input.isDisabled(), true);
    await dialog().getByLabel('名称', { exact: true }).fill('A布置更正名称');
    await dialog().getByLabel('说明', { exact: true }).fill('名称说明更正');
    await save(); await page.getByRole('tree').getByText('A布置更正名称', { exact: true }).waitFor();
    const after = (await state()).physical.objects[0].configurations[0].experiments[0];
    assert.deepEqual(after.trials, before.trials); assert.deepEqual(after.settings, before.settings); assert.deepEqual(after.parameters, before.parameters);
    await page.goto(`${baseURL}/sessions/${sessionA}/analysis`);
    await panel().getByText(/当前来源：.*A布置更正名称.*A当前记录/).waitFor();
    assert.match(await page.locator('.session-meta').innerText(), /A布置更正名称/);
  });
  await test('主动更换到 B、另一对象 C 或历史记录，来源不会串用', async () => {
    for (const label of ['B当前记录', 'C当前记录', 'A历史记录']) {
      await panel().getByRole('button', { name: '更换来源', exact: true }).click();
      await choose(sourceSelector(), label);
      await panel().getByText(new RegExp(`当前来源：.*${label}`)).waitFor();
      assert.equal(await sourceSelector().count(), 0);
      assert.notEqual(new URL(page.url()).pathname.split('/')[2], sessionA);
      await panel().getByRole('button', { name: '返回原始记录' }).click();
      await main().getByText(label, { exact: true }).waitFor();
      await main().getByRole('button', { name: '数据分析', exact: true }).click();
      await panel().getByText(new RegExp(`当前来源：.*${label}`)).waitFor();
    }
  });
  await test('独立打开专业功能时显示来源选择入口', async () => {
    await page.goto(`${baseURL}/physical-objects?view=tools`);
    await page.locator('.physical-tool-grid .ant-card').filter({ hasText: '数据分析' }).getByRole('button', { name: /打\s*开/ }).click();
    await sourceSelector().waitFor();
    assert.equal(await panel().getByRole('button', { name: '更换来源', exact: true }).count(), 0);
    await choose(sourceSelector(), 'C当前记录');
    await panel().getByText(/当前来源：.*C当前记录/).waitFor(); assert.equal(await sourceSelector().count(), 0);
  });
  await test('失效专业来源显示选择入口并阻止使用其他记录', async () => {
    await page.evaluate(sessionId => {
      const saved = JSON.parse(localStorage.getItem('protangram-work-sessions-v1'));
      const original = saved.sessions.find(item => item.id === sessionId);
      saved.sessions.push({ ...original, id: 'invalid-source-session', businessScope: { ...original.businessScope, testRecordId: 'missing' } });
      localStorage.setItem('protangram-work-sessions-v1', JSON.stringify(saved));
    }, sessionA);
    await page.goto(`${baseURL}/sessions/invalid-source-session/analysis`);
    await panel().getByText('业务来源已失效；请选择已有来源，当前工作不会改用其他记录。', { exact: true }).waitFor();
    await sourceSelector().waitFor(); assert.equal(await panel().getByText(/当前来源：/).count(), 0);
    await page.getByText('请先修复业务来源，专业功能不会使用其他记录替代', { exact: true }).waitFor();
  });
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ passed: results, pageErrors: errors }, null, 2));
  console.log(`Passed ${results.length} browser scenarios without page errors`);
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\nURL: ${page.url()}\n${await page.locator('body').innerText()}`);
  throw error;
} finally { await browser.close(); }
