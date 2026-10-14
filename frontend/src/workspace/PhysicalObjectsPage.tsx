import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Tabs, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { BarChartOutlined, FileAddOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TrialChart from './TrialChart';
import { artifactResultLabel, getSourceArtifacts } from './physicalBusinessContext';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact } from './types';
import { isExperimentSetupLocked, usePhysicalObjectStore, type ConcreteTrial, type DerivedChart, type DesignField, type ExperimentDefinition, type PhysicalConfiguration, type PhysicalObject, type RawDataFile, type ValueField } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type PhysicalBusinessScope, type SessionCapability } from './sessionModel';
import { buildChartPoints, parseTrialCsv, readTrialFile, saveTrialFile } from './trialDataFiles';
import './physicalObjects.css';

const { Text, Title } = Typography;
type Dialog = 'family' | 'configuration' | 'parameter' | 'experiment' | 'trial' | 'record' | 'chart' | 'model' | null;
type FieldValue = { id?: string; name: string; description?: string; unit?: string; form?: ValueField['form']; value?: string };
type DesignFormField = FieldValue & { usage?: DesignField['usage']; comparison?: DesignField['comparison'] };
type FormSubmission = {
  name?: string; description?: string; type?: string; category?: string; taskBookId?: string; designArtifactId?: string;
  settings?: FieldValue[]; parameters?: FieldValue[]; actualConditions?: FieldValue[]; measurements?: FieldValue[]; fields?: DesignFormField[];
  form?: ValueField['form']; value?: string; unit?: string; inputs?: FieldValue[]; outputs?: FieldValue[]; method?: string;
  rawFileId?: string; xField?: string; yField?: string; chartType?: DerivedChart['chartType']; startRow?: number; endRow?: number;
  scale?: number; offset?: number; color?: string; smooth?: boolean; modelId?: string; modelInputs?: FieldValue[];
};
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function FieldList({ name, label, initialValue = [], disabled = false }: { name: string; label: string; initialValue?: FieldValue[]; disabled?: boolean }) {
  return <Form.List name={name} initialValue={initialValue}>{(fields, { add, remove }) => <div className="physical-form-list"><Text strong>{label}</Text>{fields.map(({ key, name: index, ...rest }) => <div className="physical-form-row physical-compact-row" key={key}>
    <Form.Item {...rest} name={[index, 'id']} hidden><Input /></Form.Item>
    <Form.Item {...rest} name={[index, 'name']} rules={[{ required: true, message: '填写名称' }]}><Input disabled={disabled} placeholder="名称" /></Form.Item>
    <Form.Item {...rest} name={[index, 'value']}><Input disabled={disabled} placeholder="内容" /></Form.Item>
    <Form.Item {...rest} name={[index, 'unit']}><Input disabled={disabled} placeholder="单位" /></Form.Item>
    <Form.Item {...rest} name={[index, 'description']}><Input disabled={disabled} placeholder="描述（可选）" /></Form.Item>
    <Button type="text" disabled={disabled} danger onClick={() => remove(index)}>删除</Button>
  </div>)}<Button type="dashed" disabled={disabled} icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '' })}>添加一行</Button></div>}</Form.List>;
}

function ParameterList({ initialValue = [] }: { initialValue?: FieldValue[] }) {
  return <Form.List name="parameters" initialValue={initialValue.length ? initialValue : [{ name: '', value: '', unit: '', description: '' }]}>{(fields, { add, remove }) => <div className="physical-parameter-list">{fields.map(({ key, name, ...rest }) => <div className="physical-parameter-entry" key={key}>
    <Form.Item {...rest} name={[name, 'id']} hidden><Input /></Form.Item>
    <div className="physical-parameter-row"><Form.Item {...rest} name={[name, 'name']} rules={[{ required: true, whitespace: true, message: '填写参数名称' }]}><Input aria-label="参数名称" placeholder="参数名称" /></Form.Item><span className="physical-parameter-separator">|</span><Form.Item {...rest} name={[name, 'value']} rules={[{ required: true, whitespace: true, message: '填写参数内容' }]}><Input aria-label="参数内容" placeholder="参数内容，如 1200" /></Form.Item><Form.Item {...rest} name={[name, 'unit']}><Input aria-label="单位" placeholder="单位，如 r/min" /></Form.Item><Button aria-label="增加参数行" title="增加参数行" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', description: '' }, name + 1)} /></div>
    <Form.Item {...rest} name={[name, 'description']} className="physical-parameter-description"><Input placeholder="描述（可选）" aria-label="参数描述" /></Form.Item>
    <Button type="link" danger onClick={() => remove(name)} disabled={fields.length === 1}>删除</Button>
  </div>)}</div>}</Form.List>;
}

