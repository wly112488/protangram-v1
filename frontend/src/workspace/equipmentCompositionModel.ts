import type { PhysicalConfiguration, PhysicalObject } from './physicalObjectStore';

export interface EquipmentRef {
  id: string;
  name: string;
  path: string;
  categoryId: string;
  parentId?: string;
  equipment: PhysicalConfiguration;
}

/** Categories organize the catalog; only actual equipment/parts can be CFG members. */
export function flattenEquipment(objects: PhysicalObject[]): EquipmentRef[] {
  const refs: EquipmentRef[] = [];
  const visited = new Set<string>();
  const visit = (node: PhysicalConfiguration, path: string, categoryId: string, parentId?: string) => {
    if (visited.has(node.id)) return;
    visited.add(node.id);
    const fullPath = `${path} / ${node.name}`;
    refs.push({ id: node.id, name: node.name, path: fullPath, categoryId, parentId, equipment: node });
    for (const child of node.children ?? []) visit(child, fullPath, categoryId, node.id);
    if ('configurations' in node) for (const child of (node as PhysicalObject).configurations ?? []) visit(child, fullPath, categoryId, node.id);
  };
  for (const category of objects) {
    for (const node of category.configurations) visit(node, category.name, category.id);
    for (const node of category.children ?? []) visit(node, category.name, category.id);
  }
  return refs;
}

/** Update parts in place in the existing tree; never create a parallel catalog. */
export function mapEquipment(objects: PhysicalObject[], update: (item: PhysicalConfiguration) => PhysicalConfiguration): PhysicalObject[] {
  const visit = (node: PhysicalConfiguration): PhysicalConfiguration => update({ ...node, children: (node.children ?? []).map(visitObject) });
  const visitObject = (node: PhysicalObject): PhysicalObject => ({ ...node, ...visit(node), configurations: (node.configurations ?? []).map(visit) });
  return objects.map(category => ({ ...category, configurations: category.configurations.map(visit), children: (category.children ?? []).map(visitObject) }));
}
