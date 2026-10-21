import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? new URL('../package.json', import.meta.url));
const { chromium } = require('playwright-core');
const base = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PROTANGRAM_CHROMIUM_PATH ? { executablePath: process.env.PROTANGRAM_CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1550, height: 1050 } });
const page = await context.newPage();
page.setDefaultTimeout(12000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
const state = () => page.evaluate(async () => {
  const { useProjectStore } = await import('/src/workspace/projectStore.ts');
  const { useTaskStore } = await import('/src/workspace/taskStore.ts');
  const { useSessionStore } = await import('/src/workspace/sessionStore.ts');
  const { usePhysicalObjectStore } = await import('/src/workspace/physicalObjectStore.ts');
  return { projects: useProjectStore.getState().projects, tasks: useTaskStore.getState().tasks, sessions: useSessionStore.getState().sessions,
    trials: usePhysicalObjectStore.getState().objects.flatMap(category => category.configurations.flatMap(object => object.experiments.flatMap(config => config.trials))) };
});
const importTask = async (name, trialName) => {
  await page.locator('.task-analysis-page input[type=file]').first().setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(`试验名称：${trialName}\n物理对象：工作流风扇\n试验构型：工作流构型\n载荷谱：LS-01\n目标：完成试验分析与报告。`) });
  await page.getByRole('button', { name: '复核并创建试验', exact: true }).waitFor();
};
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.evaluate(async () => {
    const { useProjectStore: projects } = await import('/src/workspace/projectStore.ts');
    const { usePhysicalObjectStore: physical } = await import('/src/workspace/physicalObjectStore.ts');
    const { useTaskStore: tasks } = await import('/src/workspace/taskStore.ts');
    const { useSessionStore: sessions } = await import('/src/workspace/sessionStore.ts');
    physical.setState({ objects: [] }); projects.setState({ projects: [], activeProjectId: null }); tasks.setState({ tasks: [] }); sessions.setState({ sessions: [], activeSessionId: null });
    const category = physical.getState().addRoot({ name: '工作流类别', type: '风扇' });
    const object = physical.getState().addConfiguration(category, { name: '工作流风扇' });
    physical.getState().addExperiment(object, { name: '工作流构型', parameters: [] });
  });
  const sections = await page.locator('.session-sidebar .session-nav-section').allTextContents();
  assert.match(sections.at(-1), /物理对象/);
  assert.equal(await page.locator('.business-object-nav button[aria-expanded]').getAttribute('aria-expanded'), 'false');
  await page.getByRole('button', { name: '新建项目', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('textbox').count(), 1);
  await page.getByRole('textbox', { name: '项目名称', exact: true }).fill('名称创建项目');
  await page.getByRole('dialog').getByRole('button', { name: /^创\s*建$/ }).click();
  const projectId = (await state()).projects.find(item => !item.sessionOwnerId).id;
  assert.equal((await state()).tasks.length, 0);
  assert.equal((await state()).sessions.length, 0);
  console.log('PASS object maintenance is last and collapsed; creating a project needs only a name');

  await page.locator('.session-sidebar').getByText('分析任务书', { exact: true }).click();
  await page.getByRole('heading', { name: '分析任务书', exact: true }).waitFor();
  await importTask('独立任务规划.txt', '已预填性能试验');
  await mkdir('node_modules/.tmp/task-analysis', { recursive: true });
  await page.screenshot({ path: 'node_modules/.tmp/task-analysis/analysis-preview.png', fullPage: true });
  assert.equal(await page.getByRole('textbox', { name: '任务事项1', exact: true }).inputValue(), '分析试验数据并识别异常响应');
  assert.equal((await state()).tasks.length, 0);
  assert.equal((await state()).trials.length, 0);
  await page.getByRole('button', { name: '复核并创建试验', exact: true }).click();
  await page.getByRole('heading', { name: '复核试验模板', exact: true }).waitFor();
  assert.equal(await page.getByLabel('具体试验名称', { exact: true }).inputValue(), '已预填性能试验');
  assert.equal(await page.getByLabel('载荷谱名称或编号', { exact: true }).inputValue(), 'LS-01');
  assert.equal(await page.getByRole('button', { name: '确认并进入试验工作台', exact: true }).isEnabled(), true);
  let snapshot = await state();
  const taskId = snapshot.tasks[0].id;
  assert.equal(snapshot.tasks[0].projectId, '');
  assert.equal(snapshot.projects.filter(item => !item.sessionOwnerId).length, 1);
  assert.equal(snapshot.sessions.length, 0);
  assert.equal(snapshot.trials.length, 0);
  await page.locator('.trial-create-page > button').first().click();
  await page.goto(`${base}/task-center?taskId=${taskId}&view=progress`);
  await page.getByRole('button', { name: '复核并创建试验', exact: true }).click();
  assert.equal(await page.getByLabel('具体试验名称', { exact: true }).inputValue(), '已预填性能试验');
  await page.getByRole('button', { name: '确认并进入试验工作台', exact: true }).click();
  await page.waitForURL(/\/sessions\/[^/]+\/analysis$/);
  snapshot = await state();
  const sessionId = snapshot.sessions[0].id;
  const trialId = snapshot.trials[0].id;
  assert.equal(snapshot.sessions[0].projectId, undefined);
  assert.equal(snapshot.sessions[0].sidebarVisible, false);
  assert.equal(snapshot.trials[0].taskBookId, taskId);
  assert.equal(await page.locator('.session-sidebar').getByText('已预填性能试验', { exact: true }).count(), 0);
  console.log('PASS importing pre-fills the template, cancelling preserves planning, confirming creates one hidden standalone work session');

  await page.getByRole('button', { name: /新建执行记录/ }).click();
  await page.locator('.trial-csv-analysis input[type=file]').setInputFiles([
    { name: '载荷记录.csv', mimeType: 'text/csv', buffer: Buffer.from('time,thrust\n0,10\n1,12\n') },
    { name: '温度记录.csv', mimeType: 'text/csv', buffer: Buffer.from('time,temperature\n0,20\n1,21\n') },
  ]);
  await page.waitForFunction(async () => {
    const { usePhysicalObjectStore } = await import('/src/workspace/physicalObjectStore.ts');
    return usePhysicalObjectStore.getState().objects[0].configurations[0].experiments[0].trials[0].records[0]?.rawFiles.length === 2;
  });
  snapshot = await state();
  assert.equal(snapshot.trials[0].records.length, 1);
  assert.equal(snapshot.trials[0].records[0].rawFiles.length, 2);
  await page.getByRole('button', { name: '返回任务进度', exact: true }).click();
  await page.getByText('0 / 5 项完成', { exact: true }).waitFor();
  await page.locator('.ant-table-tbody > tr[data-row-key]').first().getByRole('button', { name: '开展工作', exact: true }).click();
  assert.match(page.url(), new RegExp(`/sessions/${sessionId}/analysis$`));
  assert.equal((await state()).trials[0].id, trialId);
  await page.getByRole('button', { name: '返回任务进度', exact: true }).click();
  await page.locator('.ant-table-tbody > tr[data-row-key]').first().getByRole('button', { name: '确认完成', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认完成', exact: true }).click();
  assert.equal(await page.getByRole('dialog').count(), 1);
  assert.equal(await page.locator('.session-sidebar').getByText('已预填性能试验', { exact: true }).count(), 0);
  await page.getByRole('textbox', { name: '完成依据', exact: true }).fill('已核对本次两份 CSV 和分析结论');
  await page.getByRole('dialog').getByRole('button', { name: '确认完成', exact: true }).click();
  await page.getByText('1 / 5 项完成', { exact: true }).waitFor();
  await page.locator('.session-sidebar').getByText('已预填性能试验', { exact: true }).waitFor();
  await page.reload();
  await page.getByText('1 / 5 项完成', { exact: true }).waitFor();
  snapshot = await state();
  assert.equal(snapshot.sessions.length, 1);
  assert.equal(snapshot.trials.length, 1);
  assert.equal(snapshot.trials[0].records[0].rawFiles.length, 2);
  await mkdir('node_modules/.tmp/task-analysis', { recursive: true });
  await page.screenshot({ path: 'node_modules/.tmp/task-analysis/task-progress.png', fullPage: true });
  console.log('PASS ordinary execution-record/CSV management is reused, continue resumes the same session, and completion publishes it with persisted task progress');

  for (let index = 1; index < 5; index++) {
    await page.locator('.ant-table-tbody > tr[data-row-key]').nth(index).getByRole('button', { name: '确认完成', exact: true }).click();
    await page.getByRole('textbox', { name: '完成依据', exact: true }).fill('已人工复核本事项交付内容');
    await page.getByRole('dialog').getByRole('button', { name: '确认完成', exact: true }).click();
  }
  await page.getByText('5 / 5 项完成', { exact: true }).waitFor();
  assert.equal((await state()).tasks[0].status, '已完成');
  assert.equal((await state()).sessions.length, 1);
  console.log('PASS overall task completion is derived from confirmed items without duplicating trial sessions');

  await page.goto(`${base}/projects?projectId=${projectId}&view=trials`);
  await page.locator('.session-shared-resources').getByRole('button', { name: '分析任务书', exact: true }).click();
  await importTask('项目任务规划.txt', '项目内预填试验');
  await page.getByRole('button', { name: '复核并创建试验', exact: true }).click();
  await page.getByRole('button', { name: '确认并进入试验工作台', exact: true }).click();
  await page.waitForURL(/\/sessions\/[^/]+\/analysis$/);
  snapshot = await state();
  const projectSession = snapshot.sessions.find(item => item.businessScope?.trialName === '项目内预填试验');
  assert.equal(projectSession.projectId, projectId);
  assert.equal(projectSession.sidebarVisible, false);
  assert.equal(await page.locator('.session-sidebar').getByText('项目内预填试验', { exact: true }).count(), 0);
  await page.getByRole('button', { name: '返回任务进度', exact: true }).click();
  await page.locator('.ant-table-tbody > tr[data-row-key]').first().getByRole('button', { name: '确认完成', exact: true }).click();
  await page.getByRole('textbox', { name: '完成依据', exact: true }).fill('已核对项目内交付');
  await page.getByRole('dialog').getByRole('button', { name: '确认完成', exact: true }).click();
  await page.locator('.business-project-group').filter({ hasText: '名称创建项目' }).getByText('项目内预填试验', { exact: true }).waitFor();
  assert.equal((await state()).projects.filter(item => !item.sessionOwnerId).length, 1);
  console.log('PASS project-context task work inherits the project and publishes under that project only after completion');

  await page.goto(`${base}/task-book-analysis`);
  await page.locator('.task-analysis-page input[type=file]').first().setInputFiles({ name: '未确定对象任务书.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
  await page.getByText('物理对象待确认', { exact: true }).waitFor();
  await page.getByRole('button', { name: '复核并创建试验', exact: true }).click();
  await page.getByRole('heading', { name: '复核试验模板', exact: true }).waitFor();
  assert.equal(await page.getByLabel('载荷谱名称或编号', { exact: true }).inputValue(), '');
  assert.equal(await page.getByRole('button', { name: '确认并进入试验工作台', exact: true }).isDisabled(), true);
  assert.equal((await state()).trials.length, 2);
  console.log('PASS PDF import displays reviewable templates without fabricating missing object, configuration or load spectrum');
  assert.deepEqual(errors, []);
  console.log('PASS no browser runtime errors');
} catch (error) {
  await mkdir('node_modules/.tmp/task-analysis', { recursive: true });
  await page.screenshot({ path: 'node_modules/.tmp/task-analysis/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); }
