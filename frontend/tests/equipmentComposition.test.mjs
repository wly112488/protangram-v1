import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace, MemoryStorage } from './helpers/workspaceTest.mjs';
globalThis.localStorage = new MemoryStorage();
const { flattenEquipment, usePhysicalObjectStore: physical } = await loadWorkspace("export * from './src/workspace/equipmentCompositionModel'; export * from './src/workspace/physicalObjectStore';");

test('composition keeps three levels and distinct same-name objects selectable by stable ID', () => {
  physical.setState({ objects: [] });
  const s = physical.getState();
  const category = s.addRoot({ name: '风扇', type: '风扇' });
  const fan = s.addConfiguration(category, { name: '风扇 A' });
  const rotor = s.addComponent(fan, { name: '转子' });
  const blade = s.addComponent(rotor, { name: '叶片' });
  const other = s.addComponent(fan, { name: '转子' });
  const refs = flattenEquipment(physical.getState().objects);
  assert.deepEqual(refs.map(r => r.id), [fan, rotor, blade, other]);
  assert.equal(refs.find(r => r.id === blade).parentId, rotor);
  assert.match(refs.find(r => r.id === blade).path, /风扇 A.*转子.*叶片/);
  assert.notEqual(rotor, other);
  s.addField(blade, 'parameters', { name: '弦长', value: '12', unit: 'mm', form: '单值' });
  assert.equal(flattenEquipment(physical.getState().objects).find(r => r.id === blade).equipment.parameters[0].value, '12');
  assert.deepEqual(flattenEquipment([]), []);
  assert.throws(() => s.addComponent('missing', { name: '无归属' }), /不存在/);
});
