import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://localhost:5190';
const output = resolve('node_modules/.tmp/prediction'); await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PROTANGRAM_CHROMIUM_PATH ?? '/tmp/protangram-browser-check/browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell', env: { ...process.env, LD_LIBRARY_PATH: '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu', FONTCONFIG_FILE: '/tmp/protangram-browser-check/windows-fonts.conf' } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage(); page.setDefaultTimeout(12000);
const errors = [], passed = [], requests = [], blockedWrites = [];
page.on('pageerror', error => errors.push(error.message));
let scenario = 'live-missing', savedTasks = [], lastRequest;
const ref = (id, name) => ({ physicalObjectId: 'device', physicalObjectName: '验证风扇', experimentId: id, experimentName: name });
const local = { modelId: 'local-model', modelName: '本构型推力模型', version: 'V1', sourceConfiguration: ref('target', '目标构型'), availability: 'available', applicability: '后端确认适用', inputFields: [{ key: 'speed', label: '目标转速', type: 'number', required: true, unit: 'rpm', min: 0 }] };
const cross = { ...local, modelId: 'cross-model', modelName: '跨构型推力模型', version: 'V3', sourceConfiguration: ref('source', '来源构型') };
await context.route('**/api/**', async route => {
  const request = route.request(), url = new URL(request.url());
  if (!url.pathname.startsWith('/api/prediction/')) {
    if (request.method() !== 'GET') { blockedWrites.push(request.url()); return route.abort(); }
    return route.continue();
  }
  requests.push({ method: request.method(), path: url.pathname, query: url.search });
  if (scenario === 'live-missing') return route.continue();
  const respond = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify({ success: status < 400, ...(status < 400 ? { data } : { error: data }) }) });
  if (url.pathname.endsWith('/models')) {
    let models = scenario === 'multiple' ? [local, cross] : scenario === 'empty' ? [] : scenario === 'not-ready' ? [{ ...cross, availability: 'not_ready', message: '模型训练中' }] : scenario === 'local' ? [local] : [cross];
    return respond({ serviceReady: scenario !== 'service-down', persistenceReady: scenario !== 'no-save', models, message: scenario === 'service-down' ? '计算服务维护中' : undefined });
  }
  if (request.method() === 'GET') return respond(savedTasks.filter(task => task.service === url.searchParams.get('service')));
  if (url.pathname.endsWith('/save')) {
    if (scenario === 'save-fail') return respond('保存失败，请重试', 503);
    const task = { ...lastRequest, saved: true }; savedTasks = [task]; return respond(task);
  }
  if (scenario === 'run-fail') return respond('目标状态超出服务允许范围', 422);
  const input = request.postDataJSON();
  lastRequest = { ...input, taskId: `task-${input.requestId}`, status: 'completed', resultMode: scenario === 'demo-response' ? 'demo' : 'computed', completedAt: '2026-10-15T08:00:00Z', saved: false, result: { summary: '接口夹具预测完成', columns: [{ key: 'thrust', label: '预测推力', unit: 'N' }], rows: [{ thrust: 18.2 }] } };
  if (scenario === 'wrong-target') lastRequest.targetConfiguration = { ...input.targetConfiguration, experimentId: 'source' };
  if (scenario === 'delayed') await new Promise(resolve => setTimeout(resolve, 1000));
  return respond(lastRequest);
});
const test = async (name, work) => { await work(); passed.push(name); console.log(`PASS ${name}`); };
const physicalURL = `${baseURL}/physical-objects?objectId=category&configurationId=device&experimentId=target`;
const content = () => page.locator('.session-professional-content');
let sessionURL, originalObjects;
const enter = async (next, service = 'virtual-condition') => {
  scenario = next;
  await page.goto(`${sessionURL.replace(/virtual-condition$/, service)}`, { waitUntil: 'networkidle' });
};
const predict = async () => { await content().getByLabel('目标转速 / rpm').fill('3500'); await content().getByLabel('目标转速 / rpm').press('Tab'); await content().getByRole('button', { name: '执行预测', exact: true }).click(); };
try {
  await page.goto(baseURL, { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const field = { id: 'angle', name: '安装角', value: '15', unit: '°', form: '单值' };
    const device = { id: 'device', name: '验证风扇', description: '', parameters: [], materials: [], children: [], designs: [], models: [], experiments: [{ id: 'target', name: '目标构型', testType: 'thrust', parameters: [field], trials: [] }, { id: 'source', name: '来源构型', testType: 'thrust', parameters: [], trials: [] }] };
    localStorage.setItem('protangram-physical-objects-v1', JSON.stringify({ version: 6, state: { objects: [{ id: 'category', name: '涵道风扇', type: '涵道风扇', description: '', configurations: [device], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] }] } }));
  });
  await page.goto(physicalURL, { waitUntil: 'networkidle' });
  await test('试验类型仅在构型维护中选择，编辑后保留原参数和构型身份', async () => {
    await page.getByRole('button', { name: '编辑试验构型', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('适用试验类型').click();
    await page.locator('.ant-select-dropdown:visible').getByText('气动试验', { exact: true }).click();
    await dialog.getByRole('button', { name: /保\s*存$/ }).click(); await dialog.waitFor({ state: 'hidden' });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
    assert.equal(stored[0].configurations[0].experiments[0].testType, 'aerodynamic');
    assert.equal(stored[0].configurations[0].experiments[0].parameters[0].value, '15');
    assert.equal(await page.getByLabel('适用试验类型').count(), 0);
    originalObjects = stored;
  });
  await test('从目标构型直接进入；实际后端缺少接口时真实显示待接入', async () => {
    await page.getByRole('button', { name: '虚拟工况扩展', exact: true }).click();
    await page.waitForURL(/\/sessions\/.+\/virtual-condition/); sessionURL = page.url();
    await content().getByText(/预测服务尚未接入|预测服务不可用（HTTP 500）/).waitFor();
    assert.equal(await content().getByRole('button', { name: '执行预测', exact: true }).isDisabled(), true);
    const scope = await page.evaluate(() => JSON.parse(localStorage.getItem('protangram-work-sessions-v1')).sessions.at(-1).businessScope);
    assert.equal(scope.experimentId, 'target'); assert.equal(scope.trialId, undefined); assert.equal(scope.testRecordId, undefined);
  });
  await test('当前构型单个可用模型自动选择，不再重复构型区或上传 CSV', async () => {
    await enter('local');
    await content().getByText(/本构型推力模型 · V1 · 来源：验证风扇 \/ 目标构型（本构型）/).waitFor();
    assert.equal(await page.locator('.physical-source-panel').count(), 0);
    assert.equal(await content().getByRole('combobox').count(), 0);
    assert.equal(await content().locator('input[type=file]').count(), 0);
    assert.doesNotMatch(await content().innerText(), /当前试验构型|构型参数：自动继承|构型状态：已读取|适用试验类型/);
    await predict(); await content().getByText('接口夹具预测完成', { exact: true }).waitFor();
    assert.equal(lastRequest.model.sourceConfiguration.experimentId, 'target');
  });
  await test('目标构型无真实试验或 CSV，后端允许跨构型模型即可预测并保存到目标构型', async () => {
    await enter('cross');
    await content().getByText(/跨构型推力模型 · V3 · 来源：验证风扇 \/ 来源构型（其他构型）/).waitFor();
    await predict(); await content().getByText('接口夹具预测完成', { exact: true }).waitFor();
    assert.equal(lastRequest.targetConfiguration.experimentId, 'target');
    assert.equal(lastRequest.targetConfiguration.testType, 'aerodynamic'); // No frontend type compatibility algorithm.
    assert.equal(lastRequest.targetConfiguration.configurationParameters[0].value, '15');
    assert.equal(lastRequest.inputs.speed, 3500); assert.equal(lastRequest.model.sourceConfiguration.experimentId, 'source');
    assert.equal(lastRequest.targetConfiguration.trialId, undefined); assert.equal(lastRequest.targetConfiguration.testRecordId, undefined);
    await content().getByRole('button', { name: '保存预测结果', exact: true }).click();
    await content().getByText('已保存到目标构型', { exact: true }).waitFor();
    await page.screenshot({ path: `${output}/cross-configuration-result.png`, fullPage: true });
    await page.reload({ waitUntil: 'networkidle' });
    const row = content().getByRole('row').filter({ hasText: savedTasks[0].taskId });
    await row.getByRole('button', { name: '查看结果' }).click();
    await page.getByRole('dialog').getByText('验证风扇 / 目标构型', { exact: true }).waitFor();
    await page.getByRole('dialog').getByText('验证风扇 / 来源构型', { exact: true }).waitFor();
    await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click();
  });
  await test('多个可用模型展示不同来源，显式选择后使用同一预测流程', async () => {
    await enter('multiple');
    await content().getByRole('combobox', { name: '适用模型' }).click();
    await page.locator('.ant-select-dropdown:visible').getByText(/跨构型推力模型 · V3 · 来源：验证风扇 \/ 来源构型（其他构型）/).click();
    await predict(); await content().getByText('接口夹具预测完成', { exact: true }).waitFor();
    assert.equal(lastRequest.model.modelId, 'cross-model');
  });
  await test('没有适用模型、模型训练中、服务未就绪都禁止执行且真实反馈', async () => {
    for (const [state, text] of [['empty', '暂无适用于此目标构型的模型'], ['not-ready', '模型尚未就绪，暂无可用模型'], ['service-down', '计算服务维护中']]) {
      await enter(state); await content().getByText(text, { exact: true }).waitFor();
      assert.equal(await content().getByRole('button', { name: '执行预测', exact: true }).isDisabled(), true);
    }
  });
  await test('计算失败、演示结果和错误目标结果不会成为可保存预测成果', async () => {
    for (const state of ['run-fail', 'demo-response', 'wrong-target']) {
      await enter(state); await predict();
      await content().getByText(state === 'run-fail' ? '目标状态超出服务允许范围' : '预测结果来源、输入或计算状态不匹配，未保存为预测成果', { exact: true }).waitFor();
      assert.equal(await content().getByRole('button', { name: '保存预测结果', exact: true }).count(), 0);
    }
  });
  await test('保存失败保留结果以便重试；修改输入清除旧结果，保存未接入则禁用', async () => {
    await enter('save-fail'); await predict(); await content().getByText('接口夹具预测完成', { exact: true }).waitFor();
    await content().getByRole('button', { name: '保存预测结果', exact: true }).click();
    await content().getByText('保存失败，请重试', { exact: true }).waitFor();
    assert.equal(await content().getByText('待保存', { exact: true }).count(), 1);
    scenario = 'cross'; await content().getByRole('button', { name: '保存预测结果', exact: true }).click();
    await content().getByText('已保存到目标构型', { exact: true }).waitFor();
    await content().getByLabel('目标转速 / rpm').fill('3700');
    assert.equal(await content().getByRole('button', { name: '保存预测结果', exact: true }).count(), 0);
    await enter('no-save'); await predict(); await content().getByText('预测结果保存服务尚未就绪，当前结果尚未归档', { exact: true }).waitFor();
    assert.equal(await content().getByRole('button', { name: '保存预测结果', exact: true }).isDisabled(), true);
  });
  await test('数字孪生共享预测流程；切换功能时丢弃过期响应', async () => {
    await enter('cross', 'digital-twin'); await predict(); await content().getByText('接口夹具预测完成', { exact: true }).waitFor();
    assert.equal(lastRequest.service, 'digitalTwin');
    await enter('delayed'); await predict();
    await page.getByRole('navigation', { name: '当前会话专业能力' }).getByRole('button', { name: /数字孪生/ }).click();
    await content().getByRole('heading', { name: '目标构型 · 数字孪生预测' }).waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await content().getByText('接口夹具预测完成', { exact: true }).count(), 0);
  });
  await test('真实试验、CSV、图表、模型目录和原构型参数始终未被预测写入', async () => {
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects);
    assert.deepEqual(stored, originalObjects);
    assert.deepEqual(blockedWrites, []); assert.deepEqual(errors, []);
  });
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, note: '仅服务未接入场景使用实际后端；其余场景使用隔离浏览器接口夹具，不代表后端计算或持久化已实现。', passed, pageErrors: errors, blockedWrites, requests }, null, 2));
} catch (error) {
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\n${page.url()}\n${await page.locator('body').innerText()}\n${JSON.stringify(errors)}`); throw error;
} finally { await browser.close(); }
