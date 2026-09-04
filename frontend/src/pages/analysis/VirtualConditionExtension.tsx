import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Form, InputNumber, Modal, Progress,
  Row, Select, Space, Statistic, Table, Tabs, Tag, Typography, message,
} from 'antd';
import {
  ApiOutlined, ExperimentOutlined, PlayCircleOutlined, ReloadOutlined, SaveOutlined,
  SafetyCertificateOutlined, SettingOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTrialAIAssistant } from '@/components/TrialAIAssistant';
import { saveBusinessReportItem } from '@/types/businessContext';
import type { BusinessAction, BusinessRouteState, ModelContract } from '@/types/businessContext';
import ProjectSaveTargetModal from '@/workspace/ProjectSaveTargetModal';
import { createVirtualConditionArtifactInput } from '@/workspace/projectModel';
import { useProjectStore } from '@/workspace/projectStore';
import { useWorkspaceBusinessSession } from '@/workspace/useWorkspaceBusinessSession';

const { Title, Text, Paragraph } = Typography;

const MODELS: ModelContract[] = [
  { modelId: 'engine-v2.1', modelName: '发动机数字孪生模型', version: 'V2.1', status: '已确认', measuredRange: '2000～8000 rpm', trustedRange: '2000～8800 rpm', calibratedAt: '2026-08-28' },
  { modelId: 'engine-v2.0', modelName: '发动机数字孪生模型', version: 'V2.0', status: '已校准', measuredRange: '2000～7600 rpm', trustedRange: '2000～8400 rpm', calibratedAt: '2026-06-12' },
  { modelId: 'engine-v1.8', modelName: '发动机数字孪生模型', version: 'V1.8', status: '待确认', measuredRange: '1800～6500 rpm', trustedRange: '1800～7000 rpm', calibratedAt: '2026-03-05' },
];

const DEFAULT_CONFIG = { method: '范围扩展', speedMin: 8000, speedMax: 10000, temperatureMin: 80, temperatureMax: 120, pressureMin: 1.5, pressureMax: 2.2, count: 36, sampling: '自动生成' };
const DEFAULT_CONSTRAINTS = { speedMax: 10000, temperatureMax: 120, pressureMin: 1.5, pressureMax: 2.2, withinScope: true, excludeAbnormal: true, markOutsideTrusted: true };

type ConditionConfig = typeof DEFAULT_CONFIG;
type ConstraintConfig = typeof DEFAULT_CONSTRAINTS;
type VirtualCondition = {
  key: string;
  code: string;
  speed: number;
  temperature: number;
  pressure: number;
  status: '待预测' | '已完成';
  thrust?: number;
  temperatureRise?: number;
  credibility?: '高' | '中' | '低';
  risk?: '低' | '中' | '高';
};

const parseRange = (value?: string) => {
  const numbers = value?.match(/\d+/g)?.map(Number);
  return numbers && numbers.length >= 2 ? [numbers[0], numbers[1]] as const : null;
};

const levelTag = (value?: string, reverse = false) => {
  const color = reverse
    ? value === '高' ? 'green' : value === '中' ? 'orange' : 'red'
    : value === '高' ? 'red' : value === '中' ? 'orange' : 'green';
  return value ? <Tag color={color}>{value}</Tag> : '-';
};

