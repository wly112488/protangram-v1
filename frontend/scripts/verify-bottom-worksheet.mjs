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
  const tab = name => dock.getByRole('tab').filter({ hasText: name });
  const choosePlot = async (kind, name) => {
    await editor().getByRole('button', { name: '绘图', exact: true }).click();
    await page.getByRole('menuitem', { name: kind, exact: true }).click();
    if (name) await page.getByRole('dialog').getByRole('textbox', { name: '图表名称' }).fill(name);
    await page.getByRole('dialog').getByRole('button', { name: '生成预览', exact: true }).click();
    await page.locator('.worksheet-chart-preview').waitFor();
  };
  await dock.waitFor();
  assert.equal(await page.locator('.trial-csv-analysis .physical-analysis-results').count(), 0);
  let box = await dock.boundingBox();
  assert.ok(Math.abs(box.y + box.height - 1000) < 3);
  assert.equal(await editor().locator('thead th').count(), 7);
  assert.equal(await editor().locator('.ant-table-tbody > tr[data-row-key]').count(), 15);
  assert.equal(await editor().getByRole('combobox').count(), 1); // page size only, no permanent X/Y controls
  await editor().locator('.ant-pagination-next').click();
  await editor().locator('tr[data-row-key="15"] td').nth(2).dblclick();
  await editor().getByRole('textbox', { name: '编辑第16行 speed_rpm' }).fill('3999');
  await editor().getByRole('textbox', { name: '编辑第16行 speed_rpm' }).press('Enter');
  await page.locator('.session-capability-tabs').getByRole('button', { name: /智能实验设计/ }).click();
  await dock.getByRole('button', { name: '打开已有 CSV', exact: true }).click();
  await page.getByRole('menuitem').filter({ hasText: '风扇数据.csv' }).click();
  await editor().locator('tr[data-row-key="15"]').waitFor();
  assert.equal(await editor().locator('tr[data-row-key="15"] td').nth(2).innerText(), '3999');
  assert.equal(await page.locator('input[type=file]').count(), 0);
  console.log('PASS bottom fixed tabs / all columns / numeric pagination / edits survive capability navigation');
  await dock.getByRole('button', { name: '关闭工作表区', exact: true }).first().click();
  assert.equal(await dock.isVisible(), false);
  assert.equal(await page.locator('.trial-worksheet-workspace').evaluate(el => el.style.paddingBottom), '0px');
  await page.getByRole('button', { name: '打开工作表区', exact: true }).click();
  assert.equal(await editor().locator('tr[data-row-key="15"] td').nth(2).innerText(), '3999');
  console.log('PASS full dock close hides tabs and spacing without losing unsaved edits');


  await page.evaluate(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    window.__worksheetTransactionDescriptor = descriptor;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', { ...descriptor, set(callback) { descriptor.set.call(this, function(event) { setTimeout(() => callback.call(this, event), 2000); }); } });
  });
  await editor().getByRole('button', { name: '保存工作副本' }).click();
  await page.getByRole('textbox', { name: '工作副本文件名' }).fill('风扇编辑.csv');
  await page.getByRole('dialog').getByRole('button', { name: '保存到本机', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByRole('button', { name: /取\s*消/ }).isDisabled(), true);
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 1);
  await tab('风扇编辑.csv').waitFor();
  await page.evaluate(() => Object.defineProperty(IDBTransaction.prototype, 'oncomplete', window.__worksheetTransactionDescriptor));
  await editor().locator('th').filter({ hasText: 'time_s' }).click();
  await editor().locator('th').filter({ hasText: 'speed_rpm' }).click({ modifiers: ['Control'] });
  await editor().locator('th').filter({ hasText: 'thrust_n' }).click({ modifiers: ['Control'] });
  // Exercise the actual table right-click menu, not just the toolbar shortcut.
  await editor().locator('th').filter({ hasText: 'thrust_n' }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /绘图/ }).hover();
  await page.getByRole('menuitem', { name: '多曲线折线图', exact: true }).click();
  await page.getByRole('dialog').getByRole('textbox', { name: '图表名称' }).fill('跨功能三列图');
  await page.getByRole('dialog').getByRole('button', { name: '生成预览', exact: true }).click();
  // Hide the lower sheet to inspect and save the full chart above it.
  await dock.getByRole('button', { name: '关闭工作表区', exact: true }).first().click();
  assert.equal(await dock.isVisible(), false);
  await page.locator('.worksheet-chart-preview').getByRole('button', { name: '保存图表', exact: true }).click();
  const saved = await page.evaluate(async () => {
    const { usePhysicalObjectStore: physical } = await import('/src/workspace/physicalObjectStore.ts');
    const { readTrialFile } = await import('/src/workspace/trialDataFiles.ts');
    const trial = physical.getState().objects[0].configurations[0].experiments[0].trials[0];
    const copy = trial.records[0].rawFiles.find(file => file.sourceRawFileId === 'browser-csv');
    return { copy, original: await readTrialFile('browser-csv'), edited: await readTrialFile(copy.id), chart: trial.charts.find(chart => chart.name === '跨功能三列图'), records: trial.records.length };
  });
  assert.equal(saved.original.rows[15].speed_rpm, '3150');
  assert.equal(saved.edited.rows[15].speed_rpm, '3999');
  assert.equal(saved.records, 1);
  assert.deepEqual(saved.chart.yFields, ['speed_rpm', 'thrust_n']);
  assert.equal(saved.chart.sourceCapability, 'doe');
  assert.equal(saved.chart.rawFileId, saved.copy.id);
  console.log('PASS immutable working copy / same execution / right-click multi-column chart / source capability');

  await page.getByRole('button', { name: '打开工作表区', exact: true }).click();
  await dock.getByRole('button', { name: '收起表格', exact: true }).click();
  box = await dock.boundingBox();
  assert.equal(box.height, 44);
  assert.equal(await page.locator('.worksheet-chart-preview:visible').count(), 1);
  await tab('风扇编辑.csv').click();
  await dock.getByRole('button', { name: '重命名工作表', exact: true }).click();
  await page.getByRole('textbox', { name: '工作表标签名称' }).fill('编辑工作表');
  await page.getByRole('dialog').getByRole('button', { name: '保存名称', exact: true }).click();
  await dock.getByRole('button', { name: '关闭工作表 编辑工作表', exact: true }).click();
  assert.equal(await tab('编辑工作表').count(), 0);
  await dock.getByRole('button', { name: '打开已有 CSV', exact: true }).click();
  await page.getByRole('menuitem').filter({ hasText: '编辑工作表' }).click();
  await page.reload({ waitUntil: 'networkidle' });
  await tab('编辑工作表').waitFor();
  const copyStatus = await page.evaluate(id => JSON.parse(localStorage.getItem('protangram-physical-objects-v1')).state.objects[0].configurations[0].experiments[0].trials[0].records[0].rawFiles.find(file => file.id === id).status, saved.copy.id);
  assert.equal(copyStatus, 'available');
  console.log('PASS upward expand/collapse / tab renaming survives refresh / closing a view never removes CSV');

  // Plot-first: histogram requests one column rather than forcing a two-axis form.
  await editor().getByRole('button', { name: '绘图', exact: true }).click();
  await page.getByRole('menuitem', { name: '直方图', exact: true }).click();
  assert.equal(await page.getByRole('dialog').getByLabel('绘图数值列', { exact: true }).count(), 0);
  await page.getByRole('dialog').getByRole('combobox', { name: '绘图横轴' }).click();
  await page.locator('.ant-select-dropdown:visible .ant-select-item-option').filter({ hasText: /^thrust_n$/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: '生成预览', exact: true }).click();
  await page.locator('.worksheet-chart-preview').waitFor();
  console.log('PASS plot-first workflow exposes only the selected chart roles');

  for (const name of [/数字孪生/, /虚拟工况/, /报告/]) {
    await page.locator('.session-capability-tabs').getByRole('button', { name }).click();
    await dock.getByRole('button', { name: '打开已有 CSV', exact: true }).click();
    await page.getByRole('menuitem').filter({ hasText: '编辑工作表' }).click();
    await editor().locator('th').filter({ hasText: 'time_s' }).click();
    await editor().locator('th').filter({ hasText: 'thrust_n' }).click({ modifiers: ['Control'] });
    await choosePlot('散点图');
    assert.equal(await page.locator('input[type=file]').count(), 0);
    assert.equal(await page.locator('.physical-analysis-results').count(), 0);
  }
  console.log('PASS all five professional capabilities share drawing tools without duplicate import or results panels');

  await page.locator('.session-capability-tabs').getByRole('button', { name: /数据分析/ }).click();
  await page.locator('input[type=file]').setInputFiles([
    { name: '第二份导入.csv', mimeType: 'text/csv', buffer: Buffer.from('time,value,extra\n0,4,a\n1,6,b') },
    { name: '第三份导入.csv', mimeType: 'text/csv', buffer: Buffer.from('time,value\n0,8\n1,9') },
  ]);
  await tab('第二份导入.csv').waitFor(); await tab('第三份导入.csv').waitFor();
  const diagnosticFiles = await page.evaluate(async fixture => {
    const { usePhysicalObjectStore: physical } = await import('/src/workspace/physicalObjectStore.ts');
    const { useProjectStore: projects } = await import('/src/workspace/projectStore.ts');
    const { useSessionStore: sessions } = await import('/src/workspace/sessionStore.ts');
    const trial = physical.getState().objects[0].configurations[0].experiments[0].trials[0];
    const session = sessions.getState().sessions.find(item => item.id === fixture.session);
    const files = trial.records[0].rawFiles.filter(file => file.name === '第二份导入.csv' || file.name === '第三份导入.csv');
    files.forEach((file, i) => projects.getState().addArtifact(session.storageProjectId, { type: 'rootCause', title: `文件${i + 2}独立结论`, summary: '测试专用来源夹具', source: '测试服务', payload: { resultMode: 'service', sourceScope: { ...session.businessScope, testRecordId: trial.records[0].id }, sourceContext: { rawFiles: [file] }, results: [{ id: 'conclusion', kind: 'metric', name: `文件${i + 2}独立结论`, value: `仅属于${file.name}` }] } }));
    return { files, records: trial.records.length };
  }, fixture);
  assert.equal(diagnosticFiles.records, 1);
  await page.getByRole('tab', { name: '异常与根因分析', exact: true }).click();
  assert.equal((await dock.boundingBox()).height, 44);
  await tab('第二份导入.csv').click();
  await page.getByText('仅属于第二份导入.csv', { exact: true }).waitFor();
  assert.equal(await page.getByText('仅属于第三份导入.csv', { exact: true }).count(), 0);
  await tab('第三份导入.csv').click();
  await page.getByText('仅属于第三份导入.csv', { exact: true }).waitFor();
  assert.equal(await page.getByText('仅属于第二份导入.csv', { exact: true }).count(), 0);
  await tab('风扇数据.csv').click();
  await page.getByText('当前 CSV 尚无真实异常与根因结论', { exact: true }).waitFor();
  assert.equal(await page.getByText('推力异常下降', { exact: true }).count(), 0);
  console.log('PASS multi-file import retains all tabs and one execution; diagnoses isolated by exact CSV; no mock conclusion');


  // A record-bound legacy session can inspect another execution without hiding its CSV diagnosis.
  const otherExecution = await page.evaluate(async fixture => {
    const { usePhysicalObjectStore: physical } = await import('/src/workspace/physicalObjectStore.ts');
    const { useProjectStore: projects } = await import('/src/workspace/projectStore.ts');
    const { useSessionStore: sessions } = await import('/src/workspace/sessionStore.ts');
    const { saveTrialFile } = await import('/src/workspace/trialDataFiles.ts');
    const record = physical.getState().addTrialRecord(fixture.trial, {});
    const file = { id: 'other-execution-csv', name: '另一次执行.csv', headers: ['time', 'value'], rowCount: 2, mimeType: 'text/csv', size: 21, addedAt: '' };
    await saveTrialFile(file.id, new File(['time,value\n0,10\n1,20'], file.name, { type: 'text/csv' }));
    physical.getState().addRawFile(fixture.trial, record, file);
    const session = sessions.getState().sessions.find(item => item.id === fixture.session);
    projects.getState().addArtifact(session.storageProjectId, { type: 'rootCause', title: '第二次执行诊断', source: '测试服务', summary: '仅测试来源关系', payload: { resultMode: 'computed', sourceScope: { ...session.businessScope, testRecordId: record }, sourceContext: { rawFiles: [file] }, results: [{ id: 'conclusion', kind: 'metric', name: '第二次执行结论', value: '属于另一次执行' }] } });
    // Bind the session to the first execution to exercise the historical path.
    sessions.setState({ sessions: sessions.getState().sessions.map(item => item.id === fixture.session ? { ...item, businessScope: { ...item.businessScope, testRecordId: fixture.record } } : item) });
    return { record, file };
  }, fixture);
  await page.waitForFunction(() => document.querySelector('.session-meta')?.textContent?.includes('第 1 次'));
  await dock.getByRole('button', { name: '打开已有 CSV', exact: true }).click();
  await page.getByRole('menuitem').filter({ hasText: '另一次执行.csv' }).click();
  await page.getByText('属于另一次执行', { exact: true }).waitFor();
  assert.equal((await dock.boundingBox()).height, 44);
  console.log('PASS record-bound sessions can view diagnoses owned by another execution of the same trial');

  await page.screenshot({ path: 'node_modules/.tmp/csv-result-workspace/bottom-diagnosis.png', fullPage: true });
  await page.locator('.session-header-actions').getByRole('button', { name: '数据与成果', exact: true }).click();
  const catalog = page.locator('.result-catalog-layout');
  await catalog.waitFor();
  assert.equal(await page.locator('.result-feature-tabs').count(), 0);
  assert.equal(await dock.isVisible(), false);
  assert.equal(await catalog.locator('.echarts-for-react').count(), 0);
  await catalog.getByText('另一次执行.csv', { exact: true }).waitFor();
  await catalog.getByText('第二次执行结论', { exact: true }).waitFor();
  await catalog.getByText('跨功能三列图', { exact: true }).click();
  await catalog.locator('.echarts-for-react').waitFor();
  await catalog.getByText('文件2独立结论', { exact: true }).click();
  await catalog.getByText('仅属于第二份导入.csv', { exact: true }).waitFor();
  await page.screenshot({ path: 'node_modules/.tmp/csv-result-workspace/source-catalog-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.screenshot({ path: 'node_modules/.tmp/csv-result-workspace/source-catalog-mobile.png', fullPage: true });
  await page.goto(route('analysis'), { waitUntil: 'networkidle' });
  await dock.waitFor();
  const mobileDock = await dock.boundingBox();
  assert.ok(Math.abs(mobileDock.x) < 2 && Math.abs(mobileDock.width - 390) < 2);
  const tabStripBox = await dock.locator('.worksheet-file-tabs').boundingBox();
  const activeTabBox = await dock.getByRole('tab', { selected: true }).boundingBox();
  assert.ok(activeTabBox.x >= tabStripBox.x - 2 && activeTabBox.x + activeTabBox.width <= tabStripBox.x + tabStripBox.width + 2);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false);
  await page.screenshot({ path: 'node_modules/.tmp/csv-result-workspace/bottom-mobile.png', fullPage: true });
  console.log('PASS source directory has no function partition; lazy multi-series preview and per-CSV conclusions; mobile dock fits');

  await page.setViewportSize({ width: 1500, height: 1000 });
  await page.goto(route('analysis'), { waitUntil: 'networkidle' });
  await tab('风扇数据.csv').click();
  await page.getByRole('button', { name: '管理数据文件', exact: true }).click();
  const fileRow = page.locator('.trial-csv-file-row').filter({ hasText: '风扇数据.csv' });
  await fileRow.getByRole('button', { name: /移\s*除/ }).click();
  await page.getByRole('tooltip').getByRole('button', { name: /移\s*除/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /关\s*闭/ }).click();
  assert.equal(await tab('风扇数据.csv').count(), 0);
  await page.locator('.session-header-actions').getByRole('button', { name: '数据与成果', exact: true }).click();
  await catalog.getByText('已保存推力曲线', { exact: true }).click();
  await catalog.getByText('来源 CSV 已移除；保留成果供追溯，不能重新计算或作为当前有效结果。', { exact: true }).waitFor();
  await catalog.getByText('跨功能三列图', { exact: true }).click();
  await catalog.locator('.echarts-for-react').waitFor();
  assert.ok(otherExecution.record);
  assert.deepEqual(errors, []);
  console.log('PASS removal retains history, invalidates only its own source, copy graph remains valid; no runtime errors');
} catch (error) {
  console.log('browser errors', errors);
  console.log(await page.evaluate(async () => { const { usePhysicalObjectStore: p } = await import('/src/workspace/physicalObjectStore.ts'); return { records: p.getState().objects[0]?.configurations[0]?.experiments[0]?.trials[0]?.records.map(record => ({ id: record.id, files: record.rawFiles.map(file => file.name) })), meta: document.querySelector('.session-meta')?.textContent }; }).catch(() => null));
  await page.screenshot({ path: 'node_modules/.tmp/csv-result-workspace/bottom-failure.png', fullPage: true }).catch(() => {});
  throw error;
} finally { await browser.close(); }
