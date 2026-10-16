import React, { useEffect, useState } from 'react';
import { Alert, Breadcrumb, Button, Card, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tabs, Tag, Tooltip, Typography, Upload, message } from 'antd';
import { FileAddOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import TrialChart from './TrialChart';
import AnalysisResults from './AnalysisResults';
import { collectAnalysisResults, getTrialArtifacts } from './analysisResultModel';
import PhysicalTrialsTable from './PhysicalTrialsTable';
import { artifactResultLabel, getSourceArtifacts, recordLabel } from './physicalBusinessContext';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact } from './types';
import { TEST_TYPES, assertTrialChartName, hasTrialChartNameConflict, isExperimentSetupLocked, usePhysicalObjectStore, type ChartInput, type ConcreteTrial, type DerivedChart, type DerivedTable, type ExperimentDefinition, type PhysicalConfiguration, type RawDataFile, type TestRecord, type TrialChartResult, type ValueField } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type PhysicalBusinessScope, type SessionCapability } from './sessionModel';
import { parseTrialCsv, readTrialFile, saveTrialFile } from './trialDataFiles';
import { downloadTrialChart, loadTrialChartOption } from './trialChartOutput';
import { taskBookPath } from './taskTrialModel';
import { resolvePhysicalNavigation, trialListQueryKeys } from './physicalNavigation';
import './physicalObjects.css';

