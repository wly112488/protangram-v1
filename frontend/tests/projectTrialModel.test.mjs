import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const memory = new Map();
globalThis.localStorage = {
  getItem: key => memory.get(key) ?? null,
  setItem: (key, value) => memory.set(key, value),
  removeItem: key => memory.delete(key),
};
globalThis.window = { localStorage: globalThis.localStorage };

const bundled = await build({
  stdin: {
    contents: "export * from './src/workspace/projectTrialModel'; export { buildProjectNavigation } from './src/workspace/projectModel';",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const objects = [{
  id: 'category-1', name: '涵道风扇', configurations: [{
    id: 'object-1', name: '风扇 A', experiments: [{
      id: 'setup-1', name: '性能试验构型', trials: [
        { id: 'trial-1', name: '推力试验', records: [
          { id: 'record-1', executionNumber: 1, rawFiles: [], tables: [] },
          { id: 'record-2', executionNumber: 2, rawFiles: [], tables: [] },
        ], charts: [] },
        { id: 'trial-2', name: '独立试验', records: [], charts: [] },
      ],
    }],
  }],
}];
const projects = [
  { id: 'project-a', artifacts: [] },
  { id: 'project-b', artifacts: [] },
];
const scope = { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-1' };
const sessions = [
  { id: 'session-a1', projectId: 'project-a', storageProjectId: 'project-a', businessScope: scope },
  { id: 'session-a2', projectId: 'project-a', storageProjectId: 'project-a', businessScope: scope },
  { id: 'session-b', projectId: 'project-b', storageProjectId: 'project-b',
    businessScope: { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-2' } },
];

test('project trial view deduplicates sessions and retains nested execution records', () => {
  const entries = api.getProjectTrialEntries('project-a', objects, projects, sessions);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].trial.id, 'trial-1');
  assert.deepEqual(entries[0].trial.records.map(record => record.id), ['record-1', 'record-2']);
  assert.equal(entries[0].sessions.length, 2);
});

test('a trial without taskBookId remains visible in its project', () => {
  const entries = api.getProjectTrialEntries('project-a', objects, projects, sessions);
  assert.equal(entries[0].trial.taskBookId, undefined);
});

test('project trial lists remain scoped to project-local sessions', () => {
  assert.deepEqual(api.getProjectTrialEntries('project-a', objects, projects, sessions).map(entry => entry.trial.id), ['trial-1']);
  assert.deepEqual(api.getProjectTrialEntries('project-b', objects, projects, sessions).map(entry => entry.trial.id), ['trial-2']);
});

test('a project artifact source can expose its real trial without copying it', () => {
  const artifactProjects = [
    { id: 'project-a', artifacts: [{ id: 'artifact-1', payload: { sourceScope: scope } }] },
    { id: 'project-b', artifacts: [] },
  ];
  assert.deepEqual(api.getProjectTrialEntries('project-a', objects, artifactProjects, []).map(entry => entry.trial.id), ['trial-1']);
});

test('invalid source IDs do not fall back to a different trial', () => {
  const invalid = [{ id: 'bad', projectId: 'project-a', storageProjectId: 'project-a',
    businessScope: { physicalObjectId: 'object-1', experimentId: 'missing-setup', trialId: 'trial-2' } }];
  assert.deepEqual(api.getProjectTrialEntries('project-a', objects, projects, invalid), []);
});
