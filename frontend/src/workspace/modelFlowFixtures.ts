import type { ModelEquipmentInput } from './modelPlanModel';
import type { PredictionInputField } from './predictionContract';

/** Explicit interaction fixtures, independent from the legacy engine-model catalog. */
export const MODEL_FLOW_FIXTURES:[{id:string;name:string;version:string;resultMode:'demo';configurationFields:PredictionInputField[];equipmentInputs:ModelEquipmentInput[]}]=[{
  id:'MOD-01',name:'气动性能通用模型',version:'V1.0',resultMode:'demo',
  configurationFields:[{key:'mesh',label:'网格方案',type:'text',required:true,defaultValue:'标准网格'}],
  equipmentInputs:[{key:'referenceDiameter',label:'参考直径',unit:'mm',required:false}],
}];
