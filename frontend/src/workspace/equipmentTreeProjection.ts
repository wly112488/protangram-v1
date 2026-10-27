import type { PhysicalConfiguration, PhysicalObject } from './physicalObjectStore';

export interface EquipmentCategoryView {
  id: string;
  name: string;
  sourceCategoryIds: string[];
  configurations: PhysicalConfiguration[];
}

// Only the installed demo wrapper is grouped. Object identity and storage stay
// in their original categories, including when the demo precedes the real one.
export function getEquipmentCategoryViews(categories: PhysicalObject[]): EquipmentCategoryView[] {
  const regular = categories.find(category => category.id === 'category-fan');
  const demo = regular && categories.find(category => category.id === 'demo-category-fan' && category.name === '涵道风扇（演示）');
  return categories.filter(category => category !== demo).map(category => ({
    id: category.id,
    name: category.name,
    sourceCategoryIds: [category.id, ...(category === regular && demo ? [demo.id] : [])],
    configurations: [...new Map([...category.configurations, ...(category.children ?? []), ...(category === regular && demo ? [...demo.configurations, ...(demo.children ?? [])] : [])].map(item=>[item.id,item])).values()],
  }));
}
