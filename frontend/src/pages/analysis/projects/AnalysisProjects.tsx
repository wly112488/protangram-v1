import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Form, Modal, Progress, Row,
  Select, Space, Table, Tabs, Tag, Timeline, Typography, message,
} from 'antd';
import {
  BarChartOutlined, CheckCircleOutlined, FileTextOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import ductFlowDiagram from '@/assets/duct_flow_diagram.png';
import { useTrialAIAssistant } from '@/components/TrialAIAssistant';
import type { BusinessAction, BusinessRouteState, DataContract, ModelContract, TaskContract } from '@/types/businessContext';
import PreparationChecklist from '@/workspace/PreparationChecklist';
import ProjectSaveTargetModal from '@/workspace/ProjectSaveTargetModal';
import { createAnalysisArtifactInput, createRootCauseArtifactInput } from '@/workspace/projectModel';
import { createTaskContextSearch, createTaskReturnPath, createWorkspaceNavigationState } from '@/workspace/businessSessionModel';
import { useProjectStore } from '@/workspace/projectStore';
import { useTaskStore } from '@/workspace/taskStore';
import { useWorkspaceBusinessSession } from '@/workspace/useWorkspaceBusinessSession';
import '@/workspace/visualIntegrations.css';

const { Title, Text, Paragraph } = Typography;

const TASKS = [
  {
    id: 'engine-high-speed', name: '发动机高转速验证试验', source: '智能试验设计方案 #03', status: '已完成',
    experimentFile: 'experiment_20260829.csv', environmentFile: 'environment_20260829.csv',
    controlFile: 'control_20260829.csv', modelData: 'digital_twin_v2', conditions: 8, dataCount: 12000,
  },
  {
    id: 'thermal-boundary', name: '热边界稳定性试验', source: '响应曲面设计方案 #02', status: '已完成',
    experimentFile: 'thermal_test_02.csv', environmentFile: 'thermal_environment_02.csv',
    controlFile: 'thermal_control_02.csv', modelData: 'digital_twin_thermal_v1', conditions: 6, dataCount: 8600,
  },
  {
    id: 'vibration', name: '结构振动特性试验', source: '两水平因子设计方案 #07', status: '已完成',
    experimentFile: 'vibration_07.csv', environmentFile: 'vibration_environment_07.csv',
    controlFile: 'vibration_control_07.csv', modelData: 'digital_twin_structure_v1', conditions: 10, dataCount: 15400,
  },
];

const DEFAULT_CONFIG = {
  metrics: ['出口温度', '推力', '压力', '振动'], scope: '全部工况', comparison: '实测数据与模型预测',
  contents: ['趋势分析', '异常检测', '根因分析'], sensitivity: '中',
};
const EMPTY_CONFIRMATION = { task: false, data: false, config: false };

const ANOMALIES = [
  { key: 'temperature', event: '出口温度异常', condition: '工况07', time: '13:25', level: '高' },
  { key: 'pressure', event: '压力波动', condition: '工况07', time: '13:24', level: '中' },
  { key: 'vibration', event: '振动升高', condition: '工况08', time: '14:10', level: '中' },
];

const ROOT_CAUSES: Record<string, Array<{ key: string; reason: string; relevance: string }>> = {
  temperature: [
    { key: 'cooling', reason: '冷却流量下降', relevance: '高' }, { key: 'pressure', reason: '进口压力波动', relevance: '中' },
    { key: 'environment', reason: '环境温度变化', relevance: '低' }, { key: 'sensor', reason: '传感器异常', relevance: '低' },
  ],
  pressure: [
    { key: 'valve', reason: '控制阀响应滞后', relevance: '高' }, { key: 'flow', reason: '进口流量扰动', relevance: '中' },
    { key: 'sensor', reason: '压力传感器漂移', relevance: '低' },
  ],
  vibration: [
    { key: 'resonance', reason: '高转速区域局部共振', relevance: '高' }, { key: 'balance', reason: '转子动平衡偏差', relevance: '中' },
    { key: 'mount', reason: '安装边界变化', relevance: '低' },
  ],
};

const EVIDENCE = [
  '13:21 冷却流量开始下降',
  '13:23 进口压力出现波动',
  '13:25 出口温度超过正常范围',
  '13:27 推力开始下降',
];

const MEASUREMENT_POINTS = [
  { id: '0', label: '自由来流', station: '上游来流区', x: 4, y: 47, pressure: '101.3 kPa', velocity: '24.8 m/s', temperature: '24.1 ℃', deviation: '+0.2%', status: '稳定', related: '来流基准状态' },
  { id: '1', label: '入口测点', station: 'Inlet / Rotor 前缘上游', x: 46.5, y: 47, pressure: '100.8 kPa', velocity: '31.6 m/s', temperature: '24.4 ℃', deviation: '+0.8%', status: '稳定', related: '入口压力与流量' },
  { id: '2', label: '叶轮前测点', station: 'Rotor inlet', x: 53.8, y: 47, pressure: '96.4 kPa', velocity: '38.9 m/s', temperature: '25.1 ℃', deviation: '+2.1%', status: '关注', related: '压力下降 / 流速提升' },
  { id: '3', label: '叶轮后测点', station: 'Rotor outlet', x: 59.2, y: 47, pressure: '103.7 kPa', velocity: '46.8 m/s', temperature: '31.6 ℃', deviation: '+4.6%', status: '异常', related: '出口温度异常 / 压力波动' },
  { id: '4', label: '出口测点', station: 'Exit', x: 77.6, y: 47, pressure: '102.1 kPa', velocity: '43.2 m/s', temperature: '29.8 ℃', deviation: '+1.7%', status: '关注', related: '出口恢复与推力表现' },
];

const levelTag = (level: string) => <Tag color={level === '高' ? 'red' : level === '中' ? 'orange' : 'default'}>{level}</Tag>;
const pointStatusColor = (status: string) => status === '异常' ? 'red' : status === '关注' ? 'orange' : 'green';

const DEFAULT_MODEL: ModelContract = {
  modelId: 'engine-v2.1', modelName: '发动机模型', version: 'V2.1', trustedRange: '2000～8000 rpm', status: '已确认', calibratedAt: '2026-08-28',
};

type SaveKind = 'analysis' | 'rootCause';

const AnalysisProjects: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setContext } = useTrialAIAssistant();
  const incoming = location.state as BusinessRouteState | null;
  const { projects, session, targetProject, activeTask, recordArtifactForTaskItem } = useWorkspaceBusinessSession(incoming);
  const addArtifact = useProjectStore((state) => state.addArtifact);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const autoExecute = Boolean(incoming?.autoExecute && session.mode === 'task' && session.taskItemId);

  const routedTaskContract = incoming?.task ?? (activeTask ? {
    taskId: activeTask.id,
    taskName: activeTask.title,
    taskType: '任务书分析',
    source: activeTask.sourceName || '任务中心',
    status: activeTask.status === '已完成' ? '已完成' as const : '待执行' as const,
  } : undefined);
  const routedTask = routedTaskContract ? {
    id: routedTaskContract.taskId, name: routedTaskContract.taskName, source: routedTaskContract.source, status: routedTaskContract.status,
    experimentFile: incoming?.data?.dataName ?? `${routedTaskContract.taskId}.csv`, environmentFile: `environment_${routedTaskContract.taskId}.csv`,
    controlFile: `control_${routedTaskContract.taskId}.csv`, modelData: incoming?.model ? `${incoming.model.modelName} ${incoming.model.version}` : 'digital_twin_v2',
    conditions: incoming?.plan?.length ?? 8, dataCount: (incoming?.plan?.length ?? 8) * 1500,
  } : null;
  const availableTasks = routedTask ? [routedTask, ...TASKS.filter((item) => item.id !== routedTask.id)] : TASKS;
  const initialTask = routedTask ?? TASKS[0];
  const initialData = { experimentFile: incoming?.data?.dataName ?? initialTask.experimentFile, environmentFile: initialTask.environmentFile, controlFile: initialTask.controlFile, modelData: initialTask.modelData };
  const activeModel = incoming?.model ?? DEFAULT_MODEL;
  const initialConfig = incoming?.validation ? {
    ...DEFAULT_CONFIG,
    metrics: incoming.validation.metrics,
    scope: incoming.validation.suggestedRange || DEFAULT_CONFIG.scope,
  } : DEFAULT_CONFIG;

  const [task, setTask] = useState(initialTask);
  const [data, setData] = useState(initialData);
  const [config, setConfig] = useState(initialConfig);
  const [draftConfig, setDraftConfig] = useState(initialConfig);
  const [draftTaskId, setDraftTaskId] = useState(initialTask.id);
  const [draftData, setDraftData] = useState(data);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [dataModalOpen, setDataModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [saveTargetOpen, setSaveTargetOpen] = useState(false);
  const [continueToReportAfterSave, setContinueToReportAfterSave] = useState(false);
  const [pendingSaveKind, setPendingSaveKind] = useState<SaveKind>('analysis');
  const [savedProjectId, setSavedProjectId] = useState<string | undefined>(session.targetProjectId);
  const [savedAnalysisProjectId, setSavedAnalysisProjectId] = useState<string | null>(null);
  const [savedRootCauseProjectId, setSavedRootCauseProjectId] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [activeTab, setActiveTab] = useState('trend');
  const [selectedAnomaly, setSelectedAnomaly] = useState(ANOMALIES[0]);
  const [selectedMeasurementPoint, setSelectedMeasurementPoint] = useState(MEASUREMENT_POINTS[3]);
  const [confirmed, setConfirmed] = useState(autoExecute ? { task: true, data: true, config: true } : EMPTY_CONFIRMATION);
  const timer = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const autoReturned = useRef(false);
  const preparationReady = Object.values(confirmed).every(Boolean);

  const boundProject = projects.find((project) => project.id === savedProjectId) ?? targetProject;
  const effectiveSession = useMemo<NonNullable<BusinessRouteState['workspaceSession']>>(
    () => boundProject ? (session.mode === 'task' ? session : { mode: 'project', targetProjectId: boundProject.id }) : { mode: 'standalone' },
    [boundProject, session],
  );

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const invalidateResult = () => {
    setAnalyzed(false);
    setActiveTab('trend');
    setSelectedAnomaly(ANOMALIES[0]);
    setSavedAnalysisProjectId(null);
    setSavedRootCauseProjectId(null);
  };

  const selectTask = () => {
    const next = availableTasks.find((item) => item.id === draftTaskId) ?? initialTask;
    setTask(next);
    setData({ experimentFile: next.experimentFile, environmentFile: next.environmentFile, controlFile: next.controlFile, modelData: next.modelData });
    setConfirmed((prev) => ({ ...prev, task: true, data: false }));
    setTaskModalOpen(false);
    invalidateResult();
  };

  const startAnalysis = () => {
    if (!preparationReady) return message.warning('请先确认全部分析准备项');
    if (timer.current !== null) window.clearTimeout(timer.current);
    setAnalyzing(true);
    setAnalyzed(false);
    setSavedAnalysisProjectId(null);
    setSavedRootCauseProjectId(null);
    timer.current = window.setTimeout(() => {
      setAnalyzing(false);
      setAnalyzed(true);
      setActiveTab('trend');
      setSelectedAnomaly(ANOMALIES[0]);
      setSelectedMeasurementPoint(MEASUREMENT_POINTS[3]);
      timer.current = null;
      message.success('分析完成，发现 3 个异常事件');
    }, 900);
  };

  const reset = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setTask(initialTask);
    setData(initialData);
    setDraftData(initialData);
    setDraftTaskId(initialTask.id);
    setConfig(initialConfig);
    setDraftConfig(initialConfig);
    setConfirmed(EMPTY_CONFIRMATION);
    setSelectedMeasurementPoint(MEASUREMENT_POINTS[3]);
    setAnalyzing(false);
    invalidateResult();
    message.success('已恢复默认分析状态');
  };

  const rootCauseRows = ROOT_CAUSES[selectedAnomaly.key] ?? ROOT_CAUSES.temperature;
  const primaryRootCause = rootCauseRows[0];

  const persistResult = (projectId: string, kind: SaveKind): string | null => {
    if (!analyzed) return null;
    const project = projects.find((item) => item.id === projectId);
    if (!project) return null;

    const artifactInput = kind === 'analysis'
      ? createAnalysisArtifactInput({
          title: `${task.name} · 分析结果`,
          summary: '发现 3 个异常事件，高转速区域温度异常，建议重新校准模型',
          payload: {
            task,
            data,
            config,
            model: activeModel,
            anomalies: ANOMALIES,
            measurementPoint: selectedMeasurementPoint,
            abnormalRange: '7600～8000 rpm',
            conclusion: '高转速区域温度异常，当前模型在该区域预测偏差明显增大。',
            charts: [{ id: 'analysis-trend', title: `${selectedAnomaly.event}趋势与模型对比` }],
          },
        })
      : createRootCauseArtifactInput({
          title: `${selectedAnomaly.event} · 根因结论`,
          summary: `${primaryRootCause.reason}与${selectedAnomaly.event}具有${primaryRootCause.relevance}关联`,
          payload: {
            anomaly: selectedAnomaly,
            confirmedRootCause: primaryRootCause,
            candidates: rootCauseRows,
            evidence: EVIDENCE,
            affectedRange: '7600～8000 rpm',
          },
        });

    const artifact = addArtifact(projectId, artifactInput);
    if (!artifact) return null;
    recordArtifactForTaskItem({ projectId, artifactId: artifact.id });
    setSavedProjectId(projectId);
    if (kind === 'analysis') setSavedAnalysisProjectId(projectId);
    else setSavedRootCauseProjectId(projectId);
    setSaveTargetOpen(false);
    message.success(`${kind === 'analysis' ? '分析结果' : '根因结论'}已保存到项目“${project.name}”`);
    return artifact.id;
  };

  const requestSave = (kind: SaveKind) => {
    if (!analyzed) return message.warning('请先完成试验数据分析');
    if (boundProject) {
      persistResult(boundProject.id, kind);
      return;
    }
    setPendingSaveKind(kind);
    setSaveTargetOpen(true);
  };

  const handleBusinessAction = useCallback((action: BusinessAction) => {
    if (!analyzed) return message.warning('请先完成试验数据分析');
    const taskContract: TaskContract = { taskId: task.id, taskName: task.name, taskType: '已执行试验', source: task.source, status: '已完成' };
    const dataContract: DataContract = { dataId: `data-${task.id}`, dataName: data.experimentFile, dataType: '试验实测数据', source: '试验数据分析', taskId: task.id };
    const result = { resultType: '试验数据分析', resultSummary: '发现 3 个异常事件，高转速区域温度异常，建议重新校准模型', abnormalRange: '7600～8000 rpm', metrics: config.metrics };
    const base: BusinessRouteState = { source: 'dataAnalysis', task: taskContract, data: dataContract, model: activeModel, result, workspaceSession: effectiveSession };
    if (action === '用于模型校准') navigate(`/analysis/digital-twin${createTaskContextSearch(effectiveSession)}`, { state: base });
    if (action === '虚拟工况扩展') navigate(`/analysis/virtual-condition${createTaskContextSearch(effectiveSession)}`, { state: { ...base, validation: { goal: '扩展高转速异常区域', suggestedRange: '7600～8200 rpm', metrics: ['出口温度', '推力'], recommendedRuns: 5 } } satisfies BusinessRouteState });
    if (action === '生成补充试验') navigate(`/experiment/design/intelligent${createTaskContextSearch(effectiveSession)}`, { state: { ...base, validation: { goal: `验证${selectedAnomaly.event}及主要根因`, suggestedRange: '7600～8200 rpm', metrics: [selectedAnomaly.event, '推力'], recommendedRuns: 5 } } satisfies BusinessRouteState });
    if (action === '加入报告') {
      if (boundProject) {
        const artifactId = persistResult(boundProject.id, 'analysis');
        if (!artifactId) return;
        if (effectiveSession.mode === 'task') {
          addArtifactToReport(effectiveSession.taskId, { projectId: boundProject.id, artifactId });
          navigate(createTaskReturnPath(effectiveSession));
          return;
        }
        navigate('/report/create', { state: { ...createWorkspaceNavigationState(boundProject.id), artifactIds: [artifactId] } });
        return;
      }
      setPendingSaveKind('analysis');
      setContinueToReportAfterSave(true);
      setSaveTargetOpen(true);
    }
  }, [activeModel, addArtifact, addArtifactToReport, analyzed, boundProject, config, data, effectiveSession, navigate, projects, recordArtifactForTaskItem, selectedAnomaly, selectedMeasurementPoint, task]);

  useEffect(() => {
    if (!autoExecute || autoStarted.current || !preparationReady) return;
    autoStarted.current = true;
    startAnalysis();
  }, [autoExecute, preparationReady]);

  useEffect(() => {
    if (!autoExecute || !analyzed || autoReturned.current || effectiveSession.mode !== 'task' || !effectiveSession.taskItemId || !boundProject) return;
    autoReturned.current = true;
    const artifactId = persistResult(boundProject.id, 'analysis');
    if (!artifactId) return;
    addArtifactToReport(effectiveSession.taskId, { projectId: boundProject.id, artifactId });
    setRequirementStatus(effectiveSession.taskId, effectiveSession.taskItemId, '已满足');
    message.success('已按复核后的任务规划完成模拟分析，成果已回到原任务');
    navigate(createTaskReturnPath(effectiveSession));
  }, [addArtifactToReport, analyzed, autoExecute, boundProject, effectiveSession, navigate, persistResult, setRequirementStatus]);

  useEffect(() => {
    setContext({
      pageType: 'dataAnalysis',
      pageName: '试验数据分析',
      projectName: boundProject?.name,
      taskName: task.name,
      modelName: `${activeModel.modelName} ${activeModel.version}`,
      dataName: data.experimentFile,
      resultSummary: analyzed ? '发现 3 个异常事件' : '等待开始分析',
      resultReady: analyzed,
      onBusinessAction: handleBusinessAction,
    });
    return () => setContext(null);
  }, [activeModel.modelName, activeModel.version, analyzed, boundProject?.name, data.experimentFile, handleBusinessAction, setContext, task.name]);

  const trendOption = {
    tooltip: { trigger: 'axis' }, legend: { data: ['实测值', '模型预测'] },
    xAxis: { type: 'category', data: ['工况01', '工况02', '工况03', '工况04', '工况05', '工况06', '工况07', '工况08'] },
    yAxis: { type: 'value', name: selectedAnomaly.event },
    series: [
      {
        name: '实测值', type: 'line', smooth: true, data: [642, 648, 651, 657, 663, 671, 708, 701],
        markPoint: { data: [{ name: selectedAnomaly.event, coord: [selectedAnomaly.condition, selectedAnomaly.key === 'vibration' ? 701 : 708], value: '异常', itemStyle: { color: '#ff4d4f' } }] },
      },
      { name: '模型预测', type: 'line', smooth: true, lineStyle: { type: 'dashed' }, data: [640, 646, 650, 655, 661, 668, 680, 686] },
    ],
  };

  const tabs = [
    {
      key: 'trend', label: '趋势与异常', children: <>
        <ReactECharts option={trendOption} style={{ height: 300 }} />
        <Table size="small" pagination={false} dataSource={ANOMALIES}
          rowClassName={(record) => record.key === selectedAnomaly.key ? 'ant-table-row-selected' : ''}
          onRow={(record) => ({ onClick: () => setSelectedAnomaly(record), style: { cursor: 'pointer' } })}
          columns={[
            { title: '异常事件', dataIndex: 'event' }, { title: '工况', dataIndex: 'condition' },
            { title: '时间', dataIndex: 'time' }, { title: '程度', dataIndex: 'level', render: levelTag },
          ]} />
      </>,
    },
    {
      key: 'root', label: '根因分析', children: <>
        <Alert type="warning" showIcon title={`异常事件：${selectedAnomaly.event}`} style={{ marginBottom: 16 }} />
        <Table size="small" pagination={false} dataSource={rootCauseRows} columns={[
          { title: '排序', render: (_value: unknown, _record: unknown, index: number) => index + 1, width: 80 },
          { title: '可能原因', dataIndex: 'reason' }, { title: '关联程度', dataIndex: 'relevance', render: levelTag },
        ]} />
      </>,
    },
    {
      key: 'evidence', label: '证据链', children: <>
        <Timeline items={EVIDENCE.map((item, index) => ({ color: index === 2 ? 'red' : undefined, children: item }))} />
        <Row gutter={16}>
          <Col span={8}><Card size="small" title="历史相似事件"><Text>发现 2 次相似高转速温升事件，均伴随冷却流量下降。</Text></Card></Col>
          <Col span={8}><Card size="small" title="模型预测偏差"><Text>工况07预测偏差由 1.8% 上升至 4.6%。</Text></Card></Col>
          <Col span={8}><Card size="small" title="相关指标变化"><Text>冷却流量 -8.2%，压力波动 +3.1%，推力 -2.4%。</Text></Card></Col>
        </Row>
      </>,
    },
    {
      key: 'conclusion', label: '分析结论', children: <Card size="small">
        <Paragraph><Text strong>主要异常：</Text>出口温度在高转速工况下明显升高。</Paragraph>
        <Paragraph><Text strong>主要根因候选：</Text>冷却流量下降与温度异常具有较强关联。</Paragraph>
        <Paragraph><Text strong>影响范围：</Text>主要出现在 7600～8000 rpm 区域。</Paragraph>
        <Paragraph><Text strong>模型表现：</Text>当前数字孪生模型在该区域预测偏差明显增大。</Paragraph>
        <Text strong>建议：</Text><ol><li>确认根因后对高转速区域补充验证试验。</li><li>使用本次数据重新校准数字孪生模型。</li></ol>
      </Card>,
    },
  ];

  const openTask = () => { setDraftTaskId(task.id); setTaskModalOpen(true); };
  const openData = () => { setDraftData(data); setDataModalOpen(true); };
  const openConfig = () => { setDraftConfig(config); setConfigModalOpen(true); };

  return (
    <div className="workspace-business-page">
      <div className="workspace-business-heading workspace-page-heading">
        <div><Title level={4} style={{ margin: 0 }}>试验数据分析</Title><Text type="secondary">加载试验关联数据，识别异常并形成根因、证据与分析结论</Text></div>
        <Tag color={boundProject ? 'blue' : 'default'}>{boundProject ? `项目：${boundProject.name}` : '独立模式'}</Tag>
      </div>
      {incoming?.source && (incoming.task || incoming.data || incoming.model || incoming.result || incoming.validation) && (
        <Alert showIcon type="info" title={`已从${incoming.source === 'intelligentDesign' ? '试验设计' : incoming.source === 'digitalTwin' ? '试验数字孪生' : incoming.source === 'virtualCondition' ? '虚拟工况扩展' : '试验数据分析'}带入业务上下文`} description={[incoming.task && `任务：${incoming.task.taskName}`, incoming.data && `数据：${incoming.data.dataName}`, incoming.model && `模型：${incoming.model.modelName} ${incoming.model.version}`, incoming.result && `结果：${incoming.result.resultSummary}`, incoming.validation && `验证目标：${incoming.validation.goal}`].filter(Boolean).join('；')} style={{ marginBottom: 16 }} />
      )}

      <PreparationChecklist
        title="分析准备"
        items={[
          { key: 'task', label: '试验任务', value: task.name, confirmed: confirmed.task, onClick: openTask },
          { key: 'data', label: '关联数据', value: data.experimentFile, confirmed: confirmed.data, onClick: openData },
          { key: 'config', label: '分析配置', value: `${config.scope} / ${config.sensitivity}敏感度`, confirmed: confirmed.config, onClick: openConfig },
        ]}
        actions={<Space size={6}>
          <Button type={preparationReady ? 'primary' : 'default'} icon={<BarChartOutlined />} disabled={!preparationReady} loading={analyzing} onClick={startAnalysis}>开始分析</Button>
          <Button type="text" size="small" className="workspace-reset-action" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
        </Space>}
      />

      <Card title="当前任务与数据" size="small" className="workspace-business-card">
        <Descriptions size="small" column={3} items={[
          { key: 'task', label: '当前任务', children: task.name }, { key: 'source', label: '来源方案', children: task.source },
          { key: 'status', label: '执行状态', children: <Tag color="green">{task.status}</Tag> }, { key: 'file', label: '试验数据', children: data.experimentFile },
          { key: 'conditions', label: '工况数量', children: `${task.conditions} 组` }, { key: 'count', label: '数据量', children: `${task.dataCount.toLocaleString()} 条` },
          { key: 'metrics', label: '分析指标', span: 3, children: config.metrics.join('、') },
        ]} />
      </Card>

      <Card
        title={<Space size={8}><span>设备交互模型 · 剖面测点</span><Tag color="blue">0–4 点位联动</Tag></Space>}
        extra={<Text type="secondary">点击模型测点查看当前工况数据</Text>}
        size="small"
        className="workspace-business-card analysis-model-card"
      >
        <div className="analysis-structure-view">
          <div className="analysis-structure-canvas">
            <img src={ductFlowDiagram} alt="涵道风扇剖面与流场测点示意" />
            {MEASUREMENT_POINTS.map((point) => (
              <button
                type="button"
                key={point.id}
                className={`analysis-hotspot ${selectedMeasurementPoint.id === point.id ? 'active' : ''}`}
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                aria-label={`查看${point.id}号测点 ${point.label}`}
                title={`${point.id}号测点 · ${point.label}`}
                onClick={() => setSelectedMeasurementPoint(point)}
              >
                <span>{point.id}</span>
              </button>
            ))}
          </div>

          <div className="analysis-point-panel">
            <div className="analysis-point-head">
              <div>
                <Text type="secondary">当前测点</Text>
                <Title level={5}>{selectedMeasurementPoint.id} · {selectedMeasurementPoint.label}</Title>
                <Text type="secondary">{selectedMeasurementPoint.station}</Text>
              </div>
              <Tag color={pointStatusColor(selectedMeasurementPoint.status)}>{selectedMeasurementPoint.status}</Tag>
            </div>
            <Descriptions
              size="small"
              column={1}
              className="analysis-point-descriptions"
              items={[
                { key: 'pressure', label: '静压', children: selectedMeasurementPoint.pressure },
                { key: 'velocity', label: '流速', children: selectedMeasurementPoint.velocity },
                { key: 'temperature', label: '温度', children: selectedMeasurementPoint.temperature },
                { key: 'deviation', label: '模型偏差', children: <Text type={selectedMeasurementPoint.status === '异常' ? 'danger' : undefined}>{selectedMeasurementPoint.deviation}</Text> },
                { key: 'related', label: '关联结果', children: selectedMeasurementPoint.related },
              ]}
            />
            <div className="analysis-point-footnote">
              当前关联：<strong>工况07 · 7600 rpm</strong>。切换测点不会修改原始试验数据，仅切换分析视图。
            </div>
          </div>
        </div>
      </Card>

      <Card id="business-result" title="分析结果" size="small" className="workspace-business-card">
        {analyzing ? (
          <div style={{ padding: '48px 12%' }}><Progress percent={72} status="active" /><Paragraph type="secondary" style={{ textAlign: 'center' }}>正在执行趋势、异常与根因分析...</Paragraph></div>
        ) : analyzed ? (
          <><Alert type="warning" showIcon title="分析完成，发现 3 个异常事件" style={{ marginBottom: 16 }} /><Tabs activeKey={activeTab} onChange={setActiveTab} items={tabs} />
            <div className="workspace-result-actions"><Space wrap>
              <Button icon={<SaveOutlined />} onClick={() => requestSave('analysis')}>{savedAnalysisProjectId ? '分析结果已保存' : '保存分析结果'}</Button>
              <Button icon={<CheckCircleOutlined />} onClick={() => requestSave('rootCause')}>{savedRootCauseProjectId ? '根因已确认' : `确认根因：${primaryRootCause.reason}`}</Button>
              <Button onClick={() => handleBusinessAction('用于模型校准')}>用于模型校准</Button>
              <Button onClick={() => handleBusinessAction('虚拟工况扩展')}>虚拟工况扩展</Button>
              <Button onClick={() => handleBusinessAction('生成补充试验')}>生成补充试验</Button>
              <Button type="primary" icon={<FileTextOutlined />} onClick={() => handleBusinessAction('加入报告')}>加入报告</Button>
            </Space></div>
          </>
        ) : (
          <Alert type="info" showIcon title="当前任务数据已就绪，点击“开始分析”生成分析结果" />
        )}
      </Card>

      <Modal title="选择试验任务" open={taskModalOpen} onCancel={() => setTaskModalOpen(false)} onOk={selectTask}>
        <Select style={{ width: '100%' }} value={draftTaskId} onChange={setDraftTaskId} options={availableTasks.map((item) => ({ value: item.id, label: `${item.name}（${item.status}）` }))} />
      </Modal>
      <Modal title="确认关联数据" open={dataModalOpen} onCancel={() => setDataModalOpen(false)} onOk={() => { setData(draftData); setConfirmed((prev) => ({ ...prev, data: true })); setDataModalOpen(false); invalidateResult(); }}>
        <Form labelCol={{ span: 7 }} wrapperCol={{ span: 16 }}>
          <Form.Item label="试验数据"><Select value={draftData.experimentFile} onChange={(value) => setDraftData({ ...draftData, experimentFile: value })} options={[task.experimentFile, 'experiment_01.csv', 'experiment_backup.csv'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item label="环境数据"><Select value={draftData.environmentFile} onChange={(value) => setDraftData({ ...draftData, environmentFile: value })} options={[task.environmentFile, 'environment_01.csv'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item label="控制数据"><Select value={draftData.controlFile} onChange={(value) => setDraftData({ ...draftData, controlFile: value })} options={[task.controlFile, 'control_01.csv'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item label="模型预测数据"><Select value={draftData.modelData} onChange={(value) => setDraftData({ ...draftData, modelData: value })} options={[task.modelData, 'digital_twin_v2'].map((value) => ({ value }))} /></Form.Item>
        </Form>
      </Modal>
      <Modal title="分析配置" open={configModalOpen} width={620} onCancel={() => setConfigModalOpen(false)} onOk={() => { setConfig(draftConfig); setConfirmed((prev) => ({ ...prev, config: true })); setConfigModalOpen(false); invalidateResult(); }}>
        <Form labelCol={{ span: 5 }} wrapperCol={{ span: 18 }}>
          <Form.Item label="分析指标"><Checkbox.Group value={draftConfig.metrics} options={['出口温度', '推力', '压力', '振动']} onChange={(value) => setDraftConfig({ ...draftConfig, metrics: value as string[] })} /></Form.Item>
          <Form.Item label="分析范围"><Select value={draftConfig.scope} onChange={(value) => setDraftConfig({ ...draftConfig, scope: value })} options={['全部工况', ...Array.from({ length: 8 }, (_, index) => `工况${String(index + 1).padStart(2, '0')}`)].map((value) => ({ value }))} /></Form.Item>
          <Form.Item label="对比方式"><Select value={draftConfig.comparison} onChange={(value) => setDraftConfig({ ...draftConfig, comparison: value })} options={['实测数据与模型预测', '仅实测数据'].map((value) => ({ value }))} /></Form.Item>
          <Form.Item label="分析内容"><Checkbox.Group value={draftConfig.contents} options={['趋势分析', '异常检测', '根因分析']} onChange={(value) => setDraftConfig({ ...draftConfig, contents: value as string[] })} /></Form.Item>
          <Form.Item label="异常敏感度"><Select value={draftConfig.sensitivity} onChange={(value) => setDraftConfig({ ...draftConfig, sensitivity: value })} options={['低', '中', '高'].map((value) => ({ value }))} /></Form.Item>
        </Form>
      </Modal>
      <ProjectSaveTargetModal open={saveTargetOpen} title={pendingSaveKind === 'analysis' ? '保存分析结果到项目' : '确认根因并保存到项目'} defaultProjectId={boundProject?.id} onCancel={() => { setSaveTargetOpen(false); setContinueToReportAfterSave(false); }} onConfirm={(projectId) => {
        const artifactId = persistResult(projectId, pendingSaveKind);
        if (artifactId && continueToReportAfterSave) {
          setContinueToReportAfterSave(false);
          if (effectiveSession.mode === 'task') {
            addArtifactToReport(effectiveSession.taskId, { projectId, artifactId });
            navigate(createTaskReturnPath(effectiveSession));
            return;
          }
          navigate('/report/create', { state: { ...createWorkspaceNavigationState(projectId), artifactIds: [artifactId] } });
        }
      }} />
    </div>
  );
};

export default AnalysisProjects;