const { Text, Title } = Typography;
type Dialog = 'family' | 'configuration' | 'parameter' | 'experiment' | 'trial' | 'record' | 'chart' | 'table' | null;
type FieldValue = { id?: string; name: string; description?: string; unit?: string; form?: ValueField['form']; value?: string };
type FormSubmission = {
  name?: string; description?: string; testType?: string; taskBookId?: string; designArtifactId?: string; loadSpectrum?: string; loadSpectrumDescription?: string;
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
  const [chartPreview, setChartPreview] = useState<DerivedChart>();
  const [exporting, setExporting] = useState(false);
  const [form] = Form.useForm();
  const createIntent = params.get('create');
  const { family, configuration, experiment, trial, record, requestedRecordUnavailable, missing: sourceUnavailable } = resolvePhysicalNavigation(objects, params);
  const editingExperiment = configuration?.experiments.find(item => item.id === editingExperimentId);
  const setupLocked = Boolean(editingExperiment && isExperimentSetupLocked(editingExperiment));
  const activeTab = params.get('view') === 'tools' ? 'tools' : params.get('view') === 'taskbooks' || params.has('taskId') ? 'taskbooks' : 'objects';
  const startDialog = (next: Exclude<Dialog, null>, initial: Record<string, unknown> = {}) => { setDialog(next); setPendingFiles([]); setChartPreview(undefined); setEditingParameterId(undefined); setEditingTrialId(undefined); setEditingExperimentId(undefined); setEditingRecordId(undefined); setEditingChartId(undefined); setEditingTableId(undefined); form.resetFields(); if (Object.keys(initial).length) form.setFieldsValue(initial); };
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
    const prediction = key === 'digitalTwin' || key === 'virtualCondition';
    if (prediction && !experiment) return message.info('请先打开目标试验构型');
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
  const chartInput = async (values: FormSubmission): Promise<ChartInput> => {
    const input: ChartInput = { name: values.name?.trim() || '', rawFileId: values.rawFileId || '', xField: values.xField || '', yField: values.yField || '', chartType: values.chartType || 'line', startRow: Math.max(0, Number(values.startRow ?? 1) - 1), endRow: Number(values.endRow ?? 0), scale: Number(values.scale ?? 1), offset: Number(values.offset ?? 0), color: values.color || '#1677ff', smooth: Boolean(values.smooth) };
    const file = record?.rawFiles.find(file => file.id === input.rawFileId);
    if (!file) throw new Error('请选择本记录的 CSV 原始文件');
    if (input.endRow > 0 && input.endRow <= input.startRow) throw new Error('结束行必须大于或等于起始行');
    await loadTrialChartOption({ ...input, id: 'preview', createdAt: '', updatedAt: '' }, file);
    return input;
  };
  const submit = async (values: FormSubmission, exportPng = false) => {
    if (sourceUnavailable && dialog !== 'family') return message.error('业务来源已失效，请选择已有来源');
    if (saving) return;
    setSaving(true);
    try {
      if (dialog === 'family') {
        const id = addRoot({ name: values.name || '', type: values.name || '', description: values.description || '' });
        setParams({ objectId: id }); message.success('对象类别已保存');
      } else if (dialog === 'configuration' && family) {
        const id = addConfiguration(family.id, { name: values.name || '', description: values.description || '' });
        if (id) setParams({ objectId: family.id, configurationId: id }); message.success('具体物理对象已创建');
      } else if (dialog === 'parameter' && configuration) {
        const items = (values.parameters ?? []).filter(item => item.name?.trim()).map(item => ({ id: item.id, name: item.name!.trim(), description: item.description || '', unit: item.unit || '', form: item.id && editingParameterId ? configuration.parameters.find(field => field.id === item.id)?.form ?? '单值' : '单值', value: item.value || '' }));
        for (const item of items) {
          if (item.id && editingParameterId) updateField(configuration.id, 'parameters', editingParameterId, item);
          else addField(configuration.id, 'parameters', item);
        }
        message.success(items.length === 1 ? '参数已保存' : `已保存 ${items.length} 项参数`);
      } else if (dialog === 'experiment' && configuration) {
        if (editingExperimentId && !editingExperiment) throw new Error('试验构型来源已变化，请重新打开编辑。');
        const metadata = { name: values.name || '', description: values.description || '', testType: values.testType };
        const input = setupLocked ? metadata : { ...metadata, parameters: normalizeFields(values.parameters, editingExperiment?.parameters) };
        const id = editingExperimentId ?? addExperiment(configuration.id, { ...metadata, parameters: normalizeFields(values.parameters) });
        if (editingExperimentId) updateExperiment(editingExperimentId, input);
        setRoute({ objectId: family!.id, configurationId: configuration.id, experimentId: id }); message.success(editingExperimentId ? '试验构型已更新' : '试验构型已创建');
      } else if (dialog === 'trial' && experiment) {
        const design = designArtifacts.find(artifact => artifact.id === values.designArtifactId);
        const input = { designArtifactRef: design ? { projectId: design.projectId, artifactId: design.id } : editingTrialId && (values.designArtifactId === trial?.designArtifactRef?.artifactId || !designArtifacts.length) ? trial?.designArtifactRef : undefined, name: values.name || '', description: values.description || '', taskBookId: values.taskBookId || undefined, loadSpectrum: values.loadSpectrum?.trim() || '', loadSpectrumDescription: values.loadSpectrumDescription || '' };
        const id = editingTrialId ?? addConcreteTrial(experiment.id, input);
        if (editingTrialId) updateConcreteTrial(editingTrialId, input);
        setRoute({ objectId: family!.id, configurationId: configuration!.id, experimentId: experiment.id, trialId: id, ...(editingTrialId && record ? { recordId: record.id } : {}) }); message.success(editingTrialId ? '具体试验已更新' : '具体试验已创建');
      } else if (dialog === 'record' && trial) {
        const input = { name: values.name, description: values.description || '' };
        const id = editingRecordId ?? addRecord(trial.id, input);
        if (editingRecordId) updateRecord(trial.id, id, input);
        setEditingRecordId(id);
        setRoute({ objectId: family!.id, configurationId: configuration!.id, experimentId: experiment!.id, trialId: trial.id, recordId: id });
        await uploadRawFiles(trial.id, id, pendingFiles); message.success('试验记录已保存');
      } else if (dialog === 'chart' && trial) {
        const input = await chartInput(values);
        const chartId = saveChart(trial.id, record!.id, input, editingChartId);
        setEditingChartId(chartId);
        if (exportPng) {
          try { await downloadTrialChart({ ...input, id: chartId, createdAt: '', updatedAt: '' }, record!.rawFiles.find(file => file.id === input.rawFileId)!, `${trial.name} / ${recordLabel(record!)}`); }
          catch (error) { throw new Error(`图表成果已保存，PNG 导出失败：${error instanceof Error ? error.message : '请重试'}`); }
        }
        message.success(exportPng ? '图表成果已保存并导出' : '已保存到本试验的共享图表成果');
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
    const file = chart ? record.rawFiles.find(item => item.id === chart.rawFileId) : record.rawFiles.find(item => item.headers.length);
    let number = trial.charts.length + 1;
    while (hasTrialChartNameConflict(trial, `图表 ${number}`)) number++;
    startDialog('chart', chart ? { ...chart, startRow: chart.startRow + 1 } : { name: `图表 ${number}`, rawFileId: file?.id, xField: file?.headers[0], yField: file?.headers[1] ?? file?.headers[0], chartType: 'line', startRow: 1, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
    setEditingChartId(chart?.id); setChartHeaders(file?.headers ?? []); setChartDataError('');
  };
  const generatePreview = async () => {
    if (saving) return;
    try { const values = await form.validateFields(); setSaving(true); const input = await chartInput(values); setChartPreview({ ...input, id: 'preview', createdAt: '', updatedAt: '' }); }
    catch (error) { if (error instanceof Error) message.error(error.message); }
    finally { setSaving(false); }
  };
  const exportSavedChart = async (chart: TrialChartResult) => {
    if (!trial || !record || exporting) return;
    setExporting(true);
    try {
      assertTrialChartName(trial, chart.name, chart);
      const file = record.rawFiles.find(file => file.id === chart.rawFileId);
      if (!file || chart.sourceRecordId !== record.id) throw new Error('图表数据来源已失效');
      await downloadTrialChart(chart, file, `${trial.name} / ${recordLabel(record)}`);
      message.success('PNG 已导出');
    } catch (error) { message.error(error instanceof Error ? error.message : '导出失败'); }
    finally { setExporting(false); }
  };
  const openTable = (table?: DerivedTable) => {
    if (!record) return;
    const file = record.rawFiles.find(item => table ? item.id === table.rawFileId : item.headers.length);
    startDialog('table', table ? { ...table, startRow: table.startRow + 1 } : { name: `数据表 ${record.tables.length + 1}`, rawFileId: file?.id, fields: file?.headers, startRow: 1, endRow: 0 });
    setEditingTableId(table?.id); setChartHeaders(file?.headers ?? []);
  };
  const loadChartHeaders = (fileId: string) => { const headers = record?.rawFiles.find(item => item.id === fileId)?.headers ?? []; setChartHeaders(headers); setChartDataError(headers.length ? '' : '此文件没有可绘制的 CSV 字段'); form.setFieldsValue({ xField: headers[0], yField: headers.find(header => header !== headers[0]) ?? headers[0], fields: headers }); };
  const dialogTitles: Record<Exclude<Dialog, null>, string> = { family: '新建对象类别', configuration: `在${family?.name ?? ''}下新建具体物理对象`, parameter: editingParameterId ? '编辑技术参数' : '新增技术参数', experiment: editingExperimentId ? '编辑试验构型' : `在${configuration?.name ?? ''}下新建试验构型`, trial: editingTrialId ? '编辑具体试验' : `在${experiment?.name ?? ''}下新建具体试验`, record: editingRecordId ? '编辑试验记录 / 添加文件' : '新增一次试验记录', chart: editingChartId ? '编辑图表配置' : '新建图表', table: editingTableId ? '编辑数据表配置' : '新建数据表' };
  const dialogContent = () => <Form form={form} layout="vertical" disabled={saving} onFinish={values => submit(values)} onValuesChange={() => { if (dialog === 'chart') setChartPreview(undefined); }}>
    {['family', 'configuration', 'experiment', 'trial'].includes(dialog || '') && <Form.Item name="name" label="名称" rules={[{ required: true, whitespace: true, message: '请输入名称' }]}><Input autoFocus /></Form.Item>}
    {dialog === 'family' && <Form.Item name="description" label="说明（可选）"><Input /></Form.Item>}
    {dialog === 'configuration' && <Form.Item name="description" label="说明"><Input /></Form.Item>}
    {dialog === 'parameter' && <ParameterList />}
    {dialog === 'experiment' && <><Form.Item name="testType" label="适用试验类型" extra="构型维护时设置，用于专业服务匹配模型" rules={[{ required: true, message: '请选择适用试验类型' }]}><Select options={TEST_TYPES} /></Form.Item><Form.Item name="description" label="说明"><Input /></Form.Item>{setupLocked && <Alert type="info" showIcon message="已有执行记录，试验构型参数已锁定。名称和说明可修改；变更装置或参数请新建试验构型。" />}<Text strong>试验构型参数</Text><ParameterList disabled={setupLocked} allowEmpty /></>}
    {dialog === 'trial' && <><Form.Item name="description" label="说明"><Input /></Form.Item>{editingTrialId && trial?.records.length ? <Alert type="info" showIcon message="已有执行记录；不同载荷谱应新建具体试验。旧数据未登记载荷谱时，可补充标识。" /> : null}<Form.Item name="loadSpectrum" label="载荷谱名称或编号" rules={[{ required: true, whitespace: true, message: '填写载荷谱标识即可，无须录入曲线' }]}><Input placeholder="例如：载荷谱 01" disabled={Boolean(editingTrialId && trial?.records.length && trial.loadSpectrum)} /></Form.Item><Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input /></Form.Item><Form.Item name="taskBookId" label="任务书（可选，仅关联 ID）"><Select allowClear placeholder="自主试验，无需任务书" options={tasks.map(task => ({ value: task.id, label: task.title }))} /></Form.Item>{designArtifacts.length > 0 && <Form.Item name="designArtifactId" label="引用已有设计成果（可选）"><Select allowClear options={designArtifacts.map(artifact => ({ value: artifact.id, label: `${artifact.title} · ${artifactResultLabel(artifact)}` }))} /></Form.Item>}</>}
    {dialog === 'record' && <><Form.Item name="name" label="记录名称（可选）"><Input placeholder={`第 ${(trial?.records.length ?? 0) + 1} 次试验记录`} autoFocus /></Form.Item><Form.Item name="description" label="本次执行说明（可选）"><Input /></Form.Item><div className="physical-upload-section"><Text strong>CSV 原始数据文件（可多选，字段由文件提供）</Text><Upload accept=".csv,text/csv" multiple disabled={saving} fileList={pendingFiles.map(file => ({ uid: file.uid, name: file.name, originFileObj: file }))} beforeUpload={file => { if (!file.name.toLowerCase().endsWith('.csv')) { message.error('请选择 CSV 文件'); return Upload.LIST_IGNORE; } setPendingFiles(items => [...items, file]); return false; }} onRemove={file => setPendingFiles(items => items.filter(item => item.uid !== file.uid))}><Button icon={<FileAddOutlined />}>选择 CSV 文件</Button></Upload>{editingRecordId && record?.rawFiles.map(file => <div className="physical-file-row" key={file.id}><span>{file.name}</span><Text type="secondary">{file.rowCount} 行 · {file.headers.join('、')}</Text></div>)}</div></>}
    {(dialog === 'chart' || dialog === 'table') && <><Form.Item name="name" label={dialog === 'chart' ? '图表名称' : '数据表名称'} rules={[{ required: true, whitespace: true }, { validator: (_, value: string) => dialog === 'chart' && trial && value?.trim() && hasTrialChartNameConflict(trial, value, editingChartId && record ? { id: editingChartId, sourceRecordId: record.id } : undefined) ? Promise.reject(new Error('本具体试验已有同名图表，请使用其他名称。')) : Promise.resolve() }]}><Input autoFocus /></Form.Item><Form.Item name="rawFileId" label="本次记录的 CSV 文件" rules={[{ required: true, message: '选择原始文件' }]}><Select onChange={loadChartHeaders} options={record?.rawFiles.filter(file => file.headers.length).map(file => ({ value: file.id, label: `${file.name}（${file.rowCount} 行）` })) ?? []} /></Form.Item>{chartDataError && dialog === 'chart' && <Alert type="error" message={chartDataError} />}{chartHeaders.length > 0 && <>
      {dialog === 'chart' ? <><Space align="start" wrap><Form.Item name="xField" label="X 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="yField" label="Y 轴字段" rules={[{ required: true }]}><Select options={chartHeaders.map(value => ({ value }))} /></Form.Item><Form.Item name="chartType" label="图形"><Select options={[{ value: 'line', label: '折线' }, { value: 'scatter', label: '散点' }, { value: 'bar', label: '柱状' }]} /></Form.Item></Space><Space align="start" wrap><Form.Item name="scale" label="Y 缩放"><InputNumber step={0.1} /></Form.Item><Form.Item name="offset" label="Y 偏移"><InputNumber step={0.1} /></Form.Item><Form.Item name="color" label="颜色"><Input type="color" /></Form.Item><Form.Item name="smooth" label="曲线平滑"><Select options={[{ value: true, label: '平滑' }, { value: false, label: '直线' }]} /></Form.Item></Space></> : <Form.Item name="fields" label="显示字段" rules={[{ required: true, type: 'array', min: 1 }]}><Select mode="multiple" options={chartHeaders.map(value => ({ value }))} /></Form.Item>}
      <Space align="start" wrap><Form.Item name="startRow" label="起始行"><InputNumber min={1} precision={0} /></Form.Item><Form.Item name="endRow" label="结束行（0 表示末尾）"><InputNumber min={0} precision={0} /></Form.Item></Space>
    </>}{dialog === 'chart' && chartPreview && <div className="physical-chart-preview"><Text type="secondary">{record && recordLabel(record)} · {record?.rawFiles.find(file => file.id === chartPreview.rawFileId)?.name}</Text><TrialChart chart={chartPreview} rawFile={record?.rawFiles.find(file => file.id === chartPreview.rawFileId)} /></div>}</>}
  </Form>;
  // Commit record selection before another action can consume its source.
  const setRoute = (next: Record<string, string>) => {
    const destination = new URLSearchParams(next);
    if (next.experimentId && next.experimentId === experiment?.id) for (const key of trialListQueryKeys) {
      if (params.has(key)) destination.set(key, params.get(key)!);
    }
    setParams(destination, { flushSync: true });
  };
  const categoryRoute: Record<string, string> = family ? { objectId: family.id } : {};
  const objectRoute: Record<string, string> = configuration ? { ...categoryRoute, configurationId: configuration.id } : categoryRoute;
  const experimentRoute: Record<string, string> = experiment ? { ...objectRoute, experimentId: experiment.id } : objectRoute;
  const trialRoute: Record<string, string> = trial ? { ...experimentRoute, trialId: trial.id } : experimentRoute;
  const backTarget = record ? { label: '返回具体试验', route: trialRoute }
    : trial ? { label: '返回试验构型', route: experimentRoute }
      : experiment ? { label: '返回具体物理对象', route: objectRoute } : undefined;
  const crumbs = [
    ...(family ? [{ title: family.name }] : []),
    ...(configuration ? [{ title: experiment ? <Button type="link" onClick={() => setRoute(objectRoute)}>{configuration.name}</Button> : configuration.name }] : []),
    ...(experiment ? [{ title: trial ? <Button type="link" onClick={() => setRoute(experimentRoute)}>{experiment.name}</Button> : experiment.name }] : []),
    ...(trial ? [{ title: record ? <Button type="link" onClick={() => setRoute(trialRoute)}>{trial.name}</Button> : trial.name }] : []),
    ...(record ? [{ title: recordLabel(record) }] : []),
  ];
  const configPage = (config: PhysicalConfiguration) => <>
    <div className="physical-config-title"><div><Text type="secondary">具体物理对象</Text><Title level={4}>{config.name}</Title>{config.description && <Text>{config.description}</Text>}<div><Text type="secondary">{config.experiments.length} 个试验构型 · {config.experiments.reduce((count, item) => count + item.trials.length, 0)} 项具体试验</Text></div></div><Button type="primary" onClick={() => startDialog('experiment', { parameters: [{ name: '', value: '', unit: '', description: '' }] })}>新建试验构型</Button></div>
    <Card size="small" title="技术参数" extra={<Button size="small" onClick={() => startDialog('parameter', { parameters: [{ name: '', value: '', unit: '', description: '' }] })}>新增参数</Button>}>{config.parameters.length ? <div className="physical-field-list">{config.parameters.map(item => <div className="physical-field-row" key={item.id}><Tooltip title={item.description || undefined}><span className={item.description ? 'physical-field-name has-description' : ''}>{item.name}</span></Tooltip><strong>{item.value || '—'} {item.unit}</strong><Button className="physical-parameter-edit" type="link" size="small" onClick={() => { startDialog('parameter', { parameters: [{ ...item }] }); setEditingParameterId(item.id); }}>编辑</Button></div>)}</div> : <Text type="secondary">暂无参数</Text>}</Card>
    {config.designs.length > 0 && <Card size="small" title="对象通用要求">{config.designs.map(design => <div key={design.id} className="physical-design-case"><strong>{design.name}</strong>{design.fields.map(field => <div className="physical-field-row" key={field.id}><Tag>{field.usage}</Tag><span>{field.name}</span><strong>{field.comparison ? `${field.comparison} ` : ''}{field.value} {field.unit}</strong></div>)}</div>)}</Card>}
  </>;
  const experimentPage = (item: ExperimentDefinition, config: PhysicalConfiguration) => {
    const results = collectAnalysisResults(undefined, getSourceArtifacts(projects, sessions, { physicalObjectId: config.id, experimentId: item.id }));
    return <>
    <div className="physical-config-title"><div><Text type="secondary">试验构型</Text><Title level={4}>{item.name}</Title>{item.description && <Text>{item.description}</Text>}</div><Button onClick={() => { startDialog('experiment', { name: item.name, description: item.description, testType: item.testType, parameters: item.parameters }); setEditingExperimentId(item.id); }}>编辑试验构型</Button></div>
    {item.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === item.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === item.designArtifactRef?.artifactId)} />}
    <Card size="small" title="试验构型参数">{renderFields(item.parameters)}</Card>
    <Card size="small" title={`具体试验 · ${item.trials.length}`} extra={<Button type="primary" size="small" onClick={() => startDialog('trial', { taskBookId: params.get('taskBookId') || undefined })}>新建具体试验</Button>}>
      <PhysicalTrialsTable trials={item.trials} tasks={tasks} params={params} onQueryChange={patch => {
        const next = new URLSearchParams(params);
        for (const [key, value] of Object.entries(patch)) { if (value) next.set(key, value); else next.delete(key); }
        setParams(next, { replace: true, flushSync: true });
      }} onOpen={trialId => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id, trialId })} />
    </Card>
    {results.length > 0 && <AnalysisResults entries={results} />}
    </>;
  };
  const trialPage = (entry: ConcreteTrial, item: ExperimentDefinition, config: PhysicalConfiguration) => {
    const sourceScope = { physicalObjectId: config.id, experimentId: item.id, trialId: entry.id, testRecordId: record?.id };
    const artifacts = getTrialArtifacts(projects, sessions, sourceScope, entry);
    const results = collectAnalysisResults(entry, artifacts, record?.id);
    return <>
      <div className="physical-config-title"><div><Text type="secondary">{record ? '试验记录' : '具体试验'}</Text><Title level={4}>{record ? recordLabel(record) : entry.name}</Title>{!record && entry.description && <Text>{entry.description}</Text>}</div>{!record && <Button onClick={() => { startDialog('trial', { ...entry, designArtifactId: entry.designArtifactRef?.artifactId }); setEditingTrialId(entry.id); }}>编辑具体试验</Button>}</div>
      <Card size="small" title="试验信息"><Text strong>载荷谱：{entry.loadSpectrum || '旧数据未登记，请编辑补充'}</Text>{entry.loadSpectrumDescription && <div>{entry.loadSpectrumDescription}</div>}<div><Text type="secondary">{entry.taskBookId ? `任务书：${tasks.find(task => task.id === entry.taskBookId)?.title || entry.taskBookId}（ID：${entry.taskBookId}）` : '自主试验'}</Text></div></Card>
      {entry.designArtifactRef && <ReferencedDesign artifact={projects.find(project => project.id === entry.designArtifactRef?.projectId)?.artifacts.find(artifact => artifact.id === entry.designArtifactRef?.artifactId)} />}
      {Boolean(entry.designs?.length) && <Card size="small" title="历史工况备注">{renderFields(entry.designs!)}</Card>}
      {!record ? <Card size="small" title={`试验记录 · ${entry.records.length} 次执行`} extra={<Button type="primary" size="small" disabled={sourceUnavailable || !entry.loadSpectrum} onClick={() => startDialog('record')}>{entry.records.length ? '新增一次记录' : '创建第 1 次记录'}</Button>}>
        <Table<TestRecord> className="physical-execution-table" size="middle" rowKey="id" dataSource={entry.records} scroll={{ x: 650 }}
          locale={{ emptyText: '尚无执行记录' }} pagination={{ pageSize: 10, showSizeChanger: false, showTotal: total => `共 ${total} 次执行` }} columns={[
            { title: '执行记录', dataIndex: 'name', width: 230, render: (_, execution) => <Button className="physical-trial-name" type="link" onClick={() => setRoute({ objectId: family!.id, configurationId: config.id, experimentId: item.id, trialId: entry.id, recordId: execution.id })}>{recordLabel(execution)}</Button> },
            { title: '执行时间', dataIndex: 'createdAt', width: 180, render: (date: string) => date && Number.isFinite(Date.parse(date)) ? new Date(date).toLocaleString('zh-CN') : '未登记' },
            { title: 'CSV 文件', width: 90, render: (_, execution) => execution.rawFiles.length },
            { title: '图表 / 数据表 / 指标', width: 170, render: (_, execution) => { const own = collectAnalysisResults(entry, getTrialArtifacts(projects, sessions, { ...sourceScope, testRecordId: execution.id }, entry), execution.id); return ['chart', 'table', 'metric'].map(kind => own.filter(result => result.kind === kind).length).join(' / '); } },
          ]} />
      </Card> : <Card size="small" title="执行记录与原始数据">
          <div className="physical-record-heading"><div><strong>{recordLabel(record)}</strong>{record.description && <div>{record.description}</div>}<div><Text type="secondary">记录 ID：{record.id}</Text></div></div><Button onClick={editRecord}>编辑记录 / 添加文件</Button></div>
          {(record.actualConditions.length > 0 || record.measurements.length > 0) && <div className="physical-record-columns"><div><Text strong>历史实际条件</Text>{renderFields(record.actualConditions)}</div><div><Text strong>历史测量备注</Text>{renderFields(record.measurements)}</div></div>}
          <div className="physical-file-row"><Space><FileAddOutlined /><strong>CSV 原始文件</strong><Tag>{record.rawFiles.length}</Tag></Space><span>{record.rawFiles.map(file => `${file.name} · ${file.rowCount} 行`).join('；') || '暂无文件，请添加本次执行的 CSV'}</span></div>
      </Card>}
      <AnalysisResults trial={entry} activeKind={params.get('result') ?? 'chart'} onKindChange={kind => { const next = new URLSearchParams(params); next.set('result', kind); setParams(next, { replace: true }); }} entries={results} shared={!record} extra={record && <Space wrap><Button size="small" disabled={!record.rawFiles.some(file => file.headers.length)} onClick={() => openTable()}>新建数据表</Button><Button type="primary" size="small" disabled={!record.rawFiles.some(file => file.headers.length)} onClick={() => openChart()}>新建图表</Button></Space>} actions={result => record ? <Space>{result.chart && <><Button type="link" onClick={() => openChart(result.chart)}>配置</Button><Button type="link" disabled={exporting} onClick={() => exportSavedChart(result.chart!)}>导出 PNG</Button></>}{result.table && <Button type="link" onClick={() => openTable(result.table)}>配置</Button>}</Space> : result.record && <Button type="link" onClick={() => setRoute({ ...trialRoute, recordId: result.record!.id })}>前往来源记录</Button>} />
    </>;
  };
  const objectPage = () => <Empty description={objects.length ? '从左侧选择具体物理对象或试验构型' : '请先创建对象类别'} />;
  if (activeTab === 'taskbooks') return <Navigate to={params.get('taskId') ? taskBookPath(params.get('taskId')!) : '/task-center'} replace />;
  return <div className="physical-page">
    <div className="physical-heading"><div><div className="workspace-kicker">试验工作表</div><Title level={3}>物理对象与试验数据</Title></div></div>
    {crumbs.length > 0 && <nav className="physical-breadcrumb" aria-label="业务路径"><Breadcrumb items={crumbs} /></nav>}
    {sourceUnavailable && <Alert type="error" showIcon message={requestedRecordUnavailable ? '指定的试验记录不存在或已失效，未切换到其他记录。' : '业务来源已失效；请选择已有对象、构型或记录，不会自动改用其他数据。'} action={<Button onClick={() => setRoute(trialRoute)}>{trial ? '返回所属具体试验' : experiment ? '返回试验构型' : configuration ? '返回具体物理对象' : '重新选择来源'}</Button>} />}
    <Card className="physical-workspace-card" bordered={false}><Tabs activeKey={activeTab} onChange={key => { const next = new URLSearchParams(params); if (key === 'objects') next.delete('view'); else next.set('view', key); if (key !== 'taskbooks') next.delete('taskId'); setParams(next); }} items={[
      { key: 'objects', label: '对象与试验', children: <main className="physical-flow-main">{!sourceUnavailable && <>{backTarget && <div className="physical-level-back"><Button type="link" onClick={() => setRoute(backTarget.route)}>{backTarget.label}</Button></div>}{trial && experiment && configuration ? trialPage(trial, experiment, configuration) : experiment && configuration ? experimentPage(experiment, configuration) : configuration ? configPage(configuration) : objectPage()}</>}</main> },
      { key: 'tools', label: '专业功能', children: <div className="physical-tool-grid">{Object.entries(capabilityNames).map(([key, label]) => <Card key={key} size="small" title={label}><Text type="secondary">{configuration ? `${trial ? `当前试验：${trial.name}` : `当前对象：${configuration.name}`}` : '独立使用'}</Text><Button type="primary" block onClick={() => launchCapability(key)}>打开</Button></Card>)}</div> },
    ]} /></Card>
    <Modal title={dialog ? dialogTitles[dialog] : ''} open={Boolean(dialog)} onCancel={() => { if (!saving) setDialog(null); }} onOk={() => form.submit()} confirmLoading={saving} cancelButtonProps={{ disabled: saving }} okText="保存" cancelText="取消" destroyOnHidden width={dialog === 'chart' || dialog === 'table' ? 820 : 640} okButtonProps={{ icon: <SaveOutlined /> }} footer={dialog === 'chart' ? <Space wrap><Button disabled={saving} onClick={() => setDialog(null)}>取消</Button><Button disabled={saving} onClick={generatePreview}>生成预览</Button><Button loading={saving} onClick={() => { form.validateFields().then(values => submit(values, true)).catch(() => {}); }}>保存并导出 PNG</Button><Button type="primary" loading={saving} onClick={() => form.submit()}>保存成果</Button></Space> : undefined}>{dialogContent()}</Modal>
  </div>;
};


export default PhysicalObjectsPage;
