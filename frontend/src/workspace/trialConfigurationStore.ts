import { createLocalId } from '../utils/createLocalId';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { equipmentSelectionRoots, selectedEquipmentMembers } from './equipmentManagementModel';
import { validateTrialConfiguration, type TrialConfiguration } from './trialConfigurationModel';
import type { CfgCategory } from './cfgCategoryModel';

interface TrialConfigurationState {
  configurations: TrialConfiguration[];
  categories: CfgCategory[];
  createCategory: (name: string) => string;
  renameCategory: (id: string, name: string) => void;
  setConfigurationCategory: (cfgId: string, categoryId?: string) => void;
  createConfiguration: (input: Omit<TrialConfiguration, 'id'>) => string;
  updateConfiguration: (id:string, input:Omit<TrialConfiguration,'id'>) => void;
  getConfiguration: (id: string) => TrialConfiguration | undefined;
}

export const useTrialConfigurationStore = create<TrialConfigurationState>()(persist((set, get) => ({
  configurations: [],
  categories: [],
  createCategory: name => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error('填写 CFG 分类名称');
    if (trimmed === '未分类' || get().categories.some(category => category.name === trimmed)) throw new Error('CFG 分类名称已存在');
    const category = { id: `cfg-category-${createLocalId()}`, name: trimmed };
    set(state => ({ categories: [...state.categories, category] }));
    return category.id;
  },
  renameCategory: (id, name) => {
    if (!get().categories.some(category => category.id === id)) throw new Error('CFG 分类不存在');
    const trimmed = name.trim();
    if (!trimmed) throw new Error('填写 CFG 分类名称');
    if (trimmed === '未分类' || get().categories.some(category => category.id !== id && category.name === trimmed)) throw new Error('CFG 分类名称已存在');
    set(state => ({ categories: state.categories.map(category => category.id === id ? { ...category, name: trimmed } : category) }));
  },
  setConfigurationCategory: (cfgId, categoryId) => {
    if (!get().configurations.some(cfg => cfg.id === cfgId)) throw new Error('CFG 不存在');
    if (categoryId !== undefined && !get().categories.some(category => category.id === categoryId)) throw new Error('CFG 分类不存在');
    set(state => ({ configurations: state.configurations.map(cfg => cfg.id === cfgId ? { ...cfg, categoryId } : cfg) }));
  },
  createConfiguration: input => {
    if (input.categoryId !== undefined && !get().categories.some(category => category.id === input.categoryId)) throw new Error('CFG 分类不存在');
    const objects = usePhysicalObjectStore.getState().objects;
    const invalid = validateTrialConfiguration({...input,id:''},new Set(flattenEquipment(objects).map(ref=>ref.id)));
    if(invalid.length) throw new Error(invalid.join('；'));
    const members = selectedEquipmentMembers(objects,equipmentSelectionRoots(objects,input.members.map(member=>member.objectId)),input.members);
    const configuration = { ...structuredClone(input), members:structuredClone(members), name: input.name.trim(), id: `cfg-${createLocalId()}` };
    const errors = validateTrialConfiguration(configuration, new Set(flattenEquipment(usePhysicalObjectStore.getState().objects).map(item => item.id)));
    if (errors.length) throw new Error(errors.join('；'));
    set(state => ({ configurations: [...state.configurations, configuration] }));
    return configuration.id;
  },
  updateConfiguration: (id,input) => {
    if(!get().configurations.some(cfg=>cfg.id===id)) throw new Error('CFG 不存在');
    if(input.categoryId !== undefined && !get().categories.some(category=>category.id===input.categoryId)) throw new Error('CFG 分类不存在');
    const objects=usePhysicalObjectStore.getState().objects;
    const invalid=validateTrialConfiguration({...input,id},new Set(flattenEquipment(objects).map(ref=>ref.id)));
    if(invalid.length) throw new Error(invalid.join('；'));
    const members=selectedEquipmentMembers(objects,equipmentSelectionRoots(objects,input.members.map(member=>member.objectId)),input.members);
    const updated={...structuredClone(input),name:input.name.trim(),members:structuredClone(members),id};
    set(state=>({configurations:state.configurations.map(cfg=>cfg.id===id?updated:cfg)}));
  },
  getConfiguration: id => get().configurations.find(item => item.id === id),
}), { name: 'protangram-trial-configurations-v1', version: 1, storage: createJSONStorage(() => localStorage) }));
