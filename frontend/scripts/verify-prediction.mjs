import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
const output = 'node_modules/.tmp/professional-interactions'; await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', env: { ...process.env, LD_LIBRARY_PATH: '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu' } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const page = await context.newPage(); page.setDefaultTimeout(15000);
const errors = [], passed = [], unexpectedWrites = [], requests = [];
page.on('pageerror', error => errors.push(error.message));

// Prediction requests deliberately fail: the complete presentation flow must be local.
await context.route('**/api/**', async route => {
  const request = route.request();
  if (new URL(request.url()).pathname.startsWith('/api/prediction/') || request.method() !== 'GET') {
    unexpectedWrites.push(request.url());
    return route.fulfill({ status: 404, body: 'Cannot POST prediction' });
  }
  return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
});
page.on('request', request => { if (new URL(request.url()).pathname.startsWith('/api/prediction/')) requests.push(request.url()); });
const test = async (name, work) => { await work(); passed.push(name); console.log(`PASS ${name}`); };
const content = () => page.locator('.session-professional-content');
const resultCard = () => content().locator('#business-result');
const artifacts = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-project-workspace-v1')).state.projects.flatMap(project => project.artifacts));
const rawState = () => page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
const physicalURL = (recordId, experimentId = 'setup', trialId = 'trial') => `${baseURL}/physical-objects?${new URLSearchParams({ objectId: 'category', configurationId: 'device', experimentId, ...(trialId ? { trialId } : {}), ...(recordId ? { recordId } : {}) })}`;
const launch = async label => {
  await page.getByRole('tab', { name: '专业功能', exact: true }).click();
  await page.locator('.physical-tool-grid > .ant-card').filter({ has: page.locator('.ant-card-head-title', { hasText: label }) }).getByRole('button', { name: /打\s*开/ }).click();
  await page.waitForURL(/\/sessions\//); await content().locator('.workspace-business-page').waitFor();
};
const noTechnicalUI = async () => {
  assert.doesNotMatch(await page.locator('body').innerText(), /选择模型|模型来源构型|服务未接入|计算未完成|HTTP 404|本次成果未保存/);
  assert.equal(await page.locator('.physical-source-panel').count(), 0);
  assert.equal(await page.locator('input[type=file]:visible').count(), 0);
  assert.equal(await page.getByRole('combobox', { name: /选择已有业务来源|引用已有成果/ }).count(), 0);
};
const confirm = async fields => {
  await content().getByRole('button', { name: /计算条件/ }).click();
  const dialog = page.getByRole('dialog');
  for (const [name, value] of Object.entries(fields)) await dialog.getByLabel(name, { exact: true }).fill(String(value));
  await dialog.getByRole('button', { name: /确\s*认$/ }).click(); await dialog.waitFor({ state: 'hidden' });
};
const execute = async () => {
  await content().getByRole('button', { name: '执行预测', exact: true }).click();
  await resultCard().getByText(/演示计算完成，共/).waitFor();
  await resultCard().getByText('演示结果', { exact: true }).waitFor();
};
const save = async () => {
  await resultCard().getByRole('button', { name: /保存成果$/ }).click();
  await resultCard().getByText('已保存到共享成果', { exact: true }).waitFor();
  assert.equal(await resultCard().getByRole('button', { name: /保存成果$/ }).isDisabled(), true);
};
let original, firstSessionURL;
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const load = new Function('path', 'return import(path)');
    const { saveTrialFile } = await load('/src/workspace/trialDataFiles.ts');
    const records = [];
    for (let i = 1; i <= 2; i++) {
      await saveTrialFile(`csv-${i}`, new File([`time,speed\n0,${i * 1000}\n1,${i * 2000}\n`], `record${i}.csv`, { type: 'text/csv' }));
      records.push({ id: `record-${i}`, name: `第 ${i} 次试验记录`, executionNumber: i, createdAt: '2026-10-16', actualConditions: i === 2 ? [{ id: 'speed', name: '转速', value: '5000', unit: 'rpm', form: '单值' }, { id: 'temperature', name: '温度', value: '30', unit: '℃', form: '单值' }, { id: 'pressure', name: '压力', value: '100', unit: 'kPa', form: '单值' }] : [], measurements: [], tables: [], rawFiles: [{ id: `csv-${i}`, name: `record${i}.csv`, mimeType: 'text/csv', headers: ['time', 'speed'], rowCount: 2, size: 30, addedAt: '' }] });
    }
    const angle = { id: 'angle', name: '安装角', value: '15', unit: '°', form: '单值' };
    const chart = { id: 'raw-curve', name: '第二次转速曲线', sourceRecordId: 'record-2', rawFileId: 'csv-2', xField: 'time', yField: 'speed', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false, createdAt: '', updatedAt: '' };
    const device = { id: 'device', name: '风扇 A', description: '', parameters: [], materials: [], children: [], designs: [], models: [], experiments: [{ id: 'setup', name: '试验构型 A', testType: 'thrust', parameters: [angle], trials: [{ id: 'trial', name: '性能试验', loadSpectrum: 'LS-01', charts: [chart], records }] }, { id: 'empty', name: '待验证构型', testType: 'thrust', parameters: [angle], trials: [] }] };
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ version: 6, state: { objects: [{ id: 'category', name: '涵道风扇', type: '涵道风扇', configurations: [device], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] }] } }));
    const { useProjectStore } = await load('/src/workspace/projectStore.ts');
    const projectId = useProjectStore.getState().createProject({ name: '既有分析', sessionOwnerId: 'existing' });
    for (const [id, type, source, nature] of [['analysis-input', 'analysis', '试验数据分析', 'analysis'], ['twin-input', 'calibration', '数字孪生', 'digitalTwin'], ['virtual-input', 'virtualCondition', '虚拟工况', 'virtualPrediction']]) {
      useProjectStore.getState().addArtifact(projectId, { id, type, source, title: id, summary: '原有成果', payload: { resultMode: 'computed', resultNature: nature, sourceScope: { physicalObjectId: 'device', experimentId: 'setup', trialId: 'trial', testRecordId: 'record-2' }, results: [{ id: 'metric', kind: 'metric', name: id, value: 12 }] } });
    }
  });
  await page.goto(physicalURL('record-1'), { waitUntil: 'networkidle' }); original = await rawState();

  await test('智能设计与分析只需业务参数，不选择来源、成果或模型', async () => {
    await launch('智能试验设计'); firstSessionURL = page.url(); await noTechnicalUI();
    for (const name of ['试验配置', '约束']) {
      await content().getByRole('button', { name: new RegExp(name) }).click();
      await page.getByRole('dialog').getByRole('button', { name: /确\s*定$/ }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    }
    await content().getByRole('button', { name: /生成推荐方案$/ }).click();
    await content().getByRole('button', { name: '确认方案并创建试验任务', exact: true }).waitFor();
    await page.goto(firstSessionURL.replace(/doe$/, 'analysis'), { waitUntil: 'networkidle' }); await noTechnicalUI();
    await content().getByRole('button', { name: /分析配置/ }).click();
    await page.getByRole('dialog').getByRole('button', { name: /确\s*定$/ }).click(); await page.getByRole('dialog').waitFor({ state: 'hidden' });
    assert.equal(await content().getByRole('button', { name: /开始分析$/ }).isEnabled(), true);
  });
  await test('数字孪生无需后端即可执行并保存，同一成果保存后按钮禁用', async () => {
    await page.goto(firstSessionURL.replace(/doe$/, 'digital-twin'), { waitUntil: 'networkidle' });
    await confirm({ '目标转速 / rpm': 3500 }); await execute(); await noTechnicalUI();
    await resultCard().getByText('18.2', { exact: true }).waitFor(); await save();
    const all = await artifacts(), artifact = all.at(-1);
    assert.equal(all.length, 4); assert.equal(artifact.payload.resultMode, 'demo');
    assert.equal(artifact.payload.resultNature, 'digitalTwin'); assert.equal(artifact.payload.sourceScope.testRecordId, 'record-1');
    assert.equal(artifact.payload.inputs.speed, 3500); assert.equal(artifact.payload.model, undefined); assert.equal(artifact.payload.csvData, undefined);
    assert.equal(artifact.payload.upstreamArtifactRefs.length, 3); assert.match(artifact.payload.results[0].basis.join('；'), /前端演示数据/);
    assert.deepEqual(await rawState(), original);
  });
  await test('已保存结果返回原记录，刷新后保留，记录与共享视图引用同一成果', async () => {
    await page.getByRole('button', { name: /查看刚保存的结果$/ }).click();
    assert.equal(new URL(page.url()).searchParams.get('recordId'), 'record-1');
    const results = page.locator('.physical-analysis-results'); await results.getByText('18.2', { exact: true }).waitFor();
    await results.getByText('演示成果', { exact: true }).waitFor();
    await page.reload({ waitUntil: 'networkidle' }); await results.getByText('18.2', { exact: true }).waitFor();
    assert.equal((await artifacts()).length, 4);
  });
  await test('虚拟工况按输入范围生成指定数量结果，旧引用勾选不影响自动上下文', async () => {
    await page.evaluate(async id => {
      const load = new Function('path', 'return import(path)');
      const { useSessionStore } = await load('/src/workspace/sessionStore.ts');
      const { getSessionDraftKey } = await load('/src/workspace/sessionModel.ts');
      const state = useSessionStore.getState(); state.updateDraft(id, 'virtualCondition', getSessionDraftKey('referencedResultKeys', state.getWorkspaceSession(id)), []);
    }, new URL(firstSessionURL).pathname.split('/')[2]);
    await page.goto(firstSessionURL.replace(/doe$/, 'virtual-condition'), { waitUntil: 'networkidle' });
    await confirm({ '转速下限 / rpm': 4000, '转速上限 / rpm': 6000, '工况数量': 6 }); await execute(); await save();
    const artifact = (await artifacts()).at(-1);
    assert.equal(artifact.payload.resultNature, 'virtualPrediction'); assert.equal(artifact.payload.resultMode, 'demo');
    assert.equal(artifact.payload.results[0].rows.length, 6); assert.equal(artifact.payload.results[0].rows[0].speed, 4000); assert.equal(artifact.payload.results[0].rows.at(-1).speed, 6000);
    assert.equal(artifact.payload.upstreamArtifactRefs.length, 4); assert.deepEqual(artifact.payload.sourceContext.rawFiles.map(file => file.id), ['csv-1', 'csv-2']);
    await noTechnicalUI(); assert.deepEqual(await rawState(), original);
  });
  await test('原始 CSV 内容不可读取也不阻断前端展示，目标输入不改写实测条件', async () => {
    const id = await page.evaluate(async () => {
      await new Promise((resolve, reject) => {
        const open = indexedDB.open('protangram-trial-files', 1);
        open.onsuccess = () => { const db = open.result; const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = reject; };
        open.onerror = reject;
      });
      const { useSessionStore } = await (new Function('path', 'return import(path)'))('/src/workspace/sessionStore.ts');
      return useSessionStore.getState().ensurePhysicalSession({ physicalObjectId: 'device', experimentId: 'setup', trialId: 'trial', testRecordId: 'record-2' }, '第二次执行');
    });
    await page.goto(`${baseURL}/sessions/${id}/digital-twin`, { waitUntil: 'networkidle' });
    await confirm({ '目标转速 / rpm': 4500 }); await execute(); await save(); await noTechnicalUI();
    const artifact = (await artifacts()).at(-1); assert.equal(artifact.payload.sourceScope.testRecordId, 'record-2'); assert.equal(artifact.payload.results[0].rows[0].speed, 4500);
    assert.deepEqual(await rawState(), original);
  });
  await test('无 CSV 构型可完成虚拟工况全流程，窄屏没有来源或技术状态入口', async () => {
    await page.goto(physicalURL(undefined, 'empty', ''), { waitUntil: 'networkidle' }); await launch('虚拟工况');
    await confirm({ '转速下限 / rpm': 8000, '工况数量': 3 }); await execute(); await save();
    const artifact = (await artifacts()).at(-1); assert.equal(artifact.payload.sourceScope.experimentId, 'empty'); assert.deepEqual(artifact.payload.sourceContext.rawFiles, []);
    await page.setViewportSize({ width: 390, height: 844 }); await noTechnicalUI(); await page.screenshot({ path: `${output}/prediction-mobile.png`, fullPage: true });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1440, height: 1100 }); await page.screenshot({ path: `${output}/professional-preview.png`, fullPage: true });
  });
  assert.deepEqual(errors, []); assert.deepEqual(unexpectedWrites, []); assert.deepEqual(requests, []);
  await writeFile(`${output}/results.json`, JSON.stringify({ passed, pageErrors: errors, unexpectedWrites, predictionRequests: requests }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\n${page.url()}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`); throw error;
} finally { await browser.close(); }
