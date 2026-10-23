import type { ValueField } from './physicalObjectStore';
export interface TrialSetting { id:string; name:string; fields:ValueField[]; programId?:string }
export function createTrialSetting(id:string,name:string,fields:ValueField[]):TrialSetting {
  if(!name.trim()) throw new Error('请填写试验设置名称');
  if(fields.some(field=>!field.name.trim())) throw new Error('请填写设置字段名称');
  return {id,name:name.trim(),fields:structuredClone(fields)};
}
export function replaceTrialSetting(items:TrialSetting[],id:string,patch:Partial<Omit<TrialSetting,'id'>>):TrialSetting[] {
  if(!items.some(item=>item.id===id)) throw new Error('指定试验设置不存在');
  return items.map(item=>item.id===id ? {...item,...createTrialSetting(id,patch.name ?? item.name,patch.fields ?? item.fields),programId:patch.programId ?? item.programId} : item);
}