function DesignFieldList() {
  return <Form.List name="fields" initialValue={[{ name: '', value: '', unit: '', usage: '条件', comparison: '' }]}>{(fields, { add, remove }) => <div className="physical-form-list"><Text strong>本次设计工况与要求</Text>{fields.map(({ key, name, ...rest }) => <div className="physical-form-row physical-design-row" key={key}>
    <Form.Item {...rest} name={[name, 'id']} hidden><Input /></Form.Item>
    <Form.Item {...rest} name={[name, 'name']} rules={[{ required: true, message: '填写名称' }]}><Input placeholder="名称" /></Form.Item><Form.Item {...rest} name={[name, 'value']}><Input placeholder="目标值" /></Form.Item><Form.Item {...rest} name={[name, 'unit']}><Input placeholder="单位" /></Form.Item><Form.Item {...rest} name={[name, 'usage']}><Select options={['条件', '参考', '要求'].map(value => ({ value }))} /></Form.Item><Form.Item {...rest} name={[name, 'comparison']}><Select allowClear placeholder="比较方式" options={['目标', '下限', '上限', '区间'].map(value => ({ value }))} /></Form.Item><Button type="text" danger onClick={() => remove(name)}>删除</Button>
  </div>)}<Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', usage: '条件' })}>添加工况字段</Button></div>}</Form.List>;
}

const normalizeFields = (items: FieldValue[] = [], previous: ValueField[] = []): ValueField[] => items.filter(item => item.name?.trim()).map(item => {
  const original = previous.find(field => field.id === item.id);
  return { ...original, id: item.id || `field-${uuid()}`, name: item.name.trim(), value: item.value ?? '', unit: item.unit ?? '', description: item.description ?? '', form: item.form ?? original?.form ?? '单值' };
});
const renderFields = (items: ValueField[]) => items.length ? <div className="physical-field-list">{items.map(item => <div className="physical-field-row" key={item.id}><Tooltip title={item.description || undefined}><span className={item.description ? 'physical-field-name has-description' : ''}>{item.name}</span></Tooltip><strong>{item.value || '—'} {item.unit}</strong></div>)}</div> : <Text type="secondary">暂无</Text>;

function ReferencedDesign({ artifact }: { artifact?: ProjectArtifact }) {
  return artifact ? <Card size="small" title={<Space>引用设计方案：{artifact.title}<Tag>{artifactResultLabel(artifact)}</Tag></Space>}><Text type="secondary">{artifact.summary}</Text><div><Text type="secondary">作为本次试验的输入引用，不自动生成设置或记录。</Text></div></Card> : null;
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
  const updateField = usePhysicalObjectStore(state => state.updateField);
  const addExperiment = usePhysicalObjectStore(state => state.addExperiment);
  const updateExperiment = usePhysicalObjectStore(state => state.updateExperiment);
  const addConcreteTrial = usePhysicalObjectStore(state => state.addConcreteTrial);
  const updateConcreteTrial = usePhysicalObjectStore(state => state.updateConcreteTrial);
  const ensureRecord = usePhysicalObjectStore(state => state.ensureTrialRecord);
  const updateRecord = usePhysicalObjectStore(state => state.updateTrialRecord);
  const addRawFile = usePhysicalObjectStore(state => state.addRawFile);
  const saveChart = usePhysicalObjectStore(state => state.saveChart);
  const addModel = usePhysicalObjectStore(state => state.addModel);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingParameterId, setEditingParameterId] = useState<string>();
  const [editingTrialId, setEditingTrialId] = useState<string>();
  const [editingExperimentId, setEditingExperimentId] = useState<string>();
  const [editingChartId, setEditingChartId] = useState<string>();
  const [pendingFiles, setPendingFiles] = useState<RcFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartHeaders, setChartHeaders] = useState<string[]>([]);
  const [chartDataError, setChartDataError] = useState('');
  const [form] = Form.useForm();
  const selectedModelId = Form.useWatch('modelId', form);
  const createIntent = params.get('create');
  const requestedObjectId = params.get('objectId') || '';
  const family = requestedObjectId ? objects.find(item => item.id === requestedObjectId || item.configurations.some(config => config.id === requestedObjectId)) : undefined;
  const routeConfigurationId = family?.configurations.some(config => config.id === requestedObjectId) ? requestedObjectId : '';
  const configurationId = params.get('configurationId') || routeConfigurationId;
  const configuration = family?.configurations.find(item => item.id === configurationId);
  const experimentId = params.get('experimentId') || '';
  const experiment = configuration?.experiments.find(item => item.id === experimentId);
  const editingExperiment = configuration?.experiments.find(item => item.id === editingExperimentId);
  const setupLocked = Boolean(editingExperiment && isExperimentSetupLocked(editingExperiment));
  const trialId = params.get('trialId') || '';
  const trial = experiment?.trials?.find(item => item.id === trialId);
  const routeRecordId = params.get('recordId');
  const record = trial ? routeRecordId !== null ? [trial.record, ...(trial.archivedRecords ?? [])].find(item => item?.id === routeRecordId) : trial.record : undefined;
  const requestedRecordUnavailable = routeRecordId !== null && !record;
  const sourceUnavailable = Boolean(requestedObjectId && !family || params.get('configurationId') && !configuration || experimentId && !experiment || trialId && !trial || requestedRecordUnavailable);
  const isArchivedRecord = Boolean(record && record.id !== trial?.record?.id);
  const activeTab = params.get('view') === 'tools' ? 'tools' : params.get('view') === 'taskbooks' || params.has('taskId') ? 'taskbooks' : 'objects';
  const allEntries = useMemo(() => objects.flatMap(object => object.configurations.flatMap(config => config.experiments.flatMap(item => (item.trials ?? []).map(itemTrial => ({ object, config, experiment: item, trial: itemTrial }))))), [objects]);
  const startDialog = (next: Exclude<Dialog, null>, initial: Record<string, unknown> = {}) => { setDialog(next); setPendingFiles([]); setEditingParameterId(undefined); setEditingTrialId(undefined); setEditingExperimentId(undefined); form.resetFields(); if (Object.keys(initial).length) form.setFieldsValue(initial); };
  useEffect(() => {
    const intent = params.get('create');
    if (!intent || !['family', 'configuration', 'experiment'].includes(intent)) return;
    if ((intent === 'configuration' && !family) || (intent === 'experiment' && !configuration)) return;
    startDialog(intent as 'family' | 'configuration' | 'experiment');
    const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true });
  // Query intent is consumed once; current parent is derived from the remaining query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createIntent]);
  const capabilityNames: Record<string, string> = { doe: '智能试验设计', analysis: '数据分析', digitalTwin: '数字孪生', virtualCondition: '虚拟工况', report: '报告' };
  const capabilityPaths: Record<string, SessionCapability> = { doe: 'doe', analysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition', report: 'report' };
  const launchCapability = (key: string) => {
    if (sourceUnavailable) return message.error('业务来源已失效，请选择已有来源');
    const capability = capabilityPaths[key];
    const scope: PhysicalBusinessScope = { physicalObjectId: configuration?.id, physicalObjectName: configuration?.name, experimentId: experiment?.id, experimentName: experiment?.name, trialId: trial?.id, trialName: trial?.name, testRecordId: record?.id, testRecordName: record?.name, taskBookId: trial?.taskBookId, taskBookName: tasks.find(task => task.id === trial?.taskBookId)?.title };
    const id = useSessionStore.getState().ensurePhysicalSession(scope, `${configuration?.name ?? '工作'} · 专业工作`);
    useSessionStore.getState().openSession(id, capability); navigate(getSessionPath(id, capability));
  };
  const designArtifacts = projects.flatMap(project => project.artifacts.filter(artifact => {
    if (artifact.type !== 'design' || !configuration) return false;
    const explicit = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    return explicit ? explicit.physicalObjectId === configuration.id : sessions.some(session => session.storageProjectId === project.id && session.businessScope?.physicalObjectId === configuration.id);
  }));
  const submit = async (values: FormSubmission) => {
    if (sourceUnavailable && dialog !== 'family') return message.error('业务来源已失效，请选择已有来源');
    if (saving) return;
    setSaving(true);
    try {
      if (dialog === 'family') {
        const id = addRoot({ name: values.name || '', type: values.type || '自定义对象', description: values.description || '' });
        setParams({ objectId: id }); message.success('物理对象已创建');
      } else if (dialog === 'configuration' && family) {
        const id = addConfiguration(family.id, { name: values.name || '', description: values.description || '' });
        if (id) setParams({ objectId: family.id, configurationId: id }); message.success('具体构型已创建');
      } else if (dialog === 'parameter' && configuration) {
        const items = (values.parameters ?? []).filter(item => item.name?.trim()).map(item => ({ id: item.id, name: item.name!.trim(), description: item.description || '', unit: item.unit || '', form: item.id && editingParameterId ? configuration.parameters.find(field => field.id === item.id)?.form ?? '单值' : '单值', value: item.value || '' }));
        for (const item of items) {
          if (item.id && editingParameterId) updateField(configuration.id, 'parameters', editingParameterId, item);
          else addField(configuration.id, 'parameters', item);
        }
        message.success(items.length === 1 ? '参数已保存' : `已保存 ${items.length} 项参数`);
      } else if (dialog === 'experiment' && configuration) {
        if (editingExperimentId && !editingExperiment) throw new Error('试验构型来源已变化，请重新打开编辑。');
        const metadata = { name: values.name || '', description: values.description || '' };
        const input = setupLocked ? metadata : { ...metadata, category: values.category || '性能与功能类', settings: normalizeFields(values.settings, editingExperiment?.settings), parameters: normalizeFields(values.parameters, editingExperiment?.parameters) };
        const id = editingExperimentId ?? addExperiment(configuration.id, { ...metadata, category: values.category || '性能与功能类', settings: normalizeFields(values.settings), parameters: normalizeFields(values.parameters) });
        if (editingExperimentId) updateExperiment(editingExperimentId, input);
        setParams({ objectId: family!.id, configurationId: configuration.id, experimentId: id }); message.success(editingExperimentId ? '试验构型已更新' : '试验构型已创建');
      } else if (dialog === 'trial' && experiment) {
        const designArtifact = designArtifacts.find(item => item.id === values.designArtifactId);
        const designs: DesignField[] = (values.fields ?? []).filter(field => field.name?.trim()).map(field => ({ id: field.id || `field-${uuid()}`, name: field.name!.trim(), description: field.description || '', value: field.value || '', unit: field.unit || '', form: '单值', usage: field.usage || '条件', comparison: field.comparison || undefined }));
        const input = { name: values.name || '', description: values.description || '', taskBookId: values.taskBookId || undefined, designArtifactRef: designArtifact ? { projectId: designArtifact.projectId, artifactId: designArtifact.id } : editingTrialId ? trial?.designArtifactRef : undefined, designs };
        const id = editingTrialId ?? addConcreteTrial(experiment.id, input);
        if (editingTrialId) updateConcreteTrial(editingTrialId, input);
        setParams({ objectId: family!.id, configurationId: configuration!.id, experimentId: experiment.id, trialId: id }); message.success(editingTrialId ? '具体试验已更新' : '具体试验已创建');
      } else if (dialog === 'record' && trial) {
        const input = { name: values.name || '', description: values.description || '', actualConditions: normalizeFields(values.actualConditions), measurements: normalizeFields(values.measurements) };
        const id = record ? (updateRecord(trial.id, input), record.id) : ensureRecord(trial.id, input);
        await uploadRawFiles(trial.id, pendingFiles); if (id) message.success(record ? '试验记录已更新' : '唯一试验记录已创建');
      } else if (dialog === 'chart' && trial) {
        const input = { name: values.name || '', rawFileId: values.rawFileId || '', xField: values.xField || '', yField: values.yField || '', chartType: values.chartType || 'line', startRow: Math.max(0, Number(values.startRow ?? 1) - 1), endRow: Number(values.endRow ?? 0), scale: Number(values.scale ?? 1), offset: Number(values.offset ?? 0), color: values.color || '#1677ff', smooth: Boolean(values.smooth), modelId: values.modelId || undefined, modelInputs: values.modelId ? normalizeFields(values.modelInputs) : undefined } as Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>;
        if (!record?.rawFiles.some(file => file.id === input.rawFileId && file.headers.includes(input.xField) && file.headers.includes(input.yField))) throw new Error('请选择 CSV 原始文件及有效的 X、Y 轴字段');
        if (input.endRow > 0 && input.endRow <= input.startRow) throw new Error('结束行必须大于或等于起始行');
        const parsed = await readTrialFile(input.rawFileId); if (!buildChartPoints(parsed.rows, input.xField, input.yField, input).length) throw new Error('当前字段范围内没有可绘制的数值');
        saveChart(trial.id, input, editingChartId); message.success(editingChartId ? '图表配置已更新' : '图表已保存');
      } else if (dialog === 'model' && configuration) {
        addModel(configuration.id, { name: values.name || '', description: values.description || '', inputs: normalizeFields(values.inputs), outputs: normalizeFields(values.outputs), defaults: [], method: values.method || '' }); message.success('模型定义已保存');
      }
      setDialog(null);
    } catch (error) { message.error(error instanceof Error ? error.message : '保存失败'); }
    finally { setSaving(false); }
  };
  const uploadRawFiles = async (trialKey: string, files: RcFile[]) => {
    for (const file of files) {
      const fileId = `raw-${uuid()}`;
      let metadata: RawDataFile = { id: fileId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, addedAt: new Date().toISOString(), headers: [], rowCount: 0 };
      if (file.name.toLowerCase().endsWith('.csv')) { const parsed = parseTrialCsv(await file.text()); metadata = { ...metadata, headers: parsed.headers, rowCount: parsed.rows.length }; }
      await saveTrialFile(fileId, file); addRawFile(trialKey, metadata); setPendingFiles(items => items.filter(item => item.uid !== file.uid));
    }
  };
  const editRecord = () => startDialog('record', record ? { name: record.name, description: record.description, actualConditions: record.actualConditions, measurements: record.measurements } : { name: `${trial?.name || '具体试验'}记录`, actualConditions: [], measurements: [] });
  const openChart = (chart?: DerivedChart) => {
    if (!trial) return;
    setEditingChartId(chart?.id); startDialog('chart', chart ? { ...chart, startRow: chart.startRow + 1 } : { name: `C${String((record?.charts.length ?? 0) + 1).padStart(3, '0')}`, chartType: 'line', startRow: 1, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
    setChartHeaders(chart ? record?.rawFiles.find(item => item.id === chart.rawFileId)?.headers ?? [] : []); setChartDataError('');
  };
  const loadChartHeaders = (fileId: string) => { const headers = record?.rawFiles.find(item => item.id === fileId)?.headers ?? []; setChartHeaders(headers); setChartDataError(headers.length ? '' : '此文件没有可绘制的 CSV 字段'); form.setFieldsValue({ xField: headers[0], yField: headers.find(header => header !== headers[0]) ?? headers[0] }); };
  const dialogTitles: Record<Exclude<Dialog, null>, string> = { family: '新建物理对象', configuration: `在${family?.name ?? ''}下新建具体构型`, parameter: editingParameterId ? '编辑技术参数' : '新增技术参数', experiment: editingExperimentId ? '编辑试验构型' : `在${configuration?.name ?? ''}下新建试验构型`, trial: editingTrialId ? '编辑具体试验' : `在${experiment?.name ?? ''}下新建具体试验`, record: record ? '编辑唯一试验记录' : `为${trial?.name ?? ''}创建唯一试验记录`, chart: editingChartId ? '编辑图表配置' : '新建图表', model: '新增模型定义' };
  const dialogContent = () => <Form form={form} layout="vertical" onFinish={submit}>
    {['family', 'configuration', 'experiment', 'trial', 'model'].includes(dialog || '') && <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }]}><Input autoFocus /></Form.Item>}
    {dialog === 'family' && <><Form.Item name="type" label="对象类别"><Select options={['涵道风扇', '电推进', '电机', '自定义对象'].map(value => ({ value }))} /></Form.Item><Form.Item name="description" label="描述"><Input /></Form.Item></>}
    {dialog === 'configuration' && <Form.Item name="description" label="说明"><Input /></Form.Item>}
    {dialog === 'parameter' && <><Text type="secondary">名称、内容和单位按行填写；普通技术参数以单值保存。</Text><ParameterList initialValue={editingParameterId ? configuration?.parameters.filter(item => item.id === editingParameterId) : []} /></>}
    {dialog === 'experiment' && <><Form.Item name="description" label="说明"><Input /></Form.Item>{setupLocked && <Alert type="info" showIcon message="已有具体试验或历史记录，类别、共用设置与参数已锁定。名称和说明可修改；变更试验布置请新建试验构型。" />}<Form.Item name="category" label="试验类别" initialValue="性能与功能类"><Select disabled={setupLocked} options={['环境适应性类', '力学环境与可靠性类', '性能与功能类', '安全与防护类', '综合与考核类'].map(value => ({ value }))} /></Form.Item><FieldList name="settings" label="共用试验布置与设置" initialValue={[]} disabled={setupLocked} /><FieldList name="parameters" label="共用试验参数" initialValue={[]} disabled={setupLocked} /></>}
    {dialog === 'trial' && <><Form.Item name="description" label="说明"><Input /></Form.Item><Form.Item name="taskBookId" label="任务书（可选，仅关联 ID）"><Select allowClear placeholder="独立开展" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item><Form.Item name="designArtifactId" label="设计方案（可选，引用已保存成果）"><Select allowClear options={designArtifacts.map(artifact => ({ value: artifact.id, label: `${artifact.title} · ${artifactResultLabel(artifact)}` }))} /></Form.Item><DesignFieldList /></>}
    {dialog === 'record' && <><Form.Item name="name" label="记录名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Form.Item name="description" label="说明"><Input /></Form.Item><FieldList name="actualConditions" label="实际试验条件" initialValue={record?.actualConditions ?? []} /><FieldList name="measurements" label="测量结果" initialValue={record?.measurements ?? []} /><div className="physical-upload-section"><Text strong>原始数据文件（CSV 可用于作图，可多选）</Text><Upload multiple disabled={saving} fileList={pendingFiles.map(file => ({ uid: file.uid, name: file.name, originFileObj: file }))} beforeUpload={file => { setPendingFiles(items => [...items, file]); return false; }} onRemove={file => setPendingFiles(items => items.filter(item => item.uid !== file.uid))}><Button icon={<FileAddOutlined />}>选择原始文件</Button></Upload>{record?.rawFiles.map(file => <div className="physical-file-row" key={file.id}><span>{file.name}</span><Text type="secondary">{file.rowCount ? `${file.rowCount} 行 · ${file.headers.join('、')}` : '已关联文件'}</Text></div>)}</div></>}
    {dialog === 'chart' && <><Form.Item name="name" label="图表名称" rules={[{ required: true }]}><Input autoFocus /></Form.Item><Form.Item name="rawFileId" label="原始记录文件" rules={[{ required: true, message: '选择原始文件' }]}><Select onChange={loadChartHeaders} options={record?.rawFiles.filter(file => file.headers.length).map(file => ({ value: file.id, label: `${file.name}（${file.rowCount} 行）` })) ?? []} /></Form.Item>{chartDataError && <Alert type="error" message={chartDataError} />}{chartHeaders.length > 0 && <><Space align="start"><Form.Item name="xField" label="X 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="yField" label="Y 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="chartType" label="图形"><Select options={[{ value: 'line', label: '折线' }, { value: 'scatter', label: '散点' }, { value: 'bar', label: '柱状' }]} /></Form.Item></Space><Space align="start"><Form.Item name="startRow" label="起始行"><InputNumber min={1} precision={0} /></Form.Item><Form.Item name="endRow" label="结束行（0 表示末尾）"><InputNumber min={0} precision={0} /></Form.Item><Form.Item name="scale" label="Y 缩放"><InputNumber step={0.1} /></Form.Item><Form.Item name="offset" label="Y 偏移"><InputNumber step={0.1} /></Form.Item><Form.Item name="color" label="颜色"><Input type="color" /></Form.Item></Space><Form.Item name="smooth" label="曲线平滑"><Select options={[{ value: true, label: '平滑' }, { value: false, label: '直线' }]} /></Form.Item><Form.Item name="modelId" label="模型（可选）"><Select allowClear placeholder="不使用模型" onChange={value => form.setFieldsValue({ modelInputs: configuration?.models.find(model => model.id === value)?.inputs.map(input => ({ ...input, value: input.value || '' })) ?? [] })} options={configuration?.models.map(model => ({ value: model.id, label: model.name })) ?? []} /></Form.Item>{selectedModelId && <><Alert type="info" showIcon message="仅保存模型与输入配置；模型计算暂未接入。" /><FieldList name="modelInputs" label="本次模型输入" initialValue={configuration?.models.find(model => model.id === selectedModelId)?.inputs ?? []} /></>}</>}</>}
    {dialog === 'model' && <><Form.Item name="description" label="说明"><Input /></Form.Item><FieldList name="inputs" label="输入参数" initialValue={[]} /><FieldList name="outputs" label="输出参数" initialValue={[]} /><Form.Item name="method" label="方法说明"><Input /></Form.Item></>}
  </Form>;
  const setRoute = (next: Record<string, string>) => setParams(next);
  const configPage = (config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">{family?.name}</Text><Title level={4}>{config.name}</Title>{config.description && <Text>{config.description}</Text>}</div><Button onClick={() => startDialog('model')}>模型定义</Button></div>
    <Card size="small" title="技术参数" extra={<Button size="small" onClick={() => startDialog('parameter', { parameters: [{ name: '', value: '', unit: '', description: '' }] })}>新增参数</Button>}>{config.parameters.length ? <div className="physical-field-list">{config.parameters.map(item => <div className="physical-field-row" key={item.id}><Tooltip title={item.description || undefined}><span className={item.description ? 'physical-field-name has-description' : ''}>{item.name}</span></Tooltip><strong>{item.value || '—'} {item.unit}</strong><Button type="link" size="small" onClick={() => { startDialog('parameter', { parameters: [{ ...item }] }); setEditingParameterId(item.id); }}>编辑</Button></div>)}</div> : <Text type="secondary">暂无参数</Text>}</Card>
    {config.designs.length > 0 && <Card size="small" title="构型通用要求">{config.designs.map(design => <div key={design.id} className="physical-design-case"><strong>{design.name}</strong>{design.fields.map(field => <div className="physical-field-row" key={field.id}><Tag>{field.usage}</Tag><span>{field.name}</span><strong>{field.comparison ? `${field.comparison} ` : ''}{field.value} {field.unit}</strong></div>)}</div>)}</Card>}
    <Card size="small" title="试验构型" extra={<Button type="primary" size="small" onClick={() => startDialog('experiment', { settings: [], parameters: [] })}>新建试验构型</Button>}>{config.experiments.length ? config.experiments.map(item => <div className="physical-list-row" key={item.id}><div><strong>{item.name}</strong><div><Text type="secondary">{item.category} · {item.trials?.length ?? 0} 个具体试验</Text></div></div><Button onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id })}>打开</Button></div>) : <Text type="secondary">此构型尚无试验构型</Text>}</Card>
    {config.models.length > 0 && <Card size="small" title="可选模型定义">{config.models.map(model => <div key={model.id}><strong>{model.name}</strong> <Text type="secondary">{model.method || model.description}</Text></div>)}</Card>}
  </>;
  const experimentPage = (item: ExperimentDefinition, config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">{family?.name} / {config.name}</Text><Title level={4}>{item.name}</Title><Text type="secondary">试验构型 · {item.category}</Text>{item.description && <div><Text>{item.description}</Text></div>}</div><Button onClick={() => { startDialog('experiment', { name: item.name, description: item.description, category: item.category, settings: item.settings, parameters: item.parameters }); setEditingExperimentId(item.id); }}>编辑试验构型</Button></div>
    <div className="physical-level-back"><Button type="link" onClick={() => setRoute({ objectId: family!.id, configurationId: config.id })}>返回具体构型</Button></div>
    <Card size="small" title="共用试验布置与设置"><div className="physical-plan-fields"><div><Text type="secondary">设置</Text>{renderFields(item.settings)}</div><div><Text type="secondary">参数</Text>{renderFields(item.parameters)}</div></div></Card>
    <Card size="small" title="具体试验" extra={<Button type="primary" size="small" onClick={() => startDialog('trial', { name: '', fields: [{ name: '', value: '', unit: '', usage: '条件' }] })}>新建具体试验</Button>}>{item.trials?.length ? item.trials.map(entry => <div className="physical-list-row" key={entry.id}><div><strong>{entry.name}</strong><div><Text type="secondary">{entry.designs.length} 项设计工况与要求 · {entry.record ? '已有唯一记录' : '尚无记录'}</Text></div></div><Button onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id, trialId: entry.id })}>打开</Button></div>) : <Text type="secondary">本试验构型下还没有具体试验</Text>}</Card>
  </>;
  const trialPage = (entry: ConcreteTrial, item: ExperimentDefinition, config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">{family?.name} / {config.name} / {item.name}</Text><Title level={4}>{entry.name}</Title><Text type="secondary">具体试验</Text></div></div>
    <div className="physical-level-back"><Button type="link" onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id })}>返回试验构型</Button></div>
    {entry.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === entry.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === entry.designArtifactRef?.artifactId)} />}
    <Card size="small" title="本次设计工况与要求" extra={<Button size="small" onClick={() => { startDialog('trial', { name: entry.name, description: entry.description, taskBookId: entry.taskBookId, designArtifactId: entry.designArtifactRef?.artifactId, fields: entry.designs }); setEditingTrialId(entry.id); }}>编辑具体试验</Button>}>{entry.designs.length ? entry.designs.map(field => <div className="physical-field-row" key={field.id}><Tag color={field.usage === '要求' ? 'orange' : 'blue'}>{field.usage}</Tag><span>{field.name}</span><strong>{field.comparison ? `${field.comparison} ` : ''}{field.value} {field.unit}</strong></div>) : <Text type="secondary">未设置本次设计工况与要求</Text>}</Card>
    <Card size="small" title="实际记录" extra={!requestedRecordUnavailable && <Button type={record ? 'default' : 'primary'} disabled={isArchivedRecord || sourceUnavailable} onClick={editRecord}>{record ? '编辑记录 / 添加文件' : '创建唯一记录'}</Button>}>
      {isArchivedRecord && <Alert type="info" message="正在查看历史记录，当前只读。" />}{record ? <><div className="physical-record-heading"><strong>{record.name}</strong><Text type="secondary">记录 ID：{record.id}</Text></div><div className="physical-record-columns"><div><Text strong>实际条件</Text>{renderFields(record.actualConditions)}</div><div><Text strong>测量结果</Text>{renderFields(record.measurements)}</div></div><div className="physical-file-row"><Space><FileAddOutlined /><strong>原始文件</strong><Tag>{record.rawFiles.length}</Tag></Space><span>{record.rawFiles.map(file => `${file.name} · ${file.rowCount} 行`).join('；') || '暂无文件'}</span><Button size="small" disabled={isArchivedRecord || sourceUnavailable} onClick={editRecord}>添加文件</Button></div><Space wrap className="physical-record-actions">{Object.entries(capabilityNames).map(([key, label]) => <Button key={key} size="small" onClick={() => launchCapability(key)}>{label}</Button>)}</Space><div className="physical-charts-heading"><Title level={5}><BarChartOutlined /> 衍生图表</Title><Button type="primary" size="small" disabled={isArchivedRecord || sourceUnavailable || !record.rawFiles.length} onClick={() => openChart()}>新建图表</Button></div>{record.charts.length ? <div className="physical-charts-grid">{record.charts.map(chart => <Card key={chart.id} size="small" title={chart.name} extra={<Button type="link" disabled={isArchivedRecord || sourceUnavailable} onClick={() => openChart(chart)}>配置</Button>}><Text type="secondary">{record.rawFiles.find(file => file.id === chart.rawFileId)?.name} · {chart.xField} / {chart.yField}</Text><TrialChart chart={chart} rawFile={record.rawFiles.find(file => file.id === chart.rawFileId)} /></Card>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无图表" />}</> : <Text type="secondary">实际条件、测量结果和原始文件保存在本次试验唯一记录中。</Text>}
    </Card>
  </>;
  const objectPage = () => family ? <><div className="physical-config-title"><div><Text type="secondary">物理对象</Text><Title level={4}>{family.name}</Title><Text type="secondary">{family.type}{family.description ? ` · ${family.description}` : ''}</Text></div></div><Card size="small" title="具体构型" extra={<Button type="primary" size="small" onClick={() => startDialog('configuration')}>新建具体构型</Button>}>{family.configurations.length ? family.configurations.map(config => <div className="physical-list-row" key={config.id}><div><strong>{config.name}</strong><div><Text type="secondary">{config.description || `${config.parameters.length} 项技术参数 · ${config.experiments.length} 个试验构型`}</Text></div></div><Button onClick={() => setRoute({ objectId: family.id, configurationId: config.id })}>查看</Button></div>) : <Text type="secondary">尚无具体构型</Text>}</Card></> : <Empty description={objects.length ? '从左侧选择物理对象或具体构型。' : '尚无物理对象，请从左侧物理对象栏目旁的加号创建。'} />;
  const taskEntries = allEntries.filter(entry => entry.trial.taskBookId);
  const taskChildren = activeTab === 'taskbooks' ? <TaskBookView projects={projects} sessions={sessions} entries={taskEntries} tasks={tasks} navigate={navigate} taskId={params.get('taskId') || ''} onTaskChange={value => setParams(value ? { view: 'taskbooks', taskId: value } : { view: 'taskbooks' })} /> : undefined;
  return <div className="physical-page">
    <div className="physical-heading"><div><div className="workspace-kicker">试验工作表</div><Title level={3}>物理对象与试验数据</Title></div><div className="physical-current-context">{family?.name}{configuration && ` / ${configuration.name}`}{experiment && ` / ${experiment.name}`}{trial && ` / ${trial.name}`}</div></div>
    {sourceUnavailable && <Alert type="error" showIcon message={requestedRecordUnavailable ? '指定的试验记录不存在或已失效，未切换到其他记录。' : '业务来源已失效；请选择已有对象、构型或记录，不会自动改用其他数据。'} action={requestedRecordUnavailable && trial && experiment && configuration && family && <Button onClick={() => setRoute({ objectId: family.id, configurationId: configuration.id, experimentId: experiment.id, trialId: trial.id })}>返回所属具体试验</Button>} />}
    <Card className="physical-workspace-card" bordered={false}><Tabs activeKey={activeTab} onChange={key => { const next = new URLSearchParams(params); if (key === 'objects') next.delete('view'); else next.set('view', key); if (key !== 'taskbooks') next.delete('taskId'); setParams(next); }} items={[
      { key: 'objects', label: '对象与试验', children: <main className="physical-flow-main">{trial && experiment && configuration ? trialPage(trial, experiment, configuration) : experiment && configuration ? experimentPage(experiment, configuration) : configuration ? configPage(configuration) : objectPage()}</main> },
      { key: 'taskbooks', label: '任务书视图', children: taskChildren },
      { key: 'tools', label: '专业功能', children: <div className="physical-tool-grid">{Object.entries(capabilityNames).map(([key, label]) => <Card key={key} size="small" title={label}><Text type="secondary">{configuration ? `${trial ? `当前试验：${trial.name}` : `当前构型：${configuration.name}`}` : '独立使用'}</Text><Button type="primary" block onClick={() => launchCapability(key)}>打开</Button></Card>)}</div> },
    ]} /></Card>
    <Modal title={dialog ? dialogTitles[dialog] : ''} open={Boolean(dialog)} onCancel={() => { if (!saving) setDialog(null); }} onOk={() => form.submit()} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" destroyOnHidden width={dialog === 'chart' || dialog === 'record' ? 820 : 640} okButtonProps={{ icon: <SaveOutlined /> }}>{dialogContent()}</Modal>
  </div>;
};

function TaskBookView({ entries, tasks, projects, sessions, navigate, taskId, onTaskChange }: {
  entries: Array<{ object: PhysicalObject; config: PhysicalConfiguration; experiment: ExperimentDefinition; trial: ConcreteTrial }>;
  tasks: ReturnType<typeof useTaskStore.getState>['tasks']; projects: ReturnType<typeof useProjectStore.getState>['projects']; sessions: ReturnType<typeof useSessionStore.getState>['sessions']; navigate: ReturnType<typeof useNavigate>; taskId: string; onTaskChange: (id: string) => void;
}) {
  const selected = entries.filter(item => item.trial.taskBookId === taskId);
  return <div className="physical-taskbook-view"><Card title="任务书关联"><Select allowClear value={taskId || undefined} onChange={value => onTaskChange(value || '')} placeholder="选择任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} style={{ width: '100%' }} />{tasks.find(item => item.id === taskId) && <Text type="secondary">关联 ID：{taskId}。仅关联具体试验，不解析或执行。</Text>}</Card><div className="physical-book-tests">{taskId ? selected.length ? selected.map(item => {
    const scope = { physicalObjectId: item.config.id, experimentId: item.experiment.id, trialId: item.trial.id, testRecordId: item.trial.record?.id };
    const artifacts = getSourceArtifacts(projects, sessions, scope);
    const workSession = sessions.find(session => session.businessScope?.physicalObjectId === item.config.id && session.businessScope?.experimentId === item.experiment.id && session.businessScope?.trialId === item.trial.id);
    return <Card key={item.trial.id} title={item.trial.name}><Text type="secondary">{item.object.name} / {item.config.name} / {item.experiment.name}</Text><div className="physical-task-record">{item.trial.record ? <><strong>{item.trial.record.name}</strong><Text type="secondary">{item.trial.record.measurements.length} 项测量 · {item.trial.record.rawFiles.length} 个文件 · {item.trial.record.charts.length} 张图表</Text><Button type="link" onClick={() => navigate(`/physical-objects?objectId=${encodeURIComponent(item.object.id)}&configurationId=${encodeURIComponent(item.config.id)}&experimentId=${encodeURIComponent(item.experiment.id)}&trialId=${encodeURIComponent(item.trial.id)}`)}>查看同一记录与成果</Button></> : <Text type="secondary">尚无试验记录</Text>}</div>{item.trial.record?.charts.map(chart => <Tag key={chart.id}>{chart.name} · {chart.xField} / {chart.yField}</Tag>)}{artifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Space><Text>{artifact.title}</Text><Tag>{artifactResultLabel(artifact)}</Tag></Space></div>)}{workSession && <Button onClick={() => { useProjectStore.getState().setActiveProject(workSession.storageProjectId); navigate(getSessionPath(workSession.id, 'resources')); }}>查看专业成果</Button>}</Card>;
  }) : <Empty description="此任务书尚未关联具体试验" /> : <Empty description="选择任务书查看关联的同一试验与成果" />}</div></div>;
}

export default PhysicalObjectsPage;
