import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Form, Input, Select, Space, Typography, message } from 'antd';
import { ArrowLeftOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath } from './sessionModel';
import { resolveTrialCreationContext, resolveTrialTaskBookId } from './trialCreationModel';
import { confirmTaskTrialDraft } from './taskTrialWorkflow';
import { taskCapabilityRoute } from './taskAnalysisModel';

const { Title, Text } = Typography;
type CreateLevel = 'category' | 'object' | 'configuration' | null;

const TrialCreateForm: React.FC = () => {
  const [form] = Form.useForm();
  const location = useLocation();
  const navigate = useNavigate();
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const projects = useProjectStore(state => state.projects);
  const params = new URLSearchParams(location.search);
  const taskDraft = tasks.find(task => task.id === params.get('taskBookId'))?.trialDrafts?.find(draft => draft.id === params.get('draftId'));
  const [categoryId, setCategoryId] = useState<string | undefined>(() => new URLSearchParams(location.search).get('categoryId') || taskDraft?.categoryId || undefined);
  const [objectId, setObjectId] = useState<string | undefined>(() => new URLSearchParams(location.search).get('objectId') || taskDraft?.physicalObjectId || undefined);
  const [configurationId, setConfigurationId] = useState<string | undefined>(() => new URLSearchParams(location.search).get('configurationId') || taskDraft?.experimentId || undefined);
  const [creating, setCreating] = useState<CreateLevel>(null);
  const [draftName, setDraftName] = useState('');
  const context = resolveTrialCreationContext(location.search, tasks, projects);
  const category = objects.find(item => item.id === categoryId);
  const object = category?.configurations.find(item => item.id === objectId);
  const configuration = object?.experiments.find(item => item.id === configurationId);
  const objectOptions = category?.configurations.map(item => ({ value: item.id, label: item.name })) ?? [];
  const configurationOptions = object?.experiments.map(item => ({ value: item.id, label: item.name })) ?? [];
  const taskOptions = useMemo(() => tasks.filter(item => item.status !== '已归档').map(item => ({ value: item.id, label: item.title })), [tasks]);
  const selectedTask = Form.useWatch('taskBookId', form) as string | undefined;
  const createLabel = creating === 'category' ? '对象类别' : creating === 'object' ? '物理对象' : '试验构型';

  const createParent = () => {
    const name = draftName.trim();
    if (!creating || !name) return message.warning('请填写名称');
    try {
      if (creating === 'category') {
        const id = usePhysicalObjectStore.getState().addRoot({ name, type: name });
        setCategoryId(id); setObjectId(undefined); setConfigurationId(undefined);
      } else if (creating === 'object' && category) {
        const id = usePhysicalObjectStore.getState().addConfiguration(category.id, { name });
        setObjectId(id); setConfigurationId(undefined);
      } else if (creating === 'configuration' && object) {
        const id = usePhysicalObjectStore.getState().addExperiment(object.id, { name, parameters: [] });
        setConfigurationId(id);
      } else return message.error('上级信息已变化，请重新选择');
      setCreating(null); setDraftName(''); message.success(`${createLabel}已保存到本机并选中；取消创建试验也会保留`);
    } catch (error) { message.error(error instanceof Error ? error.message : '保存失败'); }
  };

  const submit = (values: { name: string; description?: string; loadSpectrum: string; loadSpectrumDescription?: string; taskBookId?: string }) => {
    if (context.mode === 'missing-project' || context.mode === 'missing-task') return message.error('入口关联的任务或项目已不存在，请从有效入口重新开始');
    if (!category || !object || !configuration) return message.error('请选择物理对象及其试验构型');
    try {
      if (taskDraft && context.mode === 'task') {
        const sessionId = confirmTaskTrialDraft(context.taskId, taskDraft.id, { ...values, physicalObjectId: object.id, experimentId: configuration.id });
        const requirement = tasks.find(task => task.id === context.taskId)?.requirements.find(item => taskDraft.requirementIds.includes(item.id));
        const capability = requirement?.capability ? taskCapabilityRoute[requirement.capability] : 'doe';
        if (requirement && requirement.status !== '已满足') useTaskStore.getState().setRequirementStatus(context.taskId, requirement.id, '进行中');
        navigate(getSessionPath(sessionId, capability));
        return;
      }
      const taskBookId = resolveTrialTaskBookId(context, values.taskBookId);
      const trialId = usePhysicalObjectStore.getState().addConcreteTrial(configuration.id, {
        name: values.name.trim(), description: values.description?.trim(), loadSpectrum: values.loadSpectrum.trim(),
        loadSpectrumDescription: values.loadSpectrumDescription?.trim(), taskBookId,
      });
      const scope = { physicalObjectId: object.id, physicalObjectName: object.name, experimentId: configuration.id,
        experimentName: configuration.name, trialId, trialName: values.name.trim(), taskBookId,
        taskBookName: tasks.find(item => item.id === taskBookId)?.title };
      const sessionStore = useSessionStore.getState();
      const projectId = context.mode === 'project' || context.mode === 'task' ? context.projectId : undefined;
      const sessionId = projectId ? sessionStore.ensureProjectSession(projectId, scope)
        : sessionStore.ensurePhysicalSession(scope, values.name.trim());
      sessionStore.openSession(sessionId, 'doe');
      if (useSessionStore.getState().saveError) message.error('本机存储写入失败，请重试保存；尚未保存到数据库');
      else message.success('具体试验已保存到本机');
      navigate(getSessionPath(sessionId, 'doe'));
    } catch (error) { message.error(error instanceof Error ? error.message : '具体试验保存失败'); }
  };

  if (context.mode === 'missing-task' || context.mode === 'missing-project') return <div className="trial-create-page"><Alert type="error" showIcon message="创建入口已失效" description="关联的正式任务或项目当前不可用。为防止试验被错误归属，请从任务书或项目重新进入创建流程。" /><Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回工作台</Button></div>;

  if (params.has('draftId') && !taskDraft) return <Alert type="error" showIcon message="试验模板不存在，请返回任务重新选择" />;

  return <div className="trial-create-page">
    <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
    <div className="trial-create-heading"><Text type="secondary">从具体试验开始</Text><Title level={2}>{taskDraft ? '复核试验模板' : '创建具体试验'}</Title><Text type="secondary">选择或新建关联对象和试验构型；现有信息直接选择即可。</Text></div>
    {context.mode !== 'independent' && context.projectId && <Text strong>所属项目：{projects.find(item => item.id === context.projectId)?.name}</Text>}
    {context.mode === 'task' && <Alert showIcon type="info" message={`将自动关联正式任务：${context.taskName}`} />}
    {context.mode === 'project' && <Alert showIcon type="info" message={`当前项目：${context.projectName} · 任务书关联为选填`} />}
    <Card className="trial-create-card">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <div><Form.Item label="对象类别" required><Space.Compact block><Select aria-label="选择对象类别" showSearch optionFilterProp="label" value={categoryId} options={objects.map(item => ({ value: item.id, label: item.name }))} onChange={id => { setCategoryId(id); setObjectId(undefined); setConfigurationId(undefined); }} placeholder="选择已有类别" /><Button aria-label="新建对象类别" icon={<PlusOutlined />} onClick={() => { setCreating('category'); setDraftName(''); }}>新建</Button></Space.Compact></Form.Item>{creating === 'category' && <InlineCreate label={createLabel} value={draftName} onChange={setDraftName} onSave={createParent} onCancel={() => setCreating(null)} />}</div>
        <div><Form.Item label="具体物理对象" required><Space.Compact block><Select aria-label="选择具体物理对象" showSearch optionFilterProp="label" value={objectId} options={objectOptions} disabled={!category} onChange={id => { setObjectId(id); setConfigurationId(undefined); }} placeholder={category ? '选择已有物理对象' : '先选择对象类别'} /><Button aria-label="新建具体物理对象" icon={<PlusOutlined />} disabled={!category} onClick={() => { setCreating('object'); setDraftName(''); }}>新建</Button></Space.Compact></Form.Item>{creating === 'object' && <InlineCreate label={createLabel} value={draftName} onChange={setDraftName} onSave={createParent} onCancel={() => setCreating(null)} />}</div>
        <div><Form.Item label="试验构型" required><Space.Compact block><Select aria-label="选择试验构型" showSearch optionFilterProp="label" value={configurationId} options={configurationOptions} disabled={!object} onChange={setConfigurationId} placeholder={object ? '选择已有试验构型' : '先选择具体物理对象'} /><Button aria-label="新建试验构型" icon={<PlusOutlined />} disabled={!object} onClick={() => { setCreating('configuration'); setDraftName(''); }}>新建</Button></Space.Compact></Form.Item>{creating === 'configuration' && <InlineCreate label={createLabel} value={draftName} onChange={setDraftName} onSave={createParent} onCancel={() => setCreating(null)} />}</div>
      </Space>
    </Card>
    <Card className="trial-create-card" title="试验信息">
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ taskBookId: undefined, name: taskDraft?.name, loadSpectrum: taskDraft?.loadSpectrum, description: taskDraft?.description }}>
        <Form.Item name="name" label="具体试验名称" rules={[{ required: true, whitespace: true, message: '请填写具体试验名称' }]}><Input placeholder="例如：涵道风扇静推力试验" /></Form.Item>
        <Form.Item name="loadSpectrum" label="载荷谱名称或编号" rules={[{ required: true, whitespace: true, message: '请填写载荷谱名称或编号' }]}><Input placeholder="填写名称或编号，不需要在这里录入曲线" /></Form.Item>
        <Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input /></Form.Item>
        <Form.Item name="description" label="试验说明（可选）"><Input.TextArea rows={2} /></Form.Item>
        {context.mode !== 'task' && <Form.Item name="taskBookId" label="关联任务书（可选）"><Select allowClear showSearch optionFilterProp="label" options={taskOptions} placeholder="可不关联任务书" /></Form.Item>}
        {context.mode === 'task' && <input type="hidden" value={context.taskId} />}
        <Button type="primary" htmlType="submit" disabled={!configuration}>{taskDraft ? '确认并进入试验工作台' : '创建并进入试验工作台'}</Button>
        {selectedTask && <Text type="secondary" style={{ marginLeft: 12 }}>将关联所选任务书</Text>}
      </Form>
    </Card>
  </div>;
};

function InlineCreate({ label, value, onChange, onSave, onCancel }: { label: string; value: string; onChange: (value: string) => void; onSave: () => void; onCancel: () => void }) {
  return <Space.Compact block className="trial-inline-create"><Input aria-label={`新建${label}名称`} autoFocus value={value} onChange={event => onChange(event.target.value)} onPressEnter={onSave} placeholder={`${label}名称`} /><Button type="primary" onClick={onSave}>保存并选择</Button><Button onClick={onCancel}>取消</Button></Space.Compact>;
}

const TrialCreatePage: React.FC = () => { const location = useLocation(); return <TrialCreateForm key={location.search} />; };
export default TrialCreatePage;
