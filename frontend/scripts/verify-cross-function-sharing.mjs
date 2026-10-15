import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Run against a local Vite instance. A fresh browser context isolates all test data.
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
process.env.PLAYWRIGHT_BROWSERS_PATH ??= '/tmp/protangram-browser-check/browsers';
process.env.LD_LIBRARY_PATH ??= '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu';
const playwrightRoot = process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json';
const require = createRequire(playwrightRoot);
const { chromium } = require('playwright');
const output = resolve('node_modules/.tmp/cross-function-sharing');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium-1248/chrome-linux64/chrome', args: ['--no-sandbox'], env: { ...process.env, ...(existsSync('/tmp/protangram-browser-check/windows-fonts.conf') ? { FONTCONFIG_FILE: '/tmp/protangram-browser-check/windows-fonts.conf' } : {}) } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
await context.addInitScript(() => {
  window.__ptImport = async path => {
    const name = path.split('/').at(-1);
    const parent = name === 'taskStore.ts' ? '/src/workspace/TaskCenter.tsx' : '/src/workspace/SessionWorkbench.tsx';
    const source = await (await fetch(parent)).text();
    const actualURL = Array.from(source.matchAll(/from\s+["']([^"']+)["']/g)).map(match => match[1])
      .find(url => url.split('?')[0].endsWith(`/${name}`));
    return import(actualURL ?? path);
  };
});
const page = await context.newPage();
page.setDefaultTimeout(12000);
const pageErrors = [];
const consoleErrors = [];
const results = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.on('console', message => {
  if (message.type() === 'error' && /Maximum update depth|Uncaught|React Router caught/.test(message.text())) consoleErrors.push(message.text());
});
let fixture;
let sessionA;
const test = async (name, work) => {
  try {
    await work();
    results.push({ name, status: 'passed' });
    console.log(`PASS ${name}`);
  } catch (error) {
    results.push({ name, status: 'failed', error: error.stack, url: page.url() });
    console.log(`FAIL ${name}: ${error.message}`);
    await page.screenshot({ path: `${output}/${results.length}-failure.png`, fullPage: true }).catch(() => {});
    await writeFile(`${output}/${results.length}-body.txt`, await page.locator('body').innerText().catch(() => ''), 'utf8');
    await writeFile(`${output}/${results.length}-state.json`, JSON.stringify(await state().catch(() => ({})), null, 2), 'utf8');
    if (await page.getByRole('dialog').count()) await page.keyboard.press('Escape').catch(() => {});
  }
};
const physicalURL = key => `${baseURL}/physical-objects?objectId=${fixture.family}&configurationId=${fixture[key].config}&experimentId=${fixture[key].experiment}&trialId=${fixture[key].trial}&recordId=${fixture[key].record}`;
const sessionURL = capability => `${baseURL}/sessions/${sessionA}/${capability}`;
const state = () => page.evaluate(() => {
  // Read the application's saved state; HMR can give a manually imported store
  // a different module URL, so importing a store again is unsuitable for assertions.
  const read = key => JSON.parse(localStorage.getItem(key) ?? '{}');
  return { objects: read('protangram-physical-objects-v1').state?.objects ?? [],
    sessions: read('protangram-work-sessions-v1').sessions ?? [],
    projects: read('protangram-project-workspace-v1').state?.projects ?? [],
    tasks: read('protangram-task-workspace-v1').state?.tasks ?? [] };
});
const choose = async (locator, text) => {
  await page.waitForTimeout(250);
  await locator.click();
  await page.waitForTimeout(250);
  const options = page.locator('.ant-select-dropdown:visible .ant-select-item-option');
  await options.filter({ hasText: text }).first().click();
  await page.waitForTimeout(250);
};
const acceptDialog = async () => {
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: /(确\s*定|保\s*存(?:成果)?)$/ }).click();
  await dialog.waitFor({ state: 'hidden' });
};
const tabs = () => page.locator('.session-capability-tabs');
const switchTab = async (label, path) => {
  await tabs().getByRole('button', { name: new RegExp(`${label}$`) }).click();
  await page.waitForURL(url => url.pathname === `/sessions/${sessionA}/${path}`);
  if (path === 'digital-twin') await page.getByRole('group', { name: '试验数字孪生模型选择' }).waitFor();
  if (path === 'virtual-condition') await page.getByRole('group', { name: '虚拟工况扩展模型选择' }).waitFor();
  if (path === 'analysis') await page.getByRole('heading', { name: '试验数据分析', exact: true }).waitFor();
};
const sourcePanel = () => page.locator('.physical-source-panel');
const expandSource = async () => {
  const header = sourcePanel().locator('.ant-collapse-header').first();
  if (await header.getAttribute('aria-expanded') !== 'true') await header.click();
  await sourcePanel().getByText('直径：120 mm', { exact: true }).waitFor();
};
const chartData = () => page.evaluate(() => {
  return Array.from(document.querySelectorAll('.physical-charts-grid .echarts-for-react')).map(element => {
    const key = Object.keys(element).find(name => name.startsWith('__reactFiber$'));
    for (let fiber = element[key]; fiber; fiber = fiber.return) {
      if (typeof fiber.stateNode?.getEchartsInstance === 'function') return fiber.stateNode.getEchartsInstance().getOption().series?.[0]?.data;
    }
    throw new Error('找不到已渲染图表实例');
  });
});
const createChart = async (name, y, scale, offset) => {
  await page.getByRole('button', { name: '新建图表', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.locator('#name').fill(name);
  await choose(dialog.locator('.ant-select:has(#rawFileId)'), 'shared.csv');
  await choose(dialog.locator('.ant-select:has(#xField)'), 'speed');
  await choose(dialog.locator('.ant-select:has(#yField)'), y);
  await dialog.locator('#scale').fill(String(scale));
  await dialog.locator('#offset').fill(String(offset));
  await acceptDialog();
};

try {
  await page.goto(baseURL);
  fixture = await page.evaluate(async () => {
    const { usePhysicalObjectStore } = await window.__ptImport('/src/workspace/physicalObjectStore.ts');
    const { useTaskStore } = await window.__ptImport('/src/workspace/taskStore.ts');
    const { useProjectStore } = await window.__ptImport('/src/workspace/projectStore.ts');
    const { useSessionStore } = await window.__ptImport('/src/workspace/sessionStore.ts');
    usePhysicalObjectStore.setState({ objects: [] });
    useTaskStore.setState({ tasks: [] });
    useProjectStore.setState({ projects: [], activeProjectId: null });
    useSessionStore.setState({ sessions: [], activeSessionId: null });
    const store = usePhysicalObjectStore.getState();
    const family = store.addRoot({ name: '电涵道风扇', type: '涵道风扇' });
    const make = (name, diameter, recordName) => {
      const config = store.addConfiguration(family, { name });
      store.addField(config, 'parameters', { name: '直径', unit: 'mm', value: diameter, form: '单值' });
      store.addField(config, 'parameters', { name: '叶片数', value: '8', form: '单值' });
      // Existing saved model contracts still work; model registration is no longer a workbench operation.
      usePhysicalObjectStore.setState(state => ({ objects: state.objects.map(object => ({ ...object, configurations: object.configurations.map(item => item.id === config ? { ...item, models: [{ id: `model-${name}`, name: `${name}推力模型`, description: '旧模型兼容验证', method: '尚未接入计算', inputs: [{ id: `input-${name}`, name: '转速', value: '', unit: 'rpm', form: '单值' }], outputs: [], defaults: [], calculations: [] }] } : item) })) }));
      const experiment = store.addExperiment(config, { name: `${name}试验布置`, parameters: [{ id: `parameter-${name}`, name: '转速', value: '2000', unit: 'rpm', form: '单值' }] });
      const trial = store.addConcreteTrial(experiment, { name: `${name}性能试验`, loadSpectrum: `载荷谱-${name}` });
      const record = store.addTrialRecord(trial, { name: recordName });
      const model = usePhysicalObjectStore.getState().objects[0].configurations.find(item => item.id === config).models[0].id;
      return { config, experiment, trial, record, model };
    };
    return { family, a: make('风扇 A', '120', 'A第1次记录'), b: make('风扇 B', '140', 'B第1次记录') };
  });

  await test('真实 CSV 只导入记录一次，多个图表共享文件且配置独立', async () => {
    await page.goto(physicalURL('a'));
    await page.getByRole('button', { name: '编辑记录 / 添加文件', exact: true }).click();
    await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'shared.csv', mimeType: 'text/csv',
      buffer: Buffer.from('speed,thrust,power\n1000,10,100\n2000,20,200\n3000,30,300\n') });
    await acceptDialog();
    await createChart('推力趋势', 'thrust', 1, 0);
    await createChart('功率趋势', 'power', 2, 5);
    await page.locator('.physical-charts-grid canvas').nth(1).waitFor();
    await page.waitForFunction(() => document.querySelectorAll('.physical-charts-grid .physical-chart-loading').length === 0);
    const current = await state();
    const record = current.objects[0].configurations[0].experiments[0].trials[0].records[0];
    assert.equal(record.id, fixture.a.record);
    assert.equal(record.rawFiles.length, 1);
    const sharedCharts = (await state()).objects[0].configurations[0].experiments[0].trials[0].charts.filter(chart => chart.sourceRecordId === record.id);
    assert.equal(sharedCharts.length, 2);
    assert.equal(sharedCharts[0].rawFileId, sharedCharts[1].rawFileId);
    assert.deepEqual(await chartData(), [[[1000, 10], [2000, 20], [3000, 30]], [[1000, 205], [2000, 405], [3000, 605]]]);
    const cards = page.locator('.physical-charts-grid .ant-card');
    await cards.filter({ hasText: '推力趋势' }).getByRole('button', { name: /配\s*置/ }).click();
    await page.getByRole('dialog').locator('#scale').fill('0');
    await acceptDialog();
    await page.waitForFunction(() => document.querySelectorAll('.physical-charts-grid .physical-chart-loading').length === 0);
    assert.deepEqual(await chartData(), [[[1000, 0], [2000, 0], [3000, 0]], [[1000, 205], [2000, 405], [3000, 605]]]);
  });

  await test('记录直接进入分析，切换和刷新继承同一来源与构型参数', async () => {
    await page.goto(physicalURL('a'));
    await page.locator('.physical-record-actions').getByRole('button', { name: '数据分析', exact: true }).click();
    await page.waitForURL('**/sessions/*/analysis');
    sessionA = new URL(page.url()).pathname.split('/')[2];
    await expandSource();
    assert.ok((await page.locator('.workspace-business-page').innerText()).includes('shared.csv'));
    await sourcePanel().locator('canvas').nth(1).waitFor();
    await page.locator('.workspace-preparation-item').filter({ hasText: '分析配置' }).click();
    await acceptDialog();
    assert.equal(await page.getByRole('button', { name: /开始分析$/ }).isEnabled(), true);
    await page.getByRole('button', { name: /开始分析$/ }).click();
    await page.getByRole('button', { name: /保存分析结果$/ }).waitFor();
    await page.getByRole('button', { name: /保存分析结果$/ }).click();
    await page.getByRole('button', { name: /分析结果已保存$/ }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: /分析结果已保存$/ }).waitFor();
    await switchTab('数字孪生', 'digital-twin');
    assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
    await expandSource();
    assert.ok((await page.locator('.workspace-business-page').innerText()).includes('shared.csv'));
    await switchTab('虚拟工况', 'virtual-condition');
    await expandSource();
    await switchTab('报告', 'report');
    await expandSource();
    const current = await state();
    assert.equal(current.sessions.filter(item => item.businessScope?.testRecordId === fixture.a.record).length, 1);
    assert.equal(current.sessions.find(item => item.id === sessionA).businessScope.testRecordId, fixture.a.record);
    const analysis = current.projects.flatMap(project => project.artifacts).find(item => item.type === 'analysis');
    assert.equal(analysis.payload.sourceScope.testRecordId, fixture.a.record);
    assert.equal(analysis.payload.resultMode, 'demo');
  });

  await test('构型模型手选，参数手填，专属输入刷新恢复且互不污染', async () => {
    assert.ok(sessionA, '前置分析会话未建立');
    await page.goto(sessionURL('digital-twin'));
    await page.getByRole('group', { name: '试验数字孪生模型选择' }).getByRole('button', { name: /风扇 A推力模型/ }).click();
    await page.getByRole('textbox', { name: '模型输入：转速' }).fill('3456');
    await page.reload();
    assert.equal(await page.getByRole('textbox', { name: '模型输入：转速' }).inputValue(), '3456');
    await switchTab('虚拟工况', 'virtual-condition');
    await page.getByRole('group', { name: '虚拟工况扩展模型选择' }).getByRole('button', { name: /风扇 A推力模型/ }).click();
    assert.equal(await page.getByRole('textbox', { name: '模型输入：转速' }).inputValue(), '');
    await page.getByRole('textbox', { name: '模型输入：转速' }).fill('4567');
    await switchTab('数字孪生', 'digital-twin');
    assert.equal(await page.getByRole('textbox', { name: '模型输入：转速' }).inputValue(), '3456');
    const current = await state();
    assert.equal(current.objects[0].configurations[0].models[0].inputs[0].value, '');
    assert.equal(current.objects[0].configurations[0].experiments[0].parameters[0].value, '2000');
    assert.equal(current.objects[0].configurations[0].parameters[0].value, '120');
  });

  await test('已有分析成果可显式引用，演示校准模型和成果供虚拟工况引用', async () => {
    assert.ok(sessionA, '前置会话未建立');
    await page.goto(sessionURL('digital-twin'));
    await choose(sourcePanel().locator('.ant-select').filter({ has: page.getByRole('combobox', { name: '引用已有专业成果' }) }), '演示');
    const modelGroup = page.getByRole('group', { name: '试验数字孪生模型选择' });
    const demoButton = modelGroup.getByRole('button').filter({ hasText: /发动机/ }).first();
    await demoButton.click();
    await page.locator('.workspace-business-page input[type=file]').first().setInputFiles({ name: 'baseline.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
    await page.locator('.workspace-preparation-item').filter({ hasText: '参数配置' }).click();
    await page.getByRole('dialog').getByRole('spinbutton').first().fill('35');
    await acceptDialog();
    assert.equal(await page.getByRole('button', { name: /开始校准$/ }).isEnabled(), true);
    await page.getByRole('button', { name: /开始校准$/ }).click();
    await page.locator('#business-result').getByText(/校准完成，当前会话模型/).waitFor();
    await page.waitForFunction(async () => {
      const { useProjectStore } = await window.__ptImport('/src/workspace/projectStore.ts');
      return useProjectStore.getState().projects.some(project => project.artifacts.some(item => item.type === 'calibration'));
    });
    await switchTab('虚拟工况', 'virtual-condition');
    await choose(sourcePanel().locator('.ant-select').filter({ has: page.getByRole('combobox', { name: '引用已有专业成果' }) }), '校准结果');
    await page.waitForFunction(id => {
      const saved = JSON.parse(localStorage.getItem('protangram-work-sessions-v1'));
      return Boolean(saved.sessions.find(session => session.id === id)?.drafts.virtualCondition?.selectedModel?.modelId);
    }, sessionA);
    const current = await state();
    const calibration = current.projects.flatMap(project => project.artifacts).find(item => item.type === 'calibration');
    assert.equal(calibration.payload.sourceScope.testRecordId, fixture.a.record);
    assert.equal(calibration.payload.resultMode, 'demo');
    const work = current.sessions.find(item => item.id === sessionA);
    assert.ok(work.handoffs.virtualCondition.artifactIds.includes(calibration.id));
    assert.equal(work.drafts.virtualCondition.selectedModel.modelId, calibration.payload.model.modelId);
    assert.equal(work.drafts.virtualCondition.selectedModel.version, calibration.payload.model.version);
    assert.ok((await sourcePanel().innerText()).includes('演示计算'));
    await page.getByRole('group', { name: '虚拟工况扩展模型选择' }).getByRole('button', { name: `发动机模型 ${calibration.payload.model.version}`, exact: true }).click();
    for (const label of ['工况配置', '约束设置']) {
      await page.locator('.workspace-preparation-item').filter({ hasText: label }).click();
      await acceptDialog();
    }
    await page.getByRole('button', { name: /生成虚拟工况$/ }).click();
    await page.getByRole('button', { name: /开始预测$/ }).click();
    await page.getByRole('button', { name: /保存预测结果$/ }).click();
    await page.getByRole('button', { name: /已保存到项目$/ }).waitFor();
    const predicted = (await state()).projects.flatMap(project => project.artifacts).find(item => item.type === 'virtualCondition');
    assert.equal(predicted.payload.resultMode, 'demo');
    assert.equal(predicted.payload.sourceScope.testRecordId, fixture.a.record);
    assert.ok(predicted.payload.upstreamArtifactRefs.some(reference => reference.artifactId === calibration.id));
  });

  await test('报告按引用保存真实图表，并在编制页绘制原始 CSV 数据', async () => {
    assert.ok(sessionA, '前置会话未建立');
    await page.goto(sessionURL('report'));
    await page.getByRole('checkbox', { name: /推力趋势/ }).check();
    await page.getByRole('checkbox', { name: /功率趋势/ }).check();
    await choose(page.locator('.ant-form-item').filter({ hasText: '选择报告模板' }).locator('.ant-select'), '航空装备地面综合试验报告');
    await page.getByRole('button', { name: /进入报告编制$/ }).click();
    await page.waitForURL('**/report/generate/*');
    await page.getByText('引用的原始记录图表', { exact: true }).waitFor();
    const report = await page.evaluate(async () => {
      const { loadAnalysisReports } = await import('/src/utils/storage.ts');
      return loadAnalysisReports().at(-1);
    });
    assert.equal(report.chartRefs.length, 2);
    assert.ok(report.chartRefs.every(reference => reference.testRecordId === fixture.a.record));
    assert.ok(!JSON.stringify(report).includes('speed,thrust,power'));
    const charts = page.locator('.ant-card').filter({ has: page.getByText('引用的原始记录图表', { exact: true }) }).last();
    await charts.locator('canvas').nth(1).waitFor();
    assert.ok((await page.locator('body').innerText()).includes('演示'));
    await page.reload();
    await page.getByText('引用的原始记录图表', { exact: true }).waitFor();
  });

  await test('显式选择旧校准成果采用保存的模型 snapshot，保留原始来源', async () => {
    assert.ok(sessionA, '前置会话未建立');
    await page.goto(sessionURL('virtual-condition'));
    const saved = await page.evaluate(async ({ sessionA, fixture }) => {
      const { useSessionStore } = await window.__ptImport('/src/workspace/sessionStore.ts');
      const { useProjectStore } = await window.__ptImport('/src/workspace/projectStore.ts');
      const work = useSessionStore.getState().sessions.find(item => item.id === sessionA);
      const project = useProjectStore.getState().projects.find(item => item.id === work.storageProjectId);
      const recent = project.artifacts.find(item => item.type === 'calibration');
      if (!recent) throw new Error('前置演示校准未保存');
      const model = { ...recent.payload.model, version: 'V1.0', status: '演示校准',
        calibrationData: { ...recent.payload.model.calibrationData, measuredFile: '旧校准采样.csv', credibility: 72 } };
      const old = useProjectStore.getState().addArtifact(project.id, { type: 'calibration', title: '历史校准snapshot',
        summary: '测试旧版保存结果的显式选择', status: '已完成',
        payload: { ...recent.payload, model, sourceScope: { physicalObjectId: fixture.a.config, experimentId: fixture.a.experiment, testRecordId: fixture.a.record }, resultMode: 'demo' } });
      return { artifactId: old.id, modelId: model.modelId };
    }, { sessionA, fixture });
    await choose(sourcePanel().locator('.ant-select').filter({ has: page.getByRole('combobox', { name: '引用已有专业成果' }) }), '历史校准snapshot');
    await page.getByRole('group', { name: '虚拟工况扩展模型选择' }).getByRole('button', { name: /V1.0/ }).waitFor();
    const current = await state();
    const work = current.sessions.find(item => item.id === sessionA);
    assert.equal(work.drafts.virtualCondition.selectedModel.version, 'V1.0');
    assert.equal(work.drafts.virtualCondition.selectedModel.calibrationData.measuredFile, '旧校准采样.csv');
    assert.equal(work.drafts.overview.modelUpdates[saved.modelId].version, 'V1.0');
    assert.ok(work.handoffs.virtualCondition.artifactIds.includes(saved.artifactId));
    assert.equal(work.businessScope.testRecordId, fixture.a.record);
    await switchTab('数字孪生', 'digital-twin');
    await page.getByRole('group', { name: '试验数字孪生模型选择' }).getByRole('button', { name: /发动机模型 V1.0$/ }).click();
    await page.getByRole('button', { name: /开始校准$/ }).click();
    await page.locator('#business-result').getByText(/校准完成，当前会话模型 发动机模型 V1.1/).waitFor();
    const recalibrated = await state();
    assert.equal(recalibrated.sessions.find(item => item.id === sessionA).drafts.overview.modelUpdates[saved.modelId].version, 'V1.1');
    const old = recalibrated.projects.flatMap(project => project.artifacts).find(item => item.id === saved.artifactId);
    assert.equal(old.payload.model.version, 'V1.0');
  });

  await test('只选真实记录图表可以正式生成报告，保存来源引用且不包含演示成果', async () => {
    await page.goto(sessionURL('report'));
    for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.uncheck();
    await page.getByRole('checkbox', { name: /推力趋势/ }).check();
    await page.getByRole('checkbox', { name: /功率趋势/ }).check();
    await choose(page.locator('.ant-form-item').filter({ hasText: '选择报告模板' }).locator('.ant-select'), '航空装备地面综合试验报告');
    await page.getByRole('button', { name: /进入报告编制$/ }).click();
    await page.waitForURL('**/report/generate/*');
    const reportId = new URL(page.url()).pathname.split('/').at(-1);
    await page.getByRole('button', { name: /正式生成报告$/ }).click();
    await page.getByRole('button', { name: /查看报告$/ }).waitFor();
    const current = await state();
    const artifact = current.projects.flatMap(project => project.artifacts).find(item => item.id === reportId);
    assert.ok(artifact);
    assert.equal(artifact.payload.resultMode, 'composed');
    assert.equal(artifact.payload.chartRefs.length, 2);
    assert.equal(artifact.payload.artifactRefs.length, 0);
    assert.ok(artifact.payload.chartRefs.every(reference => reference.testRecordId === fixture.a.record));
    assert.equal(await page.getByRole('button', { name: /生成演示报告$/ }).count(), 0);
    await page.reload();
    await page.getByRole('button', { name: /查看报告$/ }).waitFor();
    await page.locator('.workspace-report-generator-page .workspace-page-heading').getByRole('button', { name: /返回$/ }).click();
    await page.waitForURL(url => url.pathname === `/sessions/${sessionA}/report/list`);
  });

  await test('智能设计成果按 ID 引用到具体试验，载荷谱手工登记，不复制原始记录', async () => {
    await page.goto(sessionURL('doe'));
    await page.getByRole('group', { name: '智能实验设计模型选择' }).getByRole('button').filter({ hasText: /发动机模型/ }).first().click();
    for (const label of ['试验配置', '约束']) { await page.locator('.workspace-preparation-item').filter({ hasText: label }).click(); await acceptDialog(); }
    await page.getByRole('button', { name: /生成推荐方案$/ }).click();
    await page.getByRole('button', { name: '确认方案并创建试验任务', exact: true }).click(); await page.waitForURL('**/doe/result**');
    const design = (await state()).projects.flatMap(project => project.artifacts).find(item => item.type === 'design'); assert.ok(design);
    await page.goto(`${baseURL}/physical-objects?objectId=${fixture.family}&configurationId=${fixture.a.config}&experimentId=${fixture.a.experiment}`);
    await page.getByRole('button', { name: '新建具体试验' }).click(); const dialog = page.getByRole('dialog');
    await dialog.getByLabel('名称', { exact: true }).fill('引用方案的新试验'); await dialog.getByLabel('载荷谱名称或编号').fill('载荷谱-新试验');
    await choose(dialog.getByLabel('引用已有设计成果（可选）'), design.title); await acceptDialog();
    const trials = (await state()).objects[0].configurations[0].experiments[0].trials;
    assert.equal(trials[1].designArtifactRef.artifactId, design.id); assert.equal(trials[1].records.length, 0); assert.equal(trials[0].records[0].id, fixture.a.record);
    await page.getByRole('button', { name: '编辑具体试验' }).click();
    await page.getByRole('dialog').locator('.ant-select-clear').click(); await acceptDialog();
    assert.equal((await state()).objects[0].configurations[0].experiments[0].trials[1].designArtifactRef, undefined);
  });

  await test('第2次执行来源独立，专业引用和返回保留准确记录 ID', async () => {
    await page.goto(physicalURL('a'));
    const recordId = await page.evaluate(async trialId => {
      const { usePhysicalObjectStore } = await window.__ptImport('/src/workspace/physicalObjectStore.ts');
      return usePhysicalObjectStore.getState().addTrialRecord(trialId, { name: 'A第2次复测记录' });
    }, fixture.a.trial);
    await page.goto(physicalURL('a').replace(`recordId=${fixture.a.record}`, `recordId=${recordId}`));
    assert.equal(await page.getByRole('button', { name: '编辑记录 / 添加文件', exact: true }).isEnabled(), true);
    await page.locator('.physical-record-actions').getByRole('button', { name: '数据分析', exact: true }).click(); await page.waitForURL('**/analysis');
    assert.notEqual(new URL(page.url()).pathname.split('/')[2], sessionA);
    await sourcePanel().getByRole('button', { name: '返回原始记录', exact: true }).click(); assert.equal(new URL(page.url()).searchParams.get('recordId'), recordId);
    const records = (await state()).objects[0].configurations[0].experiments[0].trials[0].records; assert.equal(records[0].id, fixture.a.record); assert.equal(records[1].id, recordId); assert.equal(records[1].rawFiles.length, 0);
  });

  await test('返回记录与工作表工具入口复用同一会话，侧栏不再重复提供工具导航', async () => {
    assert.ok(sessionA, '前置会话未建立');
    await page.goto(sessionURL('analysis'));
    await sourcePanel().getByRole('button', { name: '返回原始记录', exact: true }).click();
    assert.equal(new URL(page.url()).searchParams.get('experimentId'), fixture.a.experiment);
    await page.locator('.physical-record-actions').getByRole('button', { name: '数字孪生', exact: true }).click();
    await page.waitForURL('**/digital-twin');
    assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
    assert.equal(await page.locator('.business-sidebar').getByRole('button', { name: /专业功能$/ }).count(), 0);
    await sourcePanel().getByRole('button', { name: '返回原始记录', exact: true }).click();
    await page.getByRole('tab', { name: '专业功能', exact: true }).click();
    await page.locator('.physical-tool-grid .ant-card').filter({ hasText: '报告' }).getByRole('button', { name: /打\s*开$/ }).click();
    assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
  });

  await test('切另一来源隔离数据、模型输入、图表和成果，不透明回退被阻止', async () => {
    assert.ok(sessionA, '前置会话未建立');
    await page.goto(sessionURL('digital-twin'));
    await sourcePanel().getByRole('button', { name: '更换来源', exact: true }).click();
    await choose(sourcePanel().locator('.ant-select').filter({ has: page.getByRole('combobox', { name: '选择已有业务来源' }) }), 'B第1次记录');
    await page.waitForURL(url => url.pathname.includes('/digital-twin') && !url.pathname.includes(sessionA));
    const sessionB = new URL(page.url()).pathname.split('/')[2];
    const current = await state();
    const work = current.sessions.find(item => item.id === sessionB);
    assert.equal(work.businessScope.testRecordId, fixture.b.record);
    assert.equal(work.drafts.digitalTwin?.[`modelInputs:${fixture.a.model}`], undefined);
    assert.equal(await sourcePanel().getByRole('combobox', { name: '引用已有专业成果' }).count(), 0);
    await sourcePanel().locator('.ant-collapse-header').first().click();
    assert.ok((await sourcePanel().innerText()).includes('直径：140 mm'));
    assert.ok(!(await sourcePanel().innerText()).includes('shared.csv'));
    assert.ok(!(await sourcePanel().innerText()).includes('推力趋势'));
    await page.evaluate(async id => {
      const { useSessionStore } = await window.__ptImport('/src/workspace/sessionStore.ts');
      useSessionStore.setState(state => ({ sessions: state.sessions.map(item => item.id === id ? { ...item, businessScope: { ...item.businessScope, testRecordId: 'missing-record' } } : item) }));
      useSessionStore.getState().retrySave();
    }, sessionB);
    await page.reload();
    await page.getByText('请先修复业务来源，专业功能不会使用其他记录替代', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /开始校准$/ }).count(), 0);
  });

  await test('新任务书只建立关联 ID，无 PDF、AI事项、自动执行；关联入口返回同一记录', async () => {
    await page.goto(`${baseURL}/task-center`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: /新建任务书$/ }).click();
    await page.getByRole('dialog').getByRole('textbox').fill('浏览器验证任务书');
    await page.getByRole('dialog').getByRole('button', { name: '创建任务书', exact: true }).click();
    await page.waitForURL('**/task-center?taskId=*');
    await page.locator('.taskbook-workspace').waitFor();
    const taskId = new URL(page.url()).searchParams.get('taskId');
    await page.evaluate(async ({ trial, taskId }) => {
      const { usePhysicalObjectStore } = await window.__ptImport('/src/workspace/physicalObjectStore.ts');
      usePhysicalObjectStore.getState().updateConcreteTrial(trial, { taskBookId: taskId });
    }, { trial: fixture.a.trial, taskId });
    const current = await state();
    const task = current.tasks.find(item => item.id === taskId);
    assert.equal(task.requirements.length, 0);
    assert.equal(task.professionalProjects?.length ?? 0, 0);
    assert.ok(!task.demo);
    await page.getByRole('button', { name: '查看同一记录与成果', exact: true }).first().click();
    assert.equal(new URL(page.url()).searchParams.get('experimentId'), fixture.a.experiment);
    assert.ok((await page.locator('.physical-flow-main').innerText()).includes('shared.csv'));
    await page.locator('.physical-record-actions').getByRole('button', { name: '数据分析', exact: true }).click();
    assert.equal(new URL(page.url()).pathname.split('/')[2], sessionA);
  });

  await test('仅 analysisProjectId 的旧报告在所属会话列表可见，打开与返回保留原始来源', async () => {
    const legacyId = 'legacy-report-analysis-project-id-only';
    await page.evaluate(async ({ sessionA, legacyId }) => {
      const { loadAnalysisReports, saveAnalysisReports } = await import('/src/utils/storage.ts');
      const sessions = JSON.parse(localStorage.getItem('protangram-work-sessions-v1')).sessions;
      const work = sessions.find(item => item.id === sessionA);
      const reports = loadAnalysisReports();
      const previous = reports.find(report => report.analysisProjectId === work.storageProjectId);
      if (!previous) throw new Error('前置报告未保存');
      const legacy = { ...previous, id: legacyId, name: '仅旧项目字段的历史报告', analysisProjectId: work.storageProjectId,
        artifactIds: [], artifactRefs: [], chartRefs: [], tagBindings: {}, status: 'draft', dataSource: 'artifacts' };
      delete legacy.workspaceProjectId;
      delete legacy.taskId;
      delete legacy.taskItemId;
      saveAnalysisReports([...reports.filter(report => report.id !== legacyId), legacy]);
    }, { sessionA, legacyId });
    await page.goto(sessionURL('report/list'));
    const card = page.locator('.experiment-card').filter({ hasText: '仅旧项目字段的历史报告' });
    await card.waitFor();
    assert.equal(await card.count(), 1);
    await card.locator('.ant-card-actions .anticon-eye').click();
    await page.waitForURL(url => url.pathname === `/sessions/${sessionA}/report/generate/${legacyId}`);
    await page.locator('.workspace-report-generator-page').waitFor();
    assert.ok((await sourcePanel().innerText()).includes('A第1次记录'));
    await sourcePanel().getByRole('button', { name: '返回原始记录', exact: true }).click();
    const returned = new URL(page.url());
    assert.equal(returned.searchParams.get('experimentId'), fixture.a.experiment);
    assert.equal(returned.searchParams.get('recordId'), fixture.a.record);
    const current = await state();
    assert.equal(current.sessions.find(item => item.id === sessionA).businessScope.testRecordId, fixture.a.record);
  });

  await test('所有跨功能场景无页面异常', async () => {
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(consoleErrors, []);
  });
} finally {
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, fixture, results, pageErrors, consoleErrors }, null, 2));
  await browser.close();
}
console.log(`Results: ${results.filter(item => item.status === 'passed').length}/${results.length} passed; artifacts: ${output}`);
if (results.some(item => item.status === 'failed')) process.exitCode = 1;
