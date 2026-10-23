import { useState } from 'react';
import { Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import TrialConfigurationEditor from './TrialConfigurationEditor';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { flattenEquipment } from './equipmentCompositionModel';
import { CFG_ROLES } from './trialConfigurationModel';

export default function TrialConfigurationLibrary() {
  const [creating,setCreating] = useState(false);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const objects = usePhysicalObjectStore(state=>state.objects);
  const equipment = flattenEquipment(objects);
  const navigate = useNavigate();
  return <div className="workspace-business-page">
    <Space wrap><Typography.Title level={3}>试验构型 CFG</Typography.Title><Button onClick={()=>navigate('/trials/new')}>创建具体试验</Button></Space>
    <Typography.Paragraph type="secondary">按角色组合装备，可被多项具体试验复用。组成对象可以跨层级引用，陪试件按需添加。</Typography.Paragraph>
    {creating ? <Card title="新建试验构型 CFG"><TrialConfigurationEditor onSaved={()=>setCreating(false)} onCancel={()=>setCreating(false)} /></Card>
      : <Button type="primary" onClick={()=>setCreating(true)}>新建 CFG</Button>}
    <List dataSource={configurations} locale={{emptyText:<Empty description="尚未创建独立 CFG" />}} renderItem={cfg=><List.Item>
      <Card size="small" title={cfg.name} style={{width:'100%'}} extra={<Button onClick={()=>navigate(`/trials/new?cfgId=${encodeURIComponent(cfg.id)}`)}>使用此 CFG 创建试验</Button>}>
        <Typography.Text type="secondary">{cfg.id}</Typography.Text><p>{cfg.description}</p>
        {cfg.members.map(member=><Tag key={`${member.objectId}:${member.role}`} color={equipment.some(item=>item.id===member.objectId)?undefined:'error'}>
          {CFG_ROLES.find(role=>role.value===member.role)?.label}：{equipment.find(item=>item.id===member.objectId)?.path ?? `来源失效 ${member.objectId}`}
        </Tag>)}
      </Card>
    </List.Item>} />
  </div>;
}
