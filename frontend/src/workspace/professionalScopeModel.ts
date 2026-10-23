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
  if ((base?.trialId || base?.testRecordId) && (source.missing || !source.trial)) throw new Error('当前具体试验来源已失效，请返回试验检查');
  const sameTrial = source.trial && !source.missing && source.configuration?.id === primary.id
    && (!source.trial.cfgId || source.trial.cfgId === cfg.id);
  if (source.trial && !sameTrial) throw new Error('所选 CFG 与当前具体试验不匹配，请选择该试验对应的装备构型');
  return {
    physicalObjectId: primary.id, physicalObjectName: primary.name, cfgId: cfg.id,
    experimentId: sameTrial ? source.experiment?.id : undefined,
    experimentName: sameTrial ? source.experiment?.name : undefined,
    trialId: sameTrial ? source.trial?.id : undefined, trialName: sameTrial ? source.trial?.name : undefined,
    testRecordId: sameTrial ? source.record?.id : undefined, testRecordName: sameTrial ? source.record?.name : undefined,
    taskBookId: sameTrial ? source.trial?.taskBookId : undefined,
  };
}
