import React, { useMemo, useState } from 'react';
import { Button, Card, Dropdown, Empty, Form, Input, Modal, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { PlusOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalObjectStore, flattenObjects, type ValueField, type DataForm, type DesignField, type ExperimentDefinition } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type PhysicalBusinessScope, type SessionCapability } from './sessionModel';
import './physicalObjects.css';

const { Text, Title } = Typography;
type Action = 'object' | 'child' | 'configuration' | 'parameter' | 'material' | 'design' | 'experiment' | 'testRecord' | 'model' | 'calculation' | 'calculationRecord';
type Context = { objectId?: string; experimentId?: string; modelId?: string; calculationId?: string };
const parseFields = (text = '', defaultForm: DataForm = '单值'): ValueField[] => text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
  const [name, value = '', unit = '', formOrSource = '', source = ''] = line.split(/[：:]/).map(part => part.trim());
  const forms: DataForm[] = ['单值', '分组', '表格', '序列', '文件'];
  const form = forms.includes(formOrSource as DataForm) ? formOrSource as DataForm : defaultForm;
  return { id: `field-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, name, value, unit, form, source: source || (form === defaultForm ? formOrSource || undefined : undefined) };
});
const parseDesignFields = (text = ''): DesignField[] => text.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
  const [name, value = '', unit = '', usage = '条件', comparison = ''] = line.split(/[：:]/).map(part => part.trim());
  return { id: `field-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`, name, value, unit, form: '单值', usage: (['条件', '参考', '要求'].includes(usage) ? usage : '条件') as DesignField['usage'], comparison: (['目标', '下限', '上限', '区间'].includes(comparison) ? comparison : undefined) as DesignField['comparison'] };
});
const values = (items: ValueField[]) => items.length ? <div className="physical-field-list">{items.map(item => <div className="physical-field-row" key={item.id}><span>{item.name}</span><strong>{item.value || '—'} {item.unit}</strong><Tag>{item.form}</Tag>{item.source && <Text type="secondary">来源：{item.source}</Text>}</div>)}</div> : <Text type="secondary">暂无记录</Text>;

const PhysicalObjectsPage: React.FC = () => {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const sessions = useSessionStore(state => state.sessions);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const addRoot = usePhysicalObjectStore(state => state.addRoot);
  const duplicateConfiguration = usePhysicalObjectStore(state => state.duplicateConfiguration);
  const addChild = usePhysicalObjectStore(state => state.addChild);
  const addField = usePhysicalObjectStore(state => state.addField);
  const addDesign = usePhysicalObjectStore(state => state.addDesign);
  const addExperiment = usePhysicalObjectStore(state => state.addExperiment);
  const addTestRecord = usePhysicalObjectStore(state => state.addTestRecord);
  const addModel = usePhysicalObjectStore(state => state.addModel);
  const addCalculation = usePhysicalObjectStore(state => state.addCalculation);
  const addCalculationRecord = usePhysicalObjectStore(state => state.addCalculationRecord);
  const flat = useMemo(() => flattenObjects(objects), [objects]);
  const selectedObjectId = searchParams.get('objectId') || objects[0]?.id || '';
  const selectedTaskId = searchParams.get('taskId') || '';
  const view = selectedTaskId || searchParams.get('view') === 'taskbooks' ? 'taskbooks' : 'objects';
  const [action, setAction] = useState<Action | null>(null);
  const [taskBookOpen, setTaskBookOpen] = useState(false);
  const [context, setContext] = useState<Context>({});
  const [form] = Form.useForm();
  const [taskBookForm] = Form.useForm();
  const object = flat.find(item => item.object.id === selectedObjectId)?.object;
  const open = (next: Action, data: Context = {}) => { setContext(data); setAction(next); form.resetFields(); };
  const createBook = () => { taskBookForm.resetFields(); setTaskBookOpen(true); };
  const saveTaskBook = (values: { title: string; sourceName?: string }) => {
    const title = values.title.trim();
    const projectId = useProjectStore.getState().createProject({ name: title, description: '任务书关联的数据空间' });
    const id = useTaskStore.getState().createTask({ title, sourceName: values.sourceName?.trim(), projectId, requirementTexts: [] });
    setSearchParams({ taskId: id }); setTaskBookOpen(false); message.success('任务书已创建');
  };
  const capabilityPaths: Record<string, SessionCapability> = { doe: 'doe', analysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition', report: 'report' };
  const capabilityNames: Record<string, string> = { doe: '智能试验设计', analysis: '数据分析', digitalTwin: '数字孪生', virtualCondition: '虚拟工况', report: '报告' };
  const launchCapability = (key: string, scope: PhysicalBusinessScope) => {
    const capability = capabilityPaths[key];
    const existing = sessions.find(session => session.businessScope?.physicalObjectId === scope.physicalObjectId
      && session.businessScope?.experimentId === scope.experimentId && session.businessScope?.modelId === scope.modelId
      && session.businessScope?.taskBookId === scope.taskBookId && session.capability === capability);
    const id = existing?.id ?? useSessionStore.getState().createSession({ title: `${scope.physicalObjectName} · ${capabilityNames[key]}`, businessScope: scope });
    useSessionStore.getState().openSession(id, capability);
    navigate(getSessionPath(id, capability));
  };
  const objectScope = (extra: Partial<PhysicalBusinessScope> = {}): PhysicalBusinessScope => ({ physicalObjectId: object?.id ?? '', physicalObjectName: object?.name ?? '', ...extra });
  const openCreateAction = (key: string) => {
    if (key === 'book') { createBook(); return; }
    const actions: Action[] = ['object', 'child', 'parameter', 'material', 'design', 'experiment', 'model', 'calculation', 'configuration'];
    if (actions.includes(key as Action)) open(key as Action, key === 'object' ? {} : { objectId: object?.id, ...(key === 'calculation' ? { modelId: object?.models[0]?.id } : {}) });
  };
  const createItems = [
    { key: 'object', label: '物理对象' }, { key: 'child', label: '子对象', disabled: !object }, { key: 'configuration', label: '新构型', disabled: !object },
    { key: 'parameter', label: '参数', disabled: !object }, { key: 'material', label: '资料', disabled: !object },
    { key: 'design', label: '设计工况与要求', disabled: !object }, { key: 'experiment', label: '试验', disabled: !object },
    { key: 'model', label: '模型', disabled: !object }, { key: 'calculation', label: '计算方案', disabled: !object?.models.length },
    { type: 'divider' as const }, { key: 'book', label: '任务书' },
  ];
  const openRecord = (experiment: ExperimentDefinition) => open('testRecord', { objectId: object?.id, experimentId: experiment.id });
  const submit = (values: Record<string, string>) => {
    const itemFields = parseFields(values.fields, values.form as DataForm);
    const description = values.description || '';
    if (action === 'object') { const objectId = addRoot({ name: values.name, type: values.type || '自定义对象', description }); setSearchParams({ objectId }); message.success('物理对象已创建'); }
    if (action === 'child' && context.objectId) { const objectId = addChild(context.objectId, { name: values.name, type: values.type || '自定义对象', description }); setSearchParams({ objectId }); message.success('子对象已添加'); }
    if (action === 'configuration' && context.objectId) { const objectId = duplicateConfiguration(context.objectId, { name: values.name, description, parameterOverrides: itemFields }); if (objectId) setSearchParams({ objectId }); message.success('新构型已另存'); }
    if ((action === 'parameter' || action === 'material') && context.objectId) { addField(context.objectId, action === 'parameter' ? 'parameters' : 'materials', { name: values.name, description, unit: values.unit || '', form: values.form as DataForm, value: values.value || '' }); message.success('字段已保存'); }
    if (action === 'design' && context.objectId) {
      const designFields = parseDesignFields(values.fields);
      addDesign(context.objectId, { name: values.name, description, fields: designFields }); message.success('设计工况与要求已保存');
    }
    if (action === 'experiment' && context.objectId) { addExperiment(context.objectId, { name: values.name, category: values.category || '综合与考核类', description, taskBookId: values.taskBookId || undefined, settings: itemFields }); message.success('试验已创建'); }
    if (action === 'testRecord' && context.objectId && context.experimentId) { addTestRecord(context.objectId, context.experimentId, { name: values.name, description, data: itemFields }); message.success('执行记录已新增'); }
    if (action === 'model' && context.objectId) { addModel(context.objectId, { name: values.name, description, inputs: parseFields(values.inputs), outputs: parseFields(values.outputs), defaults: parseFields(values.defaults), method: values.method || '' }); message.success('模型已创建'); }
    if (action === 'calculation' && context.objectId && context.modelId) { addCalculation(context.objectId, context.modelId, { name: values.name, description, inputs: parseFields(values.inputs) }); message.success('计算方案已创建'); }
    if (action === 'calculationRecord' && context.objectId && context.modelId && context.calculationId) { addCalculationRecord(context.objectId, context.modelId, context.calculationId, { name: values.name, description, inputs: parseFields(values.inputs), data: itemFields }); message.success('计算记录已新增'); }
    setAction(null);
  };
  const testEntries = flat.flatMap(({ object: item, path }) => item.experiments.filter(experiment => experiment.taskBookId === selectedTaskId).map(experiment => ({ object: item, path, experiment })));
  const actionTitle: Record<Action, string> = { object: '新建物理对象', child: '新建子对象', configuration: '基于当前对象另存新构型', parameter: '新增参数', material: '新增资料', design: '新增设计工况与要求', experiment: '新建试验', testRecord: '新增试验执行记录', model: '新建仿真模型', calculation: '新建计算方案', calculationRecord: '新增计算运行记录' };
  const fieldsForm = (label: string, name = 'fields', required = false, placeholder = '每行一项，格式：名称：数值：单位\n例如：转速：1200：r/min') => <Form.Item name={name} label={label} rules={required ? [{ required: true, message: `请输入${label}` }] : []}><Input.TextArea rows={3} placeholder={placeholder} /></Form.Item>;
  const modalContent = () => <Form form={form} layout="vertical" onFinish={submit}>
    {(action === 'object' || action === 'child' || action === 'configuration' || action === 'parameter' || action === 'material' || action === 'design' || action === 'experiment' || action === 'testRecord' || action === 'model' || action === 'calculation' || action === 'calculationRecord') && <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}><Input autoFocus /></Form.Item>}
    {(action === 'object' || action === 'child') && <><Form.Item name="type" label="预制类型"><Select options={['涵道风扇', '电推进', '电机', '转子', '自定义对象'].map(value => ({ value }))} showSearch /></Form.Item><Form.Item name="description" label="描述"><Input.TextArea rows={2} /></Form.Item></>}
    {action === 'configuration' && <><Form.Item name="description" label="构型说明"><Input.TextArea rows={2} /></Form.Item><Form.Item name="form" label="字段内容形式" initialValue="单值"><Select options={['单值', '分组', '表格', '序列', '文件'].map(value => ({ value }))} /></Form.Item>{fieldsForm('参数变更（只填写需要覆盖的字段）')}</>}
    {(action === 'parameter' || action === 'material') && <><Form.Item name="description" label="描述"><Input /></Form.Item>{action === 'parameter' && <Form.Item name="unit" label="单位"><Input /></Form.Item>}<Form.Item name="form" label="内容形式" initialValue={action === 'material' ? '文件' : '单值'}><Select options={['单值', '分组', '表格', '序列', '文件'].map(value => ({ value }))} /></Form.Item><Form.Item name="value" label={action === 'material' ? '内容 / 文件引用' : '数据值'}><Input.TextArea rows={2} /></Form.Item></>}
    {action === 'design' && <><Form.Item name="description" label="适用条件说明"><Input /></Form.Item>{fieldsForm('字段列表（每项可单独指定用途）', 'fields', false, '每行：名称：数值：单位：条件/参考/要求：目标/下限/上限/区间\n例如：环境温度：20：℃：条件\n推力：850：N：要求：下限')}</>}
    {action === 'experiment' && <><Form.Item name="category" label="试验类别" initialValue="性能与功能类"><Select options={['环境适应性类', '力学环境与可靠性类', '性能与功能类', '安全与防护类', '综合与考核类'].map(value => ({ value }))} /></Form.Item><Form.Item name="description" label="描述"><Input /></Form.Item><Form.Item name="taskBookId" label="关联任务书（留空为独立试验）"><Select allowClear placeholder="不关联任务书，独立开展" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item>{fieldsForm('计划设置')}</>}
    {(action === 'testRecord' || action === 'calculationRecord') && <><Form.Item name="description" label="描述"><Input /></Form.Item>{action === 'calculationRecord' && fieldsForm('本次实际输入', 'inputs', true, '每行：名称：数值：单位：内容形式：数据来源（来源可选）')}<Form.Item name="form" label="输出内容形式" initialValue="单值"><Select options={['单值', '分组', '表格', '序列', '文件'].map(value => ({ value }))} /></Form.Item>{fieldsForm(action === 'testRecord' ? '实际环境、测量结果与采集文件' : '本次输出结果', 'fields', false, '每行：名称：数值：单位：内容形式：数据来源（来源可选）')}</>}
    {action === 'model' && <><Form.Item name="description" label="模型说明" rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>{fieldsForm('输入定义', 'inputs')} {fieldsForm('输出定义', 'outputs')} {fieldsForm('默认设置', 'defaults')}<Form.Item name="method" label="计算方法（公式、文件或模型组合）"><Input.TextArea rows={2} /></Form.Item></>}
    {action === 'calculation' && <><Form.Item name="description" label="说明"><Input /></Form.Item>{fieldsForm('本次参数 / 实际输入', 'inputs', true)}</>}
  </Form>;
  return <div className="physical-page">
    <div className="physical-heading"><div><div className="workspace-kicker">对象与试验</div><Title level={3}>物理对象</Title></div><Dropdown trigger={['click']} menu={{ items: createItems, onClick: ({ key }) => openCreateAction(key) }}><Button type="primary" icon={<PlusOutlined />}>新建</Button></Dropdown></div>
    <Card className="physical-workspace-card" bordered={false}>
      <Tabs activeKey={view} onChange={key => setSearchParams(key === 'objects' ? (selectedObjectId ? { objectId: selectedObjectId } : {}) : selectedTaskId ? { taskId: selectedTaskId } : { view: 'taskbooks' })} items={[{ key: 'objects', label: '对象视图', children: <div className="physical-object-layout physical-object-layout--single">
        {object ? <div className="physical-object-detail"><div className="physical-object-title"><div><Text type="secondary">{flat.find(item => item.object.id === object.id)?.path}</Text><Title level={4}>{object.name}</Title><Tag color="blue">{object.type}</Tag>{object.basedOnId && <Tag color="cyan">新构型</Tag>}<Text>{object.description || ''}</Text></div></div>
          <Tabs items={[
            { key: 'profile', label: '组成与参数', children: <div className="physical-section-grid"><Card title="参数">{values(object.parameters)}</Card><Card title="资料">{values(object.materials)}</Card><Card title="子对象">{object.children.length ? object.children.map(child => <Button className="physical-child-link" key={child.id} type="link" onClick={() => setSearchParams({ objectId: child.id })}>{child.name} · {child.type}</Button>) : <Text type="secondary">—</Text>}</Card></div> },
            { key: 'design', label: '工况与要求', children: <div className="physical-card-list">{object.designs.length ? object.designs.map(design => <Card key={design.id} title={design.name}><Text type="secondary">{design.description}</Text>{design.fields.map(item => <div className="physical-field-row" key={item.id}><Tag color={item.usage === '要求' ? 'orange' : 'blue'}>{item.usage}</Tag><span>{item.name}</span><strong>{item.comparison ? `${item.comparison} ` : ''}{item.value} {item.unit}</strong></div>)}</Card>) : <Empty description="暂无设计项" />}</div> },
            { key: 'experiments', label: '试验', children: <div className="physical-card-list">{object.experiments.length ? object.experiments.map(experiment => <Card key={experiment.id} title={<Space>{experiment.name}<Tag>{experiment.category}</Tag>{experiment.taskBookId ? <Tag color="purple">{tasks.find(task => task.id === experiment.taskBookId)?.title || '任务书已删除'}</Tag> : <Tag>独立试验</Tag>}</Space>} extra={<Space><Button size="small" onClick={() => launchCapability('analysis', objectScope({ experimentId: experiment.id, experimentName: experiment.name, taskBookId: experiment.taskBookId, taskBookName: tasks.find(task => task.id === experiment.taskBookId)?.title }))}>数据分析</Button><Button size="small" onClick={() => openRecord(experiment)}>新增记录</Button></Space>}><Title level={5}>计划设置</Title>{values(experiment.settings)}<Title level={5}>执行记录（{experiment.records.length}）</Title>{experiment.records.map(record => <Card size="small" className="physical-record-card" key={record.id} title={`${record.name} · ${new Date(record.createdAt).toLocaleDateString('zh-CN')}`}>{record.description && <Text>{record.description}</Text>}{values(record.data)}</Card>)}</Card>) : <Empty description="暂无试验" />}</div> },
            { key: 'models', label: '模型与计算', children: <div className="physical-card-list">{object.models.length ? object.models.map(model => <Card key={model.id} title={<Space><ThunderboltOutlined />{model.name}</Space>} extra={<Space><Button size="small" onClick={() => launchCapability('digitalTwin', objectScope({ modelId: model.id, modelName: model.name }))}>数字孪生</Button><Button size="small" onClick={() => launchCapability('virtualCondition', objectScope({ modelId: model.id, modelName: model.name }))}>虚拟工况</Button></Space>}><div className="physical-model-grid"><div><Title level={5}>输入</Title>{values(model.inputs)}</div><div><Title level={5}>输出</Title>{values(model.outputs)}</div><div><Title level={5}>默认设置</Title>{values(model.defaults)}</div></div><Text type="secondary">{model.method}</Text>{model.calculations.map(calculation => <Card size="small" className="physical-record-card" key={calculation.id} title={calculation.name} extra={<Button size="small" onClick={() => open('calculationRecord', { objectId: object.id, modelId: model.id, calculationId: calculation.id })}>运行并记录</Button>}>{values(calculation.inputs)}{calculation.records.map(record => <Card size="small" key={record.id} title={record.name}>{values(record.inputs)}{values(record.data)}</Card>)}</Card>)}</Card>) : <Empty description="暂无模型" />}</div> },
            { key: 'capabilities', label: '专业功能', children: <div className="physical-capabilities">{Object.entries(capabilityNames).map(([key, label]) => <Button key={key} onClick={() => launchCapability(key, objectScope())}>{label}</Button>)}{sessions.filter(session => session.businessScope?.physicalObjectId === object.id).length > 0 && <Card size="small" title="关联工作">{sessions.filter(session => session.businessScope?.physicalObjectId === object.id).map(session => <Button type="link" key={session.id} onClick={() => navigate(getSessionPath(session.id, session.capability))}>{session.title}</Button>)}</Card>}</div> },
          ]} /></div> : <Empty description="选择一个物理对象" />}</div> }, { key: 'taskbooks', label: '任务书视图', children: <div className="physical-taskbook-view"><Card className="physical-taskbook-select" title="任务书"><Select value={selectedTaskId || undefined} onChange={value => setSearchParams({ taskId: value })} placeholder="选择任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} style={{ width: '100%' }} /></Card><div className="physical-book-tests">{selectedTaskId ? testEntries.length ? testEntries.map(({ object: owner, path, experiment }) => <Card key={experiment.id} title={experiment.name} extra={<Space><Tag color="blue">{owner.name}</Tag><Button size="small" onClick={() => launchCapability('report', { physicalObjectId: owner.id, physicalObjectName: owner.name, experimentId: experiment.id, experimentName: experiment.name, taskBookId: selectedTaskId, taskBookName: tasks.find(task => task.id === selectedTaskId)?.title })}>报告</Button></Space>}><Text type="secondary">{path} · {experiment.category}</Text><Title level={5}>计划设置</Title>{values(experiment.settings)}<Title level={5}>执行记录（{experiment.records.length}）</Title>{experiment.records.map(record => <Card size="small" key={record.id} title={record.name}>{values(record.data)}</Card>)}</Card>) : <Empty description="该任务书还没有关联试验" /> : <Empty description={tasks.length ? '请选择任务书' : '暂无任务书'} />}</div></div> }]}/>
    </Card>
    <Modal title={action ? actionTitle[action] : ''} open={Boolean(action)} okText="保存" cancelText="取消" onCancel={() => setAction(null)} onOk={() => form.submit()} destroyOnHidden>{modalContent()}</Modal>
    <Modal title="新建任务书" open={taskBookOpen} okText="创建任务书" cancelText="取消" onCancel={() => setTaskBookOpen(false)} onOk={() => taskBookForm.submit()} destroyOnHidden><Form form={taskBookForm} layout="vertical" onFinish={saveTaskBook}><Form.Item name="title" label="任务书名称" rules={[{ required: true, whitespace: true, message: '请填写任务书名称' }]}><Input autoFocus placeholder="例如：涵道风扇起飞工况验证" /></Form.Item><Form.Item name="sourceName" label="来源文件（可选）"><Input placeholder="任务书文件名" /></Form.Item></Form></Modal>
  </div>;
};
export default PhysicalObjectsPage;
