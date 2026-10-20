import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundled = await build({ stdin: { contents: "export * from './src/workspace/trialNavigationModel';", resolveDir: process.cwd() }, bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent' });
const { listWorkspaceTrials, filterWorkspaceTrials, trialCreatePath, filterPhysicalTree } = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const trial = { id: 'trial:one', name: '耐久验证', loadSpectrum: '谱 A', taskBookId: 'task:1', records: [] };
const objects = [{ id: 'category', name: '电机', configurations: [{ id: 'device', name: '样机 9', experiments: [{ id: 'setup', name: '高温构型', trials: [trial, { ...trial, id: 'independent', taskBookId: undefined }] }] }] }];
test('lists original nested entities and searches parents, spectrum, and task title without copying trials', () => {
 const entries = listWorkspaceTrials(objects, [{ id: 'task:1', title: '十月验证任务' }]);
 assert.equal(entries.length, 2); assert.equal(entries[0].trial, trial);
 for (const keyword of ['电机', '样机 9', '高温构型', '谱 a', '十月验证']) assert.ok(filterWorkspaceTrials(entries, keyword).some(entry => entry.trial === trial));
 assert.equal(filterWorkspaceTrials(entries, '', 'independent')[0].trial.id, 'independent');
 assert.equal(filterWorkspaceTrials(entries, '', 'task:task:1').length, 1);
});
test('creation links preserve only explicit context and safely encode IDs', () => {
 const path = trialCreatePath({ objectId: 'category', configurationId: 'device&one', experimentId: 'setup', taskBookId: 'task:1', trialId: 'old', create: 'trial' });
 const query = new URLSearchParams(path.split('?')[1]);
 assert.equal(query.get('configurationId'), 'device&one'); assert.equal(query.get('taskBookId'), 'task:1');
 assert.equal(query.has('trialId'), false); assert.equal(query.has('create'), false);
 assert.equal(trialCreatePath({}), '/trials/new');
});

test('tree search preserves the complete ancestor chain and keeps descendants of matching parents', () => {
 const search = filterPhysicalTree(objects, '耐久验证');
 assert.equal(search.length, 1); assert.equal(search[0].configurations[0].experiments[0].trials[0], trial);
 assert.equal(filterPhysicalTree(objects, '高温构型')[0].configurations[0].experiments[0].trials.length, 2);
 assert.equal(filterPhysicalTree(objects, '样机 9')[0].configurations[0].experiments.length, 1);
 assert.equal(filterPhysicalTree(objects, '不存在').length, 0);
 assert.equal(objects[0].configurations[0].experiments[0].trials.length, 2);
});
