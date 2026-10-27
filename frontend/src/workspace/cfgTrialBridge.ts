import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { validateTrialConfiguration } from './trialConfigurationModel';

export interface CfgTrialSource {
  trialId: string; physicalObjectId: string; experimentId: string; cfgId: string;
  physicalObjectName: string; experimentName: string; trialName: string; taskBookId?: string;
}

export function resolveCfgTrialTarget(cfgId: string) {
  const cfg = useTrialConfigurationStore.getState().getConfiguration(cfgId);
  if (!cfg) throw new Error('试验构型 CFG 不存在或已失效');
  const equipment = flattenEquipment(usePhysicalObjectStore.getState().objects);
  const errors = validateTrialConfiguration(cfg, new Set(equipment.map(item=>item.id)));
  if (errors.length) throw new Error(errors.join('；'));
  const tested = cfg.members.filter(member=>member.role==='tested');
  const primaryId = cfg.primaryObjectId ?? (tested.length===1 ? tested[0].objectId : undefined);
  const primary = equipment.find(item=>item.id===primaryId);
  if (!primary) throw new Error('请在 CFG 编辑中标明主被试对象');
  return {cfg,primary};
}

type TrialInput = {name:string;description?:string;taskBookId?:string;loadSpectrum?:string;loadSpectrumDescription?:string};

/** Uses the existing trial storage without making a CFG part of trial identity. */
export function createTrialForEquipment(objectId:string,input:TrialInput) {
  if (!input.name.trim()) throw new Error('请填写具体试验名称');
  const primary = flattenEquipment(usePhysicalObjectStore.getState().objects).find(item => item.id === objectId);
  if (!primary) throw new Error('物理对象不存在或已失效');
  const store = usePhysicalObjectStore.getState();
  const experimentId = primary.equipment.experiments.find(item=>item.category==='internal:cfg-trials')?.id
    ?? store.addExperiment(primary.id,{name:'具体试验',category:'internal:cfg-trials',parameters:[]});
  const trialId = store.addConcreteTrial(experimentId,{name:input.name.trim(),description:input.description,taskBookId:input.taskBookId,loadSpectrum:input.loadSpectrum?.trim() ?? '',loadSpectrumDescription:input.loadSpectrumDescription});
  return {physicalObjectId:primary.id,physicalObjectName:primary.name,experimentId,experimentName:'具体试验',trialId,trialName:input.name.trim(),taskBookId:input.taskBookId};
}

// Compatibility for explicit older CFG creation links; no fixed CFG on the trial.
export function createTrialFromCfg(cfgId:string,input:TrialInput):CfgTrialSource {
  const {cfg,primary} = resolveCfgTrialTarget(cfgId);
  return {...createTrialForEquipment(primary.id,input),cfgId:cfg.id};
}
