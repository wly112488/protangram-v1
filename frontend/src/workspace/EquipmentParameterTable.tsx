import { useState } from 'react';
import { Button, Card, Input, Space, Table, Tooltip } from 'antd';
import type { PhysicalConfiguration, ValueField } from './physicalObjectStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { sortEquipmentParameters } from './equipmentManagementModel';

export default function EquipmentParameterTable({equipment,readOnly=false}:{equipment:PhysicalConfiguration;readOnly?:boolean}) {
  const [editing,setEditing]=useState<ValueField>();
  const [invalid,setInvalid]=useState(false);
  const rows=sortEquipmentParameters(equipment.parameters);
  if(editing?.id==='new') rows.push(editing);
  const save=()=>{
    if(!editing?.name.trim() || !editing.value.trim()) {setInvalid(true);return;}
    const {id,...value}=editing;
    const patch={...value,name:value.name.trim()};
    if(id==='new') usePhysicalObjectStore.getState().addField(equipment.id,'parameters',patch);
    else usePhysicalObjectStore.getState().updateField(equipment.id,'parameters',id,patch);
    setEditing(undefined);setInvalid(false);
  };
  const field=(row:ValueField,key:'name'|'value'|'unit'|'description',label:string)=>editing?.id===row.id
    ? <Input aria-label={label} value={editing[key] ?? ''} status={invalid && (key==='name'||key==='value') && !editing[key]?.trim()?'error':undefined}
      onChange={event=>{setEditing({...editing,[key]:event.target.value});setInvalid(false);}} onPressEnter={save} />
    : key==='name'?<Tooltip title={row.description}><span>{row.name}</span></Tooltip>:row[key];
  return <Card size="small" title="参数" extra={!readOnly && <Button disabled={Boolean(editing)} onClick={()=>setEditing({id:'new',name:'',value:'',unit:'',description:'',form:'单值'})}>新增参数</Button>}>
    <Table className="equipment-parameter-table" size="small" rowKey="id" dataSource={rows} pagination={false} locale={{emptyText:null}} columns={[
      {title:'参数名称（A–Z）',render:(_,row)=>field(row,'name','参数名称')},
      {title:'参数内容',render:(_,row)=>field(row,'value','参数内容')},
      {title:'单位',width:100,render:(_,row)=>field(row,'unit','参数单位')},
      {title:'描述',render:(_,row)=>field(row,'description','参数描述')},
      ...(!readOnly?[{title:'操作',width:150,render:(_:unknown,row:ValueField)=>editing?.id===row.id?<Space><Button type="link" onClick={save}>保存</Button><Button type="link" onClick={()=>{setEditing(undefined);setInvalid(false);}}>取消</Button></Space>:<Button type="link" disabled={Boolean(editing)} onClick={()=>setEditing({...row})}>编辑</Button>}]:[]),
    ]} />
  </Card>;
}
