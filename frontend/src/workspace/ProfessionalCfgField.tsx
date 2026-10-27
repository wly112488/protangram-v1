import { useState } from 'react';
import { Button, Form, Modal, Select, Space } from 'antd';
import { useProfessionalCfgSelection } from './professionalScopeContext';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import TrialConfigurationEditor from './TrialConfigurationEditor';

export default function ProfessionalCfgField({disabled=false}:{disabled?:boolean}) {
  const [creating, setCreating] = useState(false);
  const selection=useProfessionalCfgSelection();
  const configurations=useTrialConfigurationStore(state=>state.configurations);
  if(!selection) return null;
  return <>
    <Form.Item label="试验构型 CFG" required validateStatus={selection.error ? 'error' : undefined} help={null}>
      <Space.Compact block><Select style={{flex:1}} aria-label="本次工况使用的试验构型 CFG" value={selection.cfgId} onChange={selection.selectCfg}
        showSearch optionFilterProp="label" placeholder="选择本次工况使用的 CFG" disabled={disabled}
        options={configurations.map(item=>({value:item.id,label:`${item.name} · ${item.id}`}))} /><Button disabled={disabled} onClick={() => setCreating(true)}>新建 CFG</Button></Space.Compact>
    </Form.Item>
    <Modal title="新建试验构型 CFG" open={creating} onCancel={() => setCreating(false)} footer={null} destroyOnHidden width={780}>
      <TrialConfigurationEditor onCancel={() => setCreating(false)} onSaved={() => {setCreating(false);}} />
    </Modal>
  </>;
}
