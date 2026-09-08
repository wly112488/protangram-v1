import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Form, InputNumber, Modal, Progress,
  Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  ApiOutlined, ArrowDownOutlined, ArrowUpOutlined, DatabaseOutlined, DeleteOutlined,
  ExperimentOutlined, ReloadOutlined, SafetyCertificateOutlined, SettingOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTrialAIAssistant } from '@/components/TrialAIAssistant';
import type { BusinessAction, BusinessRouteState, ModelContract, PlanCondition, TaskContract } from '@/types/businessContext';
import PreparationChecklist from '@/workspace/PreparationChecklist';
import ProjectSaveTargetModal from '@/workspace/ProjectSaveTargetModal';
import { createDesignArtifactInput } from '@/workspace/projectModel';
import { useProjectStore } from '@/workspace/projectStore';
import { useWorkspaceBusinessSession } from '@/workspace/useWorkspaceBusinessSession';

const { Title, Text, Paragraph } = Typography;

const MODELS: ModelContract[] = [
  { modelId: 'engine-v2.1', modelName: '发动机模型', version: 'V2.1', trustedRange: '2000～8000 rpm', status: '已确认', calibratedAt: '2026-08-28' },
  { modelId: 'engine-v2.0', modelName: '发动机模型', version: 'V2.0', trustedRange: '2000～7200 rpm', status: '已校准', calibratedAt: '2026-06-12' },
  { modelId: 'engine-v1.8', modelName: '发动机模型', version: 'V1.8', trustedRange: '1800～6500 rpm', status: '已校准', calibratedAt: '2026-03-05' },
];

const DATASETS = ['历史试验数据集 A', '高转速验证数据集', '环境适应性试验数据集'];
const DEFAULT_CONFIG = {
  target: '最大化性能', speedMin: 2000, speedMax: 8000,
  temperatureMin: 20, temperatureMax: 120, pressureMin: 1, pressureMax: 2,
  maxRuns: 10, strategy: '自动推荐',
};
const DEFAULT_CONSTRAINTS = {
  speedMax: 8000, temperatureMax: 120, pressureMin: 1,
  safety: true, excludeAbnormal: true,
};
const EMPTY_CONFIRMATION = { model: false, data: false, config: false, constraints: false };
const DEFAULT_PLAN: PlanCondition[] = [
  { key: '01', order: 1, speed: 7200, temperature: 85, pressure: 1.8, recommendation: '高', risk: '低', reason: '历史覆盖不足，预计信息增益高' },
  { key: '02', order: 2, speed: 7600, temperature: 90, pressure: 1.9, recommendation: '高', risk: '中', reason: '接近性能最优区域，需关注安全边界' },
  { key: '03', order: 3, speed: 6800, temperature: 95, pressure: 1.7, recommendation: '中', risk: '低', reason: '模型不确定性较高' },
  { key: '04', order: 4, speed: 6200, temperature: 75, pressure: 1.6, recommendation: '高', risk: '低', reason: '补充中速高载荷区域覆盖' },
  { key: '05', order: 5, speed: 7800, temperature: 105, pressure: 1.8, recommendation: '中', risk: '高', reason: '边界工况验证，预计收益高' },
  { key: '06', order: 6, speed: 5400, temperature: 65, pressure: 1.5, recommendation: '中', risk: '低', reason: '填补参数空间稀疏区域' },
  { key: '07', order: 7, speed: 7400, temperature: 110, pressure: 1.7, recommendation: '高', risk: '中', reason: '温度敏感区域验证' },
  { key: '08', order: 8, speed: 8000, temperature: 100, pressure: 1.9, recommendation: '高', risk: '中', reason: '可信范围上边界验证' },
];

type PlanRow = PlanCondition;
const tagLevel = (value: string) => <Tag color={value === '高' ? 'red' : value === '中' ? 'orange' : 'green'}>{value}</Tag>;

const parseRange = (value?: string) => {
  const numbers = value?.match(/\d+/g)?.map(Number);
  return numbers && numbers.length >= 2 ? [numbers[0], numbers[1]] as const : null;
};

