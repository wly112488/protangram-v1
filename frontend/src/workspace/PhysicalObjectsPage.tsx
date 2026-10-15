import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Tabs, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { BarChartOutlined, FileAddOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { useNavigate, useSearchParams } from 'react-router-dom';
import TrialChart from './TrialChart';
import TrialDataTable from './TrialDataTable';
import { artifactResultLabel, getSourceArtifacts, recordLabel } from './physicalBusinessContext';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact } from './types';
import { isExperimentSetupLocked, usePhysicalObjectStore, type ConcreteTrial, type DerivedChart, type DerivedTable, type ExperimentDefinition, type PhysicalConfiguration, type PhysicalObject, type RawDataFile, type ValueField } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type PhysicalBusinessScope, type SessionCapability } from './sessionModel';
import { buildChartPoints, parseTrialCsv, readTrialFile, saveTrialFile } from './trialDataFiles';
import './physicalObjects.css';

const { Text, Title } = Typography;
type Dialog = 'family' | 'configuration' | 'parameter' | 'experiment' | 'trial' | 'record' | 'chart' | 'table' | null;
type FieldValue = { id?: string; name: string; description?: string; unit?: string; form?: ValueField['form']; value?: string };
type FormSubmission = {
  name?: string; description?: string; type?: string; taskBookId?: string; designArtifactId?: string; loadSpectrum?: string; loadSpectrumDescription?: string;
  parameters?: FieldValue[];
  fields?: string[];
  rawFileId?: string; xField?: string; yField?: string; chartType?: DerivedChart['chartType']; startRow?: number; endRow?: number;
  scale?: number; offset?: number; color?: string; smooth?: boolean;
};
const uuid = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function ParameterList({ initialValue = [], disabled = false, allowEmpty = false }: { initialValue?: FieldValue[]; disabled?: boolean; allowEmpty?: boolean }) {
  return <Form.List name="parameters" initialValue={initialValue.length || allowEmpty || disabled ? initialValue : [{ name: '', value: '', unit: '', description: '' }]}>{(fields, { add, remove }) => <div className="physical-parameter-list">{fields.map(({ key, name, ...rest }) => <div className="physical-parameter-entry" key={key}>
    <Form.Item {...rest} name={[name, 'id']} hidden><Input /></Form.Item>
    <div className="physical-parameter-row"><Form.Item {...rest} name={[name, 'name']} rules={[{ required: true, whitespace: true, message: '填写参数名称' }]}><Input disabled={disabled} aria-label="参数名称" placeholder="参数名称" /></Form.Item><span className="physical-parameter-separator">|</span><Form.Item {...rest} name={[name, 'value']} rules={[{ required: true, whitespace: true, message: '填写参数内容' }]}><Input disabled={disabled} aria-label="参数内容" placeholder="参数内容，如 1200" /></Form.Item><Form.Item {...rest} name={[name, 'unit']}><Input disabled={disabled} aria-label="单位" placeholder="单位，如 r/min" /></Form.Item><Button disabled={disabled} aria-label="增加参数行" title="增加参数行" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', description: '' }, name + 1)} /></div>
    <Form.Item {...rest} name={[name, 'description']} className="physical-parameter-description"><Input disabled={disabled} placeholder="描述（可选）" aria-label="参数描述" /></Form.Item>
    <Button type="link" danger onClick={() => remove(name)} disabled={disabled || !allowEmpty && fields.length === 1}>删除</Button>
  </div>)}{!fields.length && !disabled && <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '', unit: '', description: '' })}>添加参数</Button>}</div>}</Form.List>;
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
  const addRecord = usePhysicalObjectStore(state => state.addTrialRecord);
  const updateRecord = usePhysicalObjectStore(state => state.updateTrialRecord);
  const addRawFile = usePhysicalObjectStore(state => state.addRawFile);
  const saveChart = usePhysicalObjectStore(state => state.saveChart);
  const saveTable = usePhysicalObjectStore(state => state.saveTable);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [editingParameterId, setEditingParameterId] = useState<string>();
  const [editingTrialId, setEditingTrialId] = useState<string>();
  const [editingExperimentId, setEditingExperimentId] = useState<string>();
  const [editingChartId, setEditingChartId] = useState<string>();
  const [editingTableId, setEditingTableId] = useState<string>();
  const [editingRecordId, setEditingRecordId] = useState<string>();
  const [pendingFiles, setPendingFiles] = useState<RcFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [chartHeaders, setChartHeaders] = useState<string[]>([]);
  const [chartDataError, setChartDataError] = useState('');
  const [form] = Form.useForm();
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
  const requestedTrialId = params.get('trialId');
  const routeRecordId = params.get('recordId');
  const trial = requestedTrialId !== null ? experiment?.trials.find(item => item.id === requestedTrialId) : routeRecordId !== null ? experiment?.trials.find(item => item.records.some(record => record.id === routeRecordId)) : undefined;
  const record = routeRecordId !== null ? trial?.records.find(item => item.id === routeRecordId) : trial?.records.length === 1 ? trial.records[0] : undefined;
  const requestedRecordUnavailable = routeRecordId !== null && !record;
  const sourceUnavailable = Boolean(requestedObjectId && !family || params.get('configurationId') && !configuration || experimentId && !experiment || requestedTrialId !== null && !trial || requestedRecordUnavailable);
  const activeTab = params.get('view') === 'tools' ? 'tools' : params.get('view') === 'taskbooks' || params.has('taskId') ? 'taskbooks' : 'objects';
  const allEntries = useMemo(() => objects.flatMap(object => object.configurations.flatMap(config => config.experiments.flatMap(item => (item.trials ?? []).map(itemTrial => ({ object, config, experiment: item, trial: itemTrial }))))), [objects]);
  const startDialog = (next: Exclude<Dialog, null>, initial: Record<string, unknown> = {}) => { setDialog(next); setPendingFiles([]); setEditingParameterId(undefined); setEditingTrialId(undefined); setEditingExperimentId(undefined); setEditingRecordId(undefined); setEditingChartId(undefined); setEditingTableId(undefined); form.resetFields(); if (Object.keys(initial).length) form.setFieldsValue(initial); };
  useEffect(() => {
    const intent = params.get('create');
    if (!intent || !['family', 'configuration', 'experiment', 'trial'].includes(intent)) return;
    if ((intent === 'configuration' && !family) || (intent === 'experiment' && !configuration) || (intent === 'trial' && !experiment)) return;
    startDialog(intent as 'family' | 'configuration' | 'experiment' | 'trial', intent === 'trial' ? { taskBookId: params.get('taskBookId') || undefined } : {});
    const next = new URLSearchParams(params); next.delete('create'); setParams(next, { replace: true });
  // Query intent is consumed once; current parent is derived from the remaining query.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createIntent]);
  const capabilityNames: Record<string, string> = { doe: '智能试验设计', analysis: '数据分析', digitalTwin: '数字孪生', virtualCondition: '虚拟工况', report: '报告' };
  const capabilityPaths: Record<string, SessionCapability> = { doe: 'doe', analysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition', report: 'report' };
  const launchCapability = (key: string) => {
    if (sourceUnavailable) return message.error('业务来源已失效，请选择已有来源');
    if (trial && trial.records.length > 1 && !record && key !== 'doe') return message.info('请先打开要使用的试验记录');
    const capability = capabilityPaths[key];
    const scope: PhysicalBusinessScope = { physicalObjectId: configuration?.id, physicalObjectName: configuration?.name, experimentId: experiment?.id, experimentName: experiment?.name, trialId: trial?.id, trialName: trial?.name, testRecordId: record?.id, testRecordName: record?.name, taskBookId: trial?.taskBookId, taskBookName: tasks.find(task => task.id === trial?.taskBookId)?.title };
    const id = useSessionStore.getState().ensurePhysicalSession(scope, `${configuration?.name ?? '工作'} · 专业工作`);
    useSessionStore.getState().openSession(id, capability); navigate(getSessionPath(id, capability));
  };
  const designArtifacts = projects.flatMap(project => project.artifacts.filter(artifact => {
    if (artifact.type !== 'design' || !configuration) return false;
    const scope = artifact.payload.sourceScope as PhysicalBusinessScope | undefined;
    return scope ? scope.physicalObjectId === configuration.id : sessions.some(session => session.storageProjectId === project.id && session.businessScope?.physicalObjectId === configuration.id);
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
        const input = setupLocked ? metadata : { ...metadata, parameters: normalizeFields(values.parameters, editingExperiment?.parameters) };
        const id = editingExperimentId ?? addExperiment(configuration.id, { ...metadata, parameters: normalizeFields(values.parameters) });
        if (editingExperimentId) updateExperiment(editingExperimentId, input);
        setParams({ objectId: family!.id, configurationId: configuration.id, experimentId: id }); message.success(editingExperimentId ? '试验构型已更新' : '试验构型已创建');
      } else if (dialog === 'trial' && experiment) {
        const design = designArtifacts.find(artifact => artifact.id === values.designArtifactId);
        const input = { designArtifactRef: design ? { projectId: design.projectId, artifactId: design.id } : editingTrialId && (values.designArtifactId === trial?.designArtifactRef?.artifactId || !designArtifacts.length) ? trial?.designArtifactRef : undefined, name: values.name || '', description: values.description || '', taskBookId: values.taskBookId || undefined, loadSpectrum: values.loadSpectrum?.trim() || '', loadSpectrumDescription: values.loadSpectrumDescription || '' };
        const id = editingTrialId ?? addConcreteTrial(experiment.id, input);
        if (editingTrialId) updateConcreteTrial(editingTrialId, input);
        setParams({ objectId: family!.id, configurationId: configuration!.id, experimentId: experiment.id, trialId: id }); message.success(editingTrialId ? '具体试验已更新' : '具体试验已创建');
      } else if (dialog === 'record' && trial) {
        const input = { name: values.name, description: values.description || '' };
        const id = editingRecordId ?? addRecord(trial.id, input);
        if (editingRecordId) updateRecord(trial.id, id, input);
        setEditingRecordId(id);
        setParams({ objectId: family!.id, configurationId: configuration!.id, experimentId: experiment!.id, trialId: trial.id, recordId: id });
        await uploadRawFiles(trial.id, id, pendingFiles); message.success('试验记录已保存');
      } else if (dialog === 'chart' && trial) {
        const input = { name: values.name || '', rawFileId: values.rawFileId || '', xField: values.xField || '', yField: values.yField || '', chartType: values.chartType || 'line', startRow: Math.max(0, Number(values.startRow ?? 1) - 1), endRow: Number(values.endRow ?? 0), scale: Number(values.scale ?? 1), offset: Number(values.offset ?? 0), color: values.color || '#1677ff', smooth: Boolean(values.smooth) } as Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>;
        if (!record?.rawFiles.some(file => file.id === input.rawFileId && file.headers.includes(input.xField) && file.headers.includes(input.yField))) throw new Error('请选择 CSV 原始文件及有效的 X、Y 轴字段');
        if (input.endRow > 0 && input.endRow <= input.startRow) throw new Error('结束行必须大于或等于起始行');
        const parsed = await readTrialFile(input.rawFileId); if (!buildChartPoints(parsed.rows, input.xField, input.yField, input).length) throw new Error('当前字段范围内没有可绘制的数值');
        saveChart(trial.id, record!.id, input, editingChartId); message.success(editingChartId ? '图表配置已更新' : '图表已保存');
      } else if (dialog === 'table' && trial && record) {
        const input = { name: values.name || '', rawFileId: values.rawFileId || '', fields: values.fields ?? [], startRow: Math.max(0, Number(values.startRow ?? 1) - 1), endRow: Number(values.endRow ?? 0) };
        if (input.endRow > 0 && input.endRow <= input.startRow) throw new Error('结束行必须大于或等于起始行');
        const parsed = await readTrialFile(input.rawFileId);
        if (!parsed.rows.slice(input.startRow, input.endRow > 0 ? input.endRow : undefined).length) throw new Error('所选范围没有数据');
        saveTable(trial.id, record.id, input, editingTableId); message.success('数据表已保存');
      }
      setDialog(null);
    } catch (error) { message.error(error instanceof Error ? error.message : '保存失败'); }
    finally { setSaving(false); }
  };
  const uploadRawFiles = async (trialKey: string, recordKey: string, files: RcFile[]) => {
    for (const file of files) {
      const fileId = `raw-${uuid()}`;
      let metadata: RawDataFile = { id: fileId, name: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, addedAt: new Date().toISOString(), headers: [], rowCount: 0 };
      if (file.name.toLowerCase().endsWith('.csv')) { const parsed = parseTrialCsv(await file.text()); metadata = { ...metadata, headers: parsed.headers, rowCount: parsed.rows.length }; }
      await saveTrialFile(fileId, file); addRawFile(trialKey, recordKey, metadata); setPendingFiles(items => items.filter(item => item.uid !== file.uid));
    }
  };
  const editRecord = () => { if (!record) return; startDialog('record', { name: record.name, description: record.description }); setEditingRecordId(record.id); };
  const openChart = (chart?: DerivedChart) => {
    if (!trial || !record) return;
    startDialog('chart', chart ? { ...chart, startRow: chart.startRow + 1 } : { name: `图表 ${record.charts.length + 1}`, chartType: 'line', startRow: 1, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
    setEditingChartId(chart?.id); setChartHeaders(chart ? record.rawFiles.find(item => item.id === chart.rawFileId)?.headers ?? [] : []); setChartDataError('');
  };
  const openTable = (table?: DerivedTable) => {
    if (!record) return;
    startDialog('table', table ? { ...table, startRow: table.startRow + 1 } : { name: `数据表 ${record.tables.length + 1}`, startRow: 1, endRow: 0 });
    setEditingTableId(table?.id); setChartHeaders(table ? record.rawFiles.find(item => item.id === table.rawFileId)?.headers ?? [] : []);
  };
  const loadChartHeaders = (fileId: string) => { const headers = record?.rawFiles.find(item => item.id === fileId)?.headers ?? []; setChartHeaders(headers); setChartDataError(headers.length ? '' : '此文件没有可绘制的 CSV 字段'); form.setFieldsValue({ xField: headers[0], yField: headers.find(header => header !== headers[0]) ?? headers[0], fields: headers }); };
  const dialogTitles: Record<Exclude<Dialog, null>, string> = { family: '新建物理对象', configuration: `在${family?.name ?? ''}下新建具体构型`, parameter: editingParameterId ? '编辑技术参数' : '新增技术参数', experiment: editingExperimentId ? '编辑试验构型' : `在${configuration?.name ?? ''}下新建试验构型`, trial: editingTrialId ? '编辑具体试验' : `在${experiment?.name ?? ''}下新建具体试验`, record: editingRecordId ? '编辑试验记录 / 添加文件' : '新增一次试验记录', chart: editingChartId ? '编辑图表配置' : '新建图表', table: editingTableId ? '编辑数据表配置' : '新建数据表' };
  const dialogContent = () => <Form form={form} layout="vertical" onFinish={submit}>
    {['family', 'configuration', 'experiment', 'trial'].includes(dialog || '') && <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }]}><Input autoFocus /></Form.Item>}
    {dialog === 'family' && <><Form.Item name="type" label="对象类别"><Select options={['涵道风扇', '电推进', '电机', '自定义对象'].map(value => ({ value }))} /></Form.Item><Form.Item name="description" label="描述"><Input /></Form.Item></>}
    {dialog === 'configuration' && <Form.Item name="description" label="说明"><Input /></Form.Item>}
    {dialog === 'parameter' && <ParameterList />}
    {dialog === 'experiment' && <><Form.Item name="description" label="说明"><Input /></Form.Item>{setupLocked && <Alert type="info" showIcon message="已有执行记录，试验构型参数已锁定。名称和说明可修改；变更装置或参数请新建试验构型。" />}<Text strong>试验构型参数</Text><ParameterList disabled={setupLocked} allowEmpty /></>}
    {dialog === 'trial' && <><Form.Item name="description" label="说明"><Input /></Form.Item>{editingTrialId && trial?.records.length ? <Alert type="info" showIcon message="已有执行记录；不同载荷谱应新建具体试验。旧数据未登记载荷谱时，可补充标识。" /> : null}<Form.Item name="loadSpectrum" label="载荷谱名称或编号" rules={[{ required: true, whitespace: true, message: '填写载荷谱标识即可，无须录入曲线' }]}><Input placeholder="例如：载荷谱 01" disabled={Boolean(editingTrialId && trial?.records.length && trial.loadSpectrum)} /></Form.Item><Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input /></Form.Item><Form.Item name="taskBookId" label="任务书（可选，仅关联 ID）"><Select allowClear placeholder="自主试验，无需任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item>{designArtifacts.length > 0 && <Form.Item name="designArtifactId" label="引用已有设计成果（可选）"><Select allowClear options={designArtifacts.map(artifact => ({ value: artifact.id, label: `${artifact.title} · ${artifactResultLabel(artifact)}` }))} /></Form.Item>}</>}
    {dialog === 'record' && <><Form.Item name="name" label="记录名称（可选）"><Input placeholder={`第 ${(trial?.records.length ?? 0) + 1} 次试验记录`} autoFocus /></Form.Item><Form.Item name="description" label="本次执行说明（可选）"><Input /></Form.Item><div className="physical-upload-section"><Text strong>CSV 原始数据文件（可多选，字段由文件提供）</Text><Upload accept=".csv,text/csv" multiple disabled={saving} fileList={pendingFiles.map(file => ({ uid: file.uid, name: file.name, originFileObj: file }))} beforeUpload={file => { if (!file.name.toLowerCase().endsWith('.csv')) { message.error('请选择 CSV 文件'); return Upload.LIST_IGNORE; } setPendingFiles(items => [...items, file]); return false; }} onRemove={file => setPendingFiles(items => items.filter(item => item.uid !== file.uid))}><Button icon={<FileAddOutlined />}>选择 CSV 文件</Button></Upload>{editingRecordId && record?.rawFiles.map(file => <div className="physical-file-row" key={file.id}><span>{file.name}</span><Text type="secondary">{file.rowCount} 行 · {file.headers.join('、')}</Text></div>)}</div></>}
    {(dialog === 'chart' || dialog === 'table') && <><Form.Item name="name" label={dialog === 'chart' ? '图表名称' : '数据表名称'} rules={[{ required: true, whitespace: true }]}><Input autoFocus /></Form.Item><Form.Item name="rawFileId" label="本次记录的 CSV 文件" rules={[{ required: true, message: '选择原始文件' }]}><Select onChange={loadChartHeaders} options={record?.rawFiles.filter(file => file.headers.length).map(file => ({ value: file.id, label: `${file.name}（${file.rowCount} 行）` })) ?? []} /></Form.Item>{chartDataError && dialog === 'chart' && <Alert type="error" message={chartDataError} />}{chartHeaders.length > 0 && <>
      {dialog === 'chart' ? <><Space align="start" wrap><Form.Item name="xField" label="X 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="yField" label="Y 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="chartType" label="图形"><Select options={[{ value: 'line', label: '折线' }, { value: 'scatter', label: '散点' }, { value: 'bar', label: '柱状' }]} /></Form.Item></Space><Space align="start" wrap><Form.Item name="scale" label="Y 缩放"><InputNumber step={0.1} /></Form.Item><Form.Item name="offset" label="Y 偏移"><InputNumber step={0.1} /></Form.Item><Form.Item name="color" label="颜色"><Input type="color" /></Form.Item><Form.Item name="smooth" label="曲线平滑"><Select options={[{ value: true, label: '平滑' }, { value: false, label: '直线' }]} /></Form.Item></Space></> : <Form.Item name="fields" label="显示字段" rules={[{ required: true, type: 'array', min: 1 }]}><Select mode="multiple" options={chartHeaders.map(value => ({ value }))} /></Form.Item>}
      <Space align="start" wrap><Form.Item name="startRow" label="起始行"><InputNumber min={1} precision={0} /></Form.Item><Form.Item name="endRow" label="结束行（0 表示末尾）"><InputNumber min={0} precision={0} /></Form.Item></Space>
    </>}</>}
  </Form>;
  const setRoute = (next: Record<string, string>) => setParams(next);
  const configPage = (config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">{family?.name}</Text><Title level={4}>{config.name}</Title>{config.description && <Text>{config.description}</Text>}</div></div>
    <Card size="small" title="技术参数" extra={<Button size="small" onClick={() => startDialog('parameter', { parameters: [{ name: '', value: '', unit: '', description: '' }] })}>新增参数</Button>}>{config.parameters.length ? <div className="physical-field-list">{config.parameters.map(item => <div className="physical-field-row" key={item.id}><Tooltip title={item.description || undefined}><span className={item.description ? 'physical-field-name has-description' : ''}>{item.name}</span></Tooltip><strong>{item.value || '—'} {item.unit}</strong><Button className="physical-parameter-edit" type="link" size="small" onClick={() => { startDialog('parameter', { parameters: [{ ...item }] }); setEditingParameterId(item.id); }}>编辑</Button></div>)}</div> : <Text type="secondary">暂无参数</Text>}</Card>
    {config.designs.length > 0 && <Card size="small" title="构型通用要求">{config.designs.map(design => <div key={design.id} className="physical-design-case"><strong>{design.name}</strong>{design.fields.map(field => <div className="physical-field-row" key={field.id}><Tag>{field.usage}</Tag><span>{field.name}</span><strong>{field.comparison ? `${field.comparison} ` : ''}{field.value} {field.unit}</strong></div>)}</div>)}</Card>}
    <Card size="small" title="试验构型" extra={<Button type="primary" size="small" onClick={() => startDialog('experiment', { parameters: [{ name: '', value: '', unit: '', description: '' }] })}>新建试验构型</Button>}>{config.experiments.length ? config.experiments.map(item => <div className="physical-list-row" key={item.id}><div><strong>{item.name}</strong><div><Text type="secondary">{item.category} · {item.trials?.length ?? 0} 个具体试验</Text></div></div><Button onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id })}>打开</Button></div>) : <Text type="secondary">此构型尚无试验构型</Text>}</Card>
  </>;
  const experimentPage = (item: ExperimentDefinition, config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">{family?.name} / {config.name}</Text><Title level={4}>{item.name}</Title><Text type="secondary">试验构型{item.category && ` · ${item.category}`}</Text>{item.description && <div><Text>{item.description}</Text></div>}</div><Button onClick={() => { startDialog('experiment', { name: item.name, description: item.description, parameters: item.parameters }); setEditingExperimentId(item.id); }}>编辑试验构型</Button></div>
    <div className="physical-level-back"><Button type="link" onClick={() => setRoute({ objectId: family!.id, configurationId: config.id })}>返回具体构型</Button></div>
    {item.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === item.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === item.designArtifactRef?.artifactId)} />}
    <Card size="small" title="试验构型参数">{renderFields(item.parameters)}</Card>
    <Card size="small" title="具体试验" extra={<Button type="primary" size="small" onClick={() => startDialog('trial', { taskBookId: params.get('taskBookId') || undefined })}>新建具体试验</Button>}>{item.trials?.length ? item.trials.map(entry => <div className="physical-list-row" key={entry.id}><div><strong>{entry.name}</strong><div><Text type="secondary">载荷谱：{entry.loadSpectrum || '待补充'} · {entry.records.length} 次执行</Text></div></div><Button onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id, trialId: entry.id })}>打开</Button></div>) : <Text type="secondary">本试验构型下还没有具体试验</Text>}</Card>
  </>;
  const trialPage = (entry: ConcreteTrial, item: ExperimentDefinition, config: PhysicalConfiguration) => {
    const sourceScope = { physicalObjectId: config.id, experimentId: item.id, trialId: entry.id, testRecordId: record?.id };
    const artifacts = record ? getSourceArtifacts(projects, sessions, sourceScope) : [];
    return <>
      <div className="physical-config-title"><div><Text type="secondary">{family?.name} / {config.name} / {item.name}</Text><Title level={4}>{entry.name}</Title>{entry.description && <Text>{entry.description}</Text>}</div><Button onClick={() => { startDialog('trial', { ...entry, designArtifactId: entry.designArtifactRef?.artifactId }); setEditingTrialId(entry.id); }}>编辑具体试验</Button></div>
      <div className="physical-level-back"><Button type="link" onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id })}>返回试验构型</Button></div>
      <Card size="small" title="试验信息"><Text strong>载荷谱：{entry.loadSpectrum || '旧数据未登记，请编辑补充'}</Text>{entry.loadSpectrumDescription && <div>{entry.loadSpectrumDescription}</div>}<div><Text type="secondary">{entry.taskBookId ? `任务书：${tasks.find(task => task.id === entry.taskBookId)?.title || entry.taskBookId}（ID：${entry.taskBookId}）` : '自主试验'}</Text></div></Card>
      {entry.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === entry.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === entry.designArtifactRef?.artifactId)} />}
      {Boolean(entry.designs?.length) && <Card size="small" title="历史工况备注">{renderFields(entry.designs!)}</Card>}
      <Card size="small" title={`试验记录 · ${entry.records.length} 次执行`} extra={<Button type="primary" size="small" disabled={sourceUnavailable || !entry.loadSpectrum} onClick={() => startDialog('record')}>{entry.records.length ? '新增一次记录' : '创建第 1 次记录'}</Button>}>
        {entry.records.length > 1 && <div className="physical-execution-list">{entry.records.map(execution => <Button key={execution.id} type={execution.id === record?.id ? 'primary' : 'default'} onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id, trialId: entry.id, recordId: execution.id })}>{recordLabel(execution)}</Button>)}</div>}
        {!record ? <Text type="secondary">{requestedRecordUnavailable ? '请求的记录已失效，请选择有效记录。' : entry.records.length ? '请选择本次需要使用的记录。' : '一次实际执行建立一条记录；同一次执行的多个 CSV 保存到同一条记录。'}</Text> : <>
          <div className="physical-record-heading"><div><strong>{recordLabel(record)}</strong>{record.description && <div>{record.description}</div>}<div><Text type="secondary">记录 ID：{record.id}</Text></div></div><Button onClick={editRecord}>编辑记录 / 添加文件</Button></div>
          {(record.actualConditions.length > 0 || record.measurements.length > 0) && <div className="physical-record-columns"><div><Text strong>历史实际条件</Text>{renderFields(record.actualConditions)}</div><div><Text strong>历史测量备注</Text>{renderFields(record.measurements)}</div></div>}
          <div className="physical-file-row"><Space><FileAddOutlined /><strong>CSV 原始文件</strong><Tag>{record.rawFiles.length}</Tag></Space><span>{record.rawFiles.map(file => `${file.name} · ${file.rowCount} 行`).join('；') || '暂无文件，请添加本次执行的 CSV'}</span></div>
          <div className="physical-charts-heading"><Title level={5}><BarChartOutlined /> 图表与数据表</Title><Space wrap><Button size="small" disabled={!record.rawFiles.some(file => file.headers.length)} onClick={() => openTable()}>新建数据表</Button><Button type="primary" size="small" disabled={!record.rawFiles.some(file => file.headers.length)} onClick={() => openChart()}>新建图表</Button></Space></div>
          {record.charts.length > 0 && <div className="physical-charts-grid">{record.charts.map(chart => <Card key={chart.id} size="small" title={chart.name} extra={<Button type="link" onClick={() => openChart(chart)}>配置</Button>}><Text type="secondary">{record.rawFiles.find(file => file.id === chart.rawFileId)?.name} · {chart.xField} / {chart.yField}</Text><TrialChart chart={chart} rawFile={record.rawFiles.find(file => file.id === chart.rawFileId)} /></Card>)}</div>}
          {record.tables.map(table => <Card key={table.id} className="physical-data-table" size="small" title={table.name} extra={<Button type="link" onClick={() => openTable(table)}>配置</Button>}><TrialDataTable table={table} rawFile={record.rawFiles.find(file => file.id === table.rawFileId)} /></Card>)}
          <Space wrap className="physical-record-actions">{Object.entries(capabilityNames).map(([key, label]) => <Button key={key} size="small" onClick={() => launchCapability(key)}>{label}</Button>)}</Space>
          {artifacts.length > 0 && <div><Text strong>本次记录的专业成果</Text>{artifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Text>{artifact.title}</Text> <Tag>{artifactResultLabel(artifact)}</Tag></div>)}</div>}
        </>}
      </Card>
    </>;
  };
  const objectPage = () => family ? <><div className="physical-config-title"><div><Text type="secondary">物理对象</Text><Title level={4}>{family.name}</Title><Text type="secondary">{family.type}{family.description ? ` · ${family.description}` : ''}</Text></div></div><Card size="small" title="具体构型" extra={<Button type="primary" size="small" onClick={() => startDialog('configuration')}>新建具体构型</Button>}>{family.configurations.length ? family.configurations.map(config => <div className="physical-list-row" key={config.id}><div><strong>{config.name}</strong><div><Text type="secondary">{config.description || `${config.parameters.length} 项技术参数 · ${config.experiments.length} 个试验构型`}</Text></div></div><Button onClick={() => setRoute({ objectId: family.id, configurationId: config.id })}>查看</Button></div>) : <Text type="secondary">尚无具体构型</Text>}</Card></> : <Empty description={objects.length ? '从左侧选择物理对象或具体构型。' : '尚无物理对象，请从左侧物理对象栏目旁的加号创建。'} />;
  const taskChildren = activeTab === 'taskbooks' ? <TaskBookView projects={projects} sessions={sessions} entries={allEntries} tasks={tasks} navigate={navigate} taskId={params.get('taskId') || ''} onTaskChange={value => setParams(value ? { view: 'taskbooks', taskId: value } : { view: 'taskbooks' })} /> : undefined;
  return <div className="physical-page">
    <div className="physical-heading"><div><div className="workspace-kicker">试验工作表</div><Title level={3}>物理对象与试验数据</Title></div><div className="physical-current-context">{family?.name}{configuration && ` / ${configuration.name}`}{experiment && ` / ${experiment.name}`}{trial && ` / ${trial.name}`}</div></div>
    {sourceUnavailable && <Alert type="error" showIcon message={requestedRecordUnavailable ? '指定的试验记录不存在或已失效，未切换到其他记录。' : '业务来源已失效；请选择已有对象、构型或记录，不会自动改用其他数据。'} action={requestedRecordUnavailable && trial && experiment && configuration && family && <Button onClick={() => setRoute({ objectId: family.id, configurationId: configuration.id, experimentId: experiment.id, trialId: trial.id })}>返回所属具体试验</Button>} />}
    <Card className="physical-workspace-card" bordered={false}><Tabs activeKey={activeTab} onChange={key => { const next = new URLSearchParams(params); if (key === 'objects') next.delete('view'); else next.set('view', key); if (key !== 'taskbooks') next.delete('taskId'); setParams(next); }} items={[
      { key: 'objects', label: '对象与试验', children: <main className="physical-flow-main">{trial && experiment && configuration ? trialPage(trial, experiment, configuration) : experiment && configuration ? experimentPage(experiment, configuration) : configuration ? configPage(configuration) : objectPage()}</main> },
      { key: 'taskbooks', label: '任务书视图', children: taskChildren },
      { key: 'tools', label: '专业功能', children: <div className="physical-tool-grid">{Object.entries(capabilityNames).map(([key, label]) => <Card key={key} size="small" title={label}><Text type="secondary">{configuration ? `${trial ? `当前试验：${trial.name}` : `当前构型：${configuration.name}`}` : '独立使用'}</Text><Button type="primary" block onClick={() => launchCapability(key)}>打开</Button></Card>)}</div> },
    ]} /></Card>
    <Modal title={dialog ? dialogTitles[dialog] : ''} open={Boolean(dialog)} onCancel={() => { if (!saving) setDialog(null); }} onOk={() => form.submit()} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" destroyOnHidden width={dialog === 'chart' || dialog === 'table' ? 820 : 640} okButtonProps={{ icon: <SaveOutlined /> }}>{dialogContent()}</Modal>
  </div>;
};

