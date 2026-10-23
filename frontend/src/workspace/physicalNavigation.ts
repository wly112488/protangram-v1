import { findObjectCategory, type PhysicalConfiguration, type PhysicalObject } from './physicalObjectStore';
import { flattenEquipment } from './equipmentCompositionModel';
import { getEquipmentCategoryViews } from './equipmentTreeProjection';

export interface PhysicalTreeNodeModel {
  key: string;
  kind: 'category' | 'object';
  id: string;
  categoryId?: string;
  parentId?: string;
  name: string;
  children: PhysicalTreeNodeModel[];
}

export function buildPhysicalTreeModel(objects: PhysicalObject[]): PhysicalTreeNodeModel[] {
  const sourceCategoryIds = new Map(flattenEquipment(objects).map(item => [item.id, item.categoryId]));
  const buildObject=(object:PhysicalConfiguration,categoryId:string,parentId:string):PhysicalTreeNodeModel=>({
    key:JSON.stringify(['object',categoryId,object.id]),kind:'object',id:object.id,categoryId,parentId,name:object.name,
    children:[...(object.children ?? []).map(child=>buildObject(child,categoryId,object.id)),
      ...('configurations' in object ? (object as PhysicalObject).configurations ?? [] : []).map(child=>buildObject(child,categoryId,object.id))],
  });
  return getEquipmentCategoryViews(objects).map(category => ({
    key: JSON.stringify(['category', category.id]), kind: 'category', id: category.id, name: category.name,
    children: category.configurations.map(object=>buildObject(object,sourceCategoryIds.get(object.id)!,sourceCategoryIds.get(object.id)!)),
  }));
}

// Both the tree and the workspace resolve the same parent chain. Explicit IDs
// are never repaired by switching to an unrelated object or execution.
export function resolvePhysicalNavigation(objects: PhysicalObject[], params: URLSearchParams) {
  const objectId = params.get('objectId') || '';
  const family = objectId ? findObjectCategory(objects, objectId) : undefined;
  const configurationId = params.get('configurationId') ?? (family?.configurations.some(item => item.id === objectId) ? objectId : '');
  const configuration = flattenEquipment(objects).find(item => item.id === configurationId && item.categoryId === family?.id)?.equipment;
  const experimentId = params.get('experimentId');
  const experiment = configuration?.experiments.find(item => item.id === experimentId);
  const trialId = params.get('trialId');
  const recordId = params.get('recordId');
  const trial = trialId !== null ? experiment?.trials.find(item => item.id === trialId)
    : recordId !== null ? experiment?.trials.find(item => item.records.some(record => record.id === recordId)) : undefined;
  const record = recordId !== null ? trial?.records.find(item => item.id === recordId) : undefined;
  const requestedRecordUnavailable = recordId !== null && !record;
  const missing = Boolean(objectId && !family || params.has('configurationId') && !configuration
    || experimentId !== null && !experiment || trialId !== null && !trial || requestedRecordUnavailable);
  return { family, configuration, experiment, trial, record, requestedRecordUnavailable, missing };
}

export const trialListQueryKeys = ['trialSearch', 'trialTask', 'trialPage', 'trialPageSize'] as const;
