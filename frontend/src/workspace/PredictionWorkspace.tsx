import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Descriptions, Empty, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { fetchApplicableModels, fetchPredictionTasks, runPrediction, savePrediction } from '../services/predictionApi';
import { useSessionRouteState, useSessionState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath } from './sessionModel';
import { configurationLabel, modelKey, preferredModel, sameConfiguration, type ApplicableModel, type PredictionCatalog, type PredictionRequest, type PredictionService, type PredictionTarget, type PredictionTask, type PredictionValue } from './predictionContract';
import { physicalSourcePath } from './physicalBusinessContext';
import WorkspacePageHeader from './WorkspacePageHeader';

const { Text } = Typography;
const errorText = (error: unknown) => error instanceof Error ? error.message : '预测服务请求失败，请重试';

function PredictionResult({ task }: { task: PredictionTask }) {
  return <>
    <Descriptions size="small" column={{ xs: 1, md: 2 }} items={[
      { key: 'target', label: '目标构型', children: configurationLabel(task.targetConfiguration) },
      { key: 'model', label: '使用模型', children: `${task.model.modelName} · ${task.model.version}` },
      { key: 'source', label: '模型来源构型', children: configurationLabel(task.model.sourceConfiguration) },
      { key: 'task', label: '计算任务', children: task.taskId },
      { key: 'inputs', label: '输入条件', children: task.model.inputFields.map(field => `${field.label}：${task.inputs[field.key] ?? '未填写'} ${field.unit ?? ''}`).join('；') || '无额外输入' },
    ]} />
    <p>{task.result.summary}</p>
    <Table size="small" rowKey={(_, index) => String(index)} scroll={{ x: true }} pagination={{ pageSize: 10 }}
      dataSource={task.result.rows} columns={task.result.columns.map(column => ({ title: `${column.label}${column.unit ? ` / ${column.unit}` : ''}`, dataIndex: column.key, render: value => value ?? '—' }))} />
  </>;
}

