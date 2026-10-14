import React, { useMemo, useState } from 'react';
import { Alert, Button, Card, Dropdown, Empty, Form, Input, InputNumber, Modal, Select, Space, Tabs, Tag, Typography, Upload, message } from 'antd';
import { BarChartOutlined, FileAddOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import TrialChart from './TrialChart';
import { artifactResultLabel, getSourceArtifacts } from './physicalBusinessContext';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact } from './types';
import type { RcFile } from 'antd/es/upload/interface';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalObjectStore, type DerivedChart, type DesignCase, type DesignField, type PhysicalConfiguration, type PhysicalObject, type RawDataFile, type ValueField } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type PhysicalBusinessScope, type SessionCapability } from './sessionModel';
import { buildChartPoints, parseTrialCsv, readTrialFile, saveTrialFile } from './trialDataFiles';
import './physicalObjects.css';

const { Text, Title } = Typography;
type Dialog = 'family' | 'configuration' | 'parameter' | 'design' | 'experiment' | 'record' | 'chart' | 'model' | null;
type FieldValue = { name: string; description?: string; unit?: string; form?: ValueField['form']; value?: string };
type DesignFormField = FieldValue & { usage?: DesignField['usage']; comparison?: DesignField['comparison'] };
type FormSubmission = {
  name?: string; description?: string; type?: string; category?: string; taskBookId?: string; designArtifactId?: string;
  settings?: FieldValue[]; parameters?: FieldValue[]; actualConditions?: FieldValue[]; measurements?: FieldValue[]; fields?: DesignFormField[];
  form?: ValueField['form']; value?: string; unit?: string; inputs?: FieldValue[]; outputs?: FieldValue[]; method?: string;
  rawFileId?: string; xField?: string; yField?: string; chartType?: DerivedChart['chartType']; startRow?: number; endRow?: number;
  scale?: number; offset?: number; color?: string; smooth?: boolean; modelId?: string; modelInputs?: FieldValue[];
};
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function FieldList({ name, label, initialValue = [] }: { name: string; label: string; initialValue?: FieldValue[] }) {
  return <Form.List name={name} initialValue={initialValue}>{(fields, { add, remove }) => <div className="physical-form-list"><Text strong>{label}</Text>{fields.map(({ key, name: fieldIndex, ...rest }) => <div className="physical-form-row" key={key}>
    <Form.Item {...rest} name={[fieldIndex, 'name']} rules={[{ required: true, message: '填写名称' }]}><Input placeholder="名称" /></Form.Item>
    <Form.Item {...rest} name={[fieldIndex, 'value']}><Input.TextArea placeholder="内容（表格、序列可分行填写）" autoSize={{ minRows: 1, maxRows: 4 }} /></Form.Item>
    <Form.Item {...rest} name={[fieldIndex, 'description']}><Input placeholder="描述" /></Form.Item>
    <Form.Item {...rest} name={[fieldIndex, 'unit']}><Input placeholder="单位" /></Form.Item>
    <Form.Item {...rest} name={[fieldIndex, 'form']}><Select placeholder="形式" options={['单值', '分组', '表格', '序列', '文件'].map(value => ({ value }))} /></Form.Item>
    <Button type="text" danger onClick={() => remove(fieldIndex)}>删除</Button>
  </div>)}<Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', form: '单值' })}>添加参数</Button></div>}</Form.List>;
}

function DesignFieldList() {
  return <Form.List name="fields" initialValue={[{ name: '', value: '', unit: '', usage: '条件', comparison: '' }]}>{(fields, { add, remove }) => <div className="physical-form-list"><Text strong>字段</Text>{fields.map(({ key, name, ...rest }) => <div className="physical-form-row physical-design-row" key={key}>
    <Form.Item {...rest} name={[name, 'name']} rules={[{ required: true, message: '填写名称' }]}><Input placeholder="名称" /></Form.Item>
    <Form.Item {...rest} name={[name, 'value']}><Input placeholder="目标值" /></Form.Item>
    <Form.Item {...rest} name={[name, 'unit']}><Input placeholder="单位" /></Form.Item>
    <Form.Item {...rest} name={[name, 'usage']}><Select options={['条件', '参考', '要求'].map(value => ({ value }))} /></Form.Item>
    <Form.Item {...rest} name={[name, 'comparison']}><Select allowClear placeholder="约束" options={['目标', '下限', '上限', '区间'].map(value => ({ value }))} /></Form.Item>
    <Button type="text" danger onClick={() => remove(name)}>删除</Button>
  </div>)}<Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', usage: '条件' })}>添加字段</Button></div>}</Form.List>;
}

function normalizeFields(items: FieldValue[] = []): ValueField[] {
  return items.filter(item => item.name?.trim()).map(item => ({ id: `field-${uuid()}`, name: item.name.trim(), value: item.value ?? '', unit: item.unit ?? '', description: item.description ?? '', form: item.form ?? '单值' }));
}

function ReferencedDesign({ artifact }: { artifact?: ProjectArtifact }) {
  if (!artifact) return <Alert type="warning" message="原设计方案引用不可用；已填写的试验设置保留" />;
  const plan = Array.isArray(artifact.payload.plan) ? artifact.payload.plan as Array<{ key?: string; speed?: number; temperature?: number; pressure?: number }> : [];
  const factors = Array.isArray(artifact.payload.factors) ? artifact.payload.factors as Array<{ name?: string; lowLevel?: string; highLevel?: string; levels?: string[] }> : [];
  return <Card size="small" title={<Space>引用设计方案：{artifact.title}<Tag>{artifactResultLabel(artifact)}</Tag></Space>}>
    <Text type="secondary">{artifact.summary}</Text>
    {plan.length > 0 && <div className="workspace-table-scroll"><table className="workspace-data-table"><thead><tr><th>采点</th><th>转速</th><th>温度</th><th>压力</th></tr></thead><tbody>{plan.map((point, index) => <tr key={point.key ?? index}><td>{index + 1}</td><td>{point.speed}</td><td>{point.temperature}</td><td>{point.pressure}</td></tr>)}</tbody></table></div>}
    {factors.length > 0 && <Space wrap>{factors.map((factor, index) => <Tag key={index}>{factor.name}：{factor.levels?.length ? factor.levels.join('、') : `${factor.lowLevel ?? ''}～${factor.highLevel ?? ''}`}</Tag>)}</Space>}
    <Text type="secondary">方案从原成果读取。试验设置由用户确定，不自动执行或生成记录。</Text>
  </Card>;
}


const PhysicalObjectsPage: React.FC = () => {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const sessions = useSessionStore(state => state.sessions);
  const projects = useProjectStore(state => state.projects);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const addRoot = usePhysicalObjectStore(state => state.addRoot);
  const addConfiguration = usePhysicalObjectStore(state => state.addConfiguration);
  const addField = usePhysicalObjectStore(state => state.addField);
  const addDesign = usePhysicalObjectStore(state => state.addDesign);
  const addExperiment = usePhysicalObjectStore(state => state.addExperiment);
  const ensureRecord = usePhysicalObjectStore(state => state.ensureTrialRecord);
  const updateRecord = usePhysicalObjectStore(state => state.updateTrialRecord);
  const addRawFile = usePhysicalObjectStore(state => state.addRawFile);
  const saveChart = usePhysicalObjectStore(state => state.saveChart);
  const addModel = usePhysicalObjectStore(state => state.addModel);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingChartId, setEditingChartId] = useState<string>();
  const [pendingFiles, setPendingFiles] = useState<RcFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartHeaders, setChartHeaders] = useState<string[]>([]);
  const [chartDataError, setChartDataError] = useState('');
  const [form] = Form.useForm();
  const selectedModelId = Form.useWatch('modelId', form);
  const routeObjectId = params.get('objectId') || '';
  const family: PhysicalObject | undefined = routeObjectId ? objects.find(item => item.id === routeObjectId || item.configurations.some(config => config.id === routeObjectId)) : objects[0];
  const routeConfigurationId = family?.configurations.some(config => config.id === routeObjectId) ? routeObjectId : '';
  const configurationId = params.get('configurationId') || routeConfigurationId || family?.configurations[0]?.id || '';
  const configuration: PhysicalConfiguration | undefined = family?.configurations.find(item => item.id === configurationId);
  const experimentId = params.get('experimentId') || configuration?.experiments[0]?.id || '';
  const experiment = configuration?.experiments.find(item => item.id === experimentId);
  const routeRecordId = params.get('recordId');
  const record = routeRecordId ? [experiment?.record, ...(experiment?.archivedRecords ?? [])].find(item => item?.id === routeRecordId) : experiment?.record;
  const sourceUnavailable = Boolean(routeObjectId && !family || params.get('configurationId') && !configuration || params.get('experimentId') && !experiment || routeRecordId && !record);
  const isArchivedRecord = Boolean(record && record.id !== experiment?.record?.id);
  const activeTab = params.get('view') === 'tools' ? 'tools' : params.get('view') === 'taskbooks' || params.has('taskId') ? 'taskbooks' : 'objects';
  const hasConfigurationContext = Boolean(configuration && (routeObjectId || params.get('configurationId')));
  const changeTab = (key: string) => {
    const next = new URLSearchParams(params);
    if (family) next.set('objectId', family.id);
    if (configuration) next.set('configurationId', configuration.id);
    if (experiment) next.set('experimentId', experiment.id);
    if (key === 'objects') next.delete('view');
    else next.set('view', key);
    if (key !== 'taskbooks') next.delete('taskId');
    setParams(next);
  };
  const designArtifacts = projects.flatMap(project => project.artifacts.filter(artifact => {
    if (artifact.type !== 'design' || !configuration) return false;
    const explicit = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    return explicit ? explicit.physicalObjectId === configuration.id
      : sessions.some(session => session.storageProjectId === project.id && session.businessScope?.physicalObjectId === configuration.id);
  }));
  const allEntries = useMemo(() => objects.flatMap(object => object.configurations.flatMap(config => config.experiments.map(item => ({ object, config, experiment: item })))), [objects]);
  const startDialog = (next: Exclude<Dialog, null>, initial: Record<string, unknown> = {}) => { setDialog(next); setPendingFiles([]); form.resetFields(); if (Object.keys(initial).length) form.setFieldsValue(initial); };
  const capabilityNames: Record<string, string> = { doe: '智能试验设计', analysis: '数据分析', digitalTwin: '数字孪生', virtualCondition: '虚拟工况', report: '报告' };
  const capabilityPaths: Record<string, SessionCapability> = { doe: 'doe', analysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition', report: 'report' };
  const launchCapability = (key: string, standalone = false) => {
    if (sourceUnavailable) return message.error('业务来源已失效，请选择已有来源');
    const capability = capabilityPaths[key];
    const scope: PhysicalBusinessScope = standalone ? {} : {
      physicalObjectId: configuration?.id, physicalObjectName: configuration?.name,
      experimentId: experiment?.id, experimentName: experiment?.name,
      testRecordId: record?.id, testRecordName: record?.name,
      taskBookId: experiment?.taskBookId, taskBookName: tasks.find(task => task.id === experiment?.taskBookId)?.title,
    };
    const id = standalone
      ? useSessionStore.getState().createSession({ title: capabilityNames[key] })
      : useSessionStore.getState().ensurePhysicalSession(scope, `${configuration?.name ?? '工作'} · 专业工作`);
    useSessionStore.getState().openSession(id, capability);
    navigate(getSessionPath(id, capability));
  };
  const makeValueFields = (items: FieldValue[] = []) => normalizeFields(items);
  const uploadRawFiles = async (experimentKey: string, files: RcFile[]) => {
    for (const file of files) {
      const fileId = `raw-${uuid()}`;
      let metadata: RawDataFile = { id: fileId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, addedAt: new Date().toISOString(), headers: [], rowCount: 0 };
      if (file.name.toLowerCase().endsWith('.csv')) {
        const parsed = parseTrialCsv(await file.text());
        metadata = { ...metadata, headers: parsed.headers, rowCount: parsed.rows.length };
      }
      await saveTrialFile(fileId, file);
      addRawFile(experimentKey, metadata);
      setPendingFiles(items => items.filter(item => item.uid !== file.uid));
    }
  };
  const submit = async (values: FormSubmission) => {
    if (sourceUnavailable && dialog !== 'family') return message.error('业务来源已失效，请选择已有来源');
    if (saving) return;
    setSaving(true);
    try {
      if (dialog === 'family') {
        const createdId = addRoot({ name: values.name || '', type: values.type || '自定义对象', description: values.description || '' });
        setParams({ objectId: createdId }); message.success('物理对象已创建');
      }
      if (dialog === 'configuration' && family) {
        const createdId = addConfiguration(family.id, { name: values.name || '', description: values.description || '' });
        if (createdId) setParams({ objectId: family.id, configurationId: createdId }); message.success('构型已创建');
      }
      if (dialog === 'parameter' && configuration) {
        addField(configuration.id, 'parameters', { name: values.name || '', description: values.description || '', unit: values.unit || '', form: values.form || '单值', value: values.value || '' }); message.success('参数已保存');
      }
      if (dialog === 'design' && configuration) {
        const fields: DesignField[] = (values.fields ?? []).filter(field => field.name?.trim()).map(field => ({ id: `field-${uuid()}`, name: field.name!.trim(), description: field.description || '', value: field.value || '', unit: field.unit || '', form: '单值', usage: field.usage || '条件', comparison: field.comparison || undefined }));
        addDesign(configuration.id, { name: values.name || '', description: values.description || '', fields }); message.success('工况与要求已保存');
      }
      if (dialog === 'experiment' && configuration) {
        const designArtifact = designArtifacts.find(item => item.id === values.designArtifactId);
        const id = addExperiment(configuration.id, { name: values.name || '', category: values.category || '性能与功能类', description: values.description || '', taskBookId: values.taskBookId || undefined, designArtifactRef: designArtifact ? { projectId: designArtifact.projectId, artifactId: designArtifact.id } : undefined, settings: makeValueFields(values.settings), parameters: makeValueFields(values.parameters) });
        setParams({ objectId: family!.id, configurationId: configuration.id, experimentId: id }); message.success('试验构型已创建');
      }
      if (dialog === 'record' && experiment) {
        const recordInput = { name: values.name || '', description: values.description || '', actualConditions: makeValueFields(values.actualConditions), measurements: makeValueFields(values.measurements) };
        const id = record ? (updateRecord(experiment.id, recordInput), record.id) : ensureRecord(experiment.id, recordInput);
        await uploadRawFiles(experiment.id, pendingFiles);
        if (id) message.success(record ? '试验记录已更新' : '唯一试验记录已创建');
      }
      if (dialog === 'chart' && experiment) {
        const input = { name: values.name || '', rawFileId: values.rawFileId || '', xField: values.xField || '', yField: values.yField || '', chartType: values.chartType || 'line', startRow: Math.max(0, Number(values.startRow ?? 1) - 1), endRow: Number(values.endRow ?? 0), scale: Number(values.scale ?? 1), offset: Number(values.offset ?? 0), color: values.color || '#1677ff', smooth: Boolean(values.smooth), modelId: values.modelId || undefined, modelInputs: values.modelId ? makeValueFields(values.modelInputs) : undefined } as Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>;
        if (!record?.rawFiles.some(file => file.id === input.rawFileId && file.headers.includes(input.xField) && file.headers.includes(input.yField))) throw new Error('请选择 CSV 原始文件及有效的 X、Y 轴字段');
        if (input.endRow > 0 && input.endRow <= input.startRow) throw new Error('结束行必须大于或等于起始行');
        const parsed = await readTrialFile(input.rawFileId);
        if (!buildChartPoints(parsed.rows, input.xField, input.yField, input).length) throw new Error('当前字段范围内没有可绘制的数值');
        saveChart(experiment.id, input, editingChartId); message.success(editingChartId ? '图表配置已更新' : '图表已保存');
      }
      if (dialog === 'model' && configuration) {
        addModel(configuration.id, { name: values.name || '', description: values.description || '', inputs: makeValueFields(values.inputs), outputs: makeValueFields(values.outputs), defaults: [], method: values.method || '' }); message.success('模型定义已保存');
      }
      setDialog(null);
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };
  const editRecord = () => startDialog('record', record ? { name: record.name, description: record.description, actualConditions: record.actualConditions, measurements: record.measurements } : { name: `${experiment?.name || '试验'}记录`, actualConditions: [], measurements: [] });
  const openChart = (chart?: DerivedChart) => {
    if (!experiment) return;
    setEditingChartId(chart?.id);
    startDialog('chart', chart ? { ...chart, startRow: chart.startRow + 1 } : { name: `C${String((record?.charts.length ?? 0) + 1).padStart(3, '0')}`, chartType: 'line', startRow: 1, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
    if (chart) {
      const file = record?.rawFiles.find(item => item.id === chart.rawFileId);
      setChartHeaders(file?.headers ?? []);
    } else setChartHeaders([]);
    setChartDataError('');
  };
  const loadChartHeaders = (fileId: string) => {
    const file = record?.rawFiles.find(item => item.id === fileId);
    const headers = file?.headers ?? [];
    setChartHeaders(headers);
    setChartDataError(headers.length ? '' : '此文件没有可绘制的 CSV 字段');
    form.setFieldsValue({ xField: headers[0], yField: headers.find(header => header !== headers[0]) ?? headers[0] });
  };
  const renderFields = (items: ValueField[]) => items.length ? <div className="physical-field-list">{items.map(item => <div className="physical-field-row" key={item.id}><span>{item.name}</span><strong>{item.value || '—'} {item.unit}</strong><Tag>{item.form}</Tag>{item.description && <Text type="secondary">{item.description}</Text>}</div>)}</div> : <Text type="secondary">暂无</Text>;
  const familyOptions = objects.map(item => ({ value: item.id, label: item.name }));
  const configOptions = family?.configurations.map(item => ({ value: item.id, label: item.name })) ?? [];
  const creationItems = [
    { key: 'family', label: '物理对象' },
    { key: 'configuration', label: '具体构型', disabled: !family },
    { key: 'experiment', label: '试验构型', disabled: !configuration },
  ];

  const dialogContent = () => <Form form={form} layout="vertical" onFinish={submit}>
    {(dialog === 'family' || dialog === 'configuration' || dialog === 'experiment' || dialog === 'model') && <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }]}><Input autoFocus /></Form.Item>}
    {dialog === 'family' && <><Form.Item name="type" label="对象类别"><Select showSearch options={['涵道风扇', '电推进', '电机', '自定义对象'].map(value => ({ value }))} /></Form.Item><Form.Item name="description" label="描述"><Input /></Form.Item></>}
    {dialog === 'configuration' && <Form.Item name="description" label="描述"><Input /></Form.Item>}
    {dialog === 'parameter' && <><Form.Item name="description" label="描述"><Input /></Form.Item><Form.Item name="name" label="参数名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Space><Form.Item name="value" label="内容" rules={[{ required: true }]}><Input.TextArea autoSize={{ minRows: 1, maxRows: 4 }} /></Form.Item><Form.Item name="unit" label="单位"><Input /></Form.Item><Form.Item name="form" label="形式" initialValue="单值"><Select options={['单值', '分组', '表格', '序列', '文件'].map(value => ({ value }))} /></Form.Item></Space></>}
    {dialog === 'design' && <><Form.Item name="name" label="名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Form.Item name="description" label="适用说明"><Input /></Form.Item><DesignFieldList /></>}
    {dialog === 'experiment' && <><Form.Item name="category" label="类别" initialValue="性能与功能类"><Select options={['环境适应性类', '力学环境与可靠性类', '性能与功能类', '安全与防护类', '综合与考核类'].map(value => ({ value }))} /></Form.Item><Form.Item name="taskBookId" label="任务书（可选）"><Select allowClear placeholder="独立开展" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item><Form.Item name="designArtifactId" label="设计方案（可选，引用已保存成果）"><Select allowClear options={designArtifacts.map(artifact => ({ value: artifact.id, label: `${artifact.title} · ${artifactResultLabel(artifact)}` }))} /></Form.Item><FieldList name="settings" label="试验设置" initialValue={[]} /><FieldList name="parameters" label="试验参数" initialValue={[]} /></>}
    {dialog === 'record' && <><Form.Item name="name" label="记录名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Form.Item name="description" label="说明"><Input /></Form.Item><FieldList name="actualConditions" label="实际试验条件" initialValue={record?.actualConditions ?? []} /><FieldList name="measurements" label="测量结果" initialValue={record?.measurements ?? []} /><div className="physical-upload-section"><Text strong>原始数据文件（CSV 可用于作图，可多选）</Text><Upload multiple disabled={saving} fileList={pendingFiles.map(file => ({ uid: file.uid, name: file.name, originFileObj: file }))} beforeUpload={file => { setPendingFiles(items => [...items, file]); return false; }} onRemove={file => setPendingFiles(items => items.filter(item => item.uid !== file.uid))}><Button icon={<FileAddOutlined />}>选择原始文件</Button></Upload>{record?.rawFiles.map(file => <div className="physical-file-row" key={file.id}><span>{file.name}</span><Text type="secondary">{file.rowCount ? `${file.rowCount} 行 · ${file.headers.join('、')}` : '已关联原始文件'}</Text></div>)}</div></>}
    {dialog === 'chart' && <><Form.Item name="name" label="图表名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Form.Item name="rawFileId" label="原始记录文件" rules={[{ required: true, message: '选择原始文件' }]}><Select onChange={loadChartHeaders} options={record?.rawFiles.filter(file => file.headers.length).map(file => ({ value: file.id, label: `${file.name}（${file.rowCount} 行）` })) ?? []} /></Form.Item>{chartDataError && <Alert type="error" message={chartDataError} />}{chartHeaders.length > 0 && <><Space align="start"><Form.Item name="xField" label="X 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="yField" label="Y 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="chartType" label="图形"><Select options={[{ value: 'line', label: '折线' }, { value: 'scatter', label: '散点' }, { value: 'bar', label: '柱状' }]} /></Form.Item></Space><Space align="start"><Form.Item name="startRow" label="起始行（从 1 开始）"><InputNumber min={1} precision={0} /></Form.Item><Form.Item name="endRow" label="结束行（0 表示末尾）"><InputNumber min={0} precision={0} /></Form.Item><Form.Item name="scale" label="Y 缩放"><InputNumber step={0.1} /></Form.Item><Form.Item name="offset" label="Y 偏移"><InputNumber step={0.1} /></Form.Item><Form.Item name="color" label="颜色"><Input type="color" /></Form.Item></Space><Form.Item name="smooth" label="曲线平滑"><Select options={[{ value: true, label: '平滑' }, { value: false, label: '直线' }]} /></Form.Item><Form.Item name="modelId" label="模型（可选）"><Select allowClear placeholder="不使用模型" onChange={value => form.setFieldsValue({ modelInputs: configuration?.models.find(model => model.id === value)?.inputs.map(input => ({ ...input, value: input.value || '' })) ?? [] })} options={configuration?.models.map(model => ({ value: model.id, label: model.name })) ?? []} /></Form.Item>{selectedModelId && <><Alert type="info" showIcon message="仅保存模型与输入配置；模型计算暂未接入。" /><FieldList name="modelInputs" label="本次模型输入" initialValue={configuration?.models.find(model => model.id === selectedModelId)?.inputs.map(input => ({ ...input, value: '' })) ?? []} /></>}</>}</>}
    {dialog === 'model' && <><Form.Item name="description" label="说明"><Input /></Form.Item><FieldList name="inputs" label="输入参数" initialValue={[]} /><FieldList name="outputs" label="输出参数" initialValue={[]} /><Form.Item name="method" label="方法说明"><Input /></Form.Item></>}
  </Form>;

  const title: Record<Exclude<Dialog, null>, string> = { family: '新建物理对象', configuration: `在${family?.name ?? ''}下新建构型`, parameter: '新增技术参数', design: '新增设计工况与要求', experiment: `在${configuration?.name ?? ''}下新建试验构型`, record: record ? '编辑唯一试验记录' : `为${experiment?.name ?? ''}创建唯一试验记录`, chart: editingChartId ? '编辑图表配置' : '新建图表', model: '新增模型定义' };
  return <div className="physical-page">
    <div className="physical-heading"><div><div className="workspace-kicker">试验工作表</div><Title level={3}>物理对象与试验数据</Title></div><Dropdown menu={{ items: creationItems, onClick: ({ key }) => startDialog(key as Exclude<Dialog, 'parameter' | 'design' | 'record' | 'chart' | 'model' | null>) }} trigger={['click']}><Button type="primary" icon={<PlusOutlined />}>新建</Button></Dropdown></div>
    {sourceUnavailable && <Alert type="error" showIcon message="业务来源已失效；请选择已有对象、构型或记录，不会自动改用其他数据。" />}
    <Card className="physical-workspace-card" bordered={false}>
      <Tabs activeKey={activeTab} onChange={changeTab} items={[
        { key: 'objects', label: '对象与试验', children: family ? <div className="physical-flow-layout"><aside className="physical-flow-tree"><div className="physical-select-label">物理对象</div><Select value={family.id} options={familyOptions} onChange={value => setParams({ objectId: value })} /><div className="physical-select-label">具体构型</div><Select value={configuration?.id} options={configOptions} placeholder="暂无构型" onChange={value => setParams({ objectId: family.id, configurationId: value })} /><div className="physical-object-summary"><Tag color="blue">{family.type}</Tag>{family.description}</div></aside><main className="physical-flow-main">{configuration ? <><div className="physical-config-title"><div><Text type="secondary">{family.name}</Text><Title level={4}>{configuration.name}</Title>{configuration.description && <Text>{configuration.description}</Text>}</div><Space><Button onClick={() => startDialog('model')}>模型定义</Button></Space></div>
          <Card size="small" title="技术参数" extra={<Button size="small" onClick={() => startDialog('parameter')}>新增参数</Button>}>{configuration.parameters.length ? <div className="physical-field-list">{configuration.parameters.map(item => <div className="physical-field-row" key={item.id}><span>{item.name}</span><strong>{item.value || '—'} {item.unit}</strong><Tag>{item.form}</Tag>{item.description && <Text type="secondary">{item.description}</Text>}</div>)}</div> : <Text type="secondary">暂无参数</Text>}</Card>
          <Card size="small" title="设计工况与要求" extra={<Button size="small" onClick={() => startDialog('design')}>新增</Button>}>{configuration.designs.length ? configuration.designs.map((design: DesignCase) => <div className="physical-design-case" key={design.id}><strong>{design.name}</strong>{design.description && <Text type="secondary">{design.description}</Text>}{design.fields.map(field => <div className="physical-field-row" key={field.id}><Tag color={field.usage === '要求' ? 'orange' : 'blue'}>{field.usage}</Tag><span>{field.name}</span><strong>{field.comparison ? `${field.comparison} ` : ''}{field.value} {field.unit}</strong></div>)}</div>) : <Text type="secondary">暂无工况与要求</Text>}</Card>
          {designArtifacts.length > 0 && <Card size="small" title="已有设计方案">{designArtifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Space wrap><strong>{artifact.title}</strong><Tag>{artifactResultLabel(artifact)}</Tag><Button size="small" onClick={() => startDialog('experiment', { name: `${artifact.title} · 试验`, designArtifactId: artifact.id })}>用于新试验构型</Button></Space><Text type="secondary">{artifact.summary}</Text></div>)}</Card>}
          <div className="physical-experiment-heading"><Title level={5}>试验构型</Title></div>
          {configuration.experiments.length ? configuration.experiments.map(item => { const currentRecord = item.id === experimentId ? record : item.record; return <Card key={item.id} className="physical-experiment-card" title={<Space>{item.name}<Tag>{item.category}</Tag>{item.taskBookId && <Tag color="purple">{tasks.find(task => task.id === item.taskBookId)?.title ?? '任务书'}</Tag>}</Space>} extra={<Button type="link" onClick={() => setParams({ objectId: family.id, configurationId: configuration.id, experimentId: item.id })}>查看</Button>}>
            {item.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === item.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === item.designArtifactRef?.artifactId)} />}
            <div className="physical-plan-fields"><div><Text type="secondary">试验设置</Text>{renderFields(item.settings)}</div><div><Text type="secondary">试验参数</Text>{renderFields(item.parameters)}</div></div>
            {item.id === experimentId && <div className="physical-record-section">{isArchivedRecord && <Alert type="info" message="正在查看旧版历史记录；历史记录只读，专业引用保留原记录 ID。" />}<div className="physical-record-heading"><div><Text type="secondary">{isArchivedRecord ? '旧版历史记录' : '唯一试验记录'}</Text><div>{currentRecord ? <Space><strong>{currentRecord.name}</strong><Tag color="green">已建立</Tag></Space> : <Text type="secondary">尚未建立</Text>}</div></div><Button type={currentRecord ? 'default' : 'primary'} disabled={isArchivedRecord || sourceUnavailable} onClick={editRecord}>{currentRecord ? '编辑记录' : '创建记录'}</Button></div>
              {currentRecord && <><div className="physical-record-columns"><div><Text strong>实际条件</Text>{renderFields(currentRecord.actualConditions)}</div><div><Text strong>测量结果</Text>{renderFields(currentRecord.measurements)}</div></div><div className="physical-file-row"><Space><FileAddOutlined /><strong>原始文件</strong><Tag>{currentRecord.rawFiles.length}</Tag></Space><span>{currentRecord.rawFiles.map(file => `${file.name} · ${file.rowCount} 行`).join('；') || '暂无文件'}</span><Button size="small" disabled={isArchivedRecord || sourceUnavailable} onClick={editRecord}>添加文件</Button></div><Space wrap className="physical-record-actions">{Object.entries(capabilityNames).map(([key, label]) => <Button key={key} size="small" onClick={() => launchCapability(key)}>{label}</Button>)}</Space><div className="physical-charts-heading"><Title level={5}><BarChartOutlined /> 衍生图表</Title><Button type="primary" size="small" disabled={isArchivedRecord || sourceUnavailable || !currentRecord.rawFiles.length} onClick={() => openChart()}>新建图表</Button></div>
                {currentRecord.charts.length ? <div className="physical-charts-grid">{currentRecord.charts.map(chart => <Card key={chart.id} size="small" title={<Space>{chart.name}<Tag>{chart.id.slice(-4).toUpperCase()}</Tag></Space>} extra={<Button type="link" disabled={isArchivedRecord || sourceUnavailable} onClick={() => openChart(chart)}>配置</Button>}><Text type="secondary">{currentRecord?.rawFiles.find(file => file.id === chart.rawFileId)?.name} · {chart.xField} / {chart.yField}</Text><TrialChart chart={chart} rawFile={currentRecord?.rawFiles.find(file => file.id === chart.rawFileId)} /></Card>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图表" />}</>}
              {item.archivedRecords?.length ? <Card size="small" title="旧版历史记录">{item.archivedRecords.map(archive => <div className="physical-design-case" key={archive.id}><strong>{archive.name}</strong><Text type="secondary">{archive.createdAt}</Text>{renderFields(archive.measurements)}</div>)}</Card> : null}
            </div>}
          </Card>; }) : <Empty description="先在当前构型下新建试验构型" />}
          {configuration.models.length > 0 && <Card size="small" title="可选模型定义" className="physical-model-list">{configuration.models.map(model => <div key={model.id}><strong>{model.name}</strong><Text type="secondary">{model.method || model.description}</Text></div>)}</Card>}
        </> : <Empty description="当前物理对象暂无具体构型"><Button type="primary" onClick={() => startDialog('configuration')}>新建具体构型</Button></Empty>}</main></div> : <Empty description="先新建物理对象和具体构型" /> },
        { key: 'taskbooks', label: '任务书视图', children: <TaskBookView projects={projects} sessions={sessions} entries={allEntries} tasks={tasks} navigate={navigate} taskId={params.get('taskId') || ''} onTaskChange={value => setParams(value ? { view: 'taskbooks', taskId: value } : { view: 'taskbooks' })} /> },
        { key: 'tools', label: '专业功能', children: <div className="physical-tool-grid">{Object.entries(capabilityNames).map(([key, label]) => <Card key={key} size="small" title={label}><Text type="secondary">{hasConfigurationContext && key === 'analysis' && record ? `当前记录：${record.name}` : hasConfigurationContext ? `当前构型：${configuration?.name}` : '独立使用'}</Text><Button type="primary" block onClick={() => launchCapability(key, !hasConfigurationContext)}>打开</Button></Card>)}</div> },
      ]} />
    </Card>
    <Modal title={dialog ? title[dialog] : ''} open={Boolean(dialog)} onCancel={() => { if (!saving) setDialog(null); }} onOk={() => form.submit()} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" destroyOnHidden width={dialog === 'chart' || dialog === 'record' ? 820 : 640} okButtonProps={{ icon: <SaveOutlined /> }}>{dialogContent()}</Modal>
  </div>;
};

function TaskBookView({ entries, tasks, projects, sessions, navigate, taskId, onTaskChange }: {
  entries: Array<{ object: PhysicalObject; config: PhysicalConfiguration; experiment: PhysicalConfiguration['experiments'][number] }>;
  tasks: ReturnType<typeof useTaskStore.getState>['tasks'];
  projects: ReturnType<typeof useProjectStore.getState>['projects'];
  sessions: ReturnType<typeof useSessionStore.getState>['sessions'];
  navigate: ReturnType<typeof useNavigate>; taskId: string; onTaskChange: (id: string) => void;
}) {
  const task = tasks.find(item => item.id === taskId);
  const selected = entries.filter(item => item.experiment.taskBookId === taskId);
  return <div className="physical-taskbook-view"><Card title="任务书关联"><Select allowClear value={taskId || undefined} onChange={value => onTaskChange(value || '')} placeholder="选择任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} style={{ width: '100%' }} />
    {task && <><Text type="secondary">关联 ID：{task.id} · {task.sourceName || '无附件'}。仅关联试验，不解析或执行。</Text>{task.requirements.length > 0 && <Button type="link" onClick={() => navigate(`/tasks/${encodeURIComponent(task.id)}`)}>查看历史任务工作台</Button>}</>}
  </Card><div className="physical-book-tests">{taskId ? selected.length ? selected.map(item => {
    const scope = { physicalObjectId: item.config.id, experimentId: item.experiment.id, testRecordId: item.experiment.record?.id };
    const artifacts = getSourceArtifacts(projects, sessions, scope);
    const workSession = sessions.find(session => session.businessScope?.physicalObjectId === item.config.id && session.businessScope?.experimentId === item.experiment.id && session.businessScope?.testRecordId === item.experiment.record?.id);
    return <Card key={item.experiment.id} title={item.experiment.name}>
      <Text type="secondary">{item.object.name} / {item.config.name} · {item.experiment.category}</Text>
      <div className="physical-task-record">{item.experiment.record ? <><strong>{item.experiment.record.name}</strong><Text type="secondary">{item.experiment.record.measurements.length} 项测量 · {item.experiment.record.rawFiles.length} 个原始文件 · {item.experiment.record.charts.length} 张图表</Text><Button type="link" onClick={() => navigate(`/physical-objects?objectId=${encodeURIComponent(item.object.id)}&configurationId=${encodeURIComponent(item.config.id)}&experimentId=${encodeURIComponent(item.experiment.id)}`)}>查看同一记录与成果</Button></> : <Text type="secondary">尚无试验记录</Text>}</div>
      {item.experiment.record?.charts.map(chart => <Tag key={chart.id}>{chart.name} · {chart.xField} / {chart.yField}</Tag>)}
      {artifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Space><Text>{artifact.title}</Text><Tag>{artifactResultLabel(artifact)}</Tag></Space></div>)}
      {workSession && <Button onClick={() => { useProjectStore.getState().setActiveProject(workSession.storageProjectId); navigate(getSessionPath(workSession.id, 'resources')); }}>查看专业成果</Button>}
    </Card>;
  }) : <Empty description="此任务书尚未关联试验构型" /> : <Empty description="选择任务书查看关联的同一试验与成果" />}</div></div>;
}

export default PhysicalObjectsPage;
