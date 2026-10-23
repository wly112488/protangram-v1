import { useState } from 'react';
import { Alert, Button, Form, Input, Select, Space } from 'antd';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { CFG_ROLES, type CfgMember, type TrialConfiguration } from './trialConfigurationModel';
import { useTrialConfigurationStore } from './trialConfigurationStore';

export default function TrialConfigurationEditor({ initial, initialCategoryId, onSaved, onCancel }: {
  initial?: TrialConfiguration; initialCategoryId?: string; onSaved: (id: string) => void; onCancel: () => void;
}) {
  const [form] = Form.useForm();
  const [error, setError] = useState('');
  const objects = usePhysicalObjectStore(state => state.objects);
  const categories = useTrialConfigurationStore(state => state.categories);
  const equipment = flattenEquipment(objects);
  const members = (Form.useWatch('members', form) ?? []) as CfgMember[];
  const tested = members.filter(member => member?.role === 'tested' && member.objectId);
  const submit = (value: Omit<TrialConfiguration, 'id'>) => {
    try {
      const primaryObjectId = tested.length === 1 ? tested[0].objectId : value.primaryObjectId;
      if (tested.length > 1 && !primaryObjectId) throw new Error('请选择主被试对象，以确定具体试验来源');
      const id = useTrialConfigurationStore.getState().createConfiguration({ ...value, primaryObjectId });
      onSaved(id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '构型保存失败'); }
  };
  return <Form name="cfg-editor" form={form} layout="vertical" onFinish={submit} initialValues={initial ?? { categoryId: initialCategoryId, members:[{ role:'tested' }] }} aria-label="试验构型编辑器">
    {error && <Alert type="error" showIcon title={error} />}
    <Form.Item name="name" label="CFG 名称" rules={[{ required:true, whitespace:true, message:'填写试验构型名称' }]}><Input /></Form.Item>
    <Form.Item name="categoryId" label="CFG 分类"><Select allowClear placeholder="未分类" options={categories.map(category => ({value:category.id,label:category.name}))} /></Form.Item>
    <Form.Item name="description" label="CFG 说明"><Input.TextArea rows={2} /></Form.Item>
    <Form.List name="members">{(fields, {add,remove}) => <>
      {fields.map(({key,name,...rest}) => <Space key={key} align="start" wrap style={{display:'flex'}}>
        <Form.Item {...rest} name={[name,'objectId']} label={`装备 ${name+1}`} rules={[{ required:true,message:'选择装备' }]}>
          <Select aria-label={`CFG 装备 ${name+1}`} style={{minWidth:280}} showSearch optionFilterProp="label" options={equipment.map(item=>({value:item.id,label:`${item.path} · ${item.id}`}))} />
        </Form.Item>
        <Form.Item {...rest} name={[name,'role']} label={`角色 ${name+1}`} rules={[{required:true,message:'选择角色'}]}>
          <Select aria-label={`CFG 角色 ${name+1}`} style={{minWidth:140}} options={[...CFG_ROLES]} />
        </Form.Item>
        <Button style={{marginTop:30}} danger onClick={()=>remove(name)} aria-label={`移除装备 ${name+1}`}>移除</Button>
      </Space>)}
      <Button onClick={()=>add({role:'other'})}>添加装备成员</Button>
    </>}</Form.List>
    {tested.length>1 && <Form.Item name="primaryObjectId" label="主被试对象" rules={[{required:true,message:'选择主被试对象'}]}>
      <Select options={tested.map(member=>({value:member.objectId,label:equipment.find(item=>item.id===member.objectId)?.path ?? member.objectId}))} />
    </Form.Item>}
    <Space style={{marginTop:20}}><Button type="primary" htmlType="submit">保存 CFG</Button><Button onClick={onCancel}>取消</Button></Space>
  </Form>;
}