function PredictionForm({ service, target, returnPath }: { service: PredictionService; target: PredictionTarget; returnPath?: string }) {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [catalog, setCatalog] = useState<PredictionCatalog>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [historyError, setHistoryError] = useState('');
  const [selected, setSelected] = useState<ApplicableModel>();
  const [draft, setDraft] = useSessionState<{ modelKey: string; inputs: Record<string, PredictionValue> }>('predictionDraftV1', { modelKey: '', inputs: {} });
  const [busy, setBusy] = useState<'run' | 'save' | null>(null);
  const [result, setResult] = useState<PredictionTask>();
  const [history, setHistory] = useState<PredictionTask[]>([]);
  const [viewing, setViewing] = useState<PredictionTask>();
  const controller = useRef<AbortController | null>(null);
  const historyController = useRef<AbortController | null>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const name = service === 'virtualCondition' ? '虚拟工况扩展' : '数字孪生预测';

  const selectModel = (model?: ApplicableModel) => {
    setSelected(model);
    setResult(undefined);
    form.resetFields();
    const inputs = model ? draftRef.current.modelKey === modelKey(model) ? draftRef.current.inputs
      : Object.fromEntries(model.inputFields.filter(field => field.defaultValue !== undefined).map(field => [field.key, field.defaultValue!])) : {};
    form.setFieldsValue({ inputs });
    if (model) setDraft({ modelKey: modelKey(model), inputs });
  };
  const loadHistory = async () => {
    historyController.current?.abort();
    const active = new AbortController();
    historyController.current = active;
    setHistoryError('');
    try {
      const tasks = await fetchPredictionTasks(service, target, active.signal);
      if (!active.signal.aborted) setHistory(tasks);
    } catch (cause) { if (!active.signal.aborted) setHistoryError(errorText(cause)); }
  };
  const load = async () => {
    controller.current?.abort();
    historyController.current?.abort();
    const active = new AbortController();
    controller.current = active;
    setLoading(true); setError(''); setCatalog(undefined); setResult(undefined); setHistory([]); setHistoryError(''); setBusy(null);
    selectModel();
    try {
      const next = await fetchApplicableModels(service, target, active.signal);
      if (active.signal.aborted) return;
      setCatalog(next);
      selectModel(next.models.find(model => modelKey(model) === draftRef.current.modelKey && model.availability === 'available') ?? preferredModel(next.models));
      if (next.persistenceReady) void loadHistory();
    } catch (cause) { if (!active.signal.aborted) setError(errorText(cause)); }
    finally { if (!active.signal.aborted) setLoading(false); }
  };
  useEffect(() => {
    void load();
    return () => { controller.current?.abort(); historyController.current?.abort(); };
  // Parent remounts this form when the target or inherited parameters change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const predict = async () => {
    if (busy || !catalog?.serviceReady || selected?.availability !== 'available') return;
    let values;
    try { values = await form.validateFields(); } catch { return; }
    const inputs = Object.fromEntries(selected.inputFields.filter(field => values.inputs?.[field.key] !== undefined && values.inputs?.[field.key] !== null).map(field => [field.key, values.inputs[field.key]]));
    const input: PredictionRequest = { requestId: crypto.randomUUID(), service, targetConfiguration: structuredClone(target), model: structuredClone(selected), inputs };
    setDraft({ modelKey: modelKey(selected), inputs });
    const active = new AbortController(); controller.current = active;
    setBusy('run'); setError(''); setResult(undefined);
    try {
      const task = await runPrediction(input, active.signal);
      if (!active.signal.aborted) { setResult(task); if (task.saved && catalog.persistenceReady) void loadHistory(); }
    } catch (cause) { if (!active.signal.aborted) setError(errorText(cause)); }
    finally { if (!active.signal.aborted) setBusy(null); }
  };
  const save = async () => {
    if (busy || !result || result.saved || !catalog?.persistenceReady) return;
    const active = new AbortController(); controller.current = active;
    setBusy('save'); setError('');
    try {
      const task = await savePrediction(result, active.signal);
      if (!active.signal.aborted) { setResult(task); void loadHistory(); }
    } catch (cause) { if (!active.signal.aborted) setError(errorText(cause)); }
    finally { if (!active.signal.aborted) setBusy(null); }
  };
  const available = catalog?.models.filter(model => model.availability === 'available') ?? [];
  const optionLabel = (model: ApplicableModel) => `${model.modelName} · ${model.version} · 来源：${configurationLabel(model.sourceConfiguration)}${sameConfiguration(model.sourceConfiguration, target) ? '（本构型）' : '（其他构型）'}${model.recommended ? ' · 推荐' : ''}`;
  return <div className="workspace-business-page">
    <WorkspacePageHeader title={`${target.experimentName} · ${name}`} actions={<Space>{returnPath && <Button onClick={() => navigate(returnPath)}>返回试验构型</Button>}<Button onClick={load} disabled={Boolean(busy)} loading={loading}>刷新模型</Button></Space>} />
    {error && <Alert showIcon type="error" title={error} />}
    {catalog && !catalog.serviceReady && <Alert showIcon type="warning" title={catalog.message || '预测计算服务未就绪，请稍后刷新'} />}
    {catalog?.serviceReady && catalog.message && <Alert showIcon type="info" title={catalog.message} />}
    <Card size="small" title="选择适用模型" loading={loading}>
      {catalog && !available.length && <Empty description={catalog.models.length ? '模型尚未就绪，暂无可用模型' : '暂无适用于此目标构型的模型'} />}
      {available.length === 1 ? <Text strong>{optionLabel(available[0])}</Text> : available.length > 1 && <Select aria-label="适用模型" style={{ width: '100%' }} value={selected ? modelKey(selected) : undefined} placeholder="选择适用模型" optionFilterProp="label" showSearch disabled={Boolean(busy)}
        options={catalog!.models.map(model => ({ value: modelKey(model), label: `${optionLabel(model)}${model.availability !== 'available' ? ` · ${model.message || (model.availability === 'not_ready' ? '未就绪' : '不可用')}` : ''}`, disabled: model.availability !== 'available' }))}
        onChange={key => { selectModel(catalog!.models.find(model => modelKey(model) === key)); setError(''); }} />}
      {selected?.applicability && <p><Text type="secondary">{selected.applicability}</Text></p>}
      {catalog?.models.filter(model => model.availability !== 'available').map(model => <p key={modelKey(model)}><Text type="secondary">{optionLabel(model)} · {model.message || '未就绪或不可用'}</Text></p>)}
    </Card>
    <Card size="small" title="预测目标状态">
      <Form form={form} layout="vertical" disabled={Boolean(busy) || !selected || !catalog?.serviceReady} onValuesChange={(_, values) => {
        setResult(undefined); setError('');
        if (selected) setDraft({ modelKey: modelKey(selected), inputs: Object.fromEntries(Object.entries(values.inputs ?? {}).filter(([, value]) => value !== undefined && value !== null)) as Record<string, PredictionValue> });
      }}>
        {selected ? selected.inputFields.length ? selected.inputFields.map(field => <Form.Item key={field.key} name={['inputs', field.key]} label={`${field.label}${field.unit ? ` / ${field.unit}` : ''}`} rules={[
          { required: field.required, type: field.type === 'number' ? 'number' : 'string', message: `请输入${field.label}`, ...(field.type === 'text' ? { whitespace: true } : {}) },
          ...(field.type === 'number' ? [{ type: 'number' as const, min: field.min, max: field.max, message: '请输入要求范围内的数值' }] : []),
        ]}>{field.type === 'number' ? <InputNumber style={{ width: '100%', maxWidth: 420 }} min={field.min} max={field.max} /> : <Input style={{ maxWidth: 420 }} />}</Form.Item>) : <p>此模型无需额外目标状态输入。</p> : <Text type="secondary">获取并选择可用模型后填写目标状态。</Text>}
      </Form>
      <Button type="primary" onClick={predict} loading={busy === 'run'} disabled={!catalog?.serviceReady || !selected || Boolean(busy)}>执行预测</Button>
    </Card>
    {result && <Card size="small" title={<Space>预测结果<Tag color={result.saved ? 'green' : 'blue'}>{result.saved ? '已保存到目标构型' : '待保存'}</Tag></Space>} extra={<Button type="primary" onClick={save} loading={busy === 'save'} disabled={result.saved || !catalog?.persistenceReady || Boolean(busy)}>保存预测结果</Button>}>
      <PredictionResult task={result} />
      {!catalog?.persistenceReady && !result.saved && <Alert type="warning" showIcon title="预测结果保存服务尚未就绪，当前结果尚未归档" />}
    </Card>}
    {catalog?.persistenceReady && <Card size="small" title="本构型的预测计算任务" extra={<Button onClick={loadHistory}>刷新任务</Button>}>
      {historyError && <Alert type="error" showIcon title={historyError} />}
      <Table size="small" rowKey="taskId" dataSource={history} locale={{ emptyText: '尚无已保存的预测计算任务' }} pagination={{ pageSize: 5 }} columns={[
        { title: '计算任务', dataIndex: 'taskId' },
        { title: '使用模型', render: (_, task) => `${task.model.modelName} · ${task.model.version}` },
        { title: '模型来源构型', render: (_, task) => configurationLabel(task.model.sourceConfiguration) },
        { title: '操作', render: (_, task) => <Button type="link" onClick={() => setViewing(task)}>查看结果</Button> },
      ]} />
    </Card>}
    <Modal title="预测计算任务" open={Boolean(viewing)} onCancel={() => setViewing(undefined)} footer={null} width={860} destroyOnHidden>{viewing && <PredictionResult task={viewing} />}</Modal>
  </div>;
}

export default function PredictionWorkspace({ service }: { service: PredictionService }) {
  const incoming = useSessionRouteState();
  const { physicalSource, session } = useWorkspaceBusinessSession(incoming);
  const objects = usePhysicalObjectStore(state => state.objects);
  const navigate = useNavigate();
  const target = useMemo<PredictionTarget | undefined>(() => physicalSource.configuration && physicalSource.experiment && !physicalSource.missing ? {
    physicalObjectId: physicalSource.configuration.id, physicalObjectName: physicalSource.configuration.name,
    experimentId: physicalSource.experiment.id, experimentName: physicalSource.experiment.name,
    testType: physicalSource.experiment.testType, objectParameters: physicalSource.configuration.parameters, configurationParameters: physicalSource.experiment.parameters,
  } : undefined, [physicalSource]);
  if (!target) return <Card size="small" title={service === 'virtualCondition' ? '虚拟工况扩展' : '数字孪生预测'}>
    <Alert type={physicalSource.missing ? 'error' : 'info'} showIcon title={physicalSource.missing ? '目标构型已失效，请返回选择已有试验构型' : '请从试验构型进入，或选择一个已有试验构型'} />
    <Select aria-label="预测目标试验构型" placeholder="选择试验构型" style={{ width: '100%', marginTop: 12 }} showSearch optionFilterProp="label" options={objects.flatMap(family => family.configurations.flatMap(config => config.experiments.map(experiment => ({ value: `${config.id}/${experiment.id}`, label: `${family.name} / ${config.name} / ${experiment.name}`, config, experiment }))))}
      onChange={(_, option) => {
        const chosen = Array.isArray(option) ? option[0] : option;
        if (!chosen) return;
        const id = useSessionStore.getState().ensurePhysicalSession({ physicalObjectId: chosen.config.id, physicalObjectName: chosen.config.name, experimentId: chosen.experiment.id, experimentName: chosen.experiment.name }, `${chosen.experiment.name} · 专业工作`);
        useSessionStore.getState().openSession(id, service); navigate(getSessionPath(id, service));
      }} />
  </Card>;
  return <PredictionForm key={JSON.stringify([service, target])} service={service} target={target} returnPath={physicalSourcePath(objects, { physicalObjectId: session.physicalObjectId, experimentId: session.experimentId })} />;
}
