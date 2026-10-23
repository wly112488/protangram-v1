import type { PhysicalBusinessScope } from './sessionModel';
import type { PhysicalObject } from './physicalObjectStore';
import type { TrialConfiguration } from './trialConfigurationModel';
import { flattenEquipment } from './equipmentCompositionModel';
import { validateTrialConfiguration } from './trialConfigurationModel';
import { resolvePhysicalSource } from './physicalBusinessContext';

export function cfgOperationScope(cfg: TrialConfiguration, objects: PhysicalObject[], base?: PhysicalBusinessScope): PhysicalBusinessScope {
  const equipment = flattenEquipment(objects);
  const errors = validateTrialConfiguration(cfg, new Set(equipment.map(item => item.id)));
  if (errors.length) throw new Error(errors.join('；'));
  const tested = cfg.members.filter(member => member.role === 'tested');
  const primaryId = cfg.primaryObjectId ?? (tested.length === 1 ? tested[0].objectId : undefined);
  const primary = equipment.find(item => item.id === primaryId);
  if (!primary) throw new Error('请为此 CFG 指定主被试对象');
  const source = resolvePhysicalSource(objects, base);
  const sameTrial = source.trial && !source.missing && source.configuration?.id === primary.id && source.trial.cfgId === cfg.id;
  return {
    physicalObjectId: primary.id, physicalObjectName: primary.name, cfgId: cfg.id,
    experimentId: sameTrial ? source.experiment?.id : undefined,
    experimentName: sameTrial ? source.experiment?.name : undefined,
    trialId: sameTrial ? source.trial?.id : undefined, trialName: sameTrial ? source.trial?.name : undefined,
    testRecordId: sameTrial ? source.record?.id : undefined, testRecordName: sameTrial ? source.record?.name : undefined,
    taskBookId: sameTrial ? source.trial?.taskBookId : undefined,
  };
}
