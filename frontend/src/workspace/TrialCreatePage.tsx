import { useState } from 'react';
import { Alert, Button, Card, Divider, Form, Input, Select, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { TEST_TYPES, usePhysicalObjectStore, type ValueField } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { physicalSourcePath } from './physicalBusinessContext';
import { commitWorkspaceChange } from './workspacePersistence';
import './trialWorkspace.css';

type InlineKind = 'category' | 'object' | 'configuration';
type CreateValues = { objectId: string; configurationId: string; experimentId: string; name: string; loadSpectrum?: string; loadSpectrumDescription?: string; description?: string; taskBookId?: string };
type MetadataValues = { name: string; description?: string; testType?: string; parameters?: Array<{ name?: string; value?: string; unit?: string; description?: string }> };

export default function TrialCreatePage() {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<CreateValues>();
  const [metadataForm] = Form.useForm<MetadataValues>();
  const [inline, setInline] = useState<InlineKind>();
  const [saving, setSaving] = useState(false);
  const [metadataSaving, setMetadataSaving] = useState(false);
  const [error, setError] = useState('');
  const objectId = Form.useWatch('objectId', form);
  const configurationId = Form.useWatch('configurationId', form);
  const family = objects.find(object => object.id === objectId);
  const object = family?.configurations.find(item => item.id === configurationId);
  const experimentId = Form.useWatch('experimentId', form);
  const experiment = object?.experiments.find(item => item.id === experimentId);
  const taskBookId = Form.useWatch('taskBookId', form);
  const stale = Boolean(objectId && !family || configurationId && !object || experimentId && !experiment || taskBookId && !tasks.some(task => task.id === taskBookId));
  const startInline = (kind: InlineKind) => { metadataForm.resetFields(); setInline(kind); setError(''); };
  const createMetadata = async (values: MetadataValues) => {
    if (!inline || metadataSaving) return;
    setMetadataSaving(true); setError('');
    try {
      const store = usePhysicalObjectStore.getState();
      if (inline === 'category') {
        const id = await commitWorkspaceChange(() => store.addRoot({ name: values.name.trim(), type: values.name.trim(), description: values.description }));
        form.setFieldsValue({ objectId: id, configurationId: undefined, experimentId: undefined });
      } else if (inline === 'object') {
        if (!family) throw new Error('请先选择有效的对象类别');
        const id = await commitWorkspaceChange(() => store.addConfiguration(family.id, { name: values.name.trim(), description: values.description }));
        form.setFieldsValue({ configurationId: id, experimentId: undefined });
      } else {
        if (!object) throw new Error('请先选择有效的具体物理对象');
        const parameters: ValueField[] = (values.parameters ?? []).filter(item => item.name?.trim()).map(item => ({ id: `field-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`, name: item.name!.trim(), value: item.value || '', unit: item.unit, description: item.description, form: '单值' }));
        const id = await commitWorkspaceChange(() => store.addExperiment(object.id, { name: values.name.trim(), description: values.description, testType: values.testType, parameters }));
        form.setFieldsValue({ experimentId: id });
      }
      setInline(undefined); message.success('已保存到数据库并选中');
    } catch (cause) { setError(cause instanceof Error ? cause.message : '保存失败，请重试'); }
    finally { setMetadataSaving(false); }
  };
  const createTrial = async (values: CreateValues) => {
    if (saving || metadataSaving || stale) return;
    setSaving(true); setError('');
    try {
      const current = usePhysicalObjectStore.getState().objects.find(item => item.id === values.objectId)?.configurations.find(item => item.id === values.configurationId)?.experiments.find(item => item.id === values.experimentId);
      if (!current) throw new Error('对象或试验构型已失效，请重新选择');
      if (values.taskBookId && !useTaskStore.getState().tasks.some(task => task.id === values.taskBookId)) throw new Error('任务书已失效，请重新选择');
      const trialId = await commitWorkspaceChange(() => usePhysicalObjectStore.getState().addConcreteTrial(current.id, { name: values.name.trim(), loadSpectrum: values.loadSpectrum?.trim() || '', loadSpectrumDescription: values.loadSpectrumDescription, description: values.description, taskBookId: values.taskBookId }));
      const path = physicalSourcePath(usePhysicalObjectStore.getState().objects, { physicalObjectId: values.configurationId, experimentId: values.experimentId, trialId });
      if (!path) throw new Error('试验已保存，但打开来源失败，请返回试验列表');
      message.success('具体试验已保存到数据库'); navigate(path);
    } catch (cause) { setError(cause instanceof Error ? cause.message : '创建失败，请重试'); }
    finally { setSaving(false); }
  };
  const inlineTitle = inline === 'category' ? '新建对象类别' : inline === 'object' ? '新建具体物理对象' : '新建试验构型';
  return <div className="trial-workspace trial-create-workspace">
    <div className="trial-page-header"><div><Button type="link" className="trial-back" icon={<ArrowLeftOutlined />} onClick={() => navigate('/trials')}>具体试验</Button><Typography.Title level={3}>新建具体试验</Typography.Title><Typography.Text type="secondary">选择物理对象与构型，填写载荷谱名称或编号。任务书可选。</Typography.Text></div></div>
    {error && <Alert type="error" showIcon title="保存未完成" description={error} closable onClose={() => setError('')} />}
    {stale && <Alert type="warning" showIcon title="预填来源不存在或已失效，请重新选择。" />}
    <div className="trial-create-layout"><Card bordered={false} className="trial-create-main">
      <Form form={form} layout="vertical" onFinish={createTrial} disabled={saving || metadataSaving} initialValues={{ objectId: params.get('objectId') || undefined, configurationId: params.get('configurationId') || undefined, experimentId: params.get('experimentId') || undefined, taskBookId: params.get('taskBookId') || undefined }}>
        <Typography.Title level={5}>对象与构型</Typography.Title>
        <Form.Item name="objectId" label="对象类别" rules={[{ required: true, message: '请选择对象类别' }]}><Select aria-label="对象类别" showSearch optionFilterProp="label" placeholder="选择对象类别" options={objects.map(item => ({ value: item.id, label: item.name }))} onChange={() => { form.setFieldsValue({ configurationId: undefined, experimentId: undefined }); setInline(undefined); }} /></Form.Item>
        <Button className="trial-inline-add" type="link" icon={<PlusOutlined />} onClick={() => startInline('category')}>新建对象类别</Button>
        <Form.Item name="configurationId" label="具体物理对象" rules={[{ required: true, message: '请选择具体物理对象' }]}><Select aria-label="具体物理对象" disabled={!family || saving || metadataSaving} showSearch optionFilterProp="label" placeholder="选择具体物理对象" options={family?.configurations.map(item => ({ value: item.id, label: item.name }))} onChange={() => { form.setFieldsValue({ experimentId: undefined }); setInline(undefined); }} /></Form.Item>
        <Button className="trial-inline-add" disabled={!family} type="link" icon={<PlusOutlined />} onClick={() => startInline('object')}>新建具体物理对象</Button>
        <Form.Item name="experimentId" label="试验构型" rules={[{ required: true, message: '请选择试验构型' }]}><Select aria-label="试验构型" disabled={!object || saving || metadataSaving} showSearch optionFilterProp="label" placeholder="选择试验构型" options={object?.experiments.map(item => ({ value: item.id, label: item.name }))} /></Form.Item>
        <Button className="trial-inline-add" disabled={!object} type="link" icon={<PlusOutlined />} onClick={() => startInline('configuration')}>新建试验构型</Button>
        <Divider /><Typography.Title level={5}>本次具体试验</Typography.Title>
        <Form.Item name="name" label="试验名称" rules={[{ required: true, whitespace: true, message: '填写本次试验名称' }]}><Input placeholder="为本次试验命名" /></Form.Item>
        <Form.Item name="loadSpectrum" label="载荷谱名称或编号" rules={[{ required: true, whitespace: true, message: '请填写载荷谱名称或编号' }]}><Input placeholder="填写标识即可，无须录入曲线" /></Form.Item>
        <Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input.TextArea rows={2} /></Form.Item>
        <Form.Item name="taskBookId" label="关联任务书（可选）"><Select aria-label="关联任务书" allowClear showSearch optionFilterProp="label" placeholder="自主试验，无需任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item>
        <Form.Item name="description" label="试验说明（可选）"><Input.TextArea rows={3} /></Form.Item>
        <div className="trial-form-footer"><Button onClick={() => navigate('/trials')}>取消</Button><Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} disabled={stale || metadataSaving || Boolean(inline)}>创建具体试验</Button></div>
      </Form>
    </Card><aside className="trial-create-aside">{inline ? <Card title={inlineTitle} className="trial-inline-card"><Form form={metadataForm} layout="vertical" onFinish={createMetadata} disabled={metadataSaving}>
      <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请填写名称' }]}><Input autoFocus /></Form.Item>
      <Form.Item name="description" label="说明（可选）"><Input.TextArea rows={2} /></Form.Item>
      {inline === 'configuration' && <><Form.Item name="testType" label="适用试验类型（可选）"><Select allowClear options={TEST_TYPES} /></Form.Item><Typography.Text type="secondary">专业参数可稍后维护；这里只填写已经确定的内容。</Typography.Text><Form.List name="parameters">{(fields, { add, remove }) => <div>{fields.map(field => <div className="trial-parameter-entry" key={field.key}><Form.Item name={[field.name, 'name']} label="参数名称" rules={[{ required: true, whitespace: true, message: '填写参数名称' }]}><Input /></Form.Item><Space.Compact block><Form.Item name={[field.name, 'value']}><Input placeholder="参数内容" /></Form.Item><Form.Item name={[field.name, 'unit']}><Input placeholder="单位" /></Form.Item></Space.Compact><Form.Item name={[field.name, 'description']}><Input placeholder="描述（可选）" /></Form.Item><Button type="link" danger onClick={() => remove(field.name)}>删除参数</Button></div>)}<Button type="dashed" block icon={<PlusOutlined />} onClick={() => add({})}>添加参数（可选）</Button></div>}</Form.List></>}
      <Space className="trial-inline-actions" wrap><Button disabled={metadataSaving} onClick={() => setInline(undefined)}>取消</Button><Button type="primary" htmlType="submit" loading={metadataSaving}>保存并选中</Button></Space>
    </Form></Card> : <Card className="trial-context-card" title="当前选择"><Typography.Paragraph><Typography.Text type="secondary">对象类别</Typography.Text><br />{family?.name || '待选择'}</Typography.Paragraph><Typography.Paragraph><Typography.Text type="secondary">具体物理对象</Typography.Text><br />{object?.name || '待选择'}</Typography.Paragraph><Typography.Paragraph><Typography.Text type="secondary">试验构型</Typography.Text><br />{experiment?.name || '待选择'}</Typography.Paragraph><Divider /><Typography.Text type="secondary">创建后可添加多次执行记录和 CSV 文件，并在同一试验下开展五项专业工作。</Typography.Text></Card>}</aside></div>
  </div>;
}
