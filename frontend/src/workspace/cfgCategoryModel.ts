import type { TrialConfiguration } from './trialConfigurationModel';

export interface CfgCategory { id: string; name: string }
export interface CfgCategoryGroup extends CfgCategory { cfgIds: string[] }

export function listCfgCategoryGroups(categories: CfgCategory[], configurations: TrialConfiguration[]): CfgCategoryGroup[] {
  const unclassified: CfgCategoryGroup = { id: 'unclassified', name: '未分类', cfgIds: [] };
  const groups: CfgCategoryGroup[] = categories.map(category => ({ ...category, cfgIds: [] }));
  const byId = new Map(groups.map(group => [group.id, group]));
  for (const cfg of configurations) (byId.get(cfg.categoryId ?? '') ?? unclassified).cfgIds.push(cfg.id);
  return [...groups, unclassified];
}
