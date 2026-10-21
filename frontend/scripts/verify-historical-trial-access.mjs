import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';

const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-ui-check/node_modules/playwright/package.json');
const { chromium } = require('playwright');
const base = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5175';
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(process.env.PROTANGRAM_CHROMIUM_PATH ? { executablePath: process.env.PROTANGRAM_CHROMIUM_PATH } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await mkdir('node_modules/.tmp/csv-result-workspace', { recursive: true });
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  const fixture = await page.evaluate(async () => {
    const { usePhysicalObjectStore: physical } = await import('/src/workspace/physicalObjectStore.ts');
    const { useProjectStore: projects } = await import('/src/workspace/projectStore.ts');
    const { useSessionStore: sessions } = await import('/src/workspace/sessionStore.ts');
    const { saveTrialFile } = await import('/src/workspace/trialDataFiles.ts');
    physical.setState({ objects: [] }); projects.setState({ projects: [], activeProjectId: null }); sessions.setState({ sessions: [], activeSessionId: null });
    const s = physical.getState(), category = s.addRoot({ name: '浏览器验证涵道风扇', type: '涵道风扇' });
    const object = s.addConfiguration(category, { name: '验证风扇' });
    const config = s.addExperiment(object, { name: '验证构型', parameters: [] });
    const trial = s.addConcreteTrial(config, { name: '额定载荷试验', loadSpectrum: '额定载荷' });
    const record = s.addTrialRecord(trial, {});
    const csv = 'time_s,speed_rpm,thrust_n,temperature_c,pressure_kpa,angle\n' + Array.from({ length: 34 }, (_, i) => `${i},${3000 + i * 10},${20 + i},${25 + i},101,15`).join('\n');
    await saveTrialFile('browser-csv', new File([csv], '风扇数据.csv', { type: 'text/csv' }));
    s.addRawFile(trial, record, { id: 'browser-csv', name: '风扇数据.csv', headers: csv.split('\n')[0].split(','), rowCount: 34, addedAt: '', mimeType: 'text/csv', size: csv.length });
    s.saveChart(trial, record, { name: '已保存推力曲线', rawFileId: 'browser-csv', xField: 'time_s', yField: 'thrust_n', chartType: 'line', startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
    const scope = { physicalObjectId: object, experimentId: config, trialId: trial };
    const session = sessions.getState().ensurePhysicalSession(scope, 'CSV 与成果浏览器验证');
    return { session, trial, record, object, config };
  });
  const route = suffix => `${base}/sessions/${fixture.session}/${suffix}`;
  await page.goto(route('analysis'), { waitUntil: 'networkidle' });


  if (!process.env.PROTANGRAM_EXPORT_ONLY) {
    await page.goto(`${base}/physical-objects?${new URLSearchParams({objectId: fixture.object, experimentId: fixture.config, trialId: fixture.trial, recordId: fixture.record})}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '进入试验工作台', exact: true }).click({ timeout: 3000 });
    const scope = await page.evaluate(() => {
      const id = location.pathname.split('/')[2];
      return id;
    });
    assert.ok(scope);
    const businessScope = await page.evaluate(async () => {
      const { useSessionStore } = await import('/src/workspace/sessionStore.ts');
      return useSessionStore.getState().sessions.find(s => s.id === location.pathname.split('/')[2]).businessScope;
    });
    assert.equal(businessScope.trialId, fixture.trial);
    assert.equal(businessScope.testRecordId, fixture.record);
    console.log('PASS historical execution opens the professional workbench with its real trial and execution');
  }
  await page.goto(route('resources'), { waitUntil: 'networkidle' });
  await page.getByText('已保存推力曲线', { exact: true }).click();
  const exportButton = page.getByRole('button', { name: /导出 PNG/ });
  await exportButton.waitFor({ timeout: 3000 });
  const downloadEvent = page.waitForEvent('download');
  await exportButton.click();
  const download = await downloadEvent;
  assert.equal(download.suggestedFilename(), '已保存推力曲线.png');
  const stream = await download.createReadStream();
  const chunks = []; for await (const chunk of stream) chunks.push(chunk);
  assert.deepEqual([...Buffer.concat(chunks).subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  await page.evaluate(async ({ trial, record }) => {
    const { usePhysicalObjectStore } = await import('/src/workspace/physicalObjectStore.ts');
    usePhysicalObjectStore.getState().removeRawFile(trial, record, 'browser-csv');
  }, fixture);
  assert.equal(await exportButton.isDisabled(), true);
  assert.deepEqual(errors, []);
  console.log('PASS saved CSV chart exports a real PNG; removed sources cannot be exported');
} finally { await browser.close(); }
