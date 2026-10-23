import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, InputNumber, Modal, Space, Table, Tag, Typography } from 'antd';
import { ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { runPredictionPreview, savePredictionPreview } from '../services/predictionPreview';
import { useSessionRouteState, useSessionState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';
import { predictionInputs, predictionUserFields, type PredictionPreparation, type PredictionPreviewTask, type PredictionRequest, type PredictionService, type PredictionTarget, type PredictionValue } from './predictionContract';
import type { ProfessionalDataContext } from './professionalContext';
import PreparationChecklist from './PreparationChecklist';
import { predictionArtifactInput } from './analysisResultModel';
import { predictionParameterError, predictionPreparation } from './predictionParameters';
import CfgPredictionForm from './CfgPredictionForm';

const { Text } = Typography;

function PredictionForm({ service, target, context, archive }: {
  service: PredictionService; target: PredictionTarget; context: ProfessionalDataContext; archive: (task: PredictionPreviewTask) => boolean;
}) {
  const [form] = Form.useForm();
  const preparation = useMemo(() => predictionPreparation(service, context), [service, context]);
  const [error, setError] = useState('');
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [conditionsError, setConditionsError] = useState('');
  const [draft, setDraft] = useSessionState<{ inputs: Record<string, PredictionValue>; confirmedSignature?: string }>('predictionBusinessDraftV2', { inputs: {} });
  const [busy, setBusy] = useState<'run' | 'save' | null>(null);
  const [result, setResult] = useState<PredictionPreviewTask>();
  const [archivedTaskId, setArchivedTaskId] = useState<string>();
  const controller = useRef<AbortController | null>(null);
  const fields = predictionUserFields(preparation);
  const signature = (spec: PredictionPreparation, inputs: Record<string, PredictionValue>) => JSON.stringify([context.scope, spec.inputFields, spec.inheritedInputs, inputs]);
  const inputs = predictionInputs(preparation, draft.inputs);
  const confirmed = !fields.length || draft.confirmedSignature === signature(preparation, inputs);
  useEffect(() => () => controller.current?.abort(), []);

  const confirmConditions = async () => {
    let values;
    try { values = await form.validateFields(); } catch { return; }
    const next = predictionInputs(preparation, values.inputs);
    const invalid = predictionParameterError(next);
    if (invalid) { setConditionsError(invalid); return; }
    setConditionsError('');
    setDraft({ inputs: next, confirmedSignature: signature(preparation, next) });
    setResult(undefined); setError(''); setConditionsOpen(false);
  };
  const predict = async () => {
    if (busy || !confirmed) return;
    const active = new AbortController(); controller.current = active;
    setBusy('run'); setError(''); setResult(undefined);
    try {
      if (active.signal.aborted) return;
      const input: PredictionRequest = { requestId: globalThis.crypto?.randomUUID?.() ?? `prediction-${Date.now()}-${Math.random().toString(36).slice(2)}`, service, targetConfiguration: structuredClone(target), context: structuredClone(context), inputs };
      const task = await runPredictionPreview(input, active.signal);
      if (!active.signal.aborted) {
        setResult(task);
        if (task.saved) {
          if (archive(task)) setArchivedTaskId(task.taskId);
          else setError('本次成果未保存，请重试保存');
        }
      }
    } catch { if (!active.signal.aborted) setError('本次计算未完成，请稍后重试'); }
    finally { if (!active.signal.aborted) setBusy(null); }
  };
  const save = async () => {
    if (busy || !result || archivedTaskId === result.taskId) return;
    const active = new AbortController(); controller.current = active;
    setBusy('save'); setError('');
    try {
      const task = result.saved ? result : await savePredictionPreview(result, active.signal);
      if (!active.signal.aborted) {
        setResult(task);
        if (archive(task)) setArchivedTaskId(task.taskId);
        else setError('本次成果未保存，请重试保存');
      }
    } catch { if (!active.signal.aborted) setError('本次成果未保存，请重试保存'); }
    finally { if (!active.signal.aborted) setBusy(null); }
  };
  const reset = () => {
    const next = predictionInputs(preparation);
    setDraft({ inputs: next }); form.setFieldsValue({ inputs: next }); setResult(undefined); setError('');
  };
  return <div className="workspace-business-page">
    {error && <Alert type="error" showIcon title={error} />}
    <PreparationChecklist title="计算准备" items={[
      { key: 'conditions', label: '计算条件', value: fields.length ? fields.map(field => `${field.label}：${inputs[field.key] ?? '待填写'} ${field.unit ?? ''}`).join('；') : '已继承当前试验条件', confirmed,
        onClick: fields.length && !busy ? () => { form.setFieldsValue({ inputs }); setConditionsError(''); setConditionsOpen(true); } : undefined,
        preview: <Space wrap>{fields.length ? fields.map(field => <Tag key={field.key}>{field.label}：{inputs[field.key]} {field.unit}</Tag>) : <Text>无需补充输入</Text>}</Space>,
      },
    ]} actions={<Space size={6}><Button type="primary" loading={busy === 'run'} disabled={!confirmed || Boolean(busy)} onClick={predict}>执行预测</Button><Button type="text" size="small" className="workspace-reset-action" icon={<ReloadOutlined />} disabled={Boolean(busy)} onClick={reset}>重置</Button></Space>} />
    <Card id="business-result" title="计算结果" size="small" className="workspace-business-card">
      {result ? <><Space><Tag>{service === 'virtualCondition' ? '虚拟预测结果' : '数字孪生结果'}</Tag><Tag color="orange">演示结果</Tag><Tag color={archivedTaskId === result.taskId ? 'green' : 'blue'}>{archivedTaskId === result.taskId ? '已保存到共享成果' : '待保存'}</Tag></Space>
        <Typography.Paragraph>{result.result.summary}</Typography.Paragraph>
        <Table size="small" rowKey={(_, index) => String(index)} scroll={{ x: true }} pagination={{ pageSize: 10 }} dataSource={result.result.rows} columns={result.result.columns.map(column => ({ title: `${column.label}${column.unit ? ` / ${column.unit}` : ''}`, dataIndex: column.key, render: value => value ?? '—' }))} />
        <div className="workspace-result-actions"><Button icon={<SaveOutlined />} onClick={save} loading={busy === 'save'} disabled={archivedTaskId === result.taskId || Boolean(busy)}>保存成果</Button></div>
      </> : <Text type="secondary">{busy === 'run' ? '正在计算…' : '确认计算条件后执行，结果可保存到共享成果。'}</Text>}
    </Card>
    <Modal title="计算条件" open={conditionsOpen} onCancel={() => setConditionsOpen(false)} onOk={confirmConditions} okText="确认" cancelText="取消" destroyOnHidden>
      {conditionsError && <Alert type="error" showIcon title={conditionsError} />}
      <Form form={form} layout="vertical">{fields.map(field => <Form.Item key={field.key} name={['inputs', field.key]} label={`${field.label}${field.unit ? ` / ${field.unit}` : ''}`} rules={[
        { required: field.required, type: field.type === 'number' ? 'number' : 'string', message: `请输入${field.label}`, ...(field.type === 'text' ? { whitespace: true } : {}) },
        ...(field.type === 'number' ? [{ type: 'number' as const, min: field.min, max: field.max, message: '请输入要求范围内的数值' }] : []),
        { validator: async (_rule, value) => {
          if (field.key === 'count' && !Number.isInteger(value)) throw new Error('工况数量请输入正整数');
          if (field.key.endsWith('Max')) {
            const minimum = form.getFieldValue(['inputs', field.key.replace(/Max$/, 'Min')]);
            if (typeof value === 'number' && typeof minimum === 'number' && value < minimum) throw new Error('上限不能小于下限');
          }
        } },
      ]}>{field.type === 'number' ? <InputNumber style={{ width: '100%' }} min={field.min} max={field.max} /> : <Input />}</Form.Item>)}</Form>
    </Modal>
  </div>;
}

export default function PredictionWorkspace({ service }: { service: PredictionService }) {
  const { physicalSource, session, dataContext, addArtifact, recordArtifactForTaskItem } = useWorkspaceBusinessSession(useSessionRouteState());
  const target = useMemo<PredictionTarget | undefined>(() => physicalSource.configuration && physicalSource.experiment && !physicalSource.missing ? {
    physicalObjectId: physicalSource.configuration.id, physicalObjectName: physicalSource.configuration.name,
    experimentId: physicalSource.experiment.id, experimentName: physicalSource.experiment.name,
    testType: physicalSource.experiment.testType, objectParameters: physicalSource.configuration.parameters, configurationParameters: physicalSource.experiment.parameters,
  } : undefined, [physicalSource]);
  if (!target || !dataContext) return <Card title="计算准备" size="small"><Empty description="请从已有试验构型、具体试验或执行记录进入此功能" /></Card>;
  const archive = (task: PredictionPreviewTask) => {
    if (!session.targetProjectId) return false;
    const artifact = addArtifact(session.targetProjectId, predictionArtifactInput(task));
    if (!artifact) return false;
    recordArtifactForTaskItem({ projectId: artifact.projectId, artifactId: artifact.id });
    return true;
  };
  return physicalSource.trial?.cfgId ? <CfgPredictionForm key={JSON.stringify([service,physicalSource.trial.id,physicalSource.trial.cfgId])} service={service} target={target} context={dataContext} cfgId={physicalSource.trial.cfgId} trialId={physicalSource.trial.id} archive={archive} />
    : <PredictionForm key={JSON.stringify([service, target, dataContext.scope, dataContext.rawFiles])} service={service} target={target} context={dataContext} archive={archive} />;
}
