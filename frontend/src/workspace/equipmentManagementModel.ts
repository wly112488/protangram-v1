import { flattenEquipment } from './equipmentCompositionModel';
import type { PhysicalObject, ValueField } from './physicalObjectStore';
import type { CfgMember } from './trialConfigurationModel';

const alphabet = new Intl.Collator('en', { sensitivity: 'base', numeric: true });
/** A–Z, case insensitive; exact name and ID provide deterministic tie breaks. */
export function sortEquipmentParameters(parameters: ValueField[]) {
  return [...parameters].sort((a,b) => alphabet.compare(a.name,b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0) || a.id.localeCompare(b.id));
}
export function equipmentSelectionScope(objects: PhysicalObject[], roots: string[]) {
  const refs = flattenEquipment(objects);
  const selected = new Set(roots);
  let changed = true;
  while (changed) {
    changed = false;
    for (const ref of refs) if (ref.parentId && selected.has(ref.parentId) && !selected.has(ref.id)) { selected.add(ref.id); changed = true; }
  }
  return refs.filter(ref => selected.has(ref.id));
}
export function equipmentSelectionRoots(objects: PhysicalObject[], ids: string[]) {
  const refs = flattenEquipment(objects), selected = new Set(ids);
  return refs.filter(ref => selected.has(ref.id) && !refs.some(parent => selected.has(parent.id) && parent.id !== ref.id && equipmentSelectionScope(objects,[parent.id]).some(child=>child.id===ref.id))).map(ref=>ref.id);
}
/** Persist existing equipment references, with a role for every descendant. No public data is copied. */
export function selectedEquipmentMembers(objects: PhysicalObject[], roots: string[], previous: CfgMember[]): CfgMember[] {
  const scope = equipmentSelectionScope(objects, roots);
  const surviving = previous.filter(member=>scope.some(ref=>ref.id===member.objectId));
  const hasTested = surviving.some(member=>member.role==='tested');
  const added = scope.filter(ref=>!surviving.some(member=>member.objectId===ref.id));
  return [...surviving, ...added.map((ref,index)=>({objectId:ref.id,role:!hasTested && !surviving.length && index===0?'tested' as const:'other' as const}))];
}
export function captureCfgEquipment(objects: PhysicalObject[], members: CfgMember[]) {
  const refs = flattenEquipment(objects);
  return structuredClone(members.map(member=>{
    const ref=refs.find(item=>item.id===member.objectId);
    if(!ref) throw new Error('装备引用已失效');
    return {...member,parentId:ref.parentId,name:ref.name,parameters:ref.equipment.parameters};
  }));
}
