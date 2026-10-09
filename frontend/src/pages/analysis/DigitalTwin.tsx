import { useSessionState, useSessionRouteState } from '@/workspace/useSessionState';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Form, InputNumber, Modal, Progress, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  BarChartOutlined, DownloadOutlined, ExperimentOutlined, ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate } from 'react-router-dom';
import { useTrialAIAssistant } from '@/components/TrialAIAssistant';
import type { BusinessAction, BusinessRouteState, ModelContract } from '@/types/businessContext';
import PreparationChecklist from '@/workspace/PreparationChecklist';
import { createCalibrationArtifactInput } from '@/workspace/projectModel';
import { useProjectStore } from '@/workspace/projectStore';
import { useTaskStore } from '@/workspace/taskStore';
import { createTaskReturnPath } from '@/workspace/businessSessionModel';
import { useWorkspaceBusinessSession } from '@/workspace/useWorkspaceBusinessSession';
import type { ProjectArtifact } from '@/workspace/types';
import { useSessionModels } from '@/workspace/useSessionModels';

const { Title, Text, Paragraph } = Typography;

const INITIAL_PARAMS = { temperature: 25, pressure: 101.3, speed: 3000 };
const EMPTY_CONFIRMATION = { model: false, simulationData: false, measuredData: false, params: false };

const calibrationRows = [
  { key: 'temperature', metric: '出口温度 / ℃', simulation: 686.2, measured: 681.8, calibrated: 682.4, error: '0.09%' },
  { key: 'pressure', metric: '出口压力 / kPa', simulation: 224.6, measured: 218.9, calibrated: 219.3, error: '0.18%' },
  { key: 'vibration', metric: '振动幅值 / mm·s⁻¹', simulation: 4.82, measured: 4.36, calibrated: 4.41, error: '1.15%' },
];

const parameterRows = [
  { key: 'heat', name: '换热系数修正量', before: '1.000', estimate: '0.947', change: '-5.30%' },
  { key: 'loss', name: '压力损失系数', before: '0.032', estimate: '0.037', change: '+15.63%' },
  { key: 'damping', name: '结构阻尼比', before: '0.018', estimate: '0.021', change: '+16.67%' },
];

const calibrationColumns = [
  { title: '指标', dataIndex: 'metric' },
  { title: '仿真值', dataIndex: 'simulation' },
  { title: '实测值', dataIndex: 'measured' },
  { title: '校准值', dataIndex: 'calibrated' },
  { title: '校准后误差', dataIndex: 'error', render: (value: string) => <Tag color="green">{value}</Tag> },
];

