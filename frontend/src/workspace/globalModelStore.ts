import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ModelContract } from '@/types/businessContext';

export interface ArchivedGlobalModelVersion extends ModelContract {
  archivedAt: string;
}

interface GlobalModelState {
  models: ModelContract[];
  history: ArchivedGlobalModelVersion[];
  updateCurrentModel: (modelId: string, changes: Omit<Partial<ModelContract>, 'modelId' | 'version'>) => ModelContract | null;
}

const INITIAL_MODELS: ModelContract[] = [
  { modelId: 'engine-v2.1', modelName: '发动机模型', version: 'V2.1', trustedRange: '2000～8000 rpm', status: '已确认', calibratedAt: '2026-08-28' },
  { modelId: 'engine-thermal-v2.1', modelName: '发动机热力学模型', version: 'V2.1', measuredRange: '2000～5000 rpm', trustedRange: '1500～5200 rpm', status: '已确认', calibratedAt: '2026-08-28' },
  { modelId: 'structure-vibration-v1.4', modelName: '结构振动有限元模型', version: 'V1.4', measuredRange: '1200～4600 rpm', trustedRange: '1000～4800 rpm', status: '已校准', calibratedAt: '2026-07-16' },
  { modelId: 'environment-temperature-v3.0', modelName: '环境温度响应模型', version: 'V3.0', measuredRange: '-20～50 ℃', trustedRange: '-25～55 ℃', status: '已确认', calibratedAt: '2026-08-03' },
];

const INITIAL_HISTORY: ArchivedGlobalModelVersion[] = [
  { modelId: 'engine-v2.1', modelName: '发动机模型', version: 'V2.0', trustedRange: '2000～7200 rpm', status: '已校准', calibratedAt: '2026-06-12', archivedAt: '2026-08-28T00:00:00.000Z' },
  { modelId: 'engine-v2.1', modelName: '发动机模型', version: 'V1.8', trustedRange: '1800～6500 rpm', status: '已校准', calibratedAt: '2026-03-05', archivedAt: '2026-06-12T00:00:00.000Z' },
];

const incrementVersion = (version: string) => {
  const match = version.match(/^V?(\d+)\.(\d+)$/i);
  return match ? `V${match[1]}.${Number(match[2]) + 1}` : `${version}.1`;
};

export const useGlobalModelStore = create<GlobalModelState>()(persist((set, get) => ({
  models: INITIAL_MODELS,
  history: INITIAL_HISTORY,
  updateCurrentModel: (modelId, changes) => {
    const currentModel = get().models.find((model) => model.modelId === modelId);
    if (!currentModel) return null;
    const updated: ModelContract = {
      ...currentModel,
      ...changes,
      modelId: currentModel.modelId,
      version: incrementVersion(currentModel.version),
    };
    const archivedAt = new Date().toISOString();
    set((state) => ({
      models: state.models.map((model) => model.modelId === modelId ? updated : model),
      history: [...state.history, { ...currentModel, archivedAt }],
    }));
    return updated;
  },
}), {
  name: 'protangram-global-models-v1',
  version: 1,
  storage: createJSONStorage(() => localStorage),
}));
