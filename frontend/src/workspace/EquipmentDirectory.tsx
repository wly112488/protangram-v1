import { useState } from 'react';
import { Breadcrumb, Button, Card, Checkbox, Input, Select, Space, Table, Tag, Typography } from 'antd';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { flattenEquipment, type EquipmentRef } from './equipmentCompositionModel';
import { getEquipmentCategoryViews } from './equipmentTreeProjection';
import { equipmentSelectionScope } from './equipmentManagementModel';
import EquipmentParameterTable from './EquipmentParameterTable';
import './equipmentManagement.css';

type Selection = {roots:string[];onChange:(ids:string[])=>void};
export default function EquipmentDirectory({categoryId,objectId,onOpen,onCreate,selection}:{
  categoryId?:string;objectId?:string;onOpen:(categoryId?:string,objectId?:string)=>void;onCreate?:()=>void;selection?:Selection;
}) {
  const objects=usePhysicalObjectStore(state=>state.objects);
  const refs=flattenEquipment(objects), categories=getEquipmentCategoryViews(objects);
  const current=refs.find(ref=>ref.id===objectId);
  const category=categories.find(item=>item.sourceCategoryIds.includes(current?.categoryId ?? categoryId ?? ''));
  const [query,setQuery]=useState('');
  const scope=equipmentSelectionScope(objects,selection?.roots ?? []);
  const selected=new Set(scope.map(ref=>ref.id));
  const open=(id?:string,object?:string)=>{setQuery('');onOpen(id,object);};
  const children=(id?:string)=>refs.filter(ref=>ref.parentId===id && (!category || category.sourceCategoryIds.includes(ref.categoryId)));
  const ancestors:EquipmentRef[]=[];
  let cursor=current;
  while(cursor && !ancestors.some(ref=>ref.id===cursor!.id)){ancestors.unshift(cursor);cursor=refs.find(ref=>ref.id===cursor!.parentId);}
  const toggle=(ref:EquipmentRef,checked:boolean)=>{
    if(!selection)return;
    const descendants=new Set(equipmentSelectionScope(objects,[ref.id]).map(item=>item.id));
    selection.onChange(checked?[...new Set([...selection.roots,ref.id])]:selection.roots.filter(id=>!descendants.has(id)));
  };
  const choice=(ref:EquipmentRef)=>selection && <Checkbox className="equipment-choice" aria-label={`关联 ${ref.name}`}
    checked={selected.has(ref.id)} disabled={selected.has(ref.id) && !selection.roots.includes(ref.id)}
    onChange={event=>toggle(ref,event.target.checked)} />;
  const objectTable=(rows:EquipmentRef[])=> <Table<EquipmentRef> className="equipment-object-table" size="small" rowKey="id" dataSource={rows} pagination={false} locale={{emptyText:null}}
    rowClassName={row=>selected.has(row.id)?'equipment-row-selected':''} columns={[
      ...(selection?[{title:'关联',width:60,render:(_:unknown,row:EquipmentRef)=>choice(row)}]:[]),
      {title:'对象名称',render:(_,row)=><Button type="link" onClick={()=>open(row.categoryId,row.id)}>{row.name}</Button>},
      {title:'描述',render:(_,row)=>row.equipment.description},
      {title:'自身参数',width:90,render:(_,row)=>row.equipment.parameters.length},
      {title:'下级对象',width:90,render:(_,row)=>refs.filter(ref=>ref.parentId===row.id).length},
      ...(selection?[{title:'关联范围',render:(_:unknown,row:EquipmentRef)=>{const all=equipmentSelectionScope(objects,[row.id]);return `${all.length} 个对象 · ${all.reduce((n,ref)=>n+ref.equipment.parameters.length,0)} 项参数`;}}]:[]),
    ]} expandable={{rowExpandable:row=>refs.some(ref=>ref.parentId===row.id),expandedRowRender:row=>objectTable(refs.filter(ref=>ref.parentId===row.id))}} />;
  const rows=query.trim()?refs.filter(ref=>`${ref.name} ${ref.path}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())):current?children(current.id):children();
  return <div className={`equipment-directory ${selection?'equipment-directory--selection':''}`}>
    <Space wrap><Breadcrumb items={[
      {title:<Button type="link" onClick={()=>open()}>物理对象</Button>},
      ...(category?[{title:<Button type="link" onClick={()=>open(category.id)}>{category.name}</Button>}]:[]),
      ...ancestors.map(ref=>({title:ref.id===current?.id?ref.name:<Button type="link" onClick={()=>open(ref.categoryId,ref.id)}>{ref.name}</Button>})),
    ]} />
      {current && <Select aria-label="切换同级对象" style={{minWidth:220}} value={current.id} options={children(current.parentId).map(ref=>({value:ref.id,label:ref.name}))} onChange={id=>{const ref=refs.find(item=>item.id===id)!;open(ref.categoryId,id);}} />}
    </Space>
    <Input.Search aria-label="搜索物理对象目录" placeholder="搜索物理对象" value={query} onChange={event=>setQuery(event.target.value)} allowClear />
    {current && !query.trim() && <>
      <div className="physical-config-title"><Space>{choice(current)}<Typography.Title level={4}>{current.name}</Typography.Title>{selection && selected.has(current.id) && <Tag color="blue">已纳入关联</Tag>}</Space>{current.equipment.description}</div>
      <EquipmentParameterTable key={`${current.id}:${selection?'selection':'manage'}`} equipment={current.equipment} readOnly={Boolean(selection)} />
    </>}
    <Card size="small" title={query.trim()?'搜索结果':current?'下级对象':category?`${category.name} · 对象目录`:'对象目录'}
      extra={!selection && onCreate && <Button onClick={onCreate}>{current?'新建下级对象':category?'新建具体物理对象':'新建对象类别'}</Button>}>
      {!current && !category && !query.trim()?<Table size="small" rowKey="id" pagination={false} dataSource={categories} columns={[
        {title:'对象类别',render:(_,item)=><Button type="link" onClick={()=>open(item.id)}>{item.name}</Button>},
        {title:'对象数量',render:(_,item)=>refs.filter(ref=>!ref.parentId && item.sourceCategoryIds.includes(ref.categoryId)).length},
      ]} />:objectTable(rows)}
    </Card>
  </div>;
}