const VirtualConditionExtension: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as BusinessRouteState | null;
  const { setContext } = useTrialAIAssistant();
  const { projects, session, targetProject } = useWorkspaceBusinessSession(incoming);
  const addArtifact = useProjectStore((state) => state.addArtifact);

  const incomingRange = parseRange(incoming?.validation?.suggestedRange);
  const initialModel = incoming?.model ?? MODELS[0];
  const initialConfig = incomingRange
    ? { ...DEFAULT_CONFIG, speedMin: incomingRange[0], speedMax: incomingRange[1] }
    : DEFAULT_CONFIG;

  const [model, setModel] = useState(initialModel);
  const [config, setConfig] = useState<ConditionConfig>(initialConfig);
  const [constraints, setConstraints] = useState<ConstraintConfig>(DEFAULT_CONSTRAINTS);
  const [draftModelId, setDraftModelId] = useState(initialModel.modelId);
  const [draftConfig, setDraftConfig] = useState<ConditionConfig>(initialConfig);
  const [draftConstraints, setDraftConstraints] = useState<ConstraintConfig>(DEFAULT_CONSTRAINTS);
  const [modelOpen, setModelOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [constraintsOpen, setConstraintsOpen] = useState(false);
  const [saveTargetOpen, setSaveTargetOpen] = useState(false);
  const [savedProjectId, setSavedProjectId] = useState<string | undefined>(session.targetProjectId);
  const [persistedProjectId, setPersistedProjectId] = useState<string | null>(null);
  const [conditions, setConditions] = useState<VirtualCondition[]>([]);
  const [generationStatus, setGenerationStatus] = useState<'idle' | 'generated'>('idle');
  const [predictionStatus, setPredictionStatus] = useState<'idle' | 'loading' | 'completed'>('idle');
  const [activeTab, setActiveTab] = useState('prediction');
  const [filter, setFilter] = useState('全部');
  const [selectedCondition, setSelectedCondition] = useState<VirtualCondition | null>(null);
  const timer = useRef<number | null>(null);

  const boundProject = projects.find((project) => project.id === savedProjectId) ?? targetProject;
  const effectiveSession = useMemo<NonNullable<BusinessRouteState['workspaceSession']>>(
    () => boundProject ? { mode: 'project', targetProjectId: boundProject.id } : { mode: 'standalone' },
    [boundProject],
  );

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const invalidate = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setConditions([]);
    setGenerationStatus('idle');
    setPredictionStatus('idle');
    setActiveTab('prediction');
    setSelectedCondition(null);
    setFilter('全部');
    setPersistedProjectId(null);
  };

  const generateConditions = () => {
    const count = Math.max(1, config.count);
    const next = Array.from({ length: count }, (_, index) => {
      const ratio = count === 1 ? 0 : index / (count - 1);
      return {
        key: String(index + 1),
        code: `V${String(index + 1).padStart(2, '0')}`,
        speed: Math.round((config.speedMin + (config.speedMax - config.speedMin) * ratio) / 10) * 10,
        temperature: Math.round(config.temperatureMin + (config.temperatureMax - config.temperatureMin) * ((index * 7) % count) / Math.max(1, count - 1)),
        pressure: Number((config.pressureMin + (config.pressureMax - config.pressureMin) * ((index * 11) % count) / Math.max(1, count - 1)).toFixed(2)),
        status: '待预测' as const,
      };
    });
    setConditions(next);
    setGenerationStatus('generated');
    setPredictionStatus('idle');
    setActiveTab('prediction');
    setSelectedCondition(next[0] ?? null);
    setPersistedProjectId(null);
    message.success(`已生成 ${next.length} 个虚拟工况`);
  };

  const startPrediction = () => {
    if (generationStatus !== 'generated') return message.warning('请先生成虚拟工况。');
    setPredictionStatus('loading');
    setPersistedProjectId(null);
    timer.current = window.setTimeout(() => {
      setConditions((prev) => prev.map((row) => {
        const credibility = row.speed <= 8800 ? '高' : row.speed <= 9400 ? '中' : '低';
        const risk = row.speed <= 8800 ? '低' : row.speed <= 9400 ? '中' : '高';
        return {
          ...row,
          status: '已完成',
          thrust: Number((69.5 + row.speed * 0.002 + row.pressure * 1.3 - row.temperature * 0.04).toFixed(1)),
          temperatureRise: Number((43 + row.speed * 0.0042 + row.temperature * 0.06).toFixed(1)),
          credibility,
          risk,
        };
      }));
      setPredictionStatus('completed');
      setActiveTab('prediction');
      timer.current = null;
      message.success('虚拟工况预测完成');
    }, 900);
  };

  const reset = () => {
    setModel(initialModel);
    setConfig(initialConfig);
    setConstraints(DEFAULT_CONSTRAINTS);
    setDraftModelId(initialModel.modelId);
    setDraftConfig(initialConfig);
    setDraftConstraints(DEFAULT_CONSTRAINTS);
    invalidate();
    message.success('已恢复默认扩展配置');
  };

  const persistVirtualResult = (projectId: string, notify = true) => {
    if (predictionStatus !== 'completed') return false;
    if (persistedProjectId === projectId) return true;
    const project = projects.find((item) => item.id === projectId);
    if (!project) return false;
    const highRiskCount = conditions.filter((row) => row.risk === '高').length;
    const artifact = addArtifact(projectId, createVirtualConditionArtifactInput({
      title: `${model.modelName} ${model.version} · 虚拟工况预测`,
      summary: `已完成 ${conditions.length} 个虚拟工况预测，高风险工况 ${highRiskCount} 个`,
      payload: {
        model,
        config,
        constraints,
        conditions,
        highRiskCount,
        trustedRange: model.trustedRange,
        charts: [
          { id: 'virtual-trend', title: '虚拟工况预测趋势' },
          { id: 'virtual-coverage', title: '真实试验与虚拟工况覆盖' },
        ],
      },
    }));
    if (!artifact) return false;
    setSavedProjectId(projectId);
    setPersistedProjectId(projectId);
    setSaveTargetOpen(false);
    if (notify) message.success(`预测结果已保存到项目“${project.name}”`);
    return true;
  };

  const requestSave = () => {
    if (predictionStatus !== 'completed') return message.warning('请先完成虚拟工况预测');
    if (boundProject) {
      persistVirtualResult(boundProject.id);
      return;
    }
    setSaveTargetOpen(true);
  };

  const handleBusinessAction = useCallback((action: BusinessAction) => {
    if (predictionStatus !== 'completed') return message.warning('请先完成虚拟工况预测');
    const highRiskCount = conditions.filter((row) => row.risk === '高').length;
    const result = {
      resultType: '虚拟工况预测',
      resultSummary: `已完成 ${conditions.length} 个虚拟工况预测，高风险工况 ${highRiskCount} 个`,
      abnormalRange: '9400～10000 rpm',
      metrics: ['推力', '温升'],
    };

    if (action === '生成验证试验') {
      if (boundProject) persistVirtualResult(boundProject.id, false);
      navigate('/experiment/design/intelligent', { state: {
        source: 'virtualCondition',
        task: incoming?.task,
        data: incoming?.data,
        model,
        result,
        workspaceSession: effectiveSession,
        validation: {
          goal: '确认高转速区域模型预测可靠性',
          suggestedRange: '9400～9800 rpm',
          highRiskRange: '9400～10000 rpm',
          metrics: ['推力', '温升'],
          recommendedRuns: 5,
        },
      } satisfies BusinessRouteState });
    }

    if (action === '加入报告') {
      saveBusinessReportItem({ source: '虚拟工况扩展', title: `${model.modelName} ${model.version}扩展结果`, summary: result.resultSummary });
      message.success('虚拟工况扩展结果已加入报告。');
    }
  }, [boundProject, conditions, effectiveSession, incoming?.data, incoming?.task, model, navigate, persistedProjectId, persistVirtualResult, predictionStatus]);

  useEffect(() => {
    setContext({
      pageType: 'virtualCondition',
      pageName: '虚拟工况扩展',
      projectName: boundProject?.name,
      taskName: incoming?.task?.taskName,
      modelName: `${model.modelName} ${model.version}`,
      resultSummary: predictionStatus === 'completed'
        ? `已完成 ${conditions.length} 个虚拟工况预测`
        : generationStatus === 'generated'
          ? `已生成 ${conditions.length} 个待预测工况`
          : '等待生成虚拟工况',
      resultReady: predictionStatus === 'completed',
      onBusinessAction: handleBusinessAction,
    });
    return () => setContext(null);
  }, [boundProject?.name, conditions.length, generationStatus, handleBusinessAction, incoming?.task?.taskName, model.modelName, model.version, predictionStatus, setContext]);

  const filteredConditions = useMemo(
    () => conditions.filter((row) => filter === '全部' || (filter === '高风险' ? row.risk === '高' : row.risk === '高' || row.credibility === '低')),
    [conditions, filter],
  );
  const completed = predictionStatus === 'completed';

  const tableColumns = completed ? [
    { title: '工况', dataIndex: 'code' }, { title: '转速', dataIndex: 'speed' }, { title: '温度', dataIndex: 'temperature' }, { title: '压力', dataIndex: 'pressure' },
    { title: '预测推力', dataIndex: 'thrust' }, { title: '预测温升', dataIndex: 'temperatureRise' },
    { title: '可信度', dataIndex: 'credibility', render: (value: string) => levelTag(value, true) }, { title: '风险', dataIndex: 'risk', render: (value: string) => levelTag(value) },
  ] : [
    { title: '工况', dataIndex: 'code' }, { title: '转速', dataIndex: 'speed' }, { title: '温度', dataIndex: 'temperature' }, { title: '压力', dataIndex: 'pressure' }, { title: '状态', dataIndex: 'status', render: (value: string) => <Tag>{value}</Tag> },
  ];

  const trendOption = {
    tooltip: { trigger: 'axis' }, legend: { data: ['预测推力', '预测温升'] },
    xAxis: { type: 'category', name: '转速 / rpm', data: conditions.map((row) => row.speed) }, yAxis: { type: 'value' },
    series: [
      { name: '预测推力', type: 'line', smooth: true, data: conditions.map((row) => row.thrust) },
      { name: '预测温升', type: 'line', smooth: true, data: conditions.map((row) => row.temperatureRise) },
    ],
  };

  const coverageOption = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } }, legend: { data: ['实测区域', '高可信虚拟区域', '谨慎区域', '待验证区域'] },
    xAxis: { type: 'value', min: 2000, max: 10000, name: '转速 / rpm' }, yAxis: { type: 'category', data: ['工况覆盖'] },
    series: [
      { name: '实测区域', type: 'bar', stack: 'range', data: [6000] },
      { name: '高可信虚拟区域', type: 'bar', stack: 'range', data: [800] },
      { name: '谨慎区域', type: 'bar', stack: 'range', data: [600] },
      { name: '待验证区域', type: 'bar', stack: 'range', data: [600] },
    ],
  };

  const resultTabs = [
    { key: 'prediction', label: '预测结果', children: <><Space style={{ marginBottom: 12 }}><Select value={filter} onChange={setFilter} options={['全部', '高风险', '待验证'].map((value) => ({ value, label: value }))} /><Text type="secondary">当前选中：{selectedCondition?.code ?? '无'}</Text></Space><Table size="small" pagination={{ pageSize: 12, showSizeChanger: false }} dataSource={filteredConditions} columns={tableColumns} onRow={(row) => ({ onClick: () => setSelectedCondition(row) })} rowClassName={(row) => row.key === selectedCondition?.key ? 'ant-table-row-selected' : ''} /></> },
    { key: 'trend', label: '趋势分析', children: completed ? <ReactECharts option={trendOption} style={{ height: 320 }} /> : <Alert type="info" showIcon title="完成预测后展示转速—推力与转速—温升趋势" /> },
    { key: 'risk', label: '风险与可信度', children: completed ? <Row gutter={16}>
      <Col span={8}><Card size="small" title={<Space><Tag color="green">高可信区域</Tag><Text>8000～8800 rpm</Text></Space>}><Progress percent={92} status="success" /><Paragraph>模型预测可信度较高，可作为工程参考。</Paragraph></Card></Col>
      <Col span={8}><Card size="small" title={<Space><Tag color="orange">谨慎区域</Tag><Text>8800～9400 rpm</Text></Space>}><Progress percent={68} strokeColor="#faad14" /><Paragraph>模型不确定性开始上升，建议结合实际任务谨慎使用。</Paragraph></Card></Col>
      <Col span={8}><Card size="small" title={<Space><Tag color="red">待验证区域</Tag><Text>9400～10000 rpm</Text></Space>}><Progress percent={36} status="exception" /><Paragraph>实测覆盖不足、模型不确定性增加，部分工况接近安全边界。</Paragraph></Card></Col>
    </Row> : <Alert type="info" showIcon title="完成预测后展示风险与可信度分区" /> },
    { key: 'coverage', label: '工况覆盖', children: completed ? <><Row gutter={16} style={{ marginBottom: 12 }}><Col span={5}><Statistic title="实测试验覆盖" value={42} suffix="组" /></Col><Col span={5}><Statistic title="模型校准覆盖" value={38} suffix="组" /></Col><Col span={5}><Statistic title="虚拟扩展工况" value={conditions.length} suffix="组" /></Col><Col span={5}><Statistic title="高可信虚拟工况" value={conditions.filter((row) => row.credibility === '高').length} suffix="组" /></Col><Col span={4}><Statistic title="待验证工况" value={conditions.filter((row) => row.risk === '高').length} suffix="组" /></Col></Row><Alert type="info" showIcon title="蓝色为真实试验覆盖，其余区域为模型虚拟预测" style={{ marginBottom: 8 }} /><ReactECharts option={coverageOption} style={{ height: 240 }} /></> : <Alert type="info" showIcon title="完成预测后展示真实试验与虚拟扩展覆盖关系" /> },
  ];

  const sourceName = incoming?.source === 'dataAnalysis'
    ? `试验数据分析${incoming.task ? ` / ${incoming.task.taskName}` : ''}`
    : incoming?.source === 'digitalTwin' ? '试验数字孪生' : '';
  const modelOptions = [model, ...MODELS].filter((item, index, rows) => rows.findIndex((row) => row.modelId === item.modelId) === index);

  return (
    <div className="workspace-business-page">
      <div className="workspace-business-heading">
        <div><Title level={4} style={{ margin: 0 }}>虚拟工况扩展</Title><Text type="secondary">使用可信数字孪生模型扩展未实测工况，并判断预测风险与可信度</Text></div>
        <Tag color={boundProject ? 'blue' : 'default'}>{boundProject ? `项目：${boundProject.name}` : '独立模式'}</Tag>
      </div>

      {sourceName && <Alert type="success" showIcon title={`来源：${sourceName}`} description={`${incoming?.validation ? `待验证区间：${incoming.validation.suggestedRange}；验证目标：${incoming.validation.goal}；` : ''}已携带可信模型：${model.modelName} ${model.version}`} />}

      <Card size="small" className="workspace-business-card"><Space wrap>
        <Button icon={<ApiOutlined />} onClick={() => { setDraftModelId(model.modelId); setModelOpen(true); }}>选择可信模型</Button>
        <Button icon={<SettingOutlined />} onClick={() => { setDraftConfig(config); setConfigOpen(true); }}>工况配置</Button>
        <Button icon={<SafetyCertificateOutlined />} onClick={() => { setDraftConstraints(constraints); setConstraintsOpen(true); }}>约束设置</Button>
        <Button icon={<ExperimentOutlined />} onClick={generateConditions}>生成虚拟工况</Button>
        <Button type="primary" icon={<PlayCircleOutlined />} disabled={generationStatus !== 'generated'} loading={predictionStatus === 'loading'} onClick={startPrediction}>开始预测</Button>
        <Button icon={<ReloadOutlined />} onClick={reset}>重置</Button>
      </Space></Card>

      <Card title="当前配置" size="small" className="workspace-business-card"><Descriptions size="small" column={2} items={[
        { key: 'model', label: '当前模型', children: `${model.modelName} ${model.version}` },
        { key: 'status', label: '模型状态', children: <Tag color="green">{model.status}</Tag> },
        { key: 'measured', label: '当前实测范围', children: model.measuredRange ?? '未设置' },
        { key: 'target', label: '目标扩展范围', children: `${config.speedMin}～${config.speedMax} rpm` },
        { key: 'variables', label: '扩展变量', children: '转速、温度、压力' },
        { key: 'count', label: '虚拟工况', children: `${conditions.length || config.count} 组` },
        { key: 'state', label: '当前状态', children: predictionStatus === 'completed' ? '已完成预测' : generationStatus === 'generated' ? '已生成' : '未生成' },
        sourceName ? { key: 'source', label: '来源', children: sourceName } : { key: 'trusted', label: '模型可信范围', children: model.trustedRange },
      ]} /></Card>

      <Card id="business-result" title="虚拟工况与预测结果" size="small" className="workspace-business-card">
        {predictionStatus === 'loading' ? (
          <div style={{ padding: '48px 12%' }}><Progress percent={78} status="active" /><Paragraph type="secondary" style={{ textAlign: 'center' }}>正在执行虚拟工况预测与风险标记...</Paragraph></div>
        ) : generationStatus === 'generated' ? (
          <><Alert type={completed ? 'success' : 'info'} showIcon title={completed ? `已完成 ${conditions.length} 个虚拟工况预测` : `已生成 ${conditions.length} 个虚拟工况，请点击“开始预测”`} style={{ marginBottom: 12 }} /><Tabs activeKey={activeTab} onChange={setActiveTab} items={resultTabs} /></>
        ) : (
          <Alert type="info" showIcon title="请配置扩展范围并生成虚拟工况" />
        )}
        {completed && <div className="workspace-result-actions"><Space wrap>
          <Button icon={<SaveOutlined />} onClick={requestSave}>{persistedProjectId ? '已保存到项目' : '保存预测结果'}</Button>
          <Button onClick={() => handleBusinessAction('生成验证试验')}>生成验证试验</Button>
          <Button type="primary" onClick={() => handleBusinessAction('加入报告')}>加入报告</Button>
        </Space></div>}
      </Card>

      <Modal title="选择可信模型" open={modelOpen} onCancel={() => setModelOpen(false)} onOk={() => { const next = modelOptions.find((item) => item.modelId === draftModelId); if (!next || next.status === '待确认') return message.warning('只能选择已校准或已确认的模型'); setModel(next); setModelOpen(false); invalidate(); }}>
        <Select style={{ width: '100%' }} value={draftModelId} onChange={setDraftModelId} options={modelOptions.map((item) => ({ value: item.modelId, disabled: item.status === '待确认', label: `${item.modelName} ${item.version}｜${item.status}｜${item.measuredRange ?? item.trustedRange}｜${item.calibratedAt ?? '本次校准'}` }))} />
      </Modal>
      <Modal title="工况配置" width={650} open={configOpen} onCancel={() => setConfigOpen(false)} onOk={() => { setConfig(draftConfig); setConfigOpen(false); invalidate(); }}><Form labelCol={{ span: 6 }} wrapperCol={{ span: 17 }}>
        <Form.Item label="扩展方式"><Select value={draftConfig.method} onChange={(value) => setDraftConfig({ ...draftConfig, method: value })} options={['范围扩展', '指定区域扩展'].map((value) => ({ value }))} /></Form.Item>
        {[[ '转速（rpm）', 'speedMin', 'speedMax' ], [ '温度（℃）', 'temperatureMin', 'temperatureMax' ], [ '压力（MPa）', 'pressureMin', 'pressureMax' ]].map(([label, minKey, maxKey]) => <Form.Item label={label} key={label}><Space><InputNumber value={draftConfig[minKey as keyof ConditionConfig] as number} onChange={(value) => setDraftConfig({ ...draftConfig, [minKey]: value ?? 0 })} /><Text>～</Text><InputNumber value={draftConfig[maxKey as keyof ConditionConfig] as number} onChange={(value) => setDraftConfig({ ...draftConfig, [maxKey]: value ?? 0 })} /></Space></Form.Item>)}
        <Form.Item label="生成数量"><InputNumber min={1} max={100} value={draftConfig.count} onChange={(value) => setDraftConfig({ ...draftConfig, count: value ?? 36 })} /></Form.Item>
        <Form.Item label="采样方式"><Select value={draftConfig.sampling} onChange={(value) => setDraftConfig({ ...draftConfig, sampling: value })} options={['自动生成', '均匀采样'].map((value) => ({ value }))} /></Form.Item>
      </Form></Modal>
      <Modal title="约束设置" width={620} open={constraintsOpen} onCancel={() => setConstraintsOpen(false)} onOk={() => { setConstraints(draftConstraints); setConstraintsOpen(false); invalidate(); }}><Form labelCol={{ span: 9 }} wrapperCol={{ span: 14 }}>
        <Form.Item label="最大转速（rpm）"><InputNumber value={draftConstraints.speedMax} onChange={(value) => setDraftConstraints({ ...draftConstraints, speedMax: value ?? 10000 })} /></Form.Item>
        <Form.Item label="最大温度（℃）"><InputNumber value={draftConstraints.temperatureMax} onChange={(value) => setDraftConstraints({ ...draftConstraints, temperatureMax: value ?? 120 })} /></Form.Item>
        <Form.Item label="压力范围"><Space><InputNumber value={draftConstraints.pressureMin} onChange={(value) => setDraftConstraints({ ...draftConstraints, pressureMin: value ?? 1.5 })} /><Text>～</Text><InputNumber value={draftConstraints.pressureMax} onChange={(value) => setDraftConstraints({ ...draftConstraints, pressureMax: value ?? 2.2 })} /></Space></Form.Item>
        <Form.Item label="约束策略"><Space orientation="vertical"><Checkbox checked={draftConstraints.withinScope} onChange={(event) => setDraftConstraints({ ...draftConstraints, withinScope: event.target.checked })}>限制在模型可推演范围内</Checkbox><Checkbox checked={draftConstraints.excludeAbnormal} onChange={(event) => setDraftConstraints({ ...draftConstraints, excludeAbnormal: event.target.checked })}>排除历史异常区域</Checkbox><Checkbox checked={draftConstraints.markOutsideTrusted} onChange={(event) => setDraftConstraints({ ...draftConstraints, markOutsideTrusted: event.target.checked })}>标记超出可信范围工况</Checkbox></Space></Form.Item>
      </Form></Modal>
      <ProjectSaveTargetModal open={saveTargetOpen} title="保存虚拟工况预测到项目" defaultProjectId={boundProject?.id} onCancel={() => setSaveTargetOpen(false)} onConfirm={persistVirtualResult} />
    </div>
  );
};

export default VirtualConditionExtension;
