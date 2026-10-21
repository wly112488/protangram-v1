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


  const dock = page.locator('.trial-worksheet-dock');
  const editor = () => dock.locator('.csv-worksheet-editor:visible');
  await editor().locator('tr[data-row-key="0"] td').nth(2).dblclick();
  await editor().getByRole('textbox', { name: '编辑第1行 speed_rpm' }).fill('3999');
  await editor().getByRole('textbox', { name: '编辑第1行 speed_rpm' }).press('Enter');
  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBRequest.prototype, 'onsuccess');
    Object.defineProperty(IDBRequest.prototype, 'onsuccess', { ...descriptor, set(callback) { descriptor.set.call(this, function(event) {
      if (this.result?.id === 'browser-csv') setTimeout(() => callback.call(this, event), 15000);
      else callback.call(this, event);
    }); } });
  });
  await editor().getByRole('button', { name: '保存工作副本' }).click();
  await page.getByRole('textbox', { name: '工作副本文件名' }).fill('保存时序验证.csv');
  await page.getByRole('dialog').getByRole('button', { name: '保存到本机', exact: true }).click();
  await dock.getByRole('tab').filter({ hasText: '保存时序验证.csv' }).waitFor();
  await dock.getByRole('tab').filter({ hasText: '风扇数据.csv' }).click();
  await editor().locator('tr[data-row-key="0"] td').nth(2).dblclick();
  await editor().getByRole('textbox', { name: '编辑第1行 speed_rpm' }).fill('4777');
  await editor().getByRole('textbox', { name: '编辑第1行 speed_rpm' }).press('Enter');
  await page.waitForTimeout(16000); // deliberately outlast the delayed original-file read
  assert.equal(await editor().locator('tr[data-row-key="0"] td').nth(2).innerText(), '4777');
  assert.equal(await editor().getByText('有未保存修改', { exact: true }).count(), 1);
  assert.deepEqual(errors, []);
  console.log('PASS saving a copy cannot asynchronously overwrite subsequent edits in the original worksheet');
} finally { await browser.close(); }
