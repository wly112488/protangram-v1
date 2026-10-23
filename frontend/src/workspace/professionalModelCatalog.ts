import type { ModelContract } from '../types/businessContext';

/** Domain workflows combine a simulation model with a feature-specific algorithm. */
export interface ProfessionalModelContract extends ModelContract {
  modelKind: 'professional';
  baseModelId: string;
  algorithmName: string;
  description: string;
}

export const PROFESSIONAL_MODEL_OPTIONS: ProfessionalModelContract[] = [
  { modelKind: 'professional', modelId: 'pro-aero-performance-v1', modelName: '气动性能', version: 'V1.0', baseModelId: 'engine-v2.1', algorithmName: '气动性能评估算法', description: '结合仿真模型与气动性能评估算法。', trustedRange: '2000～8000 rpm', status: '可用' },
  { modelKind: 'professional', modelId: 'pro-environment-temperature-v1', modelName: '环境温度响应', version: 'V1.0', baseModelId: 'engine-thermal-v2.1', algorithmName: '环境响应分析算法', description: '结合热力学仿真与环境响应分析算法。', trustedRange: '1500～5200 rpm', status: '可用' },
  { modelKind: 'professional', modelId: 'pro-structure-vibration-v1', modelName: '结构振动评估', version: 'V1.0', baseModelId: 'structure-vibration-v1.4', algorithmName: '振动特征评估算法', description: '结合结构仿真与振动特征评估算法。', trustedRange: '1000～4800 rpm', status: '可用' },
  { modelKind: 'professional', modelId: 'pro-engine-thermal-v1', modelName: '发动机热性能', version: 'V1.0', baseModelId: 'engine-thermal-v2.1', algorithmName: '热性能预测算法', description: '结合热力学仿真与热性能预测算法。', trustedRange: '1500～5200 rpm', status: '可用' },
];
