import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
const bundle = await build({ entryPoints: ['src/workspace/demoData.ts'], bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { createDemoData } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
test('demo sources, execution records, CSV, charts, sessions and task references form one consistent dataset', () => {
  const demo = createDemoData();
  assert.equal(demo.objects[0].configurations.length, 2);
  for (const device of demo.objects[0].configurations) assert.equal(device.experiments.length, 2);
  const trials = demo.objects.flatMap(category => category.configurations.flatMap(device => device.experiments.flatMap(config => config.trials)));
  assert.equal(trials[0].records.length, 2);
  assert.equal(trials[0].records[0].rawFiles.length, 2);
  for (const trial of trials) for (const chart of trial.charts) {
    const record = trial.records.find(item => item.id === chart.sourceRecordId);
    assert.ok(record);
    const metadata = record.rawFiles.find(file => file.id === chart.rawFileId);
    const contents = demo.files.find(file => file.id === metadata.id).contents.split('\n');
    assert.equal(contents.length - 1, metadata.rowCount);
    assert.deepEqual(contents[0].split(','), metadata.headers);
    assert.ok(metadata.headers.includes(chart.xField) && metadata.headers.includes(chart.yField));
  }
  for (const session of demo.sessions) {
    assert.ok(trials.some(trial => trial.id === session.businessScope.trialId));
    assert.ok(demo.projects.some(project => project.id === session.storageProjectId));
  }
  const task = demo.tasks[0], draft = task.trialDrafts[0];
  assert.equal(trials.find(trial => trial.id === draft.source.trialId).taskBookId, task.id);
  assert.ok(demo.sessions.some(session => session.id === draft.sessionId));
  for (const ref of task.artifactRefs) assert.ok(demo.projects.find(project => project.id === ref.projectId).artifacts.some(artifact => artifact.id === ref.artifactId));
  assert.equal(task.requirements.filter(item => item.status === '已满足').length, 2);
});
test('demo fixture IDs and CSV values are reproducible across clean installs', () => {
  assert.deepEqual(createDemoData(), createDemoData());
});
