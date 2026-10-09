import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
const require = createRequire(process.argv[2]);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
await context.route('**/api/**', route => route.fulfill({ status: 200, body: '[]', contentType: 'application/json' }));
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
mkdirSync('node_modules/.tmp/session-qa', { recursive: true });
const template = async () => {
  await page.locator('.workspace-report-create-page .ant-select').click();
  await page.locator('.ant-select-item-option').first().click();
};
const bind = async () => {
  await page.getByRole('combobox', { name: '为{{试验名称}}选择成果' }).tap();
  await page.locator('.ant-select-item-option').first().tap();
  await page.getByRole('button', { name: '解绑', exact: true }).waitFor();
};
try {
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('heading', { name: '从一项工作开始' }).waitFor();
  const seed = await page.evaluate(async () => {
    const { useProjectStore } = await import('/src/workspace/projectStore');
    const { useTaskStore } = await import('/src/workspace/taskStore');
    const { useSessionStore } = await import('/src/workspace/sessionStore');
    const projectId = useProjectStore.getState().createProject({ name: '审核任务资源' });
    const projectSnapshot = localStorage.getItem('protangram-project-workspace-v1');
    const taskId = useTaskStore.getState().createTask({ title: '审核关联任务', projectId, requirementTexts: ['核对分析证据', '编制报告'] });
    const task = useTaskStore.getState().tasks.find(item => item.id === taskId);
    useTaskStore.getState().updateRequirement(taskId, task.requirements[0].id, { text: task.requirements[0].text, capability: 'dataAnalysis' });
    useTaskStore.getState().updateRequirement(taskId, task.requirements[1].id, { text: task.requirements[1].text, capability: 'report' });
    useTaskStore.getState().setPlanConfirmed(taskId, true);
    const sessionId = useSessionStore.getState().ensureTaskSession(task);
    // Vite fixture imports may use a different module URL from the mounted app; reload from the complete persisted snapshot.
    localStorage.setItem('protangram-project-workspace-v1', projectSnapshot);
    return { sessionId, taskId, projectId, itemId: task.requirements[0].id, reportItemId: task.requirements[1].id };
  });
  const base = `http://127.0.0.1:5173/sessions/${seed.sessionId}`;
  await page.goto(`${base}/report/create`);
  await page.getByRole('heading', { name: '任务报告配置' }).waitFor();
  await template();
  const createUrl = page.url();
  await page.getByRole('button', { name: /查看会话成果$/ }).tap();
  await page.getByRole('dialog').getByText('会话资源', { exact: true }).waitFor();
  assert.ok((await page.getByRole('dialog').innerText()).includes('审核任务资源') || (await page.getByRole('dialog').innerText()).includes('0 项成果'));
  assert.equal(page.url(), createUrl);
  await page.getByRole('dialog').locator('.ant-drawer-close').tap();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  assert.ok((await page.locator('.workspace-report-create-page .ant-select').innerText()).includes('航空装备地面综合试验报告'));
  await page.getByRole('button', { name: /保存配置并继续编制$/ }).tap();
  await page.waitForURL('**/report/generate/**');
  const generatorUrl = page.url();
  const reportId = new URL(generatorUrl).pathname.split('/').at(-1);
  await page.getByText('当前报告没有可引用的成果', { exact: true }).waitFor();
  assert.equal(await page.locator('[draggable=true]').count(), 0);
  assert.equal(await page.getByRole('button', { name: /正式生成报告$/ }).isDisabled(), true);
  await page.getByRole('button', { name: '启用演示报告数据', exact: true }).tap();
  await bind();
  await page.getByRole('button', { name: /保存绑定$/ }).tap();
  await page.reload();
  await page.getByRole('button', { name: '解绑', exact: true }).waitFor();
  await page.getByRole('button', { name: /生成演示报告$/ }).tap();
  await page.getByRole('button', { name: /查看报告$/ }).waitFor();
  const saved = await page.evaluate(({ reportId, taskId }) => ({
    report: JSON.parse(localStorage.getItem('protangram_analysis_reports')).find(item => item.id === reportId),
    task: JSON.parse(localStorage.getItem('protangram-task-workspace-v1')).state.tasks.find(item => item.id === taskId),
  }), { reportId, taskId: seed.taskId });
  assert.equal(saved.report.dataSource, 'demo');
  assert.equal(saved.report.status, 'generated');
  assert.equal(saved.task.reportDraft.formalReportArtifact, undefined);
  assert.notEqual(saved.task.requirements.find(item => item.id === seed.reportItemId).status, '已满足');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.screenshot({ path: 'node_modules/.tmp/session-qa/report-touch.png', fullPage: true });
  await page.getByRole('button', { name: '退出演示', exact: true }).tap();
  await page.getByRole('button', { name: /保存绑定$/ }).tap();
  await page.reload();
  await page.getByText('部分绑定成果已不可用，请重新选择或解绑后生成报告。').waitFor();
  assert.equal(await page.getByRole('button', { name: /查看报告$/ }).count(), 0);
  const edited = await page.evaluate(reportId => JSON.parse(localStorage.getItem('protangram_analysis_reports')).find(item => item.id === reportId), reportId);
  assert.equal(edited.status, 'draft');
  assert.equal(edited.dataSource, 'demo');
  await page.goto(`${base}/report/list`);
  await page.getByText('演示报告 · 模拟成果', { exact: true }).waitFor();
  console.log('PASS: touch binding, empty defaults, report resource drawer preserves configuration, demo provenance, no task acceptance, invalid bindings and draft recovery.');

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${base}/analysis`);
  await page.getByRole('combobox', { name: '成果归属' }).waitFor();
  const selectedScope = page.locator('.task-artifact-scope .ant-select');
  assert.ok((await selectedScope.innerText()).includes('作为任务独立成果'));
  await selectedScope.click();
  await page.locator('.ant-select-item-option').filter({ hasText: '核对分析证据' }).click();
  await page.reload();
  await page.getByRole('combobox', { name: '成果归属' }).waitFor();
  assert.ok((await selectedScope.innerText()).includes('核对分析证据'));
  const items = page.locator('.workspace-preparation-item');
  await items.first().waitFor();
  for (let i = 0; i < await items.count(); i++) {
    await items.nth(i).click();
    await page.getByRole('dialog').getByRole('button', { name: '确 定' }).click();
  }
  await page.getByRole('button', { name: /开始分析$/ }).click();
  await page.getByRole('button', { name: /保存分析结果$/ }).click();
  const taskResult = await page.evaluate(taskId => JSON.parse(localStorage.getItem('protangram-task-workspace-v1')).state.tasks.find(item => item.id === taskId), seed.taskId);
  assert.equal(taskResult.requirements[0].status, '待确认');
  assert.equal(taskResult.requirements[0].artifactRefs.length, 1);
  assert.equal(taskResult.artifactRefs.length, 0);
  assert.equal(taskResult.status, '进行中');
  await page.locator('.session-capability-tabs').getByRole('button', { name: '数字孪生', exact: true }).click();
  await page.locator('.workspace-preparation-item').filter({ hasText: '模型' }).first().click();
  await page.getByRole('dialog').locator('.ant-select').click();
  await page.locator('.ant-select-item-option').filter({ hasText: '发动机模型 V2.1' }).first().click();
  await page.getByRole('dialog').getByRole('button', { name: '确 定' }).click();
  await page.locator('input[type=file]').nth(0).setInputFiles({ name: 'review-sim.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await page.locator('input[type=file]').nth(1).setInputFiles({ name: 'review-real.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n1,2') });
  await page.locator('.workspace-preparation-item').filter({ hasText: '参数配置' }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确 定' }).click();
  await page.getByRole('button', { name: /开始校准$/ }).click();
  await page.locator('.workspace-business-page').getByText('校准完成，当前会话模型', { exact: false }).waitFor();
  const beforeReuse = await page.evaluate(taskId => JSON.parse(localStorage.getItem('protangram-task-workspace-v1')).state.tasks.find(item => item.id === taskId), seed.taskId);
  assert.equal(beforeReuse.artifactRefs.length, 1);
  await page.locator('.task-artifact-scope .ant-select').click();
  await page.locator('.ant-select-item-option').filter({ hasText: '核对分析证据' }).click();
  await page.getByRole('button', { name: '加入任务报告', exact: true }).click();
  const afterReuse = await page.evaluate(taskId => JSON.parse(localStorage.getItem('protangram-task-workspace-v1')).state.tasks.find(item => item.id === taskId), seed.taskId);
  assert.equal(afterReuse.requirements[0].artifactRefs.length, 2);
  assert.equal(afterReuse.requirements[0].status, '待确认');
  console.log('PASS: choosing an item after calibration reuses and associates the existing artifact.');

  await page.goto(base + '/report/create');
  await page.getByRole('heading', { name: '任务报告配置' }).waitFor();
  await template();
  for (const checkbox of await page.getByRole('checkbox').all()) await checkbox.check();
  await page.getByRole('button', { name: /保存配置并继续编制$/ }).click();
  await page.waitForURL('**/report/generate/**');
  await bind();
  await page.getByRole('button', { name: /正式生成报告$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '仍要生成正式报告', exact: true }).click();
  await page.getByRole('button', { name: /查看报告$/ }).waitFor();
  const formalId = new URL(page.url()).pathname.split('/').at(-1);
  await page.evaluate(({ projectId, reportId }) => {
    const report = JSON.parse(localStorage.getItem('protangram_analysis_reports')).find(item => item.id === reportId);
    const workspace = JSON.parse(localStorage.getItem('protangram-project-workspace-v1'));
    workspace.state.projects.find(item => item.id === projectId).artifacts = workspace.state.projects.find(item => item.id === projectId).artifacts.filter(item => !report.artifactIds.includes(item.id));
    localStorage.setItem('protangram-project-workspace-v1', JSON.stringify(workspace));
  }, { projectId: seed.projectId, reportId: formalId });
  await page.reload();
  await page.getByText('此报告已有正式成果，请新建报告体验演示数据。').waitFor();
  assert.equal(await page.getByRole('button', { name: '启用演示报告数据', exact: true }).isDisabled(), true);
  assert.equal(await page.getByRole('button', { name: /正式生成报告$/ }).isDisabled(), true);
  const formal = await page.evaluate(({ taskId, reportId }) => ({
    task: JSON.parse(localStorage.getItem('protangram-task-workspace-v1')).state.tasks.find(item => item.id === taskId),
    report: JSON.parse(localStorage.getItem('protangram_analysis_reports')).find(item => item.id === reportId),
  }), { taskId: seed.taskId, reportId: formalId });
  assert.equal(formal.report.dataSource, 'artifacts');
  assert.equal(formal.task.reportDraft.formalReportArtifact.artifactId, formalId);
  console.log('PASS: invalidated source blocks generation and existing formal evidence cannot be overwritten by demo data.');
  await page.goto(`${base}/tasks/${seed.taskId}`);
  await page.getByRole('button', { name: /任务中心$/, exact: false }).first().click();
  await page.waitForURL('**/task-center');
  await page.getByRole('heading', { name: '任务中心', exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('PASS: free task association persists, save enters pending confirmation without completing task, task-center navigation; no page errors.');
} catch (error) {
  console.log('URL:', page.url());
  console.log((await page.locator('body').innerText()).slice(0, 6000));
  console.log('PAGE ERRORS:', errors);
  throw error;
} finally { await browser.close(); }
