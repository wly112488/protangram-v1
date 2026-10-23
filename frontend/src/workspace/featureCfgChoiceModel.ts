export interface CfgChoiceState {
  suggestedCfgId?: string;
  confirmedCfgId?: string;
}

export function beginCfgChoice(suggestedCfgId?: string): CfgChoiceState {
  return { suggestedCfgId, confirmedCfgId: undefined };
}

export function confirmCfgChoice(state: CfgChoiceState, cfgId: string, validIds: Set<string>): CfgChoiceState {
  if (!cfgId || !validIds.has(cfgId)) throw new Error('所选 CFG 已失效，请重新选择');
  return { ...state, confirmedCfgId: cfgId };
}

export function requireCfgChoice(state: CfgChoiceState): string {
  if (!state.confirmedCfgId) throw new Error('请明确选择试验构型 CFG');
  return state.confirmedCfgId;
}