const DigitalTwin: React.FC = () => {
  const navigate = useNavigate();
  const incoming = useSessionRouteState();
  const { setContext } = useTrialAIAssistant();
  const { projects, session, targetProject, activeTask, recordArtifactForTaskItem } = useWorkspaceBusinessSession(incoming);
  const { models: globalModels, updateCurrentModel } = useSessionModels();
  const addArtifact = useProjectStore((state) => state.addArtifact);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const autoExecute = Boolean(incoming?.autoExecute && session.mode === 'task' && session.taskItemId);
  const incomingGlobalModel = incoming?.model ? globalModels.find((item) => item.modelId === incoming.model?.modelId) : null;
  const initialModel = incomingGlobalModel ?? (incoming?.model || autoExecute ? globalModels[0] ?? null : null);
  const recommendedSpeedRange = incoming?.validation?.suggestedRange.match(/\d+/g)?.map(Number);
  const initialParams = autoExecute && recommendedSpeedRange && recommendedSpeedRange.length >= 2
    ? { ...INITIAL_PARAMS, speed: Math.round((recommendedSpeedRange[0] + recommendedSpeedRange[1]) / 2) }
    : INITIAL_PARAMS;
  const [model, setModel] = useSessionState<ModelContract | null>('model', initialModel);
  const [simulationFile, setSimulationFile] = useSessionState('simulationFile', incoming?.source === 'dataAnalysis' || autoExecute ? 'digital_twin_baseline.json' : '');
  const [measuredFile, setMeasuredFile] = useSessionState('measuredFile', incoming?.data?.dataName ?? (autoExecute ? '任务关联实测数据集（模拟）' : ''));
  const [params, setParams] = useSessionState('params', initialParams);
  const [draftParams, setDraftParams] = useSessionState('draftParams', initialParams);
  const [modelModalOpen, setModelModalOpen] = useState(false);
  const [paramsModalOpen, setParamsModalOpen] = useState(false);
  const [savedProjectId, setSavedProjectId] = useSessionState<string | undefined>('savedProjectId', session.targetProjectId);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrated, setCalibrated] = useSessionState('calibrated', false);
  const [calibrationArtifactId, setCalibrationArtifactId] = useSessionState<string | null>('calibrationArtifactId', null);
  const [confirmed, setConfirmed] = useSessionState('confirmed', autoExecute ? { model: true, simulationData: true, measuredData: true, params: true } : EMPTY_CONFIRMATION);
  const calibrationTimer = useRef<number | null>(null);
  const autoStarted = useRef(false);
  const autoReturned = useRef(false);
  const simulationInputRef = useRef<HTMLInputElement | null>(null);
  const measuredInputRef = useRef<HTMLInputElement | null>(null);
  const activeModel = (model && globalModels.find((item) => item.modelId === model.modelId))
    ?? (incoming?.model && globalModels.find((item) => item.modelId === incoming.model?.modelId))
    ?? model
    ?? (incoming?.source === 'dataAnalysis' ? globalModels[0] ?? null : null);
  const activeSimulationFile = simulationFile || (incoming?.source === 'dataAnalysis' ? 'digital_twin_baseline.json' : '');
  const activeMeasuredFile = measuredFile || incoming?.data?.dataName || '';
  const preparationReady = Object.values(confirmed).every(Boolean);
  const boundProject = projects.find((project) => project.id === savedProjectId) ?? targetProject;
  const effectiveSession = useMemo<NonNullable<BusinessRouteState['workspaceSession']>>(
    () => boundProject ? (session.mode === 'task' ? session : { ...session, mode: 'project', targetProjectId: boundProject.id }) : { mode: 'standalone' },
    [boundProject, session],
  );

  useEffect(() => () => {
    if (calibrationTimer.current !== null) window.clearTimeout(calibrationTimer.current);
  }, []);

  const reset = () => {
    if (calibrationTimer.current !== null) window.clearTimeout(calibrationTimer.current);
    calibrationTimer.current = null;
    setModel(initialModel);
    setSimulationFile(incoming?.source === 'dataAnalysis' ? 'digital_twin_baseline.json' : '');
    setMeasuredFile(incoming?.data?.dataName ?? '');
    setParams(initialParams);
    setDraftParams(initialParams);
    setConfirmed(EMPTY_CONFIRMATION);
    setCalibrating(false);
    setCalibrated(false);
    message.success('已恢复初始状态');
  };

  const startCalibration = () => {
    if (!preparationReady) return message.warning('请先确认全部校准准备项');
    if (!activeModel || !activeSimulationFile || !activeMeasuredFile) {
      message.warning('请先选择模型并导入仿真、实测数据');
      return;
    }
    setCalibrating(true);
    setCalibrationArtifactId(null);
    setCalibrated(false);
    calibrationTimer.current = window.setTimeout(() => {
      setCalibrating(false);
      const updatedModel = activeModel ? updateCurrentModel(activeModel.modelId, {
        status: '已校准',
        calibratedAt: new Date().toISOString().slice(0, 10),
        calibrationData: {
          simulationFile: activeSimulationFile,
          measuredFile: activeMeasuredFile,
          params,
          calibrationRows,
          parameterRows,
          credibility: 94.6,
          confidenceInterval: 3.2,
          errorLimit: 4.8,
        },
      }) : null;
      if (updatedModel) setModel(updatedModel);
      setCalibrated(true);
      calibrationTimer.current = null;
      message.success(updatedModel ? `校准完成，当前会话模型已更新至 ${updatedModel.version}` : '模型校准完成');
    }, 1000);
  };

  const exportResult = () => {
    if (!calibrated) {
      message.warning('请先完成模型校准');
      return;
    }
    const payload = JSON.stringify({ model: activeModel, simulationFile: activeSimulationFile, measuredFile: activeMeasuredFile, params, calibrationRows, parameterRows }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'digital-twin-calibration-result.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    message.success('结果已导出');
  };

  const persistCalibration = useCallback((projectId: string): ProjectArtifact | null => {
    if (calibrationArtifactId) {
      const existing = projects.find(project => project.id === projectId)?.artifacts.find(artifact => artifact.id === calibrationArtifactId);
      if (existing) {
        recordArtifactForTaskItem({ projectId, artifactId: existing.id });
        return existing;
      }
    }
    if (!calibrated || !activeModel) {
      message.warning('请先完成模型校准');
      return null;
    }
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      message.warning('目标项目不存在');
      return null;
    }
    const saved = addArtifact(projectId, createCalibrationArtifactInput({
      title: `${activeModel.modelName} ${activeModel.version} 校准结果`,
      summary: '模型校准完成，综合拟合度 R² = 0.946，模型可信度 94.6%',
      payload: {
        model: activeModel,
        simulationFile: activeSimulationFile,
        measuredFile: activeMeasuredFile,
        params,
        calibrationRows,
        parameterRows,
        credibility: 94.6,
        confidenceInterval: 3.2,
        errorLimit: 4.8,
        trustedRange: activeModel.trustedRange,
        charts: [{ id: 'calibration-comparison', title: '校准结果对比' }],
      },
    }));
    if (!saved) {
      message.error('保存失败');
      return null;
    }
    recordArtifactForTaskItem({ projectId, artifactId: saved.id });
    setSavedProjectId(projectId);
    setCalibrationArtifactId(saved.id);
    message.success(session.sessionId ? '校准成果已保存到当前会话' : '校准成果已归档到当前任务');
    return saved;
  }, [calibrationArtifactId, projects, calibrated, activeModel, activeSimulationFile, activeMeasuredFile, params, addArtifact, recordArtifactForTaskItem, setSavedProjectId, setCalibrationArtifactId, session.sessionId]);

  useEffect(() => {
    if (session.sessionId && calibrated && boundProject && !calibrationArtifactId) persistCalibration(boundProject.id);
  // A completed calibration becomes a reportable artifact; preparation stays a draft.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.sessionId, calibrated, boundProject?.id, calibrationArtifactId]);

  const addCalibrationToTaskReport = () => {
    if (effectiveSession.mode !== 'task' || !boundProject) return;
    const saved = persistCalibration(boundProject.id);
    if (!saved) return;
    addArtifactToReport(effectiveSession.taskId, { projectId: boundProject.id, artifactId: saved.id });
    if (effectiveSession.taskItemId) setRequirementStatus(effectiveSession.taskId, effectiveSession.taskItemId, '待确认');
    navigate(createTaskReturnPath(effectiveSession));
  };

  const handleBusinessAction = useCallback((action: BusinessAction) => {
    if (action === '查看适用范围') {
      document.getElementById('business-result')?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  useEffect(() => {
    if (!autoExecute || calibrated || autoStarted.current || !preparationReady) return;
    autoStarted.current = true;
    startCalibration();
    return () => {
      if (calibrationTimer.current !== null) {
        window.clearTimeout(calibrationTimer.current);
        calibrationTimer.current = null;
      }
      autoStarted.current = false;
    };
  }, [autoExecute, preparationReady]);

  useEffect(() => {
    if (!autoExecute || !calibrated || autoReturned.current || effectiveSession.mode !== 'task' || !effectiveSession.taskItemId || !boundProject) return;
    autoReturned.current = true;
    const saved = persistCalibration(boundProject.id);
    if (!saved) return;
    addArtifactToReport(effectiveSession.taskId, { projectId: boundProject.id, artifactId: saved.id });
    setRequirementStatus(effectiveSession.taskId, effectiveSession.taskItemId, '待确认');
    message.success('已按复核后的任务规划完成模拟校准，成果已回到原任务');
    navigate(createTaskReturnPath(effectiveSession));
  }, [addArtifactToReport, autoExecute, boundProject, calibrated, effectiveSession, navigate, persistCalibration, setRequirementStatus]);

  useEffect(() => {
    setContext({
      pageType: 'digitalTwin', pageName: '试验数字孪生', projectName: boundProject?.name,
      taskName: incoming?.task?.taskName ?? activeTask?.title, modelName: activeModel ? `${activeModel.modelName} ${activeModel.version}` : undefined,
      dataName: activeMeasuredFile || activeSimulationFile, resultSummary: calibrated ? '模型校准完成，综合拟合度 R² = 0.946' : '等待模型校准',
      resultReady: calibrated, onBusinessAction: handleBusinessAction,
    });
    return () => setContext(null);
  }, [activeMeasuredFile, activeModel, activeSimulationFile, activeTask?.title, boundProject?.name, calibrated, handleBusinessAction, incoming?.task?.taskName, setContext]);

  const comparisonChart = {
    tooltip: { trigger: 'axis' },
    legend: { data: ['仿真值', '实测值', '校准值'] },
    xAxis: { type: 'category', data: calibrationRows.map((row) => row.metric.split(' / ')[0]) },
    yAxis: { type: 'value' },
    series: [
      { name: '仿真值', type: 'bar', data: calibrationRows.map((row) => row.simulation) },
      { name: '实测值', type: 'bar', data: calibrationRows.map((row) => row.measured) },
      { name: '校准值', type: 'bar', data: calibrationRows.map((row) => row.calibrated) },
    ],
  };

  const resultTabs = [
    { key: 'calibration', label: '校准结果', children: <Table size="small" pagination={false} dataSource={calibrationRows} columns={calibrationColumns} /> },
    { key: 'parameters', label: '参数估计', children: <Table size="small" pagination={false} dataSource={parameterRows} columns={[{ title: '参数', dataIndex: 'name' }, { title: '初始值', dataIndex: 'before' }, { title: '估计值', dataIndex: 'estimate' }, { title: '变化', dataIndex: 'change' }]} /> },
    { key: 'uncertainty', label: '不确定性分析', children: <Row gutter={16}><Col span={8}><Card size="small"><Statistic title="模型可信度" value={94.6} suffix="%" /></Card></Col><Col span={8}><Card size="small"><Statistic title="平均置信区间" value={3.2} suffix="%" /></Card></Col><Col span={8}><Card size="small"><Statistic title="预测误差上限" value={4.8} suffix="%" /></Card></Col></Row> },
    { key: 'scope', label: '适用范围', children: <Descriptions bordered size="small" column={2} items={[
      { key: 'temperature', label: '环境温度', children: '-20 ～ 55 ℃' },
      { key: 'pressure', label: '环境压力', children: '85 ～ 110 kPa' },
      { key: 'speed', label: '模型可信范围', children: activeModel?.trustedRange ?? '未确定' },
      { key: 'risk', label: '外推风险', children: <Tag color="green">低</Tag> },
    ]} /> },
  ];

  const confirmOrChooseData = (key: 'simulationData' | 'measuredData', available: boolean) => {
    if (available && !confirmed[key]) {
      setConfirmed((prev) => ({ ...prev, [key]: true }));
      return;
    }
    if (key === 'simulationData') simulationInputRef.current?.click();
    else measuredInputRef.current?.click();
  };

  const handleDataFile = (key: 'simulationData' | 'measuredData', file?: File) => {
    if (!file) return;
    if (key === 'simulationData') setSimulationFile(file.name);
    else setMeasuredFile(file.name);
    setConfirmed((prev) => ({ ...prev, [key]: true }));
    setCalibrated(false);
  };

  return (
    <div className="workspace-business-page">
      <div className="workspace-business-heading workspace-page-heading">
        <div><Title level={4} style={{ margin: 0 }}>试验数字孪生</Title><Text type="secondary">配置模型与数据，执行模型校准并查看分析结果</Text></div>
        <Tag color={boundProject ? 'blue' : 'default'}>{session.sessionId ? '当前会话' : boundProject ? `项目：${boundProject.name}` : '独立模式'}</Tag>
      </div>
      {incoming?.source === 'dataAnalysis' && <Alert type="success" showIcon title={`已从试验数据分析带入：${incoming.task?.taskName ?? '试验任务'}`} description={`${incoming.data?.dataName ?? '未提供数据'}；异常工况：${incoming.result?.abnormalRange ?? '未提供'}；${incoming.result?.resultSummary ?? '暂无分析摘要'}`} style={{ marginBottom: 16 }} />}

      <PreparationChecklist
        title="校准准备"
        items={[
          { key: 'model', label: '模型', value: activeModel ? `${activeModel.modelName} ${activeModel.version}` : '未选择', confirmed: confirmed.model, onClick: () => setModelModalOpen(true) },
          { key: 'simulation', label: '仿真数据', value: activeSimulationFile || '未导入', confirmed: confirmed.simulationData, onClick: () => confirmOrChooseData('simulationData', Boolean(activeSimulationFile)) },
          { key: 'measured', label: '实测数据', value: activeMeasuredFile || '未导入', confirmed: confirmed.measuredData, onClick: () => confirmOrChooseData('measuredData', Boolean(activeMeasuredFile)) },
          { key: 'params', label: '参数配置', value: `温度 ${params.temperature}℃ / 转速 ${params.speed}`, confirmed: confirmed.params, onClick: () => { setDraftParams(params); setParamsModalOpen(true); } },
        ]}
        actions={<Space size={6}>
          <Button type={preparationReady ? 'primary' : 'default'} icon={<ExperimentOutlined />} disabled={!preparationReady} loading={calibrating} onClick={startCalibration}>开始校准</Button>
          <Button type="text" size="small" className="workspace-reset-action" icon={<ReloadOutlined />} onClick={reset}>重置</Button>
        </Space>}
      />
      <input ref={simulationInputRef} type="file" hidden onChange={(event) => { handleDataFile('simulationData', event.target.files?.[0]); event.currentTarget.value = ''; }} />
      <input ref={measuredInputRef} type="file" hidden onChange={(event) => { handleDataFile('measuredData', event.target.files?.[0]); event.currentTarget.value = ''; }} />

      <Card title="当前配置" size="small" className="workspace-business-card"><Descriptions column={2} size="small" items={[
        { key: 'model', label: '当前模型', children: activeModel ? `${activeModel.modelName} ${activeModel.version}` : <Text type="secondary">未选择</Text> },
        { key: 'simulation', label: '仿真数据文件', children: activeSimulationFile || <Text type="secondary">未导入</Text> },
        { key: 'measured', label: '实测数据文件', children: activeMeasuredFile || <Text type="secondary">未导入</Text> },
        { key: 'params', label: '当前工况/模型参数', children: `温度 ${params.temperature} ℃；压力 ${params.pressure} kPa；转速 ${params.speed} r/min` },
      ]} /></Card>

      <Card id="business-result" title="分析结果" size="small" className="workspace-business-card" extra={<Space><Button icon={<BarChartOutlined />} disabled={!calibrated} onClick={() => message.info('下方已显示结果对比图')}>结果对比</Button><Button icon={<DownloadOutlined />} onClick={exportResult}>导出结果</Button></Space>}>
        {calibrating ? <div style={{ padding: '40px 12%' }}><Progress percent={78} status="active" /><Paragraph type="secondary" style={{ textAlign: 'center' }}>正在进行参数寻优与模型校准...</Paragraph></div>
          : calibrated ? <><Alert type="success" showIcon title={`校准完成，当前会话模型 ${activeModel?.modelName ?? ''} ${activeModel?.version ?? ''} 已更新，拟合度 R² = 0.946`} style={{ marginBottom: 16 }} /><Tabs items={resultTabs} /><Card size="small" title="结果对比" style={{ marginTop: 16 }}><ReactECharts option={comparisonChart} style={{ height: 280 }} /></Card>{effectiveSession.mode === 'task' && <div className="workspace-result-actions"><Button type="primary" onClick={addCalibrationToTaskReport}>加入任务报告</Button></div>}</>
            : <Alert type="info" showIcon title="完成模型、数据和参数配置后，点击“开始校准”查看结果" />}
      </Card>

      <Modal title="选择模型" open={modelModalOpen} onCancel={() => setModelModalOpen(false)} onOk={() => { if (!activeModel) return message.warning('请选择模型'); setConfirmed((prev) => ({ ...prev, model: true })); setModelModalOpen(false); setCalibrated(false); }}>
        <Select style={{ width: '100%' }} placeholder="请选择模型" value={activeModel?.modelId} options={globalModels.map((item) => ({ value: item.modelId, label: `${item.modelName} ${item.version}｜可信范围 ${item.trustedRange}` }))} onChange={(value) => setModel(globalModels.find((item) => item.modelId === value) ?? null)} />
      </Modal>
      <Modal title="参数配置" open={paramsModalOpen} onCancel={() => setParamsModalOpen(false)} onOk={() => { setParams(draftParams); setConfirmed((prev) => ({ ...prev, params: true })); setParamsModalOpen(false); setCalibrated(false); message.success('参数配置已保存'); }}>
        <Form labelCol={{ span: 7 }} wrapperCol={{ span: 14 }}>
          <Form.Item label="环境温度（℃）"><InputNumber style={{ width: '100%' }} value={draftParams.temperature} onChange={(value) => setDraftParams({ ...draftParams, temperature: value ?? 25 })} /></Form.Item>
          <Form.Item label="环境压力（kPa）"><InputNumber style={{ width: '100%' }} value={draftParams.pressure} onChange={(value) => setDraftParams({ ...draftParams, pressure: value ?? 101.3 })} /></Form.Item>
          <Form.Item label="运行转速（r/min）"><InputNumber style={{ width: '100%' }} value={draftParams.speed} onChange={(value) => setDraftParams({ ...draftParams, speed: value ?? 3000 })} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DigitalTwin;
