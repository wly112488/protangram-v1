import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5173';
const output = resolve('node_modules/.tmp/task-trial-integration');
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], executablePath: process.env.PROTANGRAM_CHROMIUM_PATH,
  env: { ...process.env, LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ?? '/tmp/protangram-browser-check/runtime/usr/lib/x86_64-linux-gnu', FONTCONFIG_FILE: '/tmp/protangram-browser-check/windows-fonts.conf' } });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const blockedWrites = [], errors = [], passed = [];
await context.route('**/*', route => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? (blockedWrites.push(route.request().url()), route.abort()) : route.continue());
const page = await context.newPage(); page.setDefaultTimeout(20000);
page.on('pageerror', error => errors.push(error.message));
const test = async (name, work) => { await work(); passed.push(name); console.log(`PASS ${name}`); };
const go = path => page.goto(baseURL + path, { waitUntil: 'networkidle' });
const state = () => page.evaluate(() => ({ objects: JSON.parse(localStorage.getItem('protangram-physical-objects-v1') ?? '{}').state?.objects ?? [], tasks: JSON.parse(localStorage.getItem('protangram-task-workspace-v1') ?? '{}').state?.tasks ?? [], sessions: JSON.parse(localStorage.getItem('protangram-work-sessions-v1') ?? '{}').sessions ?? [], projects: JSON.parse(localStorage.getItem('protangram-project-workspace-v1') ?? '{}').state?.projects ?? [] }));
const choose = async (select, label) => { await select.click(); await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: label }).first().click(); };
const save = async () => { const dialog = page.getByRole('dialog'); await dialog.getByRole('button', { name: /(保\s*存(?:成果)?|确\s*定)$/ }).click(); await dialog.waitFor({ state: 'hidden' }); };
const pdf = () => {
  let text = '%PDF-1.4\n'; const offsets = [0];
  for (const [index, body] of ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << >> >>'].entries()) { offsets.push(text.length); text += `${index + 1} 0 obj\n${body}\nendobj\n`; }
  const start = text.length; text += `xref\n0 4\n0000000000 65535 f \n${offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;
  return { name: '综合试验任务书.pdf', mimeType: 'application/pdf', buffer: Buffer.from(text) };
};
async function createTask(name, withPdf = false) {
  await go(withPdf ? '/task-center' : '/task-center?newTask=1'); if (withPdf) await page.getByRole('button', { name: /新建任务书$/ }).click();
  await page.getByRole('dialog').getByRole('textbox').fill(name);
  if (withPdf) await page.getByRole('dialog').locator('input[type=file]').setInputFiles(pdf());
  await page.getByRole('dialog').getByRole('button', { name: '创建任务书', exact: true }).click();
  await page.waitForURL('**/task-center?taskId=*'); await page.locator('.taskbook-workspace').waitFor();
  return new URL(page.url()).searchParams.get('taskId');
}
let task1, task2, fixture, artifact, reportId, snapshot;
const physicalURL = (item, record) => '/physical-objects?' + new URLSearchParams({ objectId: item.category, configurationId: item.object, experimentId: item.setup, trialId: item.trial, recordId: record });
async function associate(item, record, taskName) {
  await go(physicalURL(item, record)); await page.getByRole('button', { name: '返回具体试验', exact: true }).click(); await page.getByRole('button', { name: '编辑具体试验', exact: true }).click();
  await choose(page.getByRole('dialog').getByLabel('任务书（可选，仅关联 ID）'), taskName); await save();
  await go(physicalURL(item, record));
  await page.locator('.physical-record-heading').getByText(`记录 ID：${record}`, { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get('recordId'), record);
}
async function uploadAndChart(item, record, names, chartName) {
  await go(physicalURL(item, record)); await page.getByRole('button', { name: '编辑记录 / 添加文件', exact: true }).click();
  await page.getByRole('dialog').locator('input[type=file]').setInputFiles(names.map(name => ({ name, mimeType: 'text/csv', buffer: Buffer.from('time,thrust\n0,10\n1,20\n2,30\n') }))); await save();
  await page.getByRole('button', { name: '新建图表', exact: true }).click(); await page.getByRole('dialog').getByLabel('图表名称').fill(chartName);
  await choose(page.getByRole('dialog').getByLabel('本次记录的 CSV 文件'), names[0]); await save(); await page.locator('.physical-charts-grid canvas').waitFor();
}
try {
  await test('新建任务书保存真实 PDF，仅建立任务信息，进入统一汇总工作台', async () => {
    task1 = await createTask('综合任务一', true);
    const task = (await state()).tasks.find(item => item.id === task1);
    assert.equal(task.requirements.length, 0); assert.equal(task.reportDraft.aiCompletedAt, undefined); assert.equal(task.sourceName, '综合试验任务书.pdf');
    assert.equal(await page.getByRole('button', { name: /AI整理|自动执行/ }).count(), 0);
    fixture = await page.evaluate(async () => {
      const text = await (await fetch('/src/workspace/PhysicalObjectsPage.tsx')).text();
      const url = [...text.matchAll(/from\s+["']([^"']+)["']/g)].map(match => match[1]).find(value => value.split('?')[0].endsWith('/physicalObjectStore.ts'));
      const { usePhysicalObjectStore } = await import(url);
      const store = usePhysicalObjectStore.getState();
      const make = (categoryName, name) => {
        const category = store.addRoot({ name: categoryName, type: categoryName }), object = store.addConfiguration(category, { name });
        const setup = store.addExperiment(object, { name: `${name}布置`, parameters: [] });
        const trial = store.addConcreteTrial(setup, { name: `${name}性能试验`, loadSpectrum: `${name}载荷谱` });
        return { category, object, setup, trial, record: store.addTrialRecord(trial, {}) };
      };
      const a = make('涵道风扇', '设备 A'), b = make('电机', '设备 B');
      return { a, b, second: store.addTrialRecord(a.trial, {}) };
    });
  });
  await test('在原试验记录直接关联任务书，上传多 CSV 并生成图表，无需返回任务管理', async () => {
    await associate(fixture.a, fixture.a.record, '综合任务一');
    await uploadAndChart(fixture.a, fixture.a.record, ['A-first.csv', 'A-auxiliary.csv'], 'A 第一次图表');
    await uploadAndChart(fixture.a, fixture.second, ['A-second.csv'], 'A 第二次图表');
    await associate(fixture.b, fixture.b.record, '综合任务一');
    await uploadAndChart(fixture.b, fixture.b.record, ['B-first.csv'], 'B 图表');
  });
  await test('记录进入专业分析继承准确来源，成果保存后自动进入任务汇总且保留演示标记', async () => {
    await go(physicalURL(fixture.a, fixture.a.record)); await page.locator('.physical-record-actions').getByRole('button', { name: '数据分析', exact: true }).click();
    await page.locator('.physical-source-panel').getByText(/当前来源：.*设备 A/).waitFor(); assert.equal(await page.getByRole('combobox', { name: '选择已有业务来源' }).count(), 0);
    await page.locator('.workspace-preparation-item').filter({ hasText: '分析配置' }).click(); await save();
    await page.getByRole('button', { name: /开始分析$/ }).click(); await page.getByRole('button', { name: /保存分析结果$/ }).click(); await page.getByRole('button', { name: /分析结果已保存$/ }).waitFor();
    artifact = (await state()).projects.flatMap(project => project.artifacts).find(item => item.type === 'analysis'); assert.equal(artifact.payload.sourceScope.testRecordId, fixture.a.record); assert.equal(artifact.payload.resultMode, 'demo');
    await page.locator('.physical-source-panel').getByRole('button', { name: '返回原始记录', exact: true }).click();
    await page.locator('.business-task-link').filter({ hasText: '综合任务一' }).click(); await page.locator('.taskbook-workspace').waitFor();
    assert.equal(await page.locator('.taskbook-object').count(), 2); assert.equal(await page.locator('.physical-task-record').count(), 3);
    for (const name of ['A-first.csv', 'A-auxiliary.csv', 'A-second.csv', 'B-first.csv', 'A 第一次图表', 'A 第二次图表', 'B 图表']) await page.locator('.physical-book-tests').getByText(new RegExp(name.replaceAll('.', '\\.'))).first().waitFor();
    await page.locator('.physical-book-tests').getByRole('button', { name: artifact.title, exact: true }).waitFor();
    await page.screenshot({ path: `${output}/task-overview.png`, fullPage: true });
    snapshot = structuredClone((await state()).objects);
  });
  await test('原始任务书可预览，报告正文人工编辑并在刷新后保留，不调用模拟 AI', async () => {
    await page.getByRole('tab', { name: '任务书与资料', exact: true }).click(); await page.getByText('综合试验任务书.pdf', { exact: true }).waitFor();
    await page.getByRole('button', { name: '查看任务书 PDF', exact: true }).click(); await page.locator('iframe[title="原始任务书 PDF"]').waitFor(); await page.locator('.ant-drawer-close').click();
    await page.getByRole('tab', { name: '任务报告', exact: true }).click(); await page.getByRole('textbox', { name: '任务背景与目标', exact: true }).fill('人工撰写：综合试验目标，覆盖设备 A 和设备 B。');
    await page.reload({ waitUntil: 'networkidle' }); assert.match(await page.getByRole('textbox', { name: '任务背景与目标', exact: true }).inputValue(), /覆盖设备 A 和设备 B/);
    assert.equal((await state()).tasks.find(item => item.id === task1).reportDraft.aiCompletedAt, undefined);
    assert.deepEqual((await state()).objects, snapshot);
  });
  await test('任务报告自动取得跨设备和多次记录的图表引用，排除演示成果后实际编制和预览', async () => {
    await page.getByRole('button', { name: '进入报告编制', exact: true }).click(); await page.getByRole('heading', { name: '任务报告配置', exact: true }).waitFor();
    assert.equal(await page.getByRole('combobox', { name: '选择已有业务来源' }).count(), 0);
    assert.equal(await page.locator('.session-capability-tabs').count(), 0);
    assert.equal(await page.getByRole('checkbox').count(), 4);
    await page.locator('.ant-checkbox-wrapper').filter({ hasText: '演示成果' }).locator('input').uncheck();
    await page.getByRole('button', { name: /保存配置并继续编制$/ }).click(); await page.waitForURL('**/generate/*?taskId=*');
    reportId = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('.workspace-report-generator-page canvas').nth(2).waitFor(); await page.getByRole('button', { name: /完成人工编制$/ }).click();
    await page.getByRole('button', { name: /查看报告$/ }).click(); await page.getByRole('dialog').getByText(/人工撰写：综合试验目标/).waitFor(); await page.getByRole('dialog').locator('canvas').nth(2).waitFor(); assert.equal(await page.getByRole('dialog').locator('canvas').count(), 3);
    await page.getByRole('dialog').getByRole('button', { name: /关\s*闭/ }).click(); await page.getByRole('button', { name: '返回任务工作台', exact: true }).click();
    await page.getByRole('button', { name: '查看 / 继续编辑', exact: true }).waitFor(); assert.deepEqual((await state()).objects, snapshot);
    const task = (await state()).tasks.find(item => item.id === task1); assert.equal(task.reportDraft.formalReportArtifact.artifactId, reportId);
  });
  await test('调整任务书关联后两个工作台实时改变范围，记录不复制，旧报告阻止用失配来源再次编制', async () => {
    task2 = await createTask('综合任务二'); await associate(fixture.a, fixture.a.record, '综合任务二');
    await go(`/task-center?taskId=${task1}`); assert.equal(await page.locator('.taskbook-object').count(), 1); assert.equal(await page.locator('.physical-task-record').count(), 1);
    assert.equal(await page.locator('.physical-book-tests').getByText(/A-first.csv/).count(), 0);
    await go(`/task-center?taskId=${task2}`); assert.equal(await page.locator('.physical-task-record').count(), 2);
    const current = await state();
    const records = objects => objects.flatMap(category => category.configurations).flatMap(object => object.experiments).flatMap(setup => setup.trials).flatMap(trial => trial.records);
    assert.deepEqual(records(current.objects), records(snapshot));
    await go(`/task-center?taskId=${task1}&view=report`); await page.getByRole('button', { name: '查看 / 继续编辑', exact: true }).click();
    await page.getByText(/部分试验已不再关联当前任务书/).waitFor(); assert.equal(await page.getByRole('button', { name: /完成人工编制$/ }).isDisabled(), true);
  });
  await test('旧任务入口统一恢复同一工作台，任务列表统计和左侧导航保持正确', async () => {
    for (const path of [`/physical-objects?taskId=${task2}`, `/tasks/${task2}`]) { await go(path); await page.waitForURL(`**/task-center?taskId=${task2}`); await page.getByRole('heading', { name: '综合任务二', exact: true }).waitFor(); }
    await page.locator('.business-sidebar').getByRole('button', { name: /综合任务一$/ }).click(); await page.getByRole('heading', { name: '综合任务一', exact: true }).waitFor();
    await go('/task-center'); const card = page.locator('.task-center-task-card').filter({ hasText: '综合任务二' }); await card.getByText('2 次执行', { exact: true }).waitFor(); await card.getByText('1 项专业成果', { exact: true }).waitFor();
    assert.equal(await page.locator('.business-sidebar').getByRole('button', { name: '专业功能', exact: true }).count(), 0); assert.deepEqual(errors, []);
  });
  await writeFile(`${output}/results.json`, JSON.stringify({ baseURL, passed, pageErrors: errors, blockedWrites }, null, 2)); console.log(`Passed ${passed.length} task integration scenarios`);
} catch (error) {
  await context.storageState({ path: `${output}/failure-storage.json`, indexedDB: true }).catch(() => {});
  await page.screenshot({ path: `${output}/failure.png`, fullPage: true }).catch(() => {});
  await writeFile(`${output}/failure.txt`, `${error.stack}\nURL: ${page.url()}\n${await page.locator('body').innerText()}`); throw error;
} finally { await browser.close(); }
