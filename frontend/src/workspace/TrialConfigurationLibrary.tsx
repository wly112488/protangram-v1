import { useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, List, Modal, Select, Space, Tag, Typography, message } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TrialConfigurationEditor from './TrialConfigurationEditor';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { flattenEquipment } from './equipmentCompositionModel';
import { CFG_ROLES } from './trialConfigurationModel';
import { listCfgCategoryGroups } from './cfgCategoryModel';

export default function TrialConfigurationLibrary() {
  const [creating,setCreating] = useState(false);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const categories = useTrialConfigurationStore(state=>state.categories);
  const [params,setParams] = useSearchParams();
  const categoryId = params.get('categoryId');
  const groups = listCfgCategoryGroups(categories,configurations);
  const group = groups.find(item=>item.id===categoryId);
  const invalidCategory = categoryId !== null && !group;
  const filtered = categoryId === null ? configurations : configurations.filter(cfg=>group?.cfgIds.includes(cfg.id));
  const [categoryModal,setCategoryModal] = useState<{id?:string} | null>(null);
  const [categoryError,setCategoryError] = useState('');
  const [categoryForm] = Form.useForm<{name:string}>();
  const objects = usePhysicalObjectStore(state=>state.objects);
  const equipment = flattenEquipment(objects);
  const navigate = useNavigate();
  const editCategory = (id?:string) => {
    setCategoryError(''); setCategoryModal({id});
    categoryForm.setFieldsValue({name:categories.find(item=>item.id===id)?.name ?? ''});
  };
  const saveCategory = ({name}:{name:string}) => {
    try {
      if (categoryModal?.id) useTrialConfigurationStore.getState().renameCategory(categoryModal.id,name);
      else {
        const id = useTrialConfigurationStore.getState().createCategory(name);
        setParams({categoryId:id});
      }
      setCategoryModal(null);
    } catch (cause) { setCategoryError(cause instanceof Error ? cause.message : '分类保存失败'); }
  };
  return <div className="workspace-business-page">
    <Space wrap><Typography.Title level={3}>试验构型 CFG</Typography.Title><Button onClick={()=>navigate('/trials/new')}>创建具体试验</Button></Space>
    <Typography.Paragraph type="secondary">按角色组合装备，可被多项具体试验复用。组成对象可以跨层级引用，陪试件按需添加。</Typography.Paragraph>
    <Space wrap style={{marginBottom:16}}>
      <Select aria-label="筛选 CFG 分类" value={categoryId ?? ''} style={{minWidth:220}} onChange={id=>{setCreating(false);setParams(id?{categoryId:id}:{});}}
        options={[{value:'',label:'全部 CFG'},...groups.map(item=>({value:item.id,label:`${item.name}（${item.cfgIds.length}）`}))]} />
      <Button onClick={()=>editCategory()}>新建分类</Button>
      {group && group.id!=='unclassified' && <Button onClick={()=>editCategory(group.id)}>重命名分类</Button>}
    </Space>
    {invalidCategory && <Alert type="warning" showIcon title="分类不存在" description="原分类已不可用，请重新选择分类。" action={<Button onClick={()=>{setCreating(false);setParams({});}}>查看全部 CFG</Button>} />}
    {creating ? <Card title="新建试验构型 CFG"><TrialConfigurationEditor key={categoryId ?? 'all'} initialCategoryId={categories.some(item=>item.id===categoryId)?categoryId!:undefined} onSaved={()=>setCreating(false)} onCancel={()=>setCreating(false)} /></Card>
      : <Button type="primary" disabled={invalidCategory} onClick={()=>setCreating(true)}>新建 CFG</Button>}
    <List dataSource={filtered} locale={{emptyText:<Empty description={invalidCategory?'请重新选择分类':'此分类下尚未创建 CFG'} />}} renderItem={cfg=><List.Item>
      <Card size="small" title={cfg.name} style={{width:'100%'}} extra={<Button onClick={()=>navigate(`/trials/new?cfgId=${encodeURIComponent(cfg.id)}`)}>使用此 CFG 创建试验</Button>}>
        <Typography.Text type="secondary">{cfg.id}</Typography.Text><p>{cfg.description}</p>
        <div style={{marginBottom:12}}><Select aria-label={`调整 ${cfg.name} 的分类`} allowClear placeholder="未分类" style={{minWidth:220}}
          value={categories.some(item=>item.id===cfg.categoryId)?cfg.categoryId:undefined}
          options={categories.map(item=>({value:item.id,label:item.name}))} onChange={id=>{
            try { useTrialConfigurationStore.getState().setConfigurationCategory(cfg.id,id); }
            catch(cause) { message.error(cause instanceof Error ? cause.message : '分类保存失败'); }
          }} /></div>
        {cfg.members.map(member=><Tag key={`${member.objectId}:${member.role}`} color={equipment.some(item=>item.id===member.objectId)?undefined:'error'}>
          {CFG_ROLES.find(role=>role.value===member.role)?.label}：{equipment.find(item=>item.id===member.objectId)?.path ?? `来源失效 ${member.objectId}`}
        </Tag>)}
      </Card>
    </List.Item>} />
    <Modal title={categoryModal?.id?'重命名 CFG 分类':'新建 CFG 分类'} open={categoryModal!==null} footer={null} onCancel={()=>setCategoryModal(null)}>
      <Form form={categoryForm} layout="vertical" onFinish={saveCategory}>
        {categoryError && <Alert type="error" showIcon title={categoryError} />}
        <Form.Item name="name" label="分类名称" rules={[{required:true,whitespace:true,message:'填写 CFG 分类名称'}]}><Input /></Form.Item>
        <Space><Button type="primary" htmlType="submit">保存分类</Button><Button onClick={()=>setCategoryModal(null)}>取消</Button></Space>
      </Form>
    </Modal>
  </div>;
}
