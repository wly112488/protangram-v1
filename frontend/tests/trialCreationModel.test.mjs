import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundle = await build({
  stdin: { contents: "export * from './src/workspace/trialCreationModel';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);

test('trial creation from a formal task locks the association to that task', () => {
  const task = { id: 'task-1', title: '风扇鉴定', projectId: 'task-project' };
  const context = api.resolveTrialCreationContext('?taskBookId=task-1', [task], [{ id: 'task-project', name: '任务项目' }]);
  assert.deepEqual(context, { mode: 'task', taskId: 'task-1', taskName: '风扇鉴定', projectId: 'task-project' });
  assert.equal(api.resolveTrialTaskBookId(context, 'different-task'), 'task-1');
});

test('project and independent creation both keep task optional; independent trials have no project', () => {
  const project = { id: 'p1', name: '风扇项目', sessionOwnerId: undefined };
  const projectContext = api.resolveTrialCreationContext('?projectId=p1', [], [project]);
  const independentContext = api.resolveTrialCreationContext('', [], [project]);
  assert.deepEqual(projectContext, { mode: 'project', projectId: 'p1', projectName: '风扇项目' });
  assert.equal(api.resolveTrialTaskBookId(projectContext, 'task-1'), 'task-1');
  assert.deepEqual(independentContext, { mode: 'independent' });
  assert.equal(api.resolveTrialTaskBookId(independentContext), undefined);
});

test('task books require their own existing project and cannot be redirected to another project', () => {
  const task = { id: 'task-1', title: '风扇鉴定', projectId: 'deleted' };
  assert.deepEqual(api.resolveTrialCreationContext('?taskBookId=task-1', [task], []), { mode: 'missing-project', projectId: 'deleted' });
  const project = { id: 'p1', name: '试验项目' };
  assert.equal(api.resolveTrialCreationContext('?taskBookId=task-1&projectId=p1', [task], [project]).mode, 'missing-project');
  assert.deepEqual(api.resolveTrialCreationContext('?taskBookId=task-1&projectId=deleted', [task], [project]), { mode: 'missing-project', projectId: 'deleted' });
  assert.deepEqual(api.resolveTrialCreationContext('?projectId=internal', [], [{ id: 'internal', sessionOwnerId: 's1' }]), { mode: 'missing-project', projectId: 'internal' });
});

test('stale task and project links remain errors instead of falling back to independent creation', () => {
  assert.deepEqual(api.resolveTrialCreationContext('?taskBookId=deleted', [], []), { mode: 'missing-task', taskId: 'deleted' });
  assert.deepEqual(api.resolveTrialCreationContext('?projectId=deleted', [], []), { mode: 'missing-project', projectId: 'deleted' });
});