function TaskBookView({ entries, tasks, projects, sessions, navigate, taskId, onTaskChange }: {
  entries: Array<{ object: PhysicalObject; config: PhysicalConfiguration; experiment: ExperimentDefinition; trial: ConcreteTrial }>;
  tasks: ReturnType<typeof useTaskStore.getState>['tasks']; projects: ReturnType<typeof useProjectStore.getState>['projects']; sessions: ReturnType<typeof useSessionStore.getState>['sessions']; navigate: ReturnType<typeof useNavigate>; taskId: string; onTaskChange: (id: string) => void;
}) {
  const objects = usePhysicalObjectStore(state => state.objects);
  const [targetExperiment, setTargetExperiment] = useState<string>();
  const [targetTrial, setTargetTrial] = useState<string>();
  const selected = entries.filter(item => item.trial.taskBookId === taskId);
  const targets = objects.flatMap(object => object.configurations.flatMap(config => config.experiments.map(experiment => ({ object, config, experiment }))));
  const task = tasks.find(item => item.id === taskId);
  return <div className="physical-taskbook-view"><Card title="任务书关联"><Select allowClear value={taskId || undefined} onChange={value => { setTargetExperiment(undefined); setTargetTrial(undefined); onTaskChange(value || ''); }} placeholder="选择任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} style={{ width: '100%' }} />{task && <>
    <Text type="secondary">关联 ID：{taskId}。仅关联具体试验，不解析或执行。</Text>
    <div className="physical-task-create"><Select aria-label="选择开展试验的试验构型" placeholder="选择试验构型" value={targetExperiment} options={targets.map(({ object, config, experiment }) => ({ value: experiment.id, label: `${object.name} / ${config.name} / ${experiment.name}` }))} onChange={setTargetExperiment} /><Button disabled={!targets.some(item => item.experiment.id === targetExperiment)} onClick={() => { const target = targets.find(item => item.experiment.id === targetExperiment); if (target) navigate(`/physical-objects?${new URLSearchParams({ objectId: target.object.id, configurationId: target.config.id, experimentId: target.experiment.id, create: 'trial', taskBookId: taskId })}`); }}>发起具体试验</Button></div>
    <div className="physical-task-create"><Select aria-label="选择尚未关联任务书的具体试验" placeholder="关联已有自主试验" value={targetTrial} options={entries.filter(item => !item.trial.taskBookId).map(item => ({ value: item.trial.id, label: `${item.config.name} / ${item.experiment.name} / ${item.trial.name}` }))} onChange={setTargetTrial} /><Button disabled={!entries.some(item => item.trial.id === targetTrial && !item.trial.taskBookId)} onClick={() => { if (targetTrial) usePhysicalObjectStore.getState().updateConcreteTrial(targetTrial, { taskBookId: taskId }); setTargetTrial(undefined); }}>关联已有试验</Button></div>
  </>}</Card><div className="physical-book-tests">{task ? selected.length ? selected.map(item => <Card key={item.trial.id} title={item.trial.name}>
    <Text type="secondary">{item.object.name} / {item.config.name} / {item.experiment.name} · 载荷谱：{item.trial.loadSpectrum || '待补充'}</Text>
    {!item.trial.records.length && <Text type="secondary">尚无执行记录</Text>}
    {item.trial.records.map(record => {
      const scope = { physicalObjectId: item.config.id, experimentId: item.experiment.id, trialId: item.trial.id, testRecordId: record.id };
      const artifacts = getSourceArtifacts(projects, sessions, scope);
      return <div className="physical-task-record" key={record.id}><div><strong>{recordLabel(record)}</strong><div><Text type="secondary">{record.rawFiles.length} 个文件 · {record.charts.length} 张图表 · {record.tables.length} 张数据表</Text></div>{artifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}>{artifact.title} <Tag>{artifactResultLabel(artifact)}</Tag></div>)}</div><Button type="link" onClick={() => navigate(`/physical-objects?${new URLSearchParams({ objectId: item.object.id, configurationId: item.config.id, experimentId: item.experiment.id, trialId: item.trial.id, recordId: record.id })}`)}>查看同一记录与成果</Button></div>;
    })}
    <Button onClick={() => navigate(`/physical-objects?${new URLSearchParams({ objectId: item.object.id, configurationId: item.config.id, experimentId: item.experiment.id, trialId: item.trial.id })}`)}>管理具体试验</Button>
  </Card>) : <Empty description="此任务书尚未关联具体试验；可以发起试验或关联已有自主试验。" /> : <Empty description="选择任务书查看关联的试验与成果" />}</div></div>;
}

export default PhysicalObjectsPage;
