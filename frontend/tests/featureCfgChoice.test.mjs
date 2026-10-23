import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const api = await loadWorkspace("export * from './src/workspace/featureCfgChoiceModel';");

test('a historical CFG is only a suggestion; each entry requires confirmation', () => {
  const state = api.beginCfgChoice('cfg-A');
  assert.equal(state.suggestedCfgId, 'cfg-A');
  assert.equal(state.confirmedCfgId, undefined);
  assert.throws(() => api.requireCfgChoice(state), /请明确选择/);
  const confirmed = api.confirmCfgChoice(state, 'cfg-B', new Set(['cfg-A', 'cfg-B']));
  assert.equal(api.requireCfgChoice(confirmed), 'cfg-B');
  assert.equal(state.confirmedCfgId, undefined);
  assert.throws(() => api.requireCfgChoice(api.beginCfgChoice(confirmed.confirmedCfgId)), /请明确选择/);
});

test('empty and stale choices cannot be confirmed', () => {
  for (const id of ['', 'missing']) {
    assert.throws(() => api.confirmCfgChoice(api.beginCfgChoice(), id, new Set(['cfg-A'])), /失效/);
  }
});
