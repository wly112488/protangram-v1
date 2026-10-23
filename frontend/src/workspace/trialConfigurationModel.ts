export const CFG_ROLES = [
  { value: 'tested', label: '被试装备' }, { value: 'power', label: '供电装备' },
  { value: 'rig', label: '试验台' }, { value: 'measurement', label: '测量设备' },
  { value: 'support', label: '陪试件' }, { value: 'other', label: '其他' },
] as const;
export type CfgRole = typeof CFG_ROLES[number]['value'];
export interface CfgMember { objectId: string; role: CfgRole }
export interface TrialConfiguration { id: string; name: string; members: CfgMember[]; description?: string; primaryObjectId?: string; categoryId?: string }

export function validateTrialConfiguration(input: TrialConfiguration, availableIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!input.name?.trim()) errors.push('填写试验构型名称');
  for (const member of input.members ?? []) {
    if (!availableIds.has(member.objectId)) errors.push(`装备引用已失效：${member.objectId}`);
    if (!CFG_ROLES.some(role => role.value === member.role)) errors.push('请选择有效的装备角色');
  }
  if (!input.members?.some(member => member.role === 'tested')) errors.push('至少选择一项被试装备');
  if (new Set(input.members?.map(member => `${member.objectId}:${member.role}`)).size !== input.members?.length) errors.push('同一装备不可重复添加相同角色');
  if (input.primaryObjectId && !input.members.some(member => member.role === 'tested' && member.objectId === input.primaryObjectId)) errors.push('主被试对象必须是已选择的被试装备');
  return errors;
}
