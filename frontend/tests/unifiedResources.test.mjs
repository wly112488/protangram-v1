import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

globalThis.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const bundle = await build({ stdin: { contents: "export * from './src/workspace/sharedResourcesModel';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('shared views retain all results and source IDs, including session-owned and historical report results', () => {
  const trial = { id: 't1', name: '试验一', loadSpectrum: 'LS1', records: [{ id: 'r1', rawFiles: [{ id: 'csv1', name: 'a.csv' }], tables: [] }], charts: [] };
  const other = { id: 't2', name: '试验二', loadSpectrum: 'LS2', records: [], charts: [] };
  const objects = [{ id: 'category', configurations: [{ id: 'fan', experiments: [{ id: 'setup', trials: [trial, other] }] }] }];
  const scope = { physicalObjectId: 'fan', experimentId: 'setup', trialId: 't1' };
  const first = { id: 'a1', projectId: 'internal', type: 'design', title: '第一版', summary: '', payload: { sourceScope: scope, results: [{ id: 'v', kind: 'metric', name: '第一版', value: 1 }] } };
  const second = { ...first, id: 'a2', title: '第二版' };
  const report = { id: 'report', projectId: 'p1', type: 'report', title: '历史报告', payload: {} };
  const projects = [{ id: 'p1', artifacts: [report] }, { id: 'internal', sessionOwnerId: 's1', artifacts: [first, second] }, { id: 'p2', artifacts: [] }];
  const sessions = [{ id: 's1', projectId: 'p1', storageProjectId: 'internal', businessScope: scope }, { id: 's2', projectId: 'p2', storageProjectId: 'p2', businessScope: { ...scope, trialId: 't2' } }];
  const all = api.collectSharedResources(projects, sessions, objects, { projectId: 'p1' });
  assert.deepEqual(all.trials.map(item => item.id), ['t1']);
  assert.deepEqual(all.entries.map(item => item.artifact.id).sort(), ['a1', 'a2', 'report']);
  assert.equal(all.trials[0], trial);
  assert.equal(all.entries.find(item => item.artifact.id === 'a1').artifact, first);
  const focused = api.collectSharedResources(projects, sessions, objects, { projectId: 'p1', trialId: 't1' });
  assert.equal(focused.entries.length, 2);
  const invalid = api.collectSharedResources(projects, sessions, objects, { projectId: 'p1', trialId: 't2' });
  assert.equal(invalid.missing, true);
  assert.deepEqual(invalid.entries, []);
  const legacy = api.collectSharedResources(projects, sessions, objects, { sessionId: 's1' });
  assert.equal(legacy.entries.length, 2);
});