const createPlan = (config: typeof DEFAULT_CONFIG): PlanRow[] => {
  const count = Math.max(1, Math.min(8, config.maxRuns));
  return Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const speed = Math.round((config.speedMin + (config.speedMax - config.speedMin) * ratio) / 10) * 10;
    return {
      key: String(index + 1).padStart(2, '0'),
      order: index + 1,
      speed,
      temperature: 80 + (index * 7) % 36,
      pressure: Number((1.55 + (index * 0.09) % 0.5).toFixed(2)),
      recommendation: index < 3 ? '高' : '中',
      risk: speed >= config.speedMax * 0.97 ? '高' : speed >= config.speedMax * 0.9 ? '中' : '低',
      reason: index < 3 ? '重点验证上游建议区域，预计信息增益高' : '补充参数空间覆盖',
    };
  });
};

const IntelligentExperimentDesign: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as BusinessRouteState | null;
  const { setContext } = useTrialAIAssistant();
  const { projects, targetProject } = useWorkspaceBusinessSession(incoming);
  const addArtifact = useProjectStore((state) => state.addArtifact);

  const incomingRange = parseRange(incoming?.validation?.suggestedRange);
  const initialModel = incoming?.model ?? MODELS[0];
  const initialConfig = incoming?.validation ? {
    ...DEFAULT_CONFIG,
    target: incoming.validation.goal,
    speedMin: incomingRange?.[0] ?? DEFAULT_CONFIG.speedMin,
    speedMax: incomingRange?.[1] ?? DEFAULT_CONFIG.speedMax,
    maxRuns: incoming.validation.recommendedRuns,
  } : DEFAULT_CONFIG;
  const initialConstraints = incomingRange
    ? { ...DEFAULT_CONSTRAINTS, speedMax: incomingRange[1] }
    : DEFAULT_CONSTRAINTS;

  const [model, setModel] = useState(initialModel);
  const [datasets, setDatasets] = useState<string[]>(incoming?.datasets ?? [DATASETS[0]]);
  const [config, setConfig] = useState(initialConfig);
  const [constraints, setConstraints] = useState(initialConstraints);
  const [draftConfig, setDraftConfig] = useState(initialConfig);
  const [draftConstraints, setDraftConstraints] = useState(initialConstraints);
  const [draftModelId, setDraftModelId] = useState(initialModel.modelId);
  const [draftDatasets, setDraftDatasets] = useState<string[]>(incoming?.datasets ?? [DATASETS[0]]);
  const [modelOpen, setModelOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [saveTargetOpen, setSaveTargetOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const [activeTab, setActiveTab] = useState('plan');
  const [plan, setPlan] = useState<PlanRow[]>(createPlan(initialConfig));
  const [confirmed, setConfirmed] = useState(EMPTY_CONFIRMATION);
  const timer = useRef<number | null>(null);
  const preparationReady = Object.values(confirmed).every(Boolean);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const invalidate = () => {
    setGenerated(false);
    setActiveTab('plan');
  };

  const generatePlan = () => {
    if (!preparationReady) return message.warning('请先确认全部方案生成准备项');
    if (timer.current !== null) window.clearTimeout(timer.current);
    setGenerating(true);
    setGenerated(false);
    timer.current = window.setTimeout(() => {
      const next = createPlan(config);
      setPlan(next);
      setGenerating(false);
      setGenerated(true);
      setActiveTab('plan');
      timer.current = null;
      message.success(`已生成 ${next.length} 条推荐试验工况`);
    }, 900);
  };

  const reset = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setModel(initialModel);
    setDatasets(incoming?.datasets ?? [DATASETS[0]]);
    setConfig(initialConfig);
    setConstraints(initialConstraints);
    setConfirmed(EMPTY_CONFIRMATION);
    setPlan(createPlan(initialConfig));
    setGenerating(false);
    invalidate();
    message.success('已恢复默认智能设计配置');
  };

  const persistDesign = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    const artifact = addArtifact(projectId, createDesignArtifactInput({
      title: `${config.target} · 智能推荐方案`,
      summary: `推荐 ${plan.length} 个试验工况，预计覆盖率 86%，高风险工况 ${plan.filter((row) => row.risk === '高').length} 个`,
      payload: {
        model,
        datasets,
        config,
        constraints,
        plan,
        coverage: 86,
        highRiskCount: plan.filter((row) => row.risk === '高').length,
      },
    }));
    if (!artifact) return false;
    message.success(`推荐方案已保存到项目“${project.name}”`);
    return true;
  };

  const createTask = (workspaceSession: NonNullable<BusinessRouteState['workspaceSession']>) => {
    const task: TaskContract = {
      taskId: `intelligent-task-${Date.now()}`,
      taskName: '发动机智能推荐试验任务 #01',
      taskType: incoming?.validation ? '验证试验' : '智能推荐试验',
      source: incoming?.source === 'virtualCondition'
        ? '虚拟工况扩展'
        : incoming?.source === 'dataAnalysis'
          ? '试验数据分析'
          : '智能试验设计',
      status: '待执行',
    };
    navigate('/experiment/tasks', {
      state: { source: 'intelligentDesign', task, model, plan, datasets, workspaceSession } satisfies BusinessRouteState,
    });
  };

  const confirmPlan = () => {
    if (!generated) return message.warning('请先生成推荐方案');
    if (targetProject) {
      if (persistDesign(targetProject.id)) createTask({ mode: 'project', targetProjectId: targetProject.id });
      return;
    }
    setSaveTargetOpen(true);
  };

  const handleBusinessAction = useCallback((action: BusinessAction) => {
    if (action === '调整方案') {
      if (!generated) return message.warning('请先生成推荐方案');
      setAdjustOpen(true);
      return;
    }
    if (action === '查看推荐工况') document.getElementById('business-result')?.scrollIntoView({ behavior: 'smooth' });
  }, [generated]);

  useEffect(() => {
    setContext({
      pageType: 'intelligentDesign',
      pageName: '智能试验设计',
      projectName: targetProject?.name,
      modelName: `${model.modelName} ${model.version}`,
      resultSummary: generated ? `推荐 ${plan.length} 个试验工况` : '等待生成推荐方案',
      resultReady: generated,
      onBusinessAction: handleBusinessAction,
    });
    return () => setContext(null);
  }, [generated, handleBusinessAction, model.modelName, model.version, plan.length, setContext, targetProject?.name]);

  const updatePlan = (key: string, field: 'speed' | 'temperature' | 'pressure', value: number | null) => {
    setPlan((prev) => prev.map((row) => row.key === key ? { ...row, [field]: value ?? row[field] } : row));
  };

  const movePlan = (index: number, offset: number) => setPlan((prev) => {
    const target = index + offset;
    if (target < 0 || target >= prev.length) return prev;
    const next = [...prev];
    [next[index], next[target]] = [next[target], next[index]];
    return next.map((row, rowIndex) => ({ ...row, order: rowIndex + 1 }));
  });

  const planColumns = [
    { title: '序号', dataIndex: 'order', width: 70 },
    { title: '转速', dataIndex: 'speed' },
    { title: '温度', dataIndex: 'temperature' },
    { title: '压力', dataIndex: 'pressure' },
    { title: '推荐程度', dataIndex: 'recommendation', render: tagLevel },
    { title: '风险', dataIndex: 'risk', render: tagLevel },
  ];

  const modelOptions = useMemo(
    () => [model, ...MODELS].filter((item, index, rows) => rows.findIndex((row) => row.modelId === item.modelId) === index),
    [model],
  );

  const tabs = [
    { key: 'plan', label: '推荐方案', children: <Table size="small" pagination={false} dataSource={plan} columns={planColumns} /> },
    { key: 'basis', label: '推荐依据', children: <Table size="small" pagination={false} dataSource={plan} columns={[
      { title: '工况', render: (_value: unknown, row: PlanRow) => `工况${String(row.order).padStart(2, '0')}` },
      { title: '推荐原因', dataIndex: 'reason' },
      { title: '推荐程度', dataIndex: 'recommendation', render: tagLevel },
    ]} /> },
    { key: 'risk', label: '风险与收益', children: <Table size="small" pagination={false} dataSource={plan} columns={[
      { title: '工况', render: (_value: unknown, row: PlanRow) => `工况${String(row.order).padStart(2, '0')}` },
      { title: '风险等级', dataIndex: 'risk', render: tagLevel },
      { title: '预计收益', dataIndex: 'recommendation' },
      { title: '建议', render: (_value: unknown, row: PlanRow) => row.risk === '高' ? <Tag color="orange">谨慎执行</Tag> : <Tag color="green">推荐</Tag> },
    ]} /> },
    { key: 'compare', label: '方案对比', children: <Table size="small" pagination={false} rowKey="name" dataSource={[
      { name: '智能推荐方案', runs: plan.length, coverage: '86%', gain: '高', risks: plan.filter((row) => row.risk === '高').length, cost: '中' },
      { name: '现有 DOE 方案', runs: 12, coverage: '72%', gain: '中', risks: 2, cost: '高' },
    ]} columns={[
      { title: '方案', dataIndex: 'name' }, { title: '试验次数', dataIndex: 'runs' },
      { title: '参数空间覆盖率', dataIndex: 'coverage' }, { title: '预计信息增益', dataIndex: 'gain' },
      { title: '高风险工况', dataIndex: 'risks' }, { title: '预计成本', dataIndex: 'cost' },
    ]} /> },
  ];

  const openModel = () => { setDraftModelId(model.modelId); setModelOpen(true); };
  const openData = () => { setDraftDatasets(datasets); setDataOpen(true); };
  const openConfig = () => { setDraftConfig(config); setConfigOpen(true); };
  const openConstraints = () => { setDraftConstraints(constraints); setConstraintsOpen(true); };

  return (
    <div className="workspace-business-page">
      <div className="workspace-business-heading">
        <div><Title level={4} style={{ margin: 0 }}>智能试验设计</Title><Text type="secondary">基于可信模型、历史数据和安全约束生成推荐试验方案</Text></div>
        <Tag color={targetProject ? 'blue' : 'default'}>{targetProject ? `项目：${targetProject.name}` : '独立模式'}</Tag>
      </div>

      {incoming?.source && (
        <Alert
          type="success"
          showIcon
          title={`已携带可信模型：${model.modelName} ${model.version}`}
          description={`来源：${incoming.source === 'digitalTwin' ? '试验数字孪生' : incoming.source === 'virtualCondition' ? '虚拟工况扩展' : '试验数据分析'}；可信范围：${model.trustedRange}${incoming.validation ? `；建议重点验证：${incoming.validation.suggestedRange}；验证目标：${incoming.validation.goal}` : ''}`}
        />
      )}

      <PreparationChecklist
        title="方案生成准备"
        items={[
          { key: 'model', label: '可信模型', value: `${model.modelName} ${model.version}`, confirmed: confirmed.model, onClick: openModel },
          { key: 'data', label: '历史数据', value: datasets.join('、'), confirmed: confirmed.data, onClick: openData },
          { key: 'config', label: '试验配置', value: `${config.target} / 最多 ${config.maxRuns} 次`, confirmed: confirmed.config, onClick: openConfig },
          { key: 'constraints', label: '约束', value: `转速 ≤ ${constraints.speedMax} rpm`, confirmed: confirmed.constraints, onClick: openConstraints },
        ]}
      />

      <Card size="small" className="workspace-business-card"><Space wrap>
        <Button icon={<ApiOutlined />} onClick={openModel}>选择可信模型</Button>
        <Button icon={<DatabaseOutlined />} onClick={openData}>选择历史数据</Button>
        <Button icon={<SettingOutlined />} onClick={openConfig}>试验配置</Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={openConstraints}>约束设置</Button>
        <Button type={preparationReady ? 'primary' : 'default'} icon={<ExperimentOutlined />} disabled={!preparationReady} loading={generating} onClick={generatePlan}>生成推荐方案</Button>
        <Button type="text" size="small" className="workspace-reset-action" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
      </Space></Card>

      <Card title="当前配置" size="small" className="workspace-business-card"><Descriptions size="small" column={2} items={[
        { key: 'target', label: '当前目标', children: config.target },
        { key: 'model', label: '可信模型', children: `${model.modelName} ${model.version}` },
        { key: 'data', label: '历史数据', children: datasets.join('、') },
        { key: 'factors', label: '因素', children: '转速、温度、压力' },
        { key: 'constraints', label: '约束', children: `转速 ≤ ${constraints.speedMax} rpm、温度 ≤ ${constraints.temperatureMax}℃、最多 ${config.maxRuns} 次` },
        { key: 'range', label: '模型可信范围', children: model.trustedRange },
      ]} /></Card>

      <Card id="business-result" title="推荐结果" size="small" className="workspace-business-card">
        {generating ? (
          <div style={{ padding: '48px 12%' }}><Progress percent={76} status="active" /><Paragraph type="secondary" style={{ textAlign: 'center' }}>正在评估参数空间、信息增益与安全边界...</Paragraph></div>
        ) : generated ? (
          <>
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={6}><Card size="small"><Statistic title="推荐试验数" value={plan.length} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="预计覆盖率" value={86} suffix="%" /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="高风险工况" value={plan.filter((row) => row.risk === '高').length} /></Card></Col>
              <Col span={6}><Card size="small"><Statistic title="推荐策略" value={config.strategy} /></Card></Col>
            </Row>
            <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
            <div className="workspace-result-actions"><Space>
              <Button onClick={() => setAdjustOpen(true)}>调整方案</Button>
              <Button type="primary" onClick={confirmPlan}>确认方案并创建试验任务</Button>
            </Space></div>
          </>
        ) : (
          <Alert type="info" showIcon title="配置可信模型、历史数据和约束后，点击“生成推荐方案”" />
        )}
      </Card>

      <Modal title="选择可信模型" open={modelOpen} onCancel={() => setModelOpen(false)} onOk={() => { setModel(modelOptions.find((item) => item.modelId === draftModelId) ?? MODELS[0]); setConfirmed((prev) => ({ ...prev, model: true })); setModelOpen(false); invalidate(); }}>
        <Select style={{ width: '100%' }} value={draftModelId} onChange={setDraftModelId} options={modelOptions.map((item) => ({ value: item.modelId, label: `${item.modelName} ${item.version}｜${item.trustedRange}｜${item.calibratedAt ?? '本次校准'}` }))} />
      </Modal>
      <Modal title="选择历史数据" open={dataOpen} onCancel={() => setDataOpen(false)} onOk={() => { setDatasets(draftDatasets); setConfirmed((prev) => ({ ...prev, data: true })); setDataOpen(false); invalidate(); }}>
        <Select mode="multiple" style={{ width: '100%' }} value={draftDatasets} onChange={setDraftDatasets} options={DATASETS.map((value) => ({ value }))} />
      </Modal>
      <Modal title="试验配置" width={680} open={configOpen} onCancel={() => setConfigOpen(false)} onOk={() => { setConfig(draftConfig); setConfirmed((prev) => ({ ...prev, config: true })); setConfigOpen(false); invalidate(); }}><Form labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
        <Form.Item label="试验目标"><Select value={draftConfig.target} onChange={(value) => setDraftConfig({ ...draftConfig, target: value })} options={[draftConfig.target, '最大化性能', '最小化能耗', '提高稳定性'].filter((value, index, rows) => rows.indexOf(value) === index).map((value) => ({ value }))} /></Form.Item>
        {[['转速', 'speedMin', 'speedMax'], ['温度', 'temperatureMin', 'temperatureMax'], ['压力', 'pressureMin', 'pressureMax']].map(([label, minKey, maxKey]) => <Form.Item label={label} key={label}><Space><InputNumber value={draftConfig[minKey as keyof typeof draftConfig] as number} onChange={(value) => setDraftConfig({ ...draftConfig, [minKey]: value ?? 0 })} /><Text>～</Text><InputNumber value={draftConfig[maxKey as keyof typeof draftConfig] as number} onChange={(value) => setDraftConfig({ ...draftConfig, [maxKey]: value ?? 0 })} /></Space></Form.Item>)}
        <Form.Item label="最大试验次数"><InputNumber min={1} max={30} value={draftConfig.maxRuns} onChange={(value) => setDraftConfig({ ...draftConfig, maxRuns: value ?? 10 })} /></Form.Item>
        <Form.Item label="优化策略"><Select value={draftConfig.strategy} onChange={(value) => setDraftConfig({ ...draftConfig, strategy: value })} options={['自动推荐', '单目标优化', '多目标优化', '安全优化'].map((value) => ({ value }))} /></Form.Item>
      </Form></Modal>
      <Modal title="约束设置" open={constraintsOpen} onCancel={() => setConstraintsOpen(false)} onOk={() => { setConstraints(draftConstraints); setConfirmed((prev) => ({ ...prev, constraints: true })); setConstraintsOpen(false); invalidate(); }}><Form labelCol={{ span: 8 }} wrapperCol={{ span: 14 }}>
        <Form.Item label="转速上限（rpm）"><InputNumber value={draftConstraints.speedMax} onChange={(value) => setDraftConstraints({ ...draftConstraints, speedMax: value ?? 8000 })} /></Form.Item>
        <Form.Item label="温度上限（℃）"><InputNumber value={draftConstraints.temperatureMax} onChange={(value) => setDraftConstraints({ ...draftConstraints, temperatureMax: value ?? 120 })} /></Form.Item>
        <Form.Item label="最低压力（MPa）"><InputNumber value={draftConstraints.pressureMin} onChange={(value) => setDraftConstraints({ ...draftConstraints, pressureMin: value ?? 1 })} /></Form.Item>
        <Form.Item label="安全策略"><Space orientation="vertical"><Checkbox checked={draftConstraints.safety} onChange={(event) => setDraftConstraints({ ...draftConstraints, safety: event.target.checked })}>启用安全约束</Checkbox><Checkbox checked={draftConstraints.excludeAbnormal} onChange={(event) => setDraftConstraints({ ...draftConstraints, excludeAbnormal: event.target.checked })}>排除历史异常工况</Checkbox></Space></Form.Item>
      </Form></Modal>
      <Modal title="调整推荐方案" width={900} open={adjustOpen} onCancel={() => setAdjustOpen(false)} onOk={() => { setAdjustOpen(false); message.success('推荐方案已更新'); }}>
        <Table size="small" pagination={false} dataSource={plan} columns={[
          { title: '顺序', dataIndex: 'order', width: 64 },
          { title: '转速', render: (_value: unknown, row: PlanRow) => <InputNumber size="small" value={row.speed} onChange={(value) => updatePlan(row.key, 'speed', value)} /> },
          { title: '温度', render: (_value: unknown, row: PlanRow) => <InputNumber size="small" value={row.temperature} onChange={(value) => updatePlan(row.key, 'temperature', value)} /> },
          { title: '压力', render: (_value: unknown, row: PlanRow) => <InputNumber size="small" value={row.pressure} onChange={(value) => updatePlan(row.key, 'pressure', value)} /> },
          { title: '操作', render: (_value: unknown, row: PlanRow, index: number) => <Space><Button size="small" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => movePlan(index, -1)} /><Button size="small" icon={<ArrowDownOutlined />} disabled={index === plan.length - 1} onClick={() => movePlan(index, 1)} /><Button size="small" danger icon={<DeleteOutlined />} onClick={() => setPlan((prev) => prev.filter((item) => item.key !== row.key).map((item, rowIndex) => ({ ...item, order: rowIndex + 1 })))} /></Space> },
        ]} />
      </Modal>
      <ProjectSaveTargetModal
        open={saveTargetOpen}
        title="确认方案并保存到项目"
        skipText="仅创建试验任务，不保存到项目"
        onCancel={() => setSaveTargetOpen(false)}
        onConfirm={(projectId) => {
          if (!persistDesign(projectId)) return;
          setSaveTargetOpen(false);
          createTask({ mode: 'project', targetProjectId: projectId });
        }}
        onSkip={() => {
          setSaveTargetOpen(false);
          createTask({ mode: 'standalone' });
        }}
      />
    </div>
  );
};

