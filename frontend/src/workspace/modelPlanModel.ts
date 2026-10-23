import { flattenEquipment } from './equipmentCompositionModel';
import type { PhysicalObject } from './physicalObjectStore';
import type { PredictionValue } from './predictionContract';

export interface ModelInputBinding { key:string; objectId:string; parameterId:string; unit:string }
export interface ModelEquipmentInput { key:string; label:string; unit:string; required?:boolean }
export interface ModelScheme {
  id:string; modelId:string; cfgId:string; objectIds:string[]; configKey:string;
  name?:string; configurationInputs?:Record<string,PredictionValue>; bindings?:ModelInputBinding[]; resultMode?:'demo';
}
export interface ModelPlan {
  modelId:string; cfgId:string; objectIds:string[]; configKey:string;
  schemeId?:string; candidateIds:string[]; action:'reuse'|'plan'|'ambiguous';
}
export type ModelPlanRequest=Pick<ModelPlan,'modelId'|'cfgId'|'objectIds'|'configKey'>;
export interface ModelRunSnapshot extends ModelPlanRequest {
  schemeId:string; trialId?:string; configurationInputs:Record<string,PredictionValue>;
  bindings:ModelInputBinding[]; equipmentInputs?:Record<string,PredictionValue>; runtimeInputs:Record<string,PredictionValue>;
}
const objectKey=(ids:string[])=>JSON.stringify([...new Set(ids)].sort());
export function resolveModelPlan(request:ModelPlanRequest,catalog:ModelScheme[]):ModelPlan {
  if(!request.modelId?.trim()||!request.cfgId?.trim()||!request.objectIds?.length||request.objectIds.some(id=>!id?.trim())||!request.configKey?.trim()) throw new Error('缺少通用模型、试验构型、仿真对象或模型配置参数');
  const matches=catalog.filter(item=>item.modelId===request.modelId&&item.cfgId===request.cfgId&&item.configKey===request.configKey&&objectKey(item.objectIds)===objectKey(request.objectIds));
  return {...request,objectIds:[...new Set(request.objectIds)].sort(),candidateIds:matches.map(item=>item.id),schemeId:matches.length===1?matches[0].id:undefined,action:matches.length===1?'reuse':matches.length?'ambiguous':'plan'};
}
export function modelConfigurationKey(inputs:Record<string,PredictionValue>,bindings:ModelInputBinding[]):string {
  return JSON.stringify([Object.entries(inputs).sort(([a],[b])=>a.localeCompare(b)),bindings.map(b=>[b.key,b.objectId,b.parameterId,b.unit]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
}
export function readModelEquipmentInputs(definitions:ModelEquipmentInput[],bindings:ModelInputBinding[],objects:PhysicalObject[],allowedObjectIds:string[]):Record<string,PredictionValue> {
  const equipment=flattenEquipment(objects);
  const values:Record<string,PredictionValue>={};
  for(const definition of definitions) {
    const matches=bindings.filter(binding=>binding.key===definition.key);
    if(!matches.length) {if(definition.required) throw new Error(`请明确绑定${definition.label}的参数来源`);continue;}
    if(matches.length!==1) throw new Error(`${definition.label}存在多个参数来源，请明确选择`);
    const binding=matches[0];
    if(!allowedObjectIds.includes(binding.objectId)) throw new Error('参数来源不属于当前 CFG');
    const parameter=equipment.find(item=>item.id===binding.objectId)?.equipment.parameters.find(item=>item.id===binding.parameterId);
    if(!parameter) throw new Error(`${definition.label}来源已失效`);
    if(parameter.unit!==definition.unit||binding.unit!==definition.unit) throw new Error(`${definition.label}单位不匹配，请明确换算后提供参数`);
    if(parameter.form!=='单值'||!String(parameter.value).trim()||!Number.isFinite(Number(parameter.value))) throw new Error(`${definition.label}必须是有效单值`);
    values[definition.key]=Number(parameter.value);
  }
  return values;
}
