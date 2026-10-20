import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({ entryPoints: ['src/workspace/workspacePersistenceCore.ts'], bundle: true, write: false, platform: 'node', format: 'esm' });
const { WorkspacePersistence } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
function fixture() {
  let fail = false;
  const calls = [];
  const database = { physical: null, projects: null, tasks: null, sessions: null };
  const revisions = { physical: 0, projects: 0, tasks: 0, sessions: 0 };
  const adapter = new WorkspacePersistence(async (url, options) => {
    calls.push({ url, options });
    if (!options) return { states: structuredClone(database), revisions: { ...revisions }, access: { role: 'experimenter', identityMode: 'deployment-config' } };
    if (fail) throw new Error('database unavailable');
    const { changes } = JSON.parse(options.body);
    for (const [key, change] of Object.entries(changes)) assert.equal(change.revision, revisions[key]);
    for (const [key, change] of Object.entries(changes)) { database[key] = change.value; revisions[key]++; }
    return { revisions: { ...revisions } };
  });
  return { adapter, calls, database, setFailure: value => { fail = value; } };
}
test('coalesces changes and commits related stores atomically before reporting saved', async () => {
  const { adapter, calls, database } = fixture();
  await adapter.initialize();
  await adapter.transaction(async () => {
    adapter.write('projects', { state: { projects: [{ id: 'p' }] }, version: 1 });
    adapter.write('physical', { state: { objects: [1] }, version: 6 });
    adapter.write('physical', { state: { objects: [1, 2] }, version: 6 });
    assert.equal(database.physical, null);
  });
  assert.equal(calls.length, 2);
  assert.deepEqual(database.physical.state.objects, [1, 2]);
  assert.equal(adapter.status.pending, 0);
  assert.equal(adapter.status.error, null);
});
test('failed creation restores the confirmed store and rejects without claiming success', async () => {
  const { adapter, database, setFailure } = fixture();
  await adapter.initialize();
  let visible = { state: { objects: [] }, version: 6 };
  adapter.register('physical', value => { visible = value ?? { state: { objects: [] }, version: 6 }; });
  setFailure(true);
  await assert.rejects(adapter.transaction(() => {
    visible = { state: { objects: ['unsaved'] }, version: 6 };
    adapter.write('physical', visible);
  }), /database unavailable/);
  assert.deepEqual(visible.state.objects, []);
  assert.equal(database.physical, null);
  assert.match(adapter.status.error, /database unavailable/);
  setFailure(false);
  await adapter.transaction(() => adapter.write('physical', { state: { objects: ['saved'] }, version: 6 }));
  assert.deepEqual(database.physical.state.objects, ['saved']);
});
test('network failures retain draft writes for explicit retry', async () => {
  const { adapter, database, setFailure } = fixture();
  await adapter.initialize();
  setFailure(true);
  adapter.write('sessions', { sessions: [{ id: 'session' }], version: 1 });
  await assert.rejects(adapter.flush(), /database unavailable/);
  assert.equal(database.sessions, null);
  setFailure(false);
  await adapter.retry();
  assert.equal(database.sessions.sessions[0].id, 'session');
});
test('a stale revision never overwrites the database and cannot be blindly retried', async () => {
  let writes = 0;
  const adapter = new WorkspacePersistence(async (_url, options) => {
    if (!options) return { states: {}, revisions: {}, access: { role: 'experimenter' } };
    writes++;
    throw Object.assign(new Error('已被其他页面修改，请重新加载'), { status: 409, code: 'REVISION_CONFLICT' });
  });
  await adapter.initialize();
  adapter.write('physical', { state: { objects: [] }, version: 6 });
  await assert.rejects(adapter.flush(), /重新加载/);
  await assert.rejects(adapter.retry(), /重新加载/);
  assert.equal(writes, 1);
});
test('an in-flight write and a newer draft preserve ordering and latest data', async () => {
  let release;
  let count = 0;
  const requests = [];
  const adapter = new WorkspacePersistence(async (_url, options) => {
    if (!options) return { states: {}, revisions: {}, access: { role: 'experimenter' } };
    requests.push(JSON.parse(options.body));
    if (++count === 1) await new Promise(resolve => { release = resolve; });
    return { revisions: { sessions: count } };
  });
  await adapter.initialize();
  adapter.write('sessions', { sessions: [1] });
  const saving = adapter.flush();
  await new Promise(resolve => setImmediate(resolve));
  adapter.write('sessions', { sessions: [1, 2] });
  release();
  await saving;
  assert.equal(requests.length, 2);
  assert.equal(requests[1].changes.sessions.revision, 1);
  assert.deepEqual(requests[1].changes.sessions.value.sessions, [1, 2]);
});

test('returning to the acknowledged value during a pending write still persists the user’s final edit', async () => {
  let database = { state: { objects: ['A'] }, version: 6 };
  let release;
  let revision = 0;
  const adapter = new WorkspacePersistence(async (_url, options) => {
    if (!options) return { states: { physical: database }, revisions: { physical: 0 }, access: { role: 'experimenter' } };
    const value = JSON.parse(options.body).changes.physical.value;
    if (value.state.objects[0] === 'B') await new Promise(resolve => { release = resolve; });
    database = value;
    return { revisions: { physical: ++revision } };
  });
  await adapter.initialize();
  adapter.write('physical', { state: { objects: ['B'] }, version: 6 });
  const pending = adapter.flush();
  await new Promise(resolve => setImmediate(resolve));
  adapter.write('physical', { state: { objects: ['A'] }, version: 6 });
  release(); await pending;
  assert.deepEqual(database.state.objects, ['A']);
  assert.equal(revision, 2);
  assert.equal(adapter.status.pending, 0);
});
