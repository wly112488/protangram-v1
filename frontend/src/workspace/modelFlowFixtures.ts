import type { ModelEquipmentInput } from './modelPlanModel';
import type { PredictionInputField } from './predictionContract';

/** Explicit interaction fixtures, independent from the legacy engine-model catalog. */
export const MODEL_FLOW_FIXTURES:[{id:string;name:string;version:string;resultMode:'demo';configurationFields:PredictionInputField[];equipmentInputs:ModelEquipmentInput[]}]=[{
  id:'MOD-01',name:'气动性能通用模型（演示）',version:'demo-v1',resultMode:'demo',
  configurationFields:[{key:'mesh',label:'模型配置说明',type:'text',required:true,defaultValue:'演示标准网格'}],
  equipmentInputs:[{key:'referenceDiameter',label:'参考直径',unit:'mm',required:false}],
}];
