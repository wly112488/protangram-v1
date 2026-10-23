import { Alert, Form, Select, Typography } from 'antd';
import { useProfessionalCfgSelection } from './professionalScopeContext';
import { useTrialConfigurationStore } from './trialConfigurationStore';

export default function ProfessionalCfgField({disabled=false}:{disabled?:boolean}) {
  const selection=useProfessionalCfgSelection();
  const configurations=useTrialConfigurationStore(state=>state.configurations);
  if(!selection) return null;
  return <>
    <Form.Item label="试验构型 CFG" required>
      <Select aria-label="本次工况使用的试验构型 CFG" value={selection.cfgId} onChange={selection.selectCfg}
        showSearch optionFilterProp="label" placeholder="选择本次工况使用的 CFG" disabled={disabled}
        options={configurations.map(item=>({value:item.id,label:`${item.name} · ${item.id}`}))} />
    </Form.Item>
    {selection.error && <Alert type="error" showIcon title={selection.error} />}
    {!selection.cfgId && !selection.error && <Typography.Text type="secondary">选择 CFG 后，本次专业输入和成果会关联到该构型。</Typography.Text>}
  </>;
}
