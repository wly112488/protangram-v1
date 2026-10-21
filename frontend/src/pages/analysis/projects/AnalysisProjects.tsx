import TrialDataAnalysisWorkspace from '../../../workspace/TrialDataAnalysisWorkspace';
import { useTrialWorksheet } from '../../../workspace/trialWorksheetContext';
import { UNSELECTED_MODEL } from '@/types/businessContext';
import { useSessionState, useSessionRouteState } from '@/workspace/useSessionState';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Form, Modal, Progress, Row,
  Select, Space, Table, Tabs, Tag, Timeline, Typography, message,
} from 'antd';
import {
  BarChartOutlined, CheckCircleOutlined, FileTextOutlined, ReloadOutlined, SaveOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import ductFlowDiagram from '@/assets/duct_flow_diagram.png';
import { useTrialAIAssistant } from '@/components/TrialAIAssistant';
import type { BusinessAction, BusinessRouteState, DataContract, TaskContract } from '@/types/businessContext';
import PreparationChecklist from '@/workspace/PreparationChecklist';
import ProjectSaveTargetModal from '@/workspace/ProjectSaveTargetModal';
import { createAnalysisArtifactInput, createRootCauseArtifactInput } from '@/workspace/projectModel';
import { createTaskContextSearch, createTaskReturnPath, createWorkspaceNavigationState } from '@/workspace/businessSessionModel';
import { useTaskStore } from '@/workspace/taskStore';
import { useWorkspaceBusinessSession } from '@/workspace/useWorkspaceBusinessSession';
import type { AnalysisResult } from '@/workspace/analysisResultModel';
import TrialCsvAnalysis from '@/workspace/TrialCsvAnalysis';
import { getTrialArtifacts } from '@/workspace/analysisResultModel';
import { useSessionStore } from '@/workspace/sessionStore';
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
const EMPTY_CONFIRMATION = { config: false };

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

type SaveKind = 'analysis' | 'rootCause';

const LegacyAnalysisProjects: React.FC = () => {
  const navigate = useNavigate();
  const { setContext } = useTrialAIAssistant();
  const incoming = useSessionRouteState();
  const { projects, session, targetProject, activeTask, recordArtifactForTaskItem, physicalSource, addArtifact } = useWorkspaceBusinessSession(incoming);
  const sourceSessions = useSessionStore(state => state.sessions);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const autoExecute = Boolean(incoming?.autoExecute && session.mode === 'task' && session.taskItemId);

  const routedTaskContract = useMemo(() => incoming?.task ?? (activeTask ? {
    taskId: activeTask.id,
    taskName: activeTask.title,
    taskType: '任务书分析',
    source: activeTask.sourceName || '任务中心',
    status: activeTask.status === '已完成' ? '已完成' as const : '待执行' as const,
  } : undefined), [incoming?.task, activeTask]);
  const routedTask = useMemo(() => routedTaskContract ? {
    id: routedTaskContract.taskId, name: routedTaskContract.taskName, source: routedTaskContract.source, status: routedTaskContract.status,
    experimentFile: incoming?.data?.dataName ?? `${routedTaskContract.taskId}.csv`, environmentFile: `environment_${routedTaskContract.taskId}.csv`,
    controlFile: `control_${routedTaskContract.taskId}.csv`, modelData: incoming?.model ? `${incoming.model.modelName} ${incoming.model.version}` : 'digital_twin_v2',
    conditions: incoming?.plan?.length ?? 8, dataCount: (incoming?.plan?.length ?? 8) * 1500,
  } : null, [routedTaskContract, incoming]);
  const businessScope = session;
  const sourceRecord = physicalSource.record;
  const boundPhysical = Boolean(session.physicalObjectId);
  const physicalTask = useMemo(() => physicalSource.configuration ? {
    id: sourceRecord?.id ?? physicalSource.experiment?.id ?? physicalSource.configuration.id, name: physicalSource.trial?.name ?? physicalSource.experiment?.name ?? physicalSource.configuration.name, source: '物理对象试验记录', status: sourceRecord ? '已完成' : '尚无记录',
    experimentFile: (sourceRecord?.rawFiles ?? physicalSource.trial?.records.flatMap(record => record.rawFiles) ?? []).map(file => file.name).join('、') || sourceRecord?.name || '尚无 CSV 文件',
    environmentFile: '记录中的实际条件', controlFile: '记录中的试验设置', modelData: '', conditions: sourceRecord ? 1 : physicalSource.trial?.records.length ?? 0,
    dataCount: (sourceRecord?.rawFiles ?? physicalSource.trial?.records.flatMap(record => record.rawFiles) ?? []).reduce((count, file) => count + file.rowCount, 0),
  } : null, [sourceRecord, physicalSource.experiment, physicalSource.configuration, physicalSource.trial]);
  const task = physicalTask ?? routedTask ?? TASKS[0];
  const defaultModel = incoming?.model ?? UNSELECTED_MODEL;
  const data = useMemo(() => ({
    experimentFile: boundPhysical ? task.experimentFile : incoming?.data?.dataName ?? task.experimentFile,
    environmentFile: boundPhysical ? '记录中的实际条件' : task.environmentFile,
    controlFile: boundPhysical ? '记录中的试验设置' : task.controlFile,
    modelData: defaultModel.modelId,
  }), [boundPhysical, task, incoming?.data?.dataName, defaultModel.modelId]);
  const initialConfig = incoming?.validation ? {
    ...DEFAULT_CONFIG,
    metrics: incoming.validation.metrics,
    scope: incoming.validation.suggestedRange || DEFAULT_CONFIG.scope,
  } : DEFAULT_CONFIG;

  const activeModel = useMemo(() => incoming?.model ?? UNSELECTED_MODEL, [incoming?.model]);
  const [config, setConfig] = useSessionState('config', initialConfig);
  const [draftConfig, setDraftConfig] = useSessionState('draftConfig', initialConfig);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [saveTargetOpen, setSaveTargetOpen] = useState(false);
  const [continueToReportAfterSave, setContinueToReportAfterSave] = useState(false);
  const [pendingSaveKind, setPendingSaveKind] = useState<SaveKind>('analysis');
  const [savedProjectId, setSavedProjectId] = useSessionState<string | undefined>('savedProjectId', session.targetProjectId);
  const [savedAnalysisProjectId, setSavedAnalysisProjectId] = useSessionState<string | null>('savedAnalysisProjectId', null);
  const [savedRootCauseProjectId, setSavedRootCauseProjectId] = useSessionState<string | null>('savedRootCauseProjectId', null);
  const [savedResultIds, setSavedResultIds] = useSessionState<Partial<Record<SaveKind, string>>>('savedResultIds', {});
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useSessionState('analyzed', false);
  const [activeTab, setActiveTab] = useSessionState('activeTab', 'trend');
  const [selectedAnomaly, setSelectedAnomaly] = useSessionState('selectedAnomaly', ANOMALIES[0]);
  const [selectedMeasurementPoint, setSelectedMeasurementPoint] = useSessionState('selectedMeasurementPoint', MEASUREMENT_POINTS[3]);
  const [confirmed, setConfirmed] = useSessionState('confirmed', autoExecute ? { config: true } : EMPTY_CONFIRMATION);
  const timer = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const autoReturned = useRef(false);
  const preparationReady = confirmed.config;

  const boundProject = projects.find((project) => project.id === savedProjectId) ?? targetProject;
  const effectiveSession = useMemo<NonNullable<BusinessRouteState['workspaceSession']>>(
    () => boundProject ? (session.mode === 'task' ? session : { ...session, mode: 'project', targetProjectId: boundProject.id }) : { mode: 'standalone' },
    [boundProject, session],
  );

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const invalidateResult = () => {
    setSavedResultIds({});
    setAnalyzed(false);
    setActiveTab('trend');
    setSelectedAnomaly(ANOMALIES[0]);
    setSavedAnalysisProjectId(null);
    setSavedRootCauseProjectId(null);
  };

  const startAnalysis = () => {
    if (!preparationReady) return message.warning('请先确认全部分析准备项');
    if (timer.current !== null) window.clearTimeout(timer.current);
    setSavedResultIds({});
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

  const trendOption = useMemo<EChartsOption>(() => ({
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
  }), [selectedAnomaly]);

  const persistResult = useCallback((projectId: string, kind: SaveKind): string | null => {
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
            physicalSource: sourceRecord ? { objectId: businessScope?.physicalObjectId, experimentId: businessScope?.experimentId, recordId: sourceRecord.id, rawFileIds: sourceRecord.rawFiles.map(file => file.id) } : undefined,
            config,
            model: activeModel,
            anomalies: ANOMALIES,
            measurementPoint: selectedMeasurementPoint,
            abnormalRange: '7600～8000 rpm',
            conclusion: '高转速区域温度异常，当前模型在该区域预测偏差明显增大。',
            results: [
              { id: 'analysis-trend', name: `${selectedAnomaly.event}趋势与模型对比`, kind: 'chart', option: trendOption, basis: ['内置演示样例；当前记录的 CSV 未参与此演示计算。'] },
              { id: 'anomalies', name: `${task.name} · 异常事件`, kind: 'table', columns: [{ key: 'event', label: '异常事件' }, { key: 'condition', label: '工况' }, { key: 'time', label: '时间' }, { key: 'level', label: '程度' }], rows: ANOMALIES },
              { id: 'anomaly-count', name: '异常事件数', kind: 'metric', value: ANOMALIES.length, unit: '个' },
              { id: 'model-deviation', name: `${selectedMeasurementPoint.label} · 模型偏差`, kind: 'metric', value: selectedMeasurementPoint.deviation },
            ] satisfies AnalysisResult[],
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
            results: [
              { id: 'root-cause', name: `${selectedAnomaly.event} · 主要根因`, kind: 'metric', value: primaryRootCause.reason, basis: EVIDENCE },
              { id: 'candidates', name: `${selectedAnomaly.event} · 根因候选`, kind: 'table', columns: [{ key: 'reason', label: '可能原因' }, { key: 'relevance', label: '关联程度' }], rows: rootCauseRows, basis: EVIDENCE },
            ] satisfies AnalysisResult[],
          },
        });

    const artifact = addArtifact(projectId, { ...artifactInput, id: savedResultIds[kind] });
    if (!artifact) return null;
    setSavedResultIds(previous => ({ ...previous, [kind]: artifact.id }));
    recordArtifactForTaskItem({ projectId, artifactId: artifact.id });
    setSavedProjectId(projectId);
    if (kind === 'analysis') setSavedAnalysisProjectId(projectId);
    else setSavedRootCauseProjectId(projectId);
    setSaveTargetOpen(false);
    message.success(session.sessionId ? `${kind === 'analysis' ? '分析结果' : '根因结论'}已保存${boundPhysical ? '到原试验的分析成果' : '到当前会话'}` : `${kind === 'analysis' ? '分析结果' : '根因结论'}已保存到项目“${project.name}”`);
    return artifact.id;
  }, [savedResultIds, setSavedResultIds, trendOption, analyzed, projects, task, data, activeModel, config, selectedAnomaly, selectedMeasurementPoint, rootCauseRows, primaryRootCause, addArtifact, recordArtifactForTaskItem, setSavedProjectId, setSavedAnalysisProjectId, setSavedRootCauseProjectId, setSaveTargetOpen, session.sessionId, boundPhysical, businessScope?.experimentId, businessScope?.physicalObjectId, sourceRecord]);

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
    const dataContract: DataContract = { dataId: sourceRecord?.id ?? `data-${task.id}`, dataName: data.experimentFile, dataType: sourceRecord ? '物理对象试验执行记录' : '演示试验数据', source: '试验数据分析', taskId: incoming?.task?.taskId ?? incoming?.workspaceSession?.taskBookId ?? task.id };
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
        navigate('/report/create', { state: { workspaceSession: effectiveSession, artifactIds: [artifactId] } });
        return;
      }
      setPendingSaveKind('analysis');
      setContinueToReportAfterSave(true);
      setSaveTargetOpen(true);
    }
  }, [persistResult, activeModel, addArtifactToReport, analyzed, boundProject, config, data, effectiveSession, incoming?.task?.taskId, incoming?.workspaceSession?.taskBookId, navigate, selectedAnomaly, sourceRecord, task, setContinueToReportAfterSave, setSaveTargetOpen, setPendingSaveKind]);

  useEffect(() => {
    if (!autoExecute || analyzed || autoStarted.current || !preparationReady) return;
    autoStarted.current = true;
    const kickoff = window.setTimeout(() => startAnalysis(), 0);
    return () => {
      window.clearTimeout(kickoff);
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
      autoStarted.current = false;
    };
  }, [autoExecute, preparationReady]);

  useEffect(() => {
    if (!autoExecute || !analyzed || autoReturned.current || effectiveSession.mode !== 'task' || !effectiveSession.taskItemId || !boundProject) return;
    const publish = window.setTimeout(() => {
    autoReturned.current = true;
    const artifactId = persistResult(boundProject.id, 'analysis');
    if (!artifactId) return;
    addArtifactToReport(effectiveSession.taskId, { projectId: boundProject.id, artifactId });
    setRequirementStatus(effectiveSession.taskId, effectiveSession.taskItemId!, '待确认');
    message.success('已按复核后的任务规划完成模拟分析，成果已回到原任务');
    navigate(createTaskReturnPath(effectiveSession));
    }, 0);
    return () => window.clearTimeout(publish);
  }, [addArtifactToReport, analyzed, autoExecute, boundProject, effectiveSession, navigate, persistResult, setRequirementStatus]);

  useEffect(() => {
    setContext({
      pageType: 'dataAnalysis',
      pageName: '试验数据分析',
      projectName: boundProject?.name,
      taskName: task.name,
      modelName: activeModel.modelId === UNSELECTED_MODEL.modelId ? undefined : `${activeModel.modelName} ${activeModel.version}`,
      dataName: data.experimentFile,
      resultSummary: analyzed ? '发现 3 个异常事件' : '等待开始分析',
      resultReady: analyzed,
      onBusinessAction: handleBusinessAction,
    });
    return () => setContext(null);
  }, [activeModel.modelId, activeModel.modelName, activeModel.version, analyzed, boundProject?.name, data.experimentFile, handleBusinessAction, setContext, task.name]);



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

  const openConfig = () => { setDraftConfig(config); setConfigModalOpen(true); };

  return (
    <div className="workspace-business-page">
      {incoming?.source && (incoming.task || incoming.data || incoming.model || incoming.result || incoming.validation) && (
        <Alert showIcon type="info" title={`已从${incoming.source === 'intelligentDesign' ? '试验设计' : incoming.source === 'digitalTwin' ? '试验数字孪生' : incoming.source === 'virtualCondition' ? '虚拟工况扩展' : '试验数据分析'}带入业务上下文`} description={[incoming.task && `任务：${incoming.task.taskName}`, incoming.data && `数据：${incoming.data.dataName}`, incoming.result && `结果：${incoming.result.resultSummary}`, incoming.validation && `验证目标：${incoming.validation.goal}`].filter(Boolean).join('；')} style={{ marginBottom: 16 }} />
      )}
      <Tabs className="workspace-subfunction-tabs" defaultActiveKey={physicalSource.trial ? 'csv' : 'diagnosis'} items={[
        { key: 'csv', label: '数据浏览与可视化', children: physicalSource.trial
          ? <TrialCsvAnalysis trialId={physicalSource.trial.id} initialRecordId={physicalSource.record?.id} artifacts={getTrialArtifacts(projects, sourceSessions, session, physicalSource.trial)} />
          : <Alert type="info" showIcon message="CSV 数据分析需要当前具体试验上下文。" /> },
        { key: 'diagnosis', label: '异常与根因分析', children: <>
      <Alert showIcon type="info" title="演示样例" description="当前趋势、异常和根因视图使用内置演示数据，尚未接入基于 CSV 的诊断服务，不代表本次试验的实际结论。" style={{ marginBottom: 16 }} />

      <PreparationChecklist
        title="分析准备"
        items={[
          { key: 'config', label: '分析配置', value: `${config.scope} / ${config.sensitivity}敏感度`, confirmed: confirmed.config, onClick: openConfig, preview: <Space size={[4, 4]} wrap><Tag color="blue">范围：{config.scope}</Tag><Tag>敏感度：{config.sensitivity}</Tag><Tag>对比：{config.comparison}</Tag><Tag>指标：{config.metrics.join('、')}</Tag><Tag>内容：{config.contents.join('、')}</Tag></Space> },
        ]}
        actions={<Space size={6}>
          <Button type={preparationReady ? 'primary' : 'default'} icon={<BarChartOutlined />} disabled={!preparationReady} loading={analyzing} onClick={startAnalysis}>开始分析</Button>
          <Button type="text" size="small" className="workspace-reset-action" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
        </Space>}
      />

      <Card
        title={<Space size={8}><span>设备剖面与测点</span><Tag color="blue">0–4 点位联动</Tag><Tag color="orange">模拟结果</Tag></Space>}
        extra={<Text type="secondary">点击测点查看当前工况数据</Text>}
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
        </> },
      ]} />
    </div>
  );
};

const AnalysisProjects: React.FC = () => {
  const workspace = useTrialWorksheet();
  const [showDemo, setShowDemo] = useState(false);
  if (workspace && !showDemo) return <TrialDataAnalysisWorkspace onShowDemo={() => setShowDemo(true)} />;
  return <>{workspace && <Alert type="warning" showIcon message="独立演示：不代表底部当前 CSV 的分析结论" action={<Button onClick={() => setShowDemo(false)}>返回当前 CSV 分析</Button>} />}<LegacyAnalysisProjects /></>;
};
export default AnalysisProjects;
