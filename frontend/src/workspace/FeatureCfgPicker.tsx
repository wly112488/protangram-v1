import { useState } from 'react';
import { Alert, Button, Card, Modal, Select, Space, Typography } from 'antd';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import TrialConfigurationEditor from './TrialConfigurationEditor';

export default function FeatureCfgPicker({ suggestedCfgId, onConfirm, onCancel }: {
  suggestedCfgId?: string;
  onConfirm: (cfgId: string) => void;
  onCancel: () => void;
}) {
  const configurations = useTrialConfigurationStore(state => state.configurations);
  const [value, setValue] = useState<string>();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const suggestion = configurations.find(cfg => cfg.id === suggestedCfgId);
  return <Card title="本次使用的试验构型 CFG" size="small" className="feature-cfg-picker">
    <Space orientation="vertical" style={{ width: '100%' }}>

      {suggestedCfgId && <Typography.Text type="secondary">历史使用：{suggestion ? `${suggestion.name} · ${suggestion.id}` : ""}（本次仍需确认）</Typography.Text>}
      {error && <Alert type="error" showIcon title={error} />}
      <Select aria-label="本次选择 CFG" value={value} onChange={id => { setValue(id); setError(''); }}
        style={{ width: '100%' }} showSearch optionFilterProp="label" placeholder="选择本次使用的 CFG"
        options={configurations.map(cfg => ({ value: cfg.id, label: `${cfg.name} · ${cfg.id}` }))} />
      <Space wrap>
        <Button onClick={() => setCreating(true)}>新建 CFG</Button>
        <Button type="primary" disabled={!value || !configurations.some(cfg => cfg.id === value)} onClick={() => {
          if (!value) return;
          try { onConfirm(value); } catch (cause) { console.error(cause); setError('操作失败'); }
        }}>确认使用</Button>
        <Button onClick={onCancel}>取消</Button>
      </Space>
    </Space>
    <Modal title="新建试验构型" open={creating} onCancel={() => setCreating(false)} footer={null} destroyOnHidden width={780}>
      <TrialConfigurationEditor onCancel={() => setCreating(false)} onSaved={id => { setValue(id); setCreating(false); setError(''); }} />
    </Modal>
  </Card>;
}