export const ExperimentTaskResult: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as BusinessRouteState | null;
  const task: TaskContract = incoming?.task ?? {
    taskId: 'intelligent-task-demo', taskName: '发动机智能推荐试验任务 #01', taskType: '智能推荐试验', source: '智能试验设计', status: '待执行',
  };
  const plan = incoming?.plan ?? DEFAULT_PLAN;
  const [status, setStatus] = useState<TaskContract['status']>(task.status);
  const timer = useRef<number | null>(null);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const startExecution = () => {
    setStatus('执行中');
    timer.current = window.setTimeout(() => {
      setStatus('已完成');
      timer.current = null;
      message.success('试验任务执行完成，可进入数据分析');
    }, 900);
  };

  const enterAnalysis = () => {
    const completedTask = { ...task, status: '已完成' as const };
    navigate('/analysis/projects', { state: {
      source: 'intelligentDesign',
      task: completedTask,
      model: incoming?.model,
      plan,
      workspaceSession: incoming?.workspaceSession,
      data: { dataId: `data-${task.taskId}`, dataName: `${task.taskId}.csv`, dataType: '试验实测数据', source: '试验任务执行', taskId: task.taskId },
    } satisfies BusinessRouteState });
  };

  return (
    <div className="workspace-business-page">
      <div className="workspace-business-heading"><div><Title level={4}>试验任务</Title><Text type="secondary">按确认后的推荐工况执行并回流试验数据</Text></div></div>
      <Alert type={status === '已完成' ? 'success' : 'info'} showIcon title={status === '已完成' ? '试验任务执行完成' : '试验任务已创建'} description={`来源方案：${task.source}`} />
      <Card title={task.taskName} size="small" className="workspace-business-card"><Descriptions column={2} items={[
        { key: 'id', label: '任务编号', children: task.taskId }, { key: 'source', label: '创建来源', children: task.source },
        { key: 'type', label: '任务类型', children: task.taskType }, { key: 'model', label: '来源模型', children: incoming?.model ? `${incoming.model.modelName} ${incoming.model.version}` : '发动机模型 V2.1' },
        { key: 'data', label: '历史数据', children: incoming?.datasets?.join('、') ?? DATASETS[0] }, { key: 'count', label: '试验工况', children: `${plan.length} 组` },
        { key: 'status', label: '执行状态', children: <Tag color={status === '已完成' ? 'green' : status === '执行中' ? 'blue' : 'default'}>{status}</Tag> },
      ]} /></Card>
      <Card title="推荐执行顺序" size="small" className="workspace-business-card"><Table size="small" pagination={false} dataSource={plan} columns={[{ title: '顺序', dataIndex: 'order' }, { title: '转速', dataIndex: 'speed' }, { title: '温度', dataIndex: 'temperature' }, { title: '压力', dataIndex: 'pressure' }, { title: '风险', dataIndex: 'risk', render: tagLevel }]} /></Card>
      <Space>
        {status !== '已完成' && <Button type="primary" loading={status === '执行中'} disabled={status === '执行中'} onClick={startExecution}>{status === '执行中' ? '正在执行' : '开始执行'}</Button>}
        {status === '已完成' && <Button type="primary" onClick={enterAnalysis}>进入试验数据分析</Button>}
        <Button onClick={() => navigate('/')}>返回工作台</Button>
      </Space>
    </div>
  );
};

export default IntelligentExperimentDesign;
