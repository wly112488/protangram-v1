import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { validateTrialConfiguration, type TrialConfiguration } from './trialConfigurationModel';

interface TrialConfigurationState {
  configurations: TrialConfiguration[];
  createConfiguration: (input: Omit<TrialConfiguration, 'id'>) => string;
  getConfiguration: (id: string) => TrialConfiguration | undefined;
}

export const useTrialConfigurationStore = create<TrialConfigurationState>()(persist((set, get) => ({
  configurations: [],
  createConfiguration: input => {
    const configuration = { ...structuredClone(input), name: input.name.trim(), id: `cfg-${crypto.randomUUID()}` };
    const errors = validateTrialConfiguration(configuration, new Set(flattenEquipment(usePhysicalObjectStore.getState().objects).map(item => item.id)));
    if (errors.length) throw new Error(errors.join('；'));
    set(state => ({ configurations: [...state.configurations, configuration] }));
    return configuration.id;
  },
  getConfiguration: id => get().configurations.find(item => item.id === id),
}), { name: 'protangram-trial-configurations-v1', version: 1, storage: createJSONStorage(() => localStorage) }));
