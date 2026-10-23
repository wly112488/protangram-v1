import { useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Modal, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore, type ConcreteTrial, type ValueField } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import type { TrialSetting } from './trialSettingsModel';

export default function TrialSettingsPanel({trial}:{trial:ConcreteTrial}) {
  const [open,setOpen]=useState(false), [error,setError]=useState('');
  const [editing,setEditing]=useState<TrialSetting>();
  const [form]=Form.useForm();
  const navigate=useNavigate();
  const cfg=useTrialConfigurationStore(state=>state.configurations.find(item=>item.id===trial.cfgId));
  const start=(setting?:TrialSetting)=>{
    setEditing(setting);setError('');form.resetFields();form.setFieldsValue(setting ?? {name:'',fields:[]});setOpen(true);
  };
  const save=(value:{name:string;fields?:Array<Partial<ValueField>>})=>{
    try {
      const fields=(value.fields ?? []).map(field=>({...field,id:field.id || `set-field-${crypto.randomUUID()}`,name:field.name ?? '',value:field.value ?? '',form:'单值' as const}));
      const store=usePhysicalObjectStore.getState();
      if(editing) store.updateTrialSetting(trial.id,editing.id,{name:value.name,fields});
      else store.addTrialSetting(trial.id,{name:value.name,fields});
      setOpen(false);
    } catch(cause) {setError(cause instanceof Error?cause.message:'设置保存失败');}
  };
  return <Card size="small" title="试验设置 SET" className="trial-settings-panel" extra={<Button onClick={()=>start()}>新增设置</Button>}>
    {trial.cfgId&&<div><Typography.Text>CFG：{cfg?.name ?? '来源已失效'} · {trial.cfgId}</Typography.Text> <Button type="link" onClick={()=>navigate('/trial-configurations')}>查看 CFG</Button></div>}
    <Typography.Paragraph type="secondary">按本次试验需要手动填写；没有设置也可进入分析或预测。</Typography.Paragraph>
    {(trial.settings ?? []).length ? trial.settings!.map(setting=><div key={setting.id} style={{padding:'8px 0',borderTop:'1px solid var(--ant-color-border-secondary,#eee)'}}>
      <Space><Typography.Text strong>{setting.name}</Typography.Text><Button type="link" aria-label={`编辑设置 ${setting.name}`} onClick={()=>start(setting)}>编辑</Button></Space>
      <div>{setting.fields.map(field=><span key={field.id} style={{marginRight:18}}>{field.name}：{field.value} {field.unit} {field.description && `（${field.description}）`}</span>)}</div>
    </div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无试验设置" />}
    <Modal title={editing?'编辑试验设置':'新增试验设置'} open={open} footer={null} onCancel={()=>setOpen(false)} destroyOnHidden width={760}>
      <Form name="trial-setting" form={form} layout="vertical" onFinish={save}>
        {error&&<Alert type="error" title={error} />}
        <Form.Item name="name" label="设置名称" rules={[{required:true,whitespace:true}]}><Input placeholder="例如：0D" /></Form.Item>
        <Form.List name="fields">{(fields,{add,remove})=><>
          {fields.map(({key,name,...rest})=><div key={key}>
            <Form.Item {...rest} name={[name,'id']} hidden><Input /></Form.Item>
            <Space align="start" wrap>
              <Form.Item {...rest} name={[name,'name']} label="字段名称" rules={[{required:true,whitespace:true}]}><Input /></Form.Item>
              <Form.Item {...rest} name={[name,'value']} label="内容"><Input /></Form.Item>
              <Form.Item {...rest} name={[name,'unit']} label="单位"><Input style={{width:90}} /></Form.Item>
              <Button style={{marginTop:30}} onClick={()=>remove(name)}>移除</Button>
            </Space>
            <Form.Item {...rest} name={[name,'description']} label="说明"><Input /></Form.Item>
          </div>)}
          <Button onClick={()=>add({name:'',value:'',unit:'',description:''})}>添加设置字段</Button>
        </>}</Form.List>
        <Space style={{marginTop:20}}><Button type="primary" htmlType="submit">保存设置</Button><Button onClick={()=>setOpen(false)}>取消</Button></Space>
      </Form>
    </Modal>
  </Card>;
}
