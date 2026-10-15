import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
const output = resolve('node_modules/.tmp/object-categories');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PROTANGRAM_CHROMIUM_PATH,
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu' } });
const errors = [], passed = [];
const context = await browser.newContext();
await context.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.abort() : route.continue());
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')));
const saveDialog = async () => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /保\s*存/ }).click();
  await dialog.waitFor({ state: 'hidden' });
};
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '新建对象类别', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('combobox').count(), 0);
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('传感器');
  await saveDialog();
  await page.getByRole('tree').getByRole('button', { name: '在传感器下新建具体物理对象', exact: true }).click();
  await page.getByRole('dialog').getByLabel('名称', { exact: true }).fill('传感器 S01');
  await saveDialog();
  await page.locator('.physical-flow-main').getByRole('heading', { name: '传感器 S01', exact: true }).waitFor();
  await page.reload({ waitUntil: 'networkidle' });
  await page.getByRole('tree').getByText('传感器 S01', { exact: true }).waitFor();
  assert.equal(await page.locator('.physical-flow-main').getByRole('button', { name: '新建具体物理对象', exact: true }).count(), 0);
  const custom = (await saved()).state.objects.find(category => category.name === '传感器');
  assert.equal(custom.configurations.length, 1);
  passed.push('自定义类别只需名称；具体物理对象归属正确，刷新后常驻，无同层嵌套入口');

  // Seed a previous version only in this isolated browser. Device and record IDs
  // deliberately differ so an accidental fallback or duplicate is detectable.
  await page.evaluate(() => {
    const object = (id, recordId) => ({ id, name: id, description: '', parameters: [], materials: [], children: [], designs: [], models: [],
      experiments: [{ id: `setup-${id}`, name: `setup-${id}`, parameters: [], trials: [{ id: `trial-${id}`, name: `trial-${id}`, loadSpectrum: `spectrum-${id}`,
        records: [{ id: recordId, name: recordId, executionNumber: 1, createdAt: '', actualConditions: [], measurements: [], rawFiles: [], charts: [], tables: [] }] }] }] });
    const category = (id, device) => ({ id, name: id, type: '涵道风扇', description: '', configurations: [device], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ version: 4, state: { objects: [category('old-category-a', object('device-a', 'record-a')), category('old-category-b', object('device-b', 'record-b'))] } }));
  });
  const oldLink = `${baseURL}/physical-objects?objectId=old-category-b&configurationId=device-b&experimentId=setup-device-b&trialId=trial-device-b&recordId=record-b`;
  await page.goto(oldLink, { waitUntil: 'networkidle' });
  await page.locator('.physical-record-heading').getByText('第 1 次 · record-b', { exact: true }).waitFor();
  const migrated = await saved();
  assert.equal(migrated.version, 6);
  const fans = migrated.state.objects.filter(category => category.name === '涵道风扇');
  assert.equal(fans.length, 1);
  assert.deepEqual(fans[0].configurations.map(device => device.id), ['device-a', 'device-b']);
  await page.getByRole('tree').getByText('device-a', { exact: true }).waitFor();
  await page.getByRole('tree').getByText('device-b', { exact: true }).waitFor();
  await page.locator('.physical-record-actions').getByRole('button', { name: '数据分析', exact: true }).click();
  await page.locator('.physical-source-panel').getByText(/当前来源：.*device-b.*record-b/).waitFor();
  assert.equal(await page.getByRole('combobox', { name: '选择已有业务来源' }).count(), 0);
  await page.locator('.physical-source-panel').getByRole('button', { name: '返回原始记录', exact: true }).click();
  await page.locator('.physical-record-heading').getByText('第 1 次 · record-b', { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('recordId'), 'record-b');
  await page.reload({ waitUntil: 'networkidle' });
  assert.deepEqual((await saved()).state.objects, migrated.state.objects);
  passed.push('同类旧分组合并、旧链接恢复设备 B、分析和返回引用同一记录，刷新不重复迁移');
  // Mixed legacy migrations may retain one ID at two different hierarchy levels.
  // These must be separate navigation locations without changing business IDs.
  await page.evaluate(() => {
    const persisted = JSON.parse(localStorage.getItem('protangram-physical-objects-v1'));
    const category = persisted.state.objects.find(item => item.name === '涵道风扇');
    category.id = 'device-b';
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify(persisted));
  });
  await page.goto(`${baseURL}/physical-objects?objectId=device-b&configurationId=device-b&experimentId=setup-device-b&trialId=trial-device-b&recordId=record-b`, { waitUntil: 'networkidle' });
  await page.locator('.physical-record-heading').getByText('第 1 次 · record-b', { exact: true }).waitFor();
  assert.equal(await page.locator('.business-object-tree .ant-tree-node-selected').count(), 1);
  assert.equal(await page.locator('.business-object-tree .ant-tree-node-selected').innerText(), 'setup-device-b');
  await page.getByRole('tree').getByText('device-b', { exact: true }).click();
  await page.locator('.physical-flow-main').getByRole('heading', { name: 'device-b', exact: true }).waitFor();
  assert.equal(await page.locator('.business-object-tree .ant-tree-node-selected').innerText(), 'device-b');
  passed.push('旧类别与设备复用 ID 时树节点仍分层唯一，记录和对象详情定位准确');
  assert.deepEqual(errors, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, passed, pageErrors: errors }, null, 2));
  for (const result of passed) console.log(`PASS ${result}`);
} catch (error) {
  await writeFile(`${output}/failure.txt`, `${error.stack}\n${await page.locator('body').innerText()}`);
  throw error;
} finally { await browser.close(); }
