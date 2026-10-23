import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { resolveCfgTrialTarget } from './cfgTrialBridge';
import { modelConfigurationKey, resolveModelPlan, type ModelInputBinding, type ModelPlanRequest, type ModelScheme } from './modelPlanModel';
import type { PredictionValue } from './predictionContract';

interface SchemeDetails { name:string; configurationInputs:Record<string,PredictionValue>; bindings:ModelInputBinding[] }
interface ModelSchemeState {
  schemes:ModelScheme[];
  confirmScheme:(request:ModelPlanRequest,details:SchemeDetails,selectedSchemeId?:string)=>ModelScheme;
}
export const useModelSchemeStore=create<ModelSchemeState>()(persist((set,get)=>({
  schemes:[],
  confirmScheme:(request,details,selectedSchemeId)=>{
    const {cfg}=resolveCfgTrialTarget(request.cfgId);
    const ids=new Set(cfg.members.map(member=>member.objectId));
    if(request.objectIds.some(id=>!ids.has(id))) throw new Error('仿真对象不属于当前 CFG');
    if(request.configKey!==modelConfigurationKey(details.configurationInputs,details.bindings)) throw new Error('模型配置身份不匹配');
    const plan=resolveModelPlan(request,get().schemes);
    if(plan.action==='ambiguous'&&!selectedSchemeId) throw new Error('存在多个匹配方案，请明确选择');
    const chosen=selectedSchemeId ?? plan.schemeId;
    if(chosen) {
      if(!plan.candidateIds.includes(chosen)) throw new Error('所选模型方案不匹配当前 CFG 与配置');
      return get().schemes.find(item=>item.id===chosen)!;
    }
    const scheme:ModelScheme={...structuredClone(request),...structuredClone(details),id:`om-${crypto.randomUUID()}`,resultMode:'demo'};
    set(state=>({schemes:[...state.schemes,scheme]}));return scheme;
  },
}),{name:'protangram-model-schemes-v1',version:1,storage:createJSONStorage(()=>localStorage)}));
