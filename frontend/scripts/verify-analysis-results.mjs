import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
const output = 'node_modules/.tmp/analysis-results'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', args: ['--no-sandbox'], env: { ...process.env, LD_LIBRARY_PATH: '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu' } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = [], passed = [], writes = [];
page.on('pageerror', error => errors.push(error.message));
await context.route('**/api/**', async route => {
  const req = route.request(), url = new URL(req.url());
  const respond = data => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data }) });
  if (url.pathname.startsWith('/api/prediction/')) { writes.push(req.url()); return route.abort(); }
  if (req.method() !== 'GET') { writes.push(req.url()); return route.abort(); }
  return respond([]);
});
const test = async (name, fn) => { await fn(); passed.push(name); console.log(`PASS ${name}`); };
const physicalURL = recordId => `${baseURL}/physical-objects?${new URLSearchParams({ objectId: 'category', configurationId: 'device', experimentId: 'setup', trialId: 'trial', ...(recordId ? { recordId } : {}) })}`;
const results = () => page.locator('.physical-analysis-results');
const visibleCards = () => results().locator('.ant-tabs-tabpane-active .physical-result-object');
const main = () => page.locator('.physical-flow-main');
const professional = () => page.locator('.session-professional-content');
const allArtifacts = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.flatMap(project => project.artifacts));
const rawState = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
const chooseTab = async name => {
  await results().getByRole('tab', { name: new RegExp(`^${name}`) }).click();
  await page.waitForFunction(label => [...document.querySelectorAll('.physical-analysis-results [role=tab]')].some(tab => tab.textContent.startsWith(label) && tab.getAttribute('aria-selected') === 'true'), name);
};
const launch = async label => {
  await page.getByRole('tab', { name: '专业功能', exact: true }).click();
  await page.locator('.physical-tool-grid > .ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: label }) }).getByRole('button', { name: /打\s*开/ }).click();
  await page.waitForURL(/\/sessions\//);
};
let original, analysisURL;
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { saveTrialFile } = await (new Function('path', 'return import(path)'))('/src/workspace/trialDataFiles.ts');
    const records = [];
    for (let i = 1; i <= 2; i++) {
      const id = `csv-${i}`; await saveTrialFile(id, new File([`time,speed\n0,${i * 1000}\n1,${i * 2000}\n`], `record${i}.csv`, { type: 'text/csv' }));
      records.push({ id: `record-${i}`, name: `第 ${i} 次试验记录`, executionNumber: i, createdAt: '2026-10-16', actualConditions: [], measurements: [], tables: [], rawFiles: [{ id, name: `record${i}.csv`, mimeType: 'text/csv', size: 30, addedAt: '', headers: ['time', 'speed'], rowCount: 2 }] });
    }
    const config = { id: 'device', name: '风扇 A', description: '', parameters: [], materials: [], children: [], designs: [], models: [], experiments: [{ id: 'setup', name: '试验构型 A', testType: 'thrust', parameters: [{ id: 'angle', name: '安装角', value: '15', unit: '°', form: '单值' }], trials: [{ id: 'trial', name: '性能试验', loadSpectrum: 'LS-01', charts: [], records }] }] };
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ version: 6, state: { objects: [{ id: 'category', name: '涵道风扇', type: '涵道风扇', configurations: [config], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] }] } }));
  });
  await test('记录直接生成真实 CSV 图表与数据表，上下文无需重复填写', async () => {
    await page.goto(physicalURL('record-1'), { waitUntil: 'networkidle' });
    assert.equal(await main().getByRole('button', { name: '数据分析', exact: true }).count(), 0);
    await results().getByRole('button', { name: '新建图表', exact: true }).click();
    const dialog = page.getByRole('dialog'); await dialog.getByLabel('图表名称').fill('转速曲线');
    assert.equal(await dialog.getByRole('combobox').count(), 5);
    await dialog.getByRole('button', { name: '保存成果', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
    await visibleCards().locator('canvas').waitFor();
    await results().getByRole('button', { name: '新建数据表', exact: true }).click();
    await dialog.getByRole('button', { name: /保\s*存$/ }).click(); await dialog.waitFor({ state: 'hidden' });
    await chooseTab('数据表'); await visibleCards().getByText('1000', { exact: true }).waitFor();
    original = await rawState();
    assert.equal(original[0].configurations[0].experiments[0].trials[0].charts[0].sourceRecordId, 'record-1');
  });
  await test('专业分析保存实际图形、数据表和指标，重复保存不生成另一套成果', async () => {
    await launch('数据分析'); analysisURL = page.url();
    await professional().getByRole('button', { name: /分析配置/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /确\s*定$/ }).click();
    await professional().getByRole('button', { name: /开始分析$/ }).click();
    await page.evaluate(() => {
      window.__restoreResultStorage = Storage.prototype.setItem;
      Storage.prototype.setItem = function(key, value) { if (key === 'protangram-project-workspace-v1') throw new DOMException('Test quota', 'QuotaExceededError'); return window.__restoreResultStorage.call(this, key, value); };
    });
    await professional().getByRole('button', { name: /保存分析结果$/ }).click();
    await page.locator('.session-save-error').waitFor(); assert.equal((await allArtifacts()).length, 0);
    await page.evaluate(() => { Storage.prototype.setItem = window.__restoreResultStorage; delete window.__restoreResultStorage; });
    await professional().getByRole('button', { name: /保存分析结果$/ }).click();
    await professional().getByRole('button', { name: /分析结果已保存$/ }).click();
    const artifacts = await allArtifacts(); assert.equal(artifacts.length, 1);
    const saved = artifacts[0]; assert.equal(saved.payload.sourceScope.testRecordId, 'record-1');
    assert.equal(saved.payload.sourceContext.loadSpectrum, 'LS-01'); assert.equal(saved.payload.sourceContext.rawFiles[0].id, 'csv-1');
    assert.equal(saved.payload.results[0].option.series[0].data.length, 8);
    assert.equal(saved.payload.resultMode, 'demo');
    await page.getByRole('button', { name: /查看刚保存的结果$/ }).click();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), 'record-1');
    await visibleCards().nth(1).waitFor(); assert.equal(await visibleCards().count(), 2);
    await page.reload({ waitUntil: 'networkidle' }); assert.equal(await visibleCards().count(), 2);
    await chooseTab('指标'); await visibleCards().getByText('异常事件数', { exact: true }).waitFor(); assert.equal(await visibleCards().count(), 2);
    await chooseTab('数据表'); assert.equal(await visibleCards().count(), 2);
    assert.equal(await page.getByText('本次记录的专业成果', { exact: true }).count(), 0);
    assert.deepEqual(await rawState(), original);
  });
  await test('第 2 次执行独立保存，两次成果在试验共享视图中引用原对象', async () => {
    await page.goto(physicalURL('record-2'), { waitUntil: 'networkidle' });
    assert.equal(await visibleCards().count(), 0);
    await results().getByRole('button', { name: '新建图表', exact: true }).click();
    await page.getByRole('dialog').getByLabel('图表名称').fill('第二次转速曲线');
    await page.getByRole('dialog').getByRole('button', { name: '保存成果', exact: true }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await visibleCards().count(), 1);
    await main().getByRole('button', { name: '返回具体试验', exact: true }).click();
    await visibleCards().nth(2).waitFor(); assert.equal(await visibleCards().count(), 3);
    assert.equal(await visibleCards().filter({ hasText: '第二次转速曲线' }).count(), 1);
    const objects = await rawState(); const trial = objects[0].configurations[0].experiments[0].trials[0];
    assert.equal(trial.charts.length, 2); assert.equal(trial.records.every(record => record.charts === undefined), true);
    const refs = await page.evaluate(async () => {
      const load = new Function('path', 'return import(path)');
      const { usePhysicalObjectStore } = await load('/src/workspace/physicalObjectStore.ts'); const { useProjectStore } = await load('/src/workspace/projectStore.ts'); const { useSessionStore } = await load('/src/workspace/sessionStore.ts');
      const { collectAnalysisResults, getTrialArtifacts } = await load('/src/workspace/analysisResultModel.ts');
      const trial = usePhysicalObjectStore.getState().objects[0].configurations[0].experiments[0].trials[0];
      const artifacts = getTrialArtifacts(useProjectStore.getState().projects, useSessionStore.getState().sessions, { physicalObjectId: 'device', experimentId: 'setup', trialId: 'trial' }, trial);
      const all = collectAnalysisResults(trial, artifacts), own = collectAnalysisResults(trial, artifacts, 'record-1');
      return { chart: all[0].chart === own[0].chart, professional: all[all.length - 1].result === own[own.length - 1].result };
    }); assert.deepEqual(refs, { chart: true, professional: true });
    await page.screenshot({ path: `${output}/shared-results.png`, fullPage: true });
  });
  await test('前端计算可直接保存；本机存储失败可重试，成果回到同一执行记录', async () => {
    await page.goto(physicalURL('record-2'), { waitUntil: 'networkidle' }); await launch('数字孪生');
    const before = await allArtifacts();
    await professional().getByRole('button', { name: /计算条件/ }).click();
    await page.getByRole('dialog').getByLabel('目标转速 / rpm').fill('3500'); await page.getByRole('dialog').getByRole('button', { name: /确\s*认$/ }).click(); await professional().getByRole('button', { name: '执行预测', exact: true }).click();
    await professional().getByText(/演示计算完成，共/).waitFor();
    await page.evaluate(() => { const original = Storage.prototype.setItem; window.__restoreSetItem = () => { Storage.prototype.setItem = original; }; Storage.prototype.setItem = function(key, value) { if (key === 'protangram-project-workspace-v1') throw new DOMException('full', 'QuotaExceededError'); return original.call(this, key, value); }; });
    await professional().getByRole('button', { name: /保存成果$/ }).click();
    await professional().getByText('本次成果未保存，请重试保存', { exact: true }).waitFor(); assert.deepEqual(await allArtifacts(), before);
    await page.evaluate(async () => { window.__restoreSetItem(); const { useSessionStore } = await (new Function('path', 'return import(path)'))('/src/workspace/sessionStore.ts'); useSessionStore.getState().retrySave(); });
    await professional().getByRole('button', { name: /保存成果$/ }).click();
    await professional().getByText('已保存到共享成果', { exact: true }).waitFor();
    const saved = (await allArtifacts()).at(-1); assert.equal(saved.payload.sourceScope.testRecordId, 'record-2'); assert.equal(saved.payload.resultMode, 'demo');
    assert.equal(saved.payload.results[0].rows[0].thrust, 18.2);
    await page.getByRole('button', { name: /查看刚保存的结果$/ }).click();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), 'record-2'); await visibleCards().getByText('18.2', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' }); await visibleCards().getByText('18.2', { exact: true }).waitFor();
  });
  await test('虚拟工况与其他专业功能成果进入同一数据表栏目，试验入口继承全部记录 CSV', async () => {
    await page.goto(physicalURL('record-1'), { waitUntil: 'networkidle' }); await launch('虚拟工况');
    await professional().getByRole('button', { name: /计算条件/ }).click();
    await page.getByRole('dialog').getByLabel('转速下限 / rpm').fill('4000'); await page.getByRole('dialog').getByRole('button', { name: /确\s*认$/ }).click(); await professional().getByRole('button', { name: '执行预测', exact: true }).click();
    await professional().getByText(/演示计算完成，共/).waitFor();
    await professional().getByRole('button', { name: /保存成果$/ }).click();
    await professional().getByText('已保存到共享成果', { exact: true }).waitFor();
    await page.getByRole('button', { name: /查看刚保存的结果$/ }).click(); await visibleCards().getByText('4000', { exact: true }).waitFor();
    await main().getByRole('button', { name: '返回具体试验', exact: true }).click(); await chooseTab('数据表'); await visibleCards().nth(3).waitFor();
    assert.equal(await visibleCards().count(), 4);
    await launch('数据分析');
    await professional().getByRole('button', { name: /分析配置/ }).click(); await page.getByRole('dialog').getByRole('button', { name: /确\s*定$/ }).click();
    await professional().getByRole('button', { name: /开始分析$/ }).click(); await professional().getByRole('button', { name: /保存分析结果$/ }).click();
    const artifact = (await allArtifacts()).at(-1); assert.equal(artifact.payload.sourceScope.trialId, 'trial'); assert.equal(artifact.payload.sourceScope.testRecordId, undefined);
    assert.deepEqual(artifact.payload.sourceContext.rawFiles.map(file => file.id), ['csv-1', 'csv-2']);
    await page.getByRole('button', { name: /查看刚保存的结果$/ }).click(); await results().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), null);
  });
  await test('旧成果目录返回来源，缺失记录不切换到其他执行，手机视图可访问成果', async () => {
    await page.goto(analysisURL.replace(/analysis$/, 'resources'), { waitUntil: 'networkidle' });
    await page.waitForURL(url => url.pathname === '/physical-objects' && url.searchParams.get('recordId') === 'record-1');
    await results().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), 'record-1');
    await page.goto(physicalURL('missing'), { waitUntil: 'networkidle' });
    await page.getByText('指定的试验记录不存在或已失效，未切换到其他记录。', { exact: true }).waitFor();
    assert.equal(await results().count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(physicalURL('record-1'), { waitUntil: 'networkidle' }); await chooseTab('指标'); await visibleCards().getByText('异常事件数', { exact: true }).waitFor(); assert.equal(await visibleCards().count(), 2);
    await page.screenshot({ path: `${output}/record-mobile.png`, fullPage: true });
  });
  assert.deepEqual(errors, []); assert.deepEqual(writes, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ passed, pageErrors: errors, unexpectedWrites: writes }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\n${page.url()}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`);
  throw error;
} finally { await browser.close(); }
