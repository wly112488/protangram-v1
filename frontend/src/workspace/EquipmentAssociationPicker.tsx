import { useState } from 'react';
import { Card, Modal, Table } from 'antd';
import EquipmentDirectory from './EquipmentDirectory';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { equipmentSelectionRoots, equipmentSelectionScope } from './equipmentManagementModel';

export default function EquipmentAssociationPicker({selectedIds,onConfirm,onCancel}:{selectedIds:string[];onConfirm:(roots:string[])=>void;onCancel:()=>void}) {
  const objects=usePhysicalObjectStore(state=>state.objects);
  const [roots,setRoots]=useState(()=>equipmentSelectionRoots(objects,selectedIds));
  const [location,setLocation]=useState<{categoryId?:string;objectId?:string}>({});
  const scope=equipmentSelectionScope(objects,roots);
  return <Modal open title="关联物理对象" width={1080} onCancel={onCancel} onOk={()=>onConfirm(roots)} okText="确认关联" cancelText="取消" destroyOnHidden>
    <EquipmentDirectory {...location} onOpen={(categoryId,objectId)=>setLocation({categoryId,objectId})} selection={{roots,onChange:setRoots}} />
    <Card size="small" title={`已选关联范围 · ${scope.length} 个对象 · ${scope.reduce((n,ref)=>n+ref.equipment.parameters.length,0)} 项参数`} style={{marginTop:16}}>
      <Table className="equipment-selection-summary" size="small" rowKey="id" pagination={false} dataSource={scope} locale={{emptyText:null}} columns={[
        {title:'对象路径',dataIndex:'path'},
        {title:'关联方式',render:(_,ref)=>roots.includes(ref.id)?'所选对象及全部下级':'随上级对象关联'},
        {title:'参数数量',render:(_,ref)=>ref.equipment.parameters.length},
      ]} />
    </Card>
  </Modal>;
}
