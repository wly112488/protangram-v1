import { useState } from 'react';
import { Alert, Button, Card, Collapse, Input, Select, Space, Tag, Typography } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { getCapabilityFromPath, getSessionPath, type PhysicalBusinessScope, type WorkSession } from './sessionModel';
import { artifactResultLabel, getSourceArtifacts, physicalSourcePath, resolvePhysicalSource, samePhysicalSource } from './physicalBusinessContext';
import TrialChart from './TrialChart';
import type { BusinessRouteState } from '../types/businessContext';

export default function PhysicalSourcePanel({ session }: { session: WorkSession }) {
  const objects = usePhysicalObjectStore(state => state.objects);
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const navigate = useNavigate();
  const location = useLocation();
  const capability = getCapabilityFromPath(location.pathname);
  const scope = session.businessScope;
  const source = resolvePhysicalSource(objects, scope);
  const path = physicalSourcePath(objects, scope);
  const [changingSourceSessionId, setChangingSourceSessionId] = useState<string | null>(null);
  const hasValidSource = Boolean(source.configuration && !source.missing);
  const changingSource = changingSourceSessionId === session.id;
  const choices: Array<{ value: string; label: string; scope: PhysicalBusinessScope }> = objects.flatMap(family => family.configurations.flatMap(configuration => [
    { value: configuration.id, label: `${family.name} / ${configuration.name}（构型参数）`, scope: { physicalObjectId: configuration.id, physicalObjectName: configuration.name } },
    ...configuration.experiments.flatMap(experiment => (experiment.trials ?? []).flatMap(trial => [trial.record, ...(trial.archivedRecords ?? [])].filter((record, index) => record || index === 0).map(record => ({
      value: `${configuration.id}/${experiment.id}/${trial.id}/${record?.id ?? ''}`,
      label: `${family.name} / ${configuration.name} / ${experiment.name} / ${trial.name} / ${record?.name ?? '尚无记录'}${record && record.id !== trial.record?.id ? '（历史只读）' : ''}`,
      scope: { physicalObjectId: configuration.id, physicalObjectName: configuration.name, experimentId: experiment.id, experimentName: experiment.name, trialId: trial.id, trialName: trial.name, testRecordId: record?.id, testRecordName: record?.name, taskBookId: trial.taskBookId },
    })))),
  ]));
  const selectedChoice = choices.find(choice => samePhysicalSource(choice.scope, scope));
  const allowedUpstream = capability === 'virtualCondition' ? ['calibration'] : capability === 'digitalTwin' ? ['analysis'] : capability === 'doe' ? ['analysis', 'calibration', 'virtualCondition'] : [];
  const upstream = getSourceArtifacts(projects, sessions, scope).filter(item => allowedUpstream.includes(item.type));
  const draft = session.drafts[capability];
  const selectedModel = (draft?.selectedModel ?? draft?.model) as { modelId?: string } | undefined;
  const selectedModelId = selectedModel?.modelId ?? (draft?.data as { modelData?: string } | undefined)?.modelData;
  const modelDefinition = source.configuration?.models.find(item => item.id === selectedModelId);
  const modelInputs = draft?.[`modelInputs:${selectedModelId}`] as Record<string, string> | undefined;
  return <Card size="small" className="physical-source-panel" title="共享业务来源" extra={<Space>{hasValidSource && <Button type="link" onClick={() => setChangingSourceSessionId(changingSource ? null : session.id)}>{changingSource ? '取消更换' : '更换来源'}</Button>}{path && <Button type="link" onClick={() => navigate(path)}>{source.record ? '返回原始记录' : '返回来源'}</Button>}</Space>}>
    {(!hasValidSource || changingSource) && <Select aria-label="选择已有业务来源" showSearch optionFilterProp="label" style={{ width: '100%' }}
      placeholder="选择已有构型或试验记录；各专业参数独立保存"
      value={selectedChoice?.value}
      options={choices}
      onChange={value => {
        const chosen = choices.find(item => item.value === value);
        if (!chosen) return;
        const id = useSessionStore.getState().ensurePhysicalSession(chosen.scope, `${chosen.scope.physicalObjectName} · 专业工作`);
        setChangingSourceSessionId(null);
        useSessionStore.getState().openSession(id, capability);
        navigate(getSessionPath(id, capability));
      }} />}
    {source.missing ? <Alert type="error" showIcon message="业务来源已失效；请选择已有来源，当前工作不会改用其他记录。" /> : source.configuration ? <>
      <Typography.Paragraph type="secondary">当前来源：{[source.family?.name, source.configuration.name, source.experiment?.name, source.trial?.name, source.record?.name].filter(Boolean).join(' / ')}{source.trial?.taskBookId && <Tag>任务书 ID：{source.trial.taskBookId}</Tag>}</Typography.Paragraph>
      <Collapse items={[{ key: 'data', label: `构型参数与原始记录 · ${source.record?.rawFiles.length ?? 0} 个文件 · ${source.record?.charts.length ?? 0} 张图表`, children: <>
        <Space wrap>{source.configuration.parameters.map(field => <Tag key={field.id}>{field.name}：{field.value} {field.unit}</Tag>)}</Space>
        <Typography.Paragraph>试验构型共用设置：{source.experiment?.settings.map(field => `${field.name}：${field.value} ${field.unit ?? ''}`).join('；') || '暂无'}</Typography.Paragraph>
        <Typography.Paragraph>本次设计工况：{source.trial?.designs.map(field => `${field.name}：${field.value} ${field.unit ?? ''}`).join('；') || '暂无'}</Typography.Paragraph>
        <Typography.Paragraph>实际条件：{source.record?.actualConditions.map(field => `${field.name}：${field.value} ${field.unit ?? ''}`).join('；') || '暂无'}</Typography.Paragraph>
        <Typography.Paragraph>测量结果：{source.record?.measurements.map(field => `${field.name}：${field.value} ${field.unit ?? ''}`).join('；') || '暂无'}</Typography.Paragraph>
        {source.record?.rawFiles.map(file => <div key={file.id}><Typography.Text>{file.name} · {file.rowCount} 行</Typography.Text><Typography.Text type="secondary"> · 文件 ID：{file.id}</Typography.Text></div>)}
        {source.record?.charts.map(chart => <Card size="small" key={chart.id} title={chart.name}><TrialChart chart={chart} rawFile={source.record?.rawFiles.find(file => file.id === chart.rawFileId)} /></Card>)}
        {path && <Button onClick={() => navigate(path)}>管理原始文件与图表</Button>}
      </> }]} />
      {modelDefinition && <Card size="small" title={`${modelDefinition.name} · 本功能模型输入（手工填写）`}>
        {modelDefinition.inputs.map(field => <label className="physical-model-input" key={field.id}>{field.name} {field.unit}<Input aria-label={`模型输入：${field.name}`} value={modelInputs?.[field.id] ?? ''} onChange={event => useSessionStore.getState().updateDraft(session.id, capability, `modelInputs:${modelDefinition.id}`, { ...modelInputs, [field.id]: event.target.value })} /></label>)}
        <Typography.Text type="secondary">模型方法：{modelDefinition.method || '未配置'}。这些输入只属于当前专业功能，不改写构型参数或其他功能。</Typography.Text>
      </Card>}
      {upstream.length > 0 && <Select aria-label="引用已有专业成果" placeholder="按需引用上游成果" style={{ width: '100%', marginTop: 12 }} value={undefined}
        options={upstream.map(item => ({ value: `${item.projectId}/${item.id}`, label: `${item.title} · ${artifactResultLabel(item)}` }))}
        onChange={value => {
          const artifact = upstream.find(item => `${item.projectId}/${item.id}` === value);
          if (!artifact) return;
          const context = useSessionStore.getState().getWorkspaceSession(session.id);
          const model = artifact.payload.model as BusinessRouteState['model'];
          const state: BusinessRouteState = { source: artifact.type === 'calibration' ? 'digitalTwin' : artifact.type === 'virtualCondition' ? 'virtualCondition' : 'dataAnalysis', artifactIds: [artifact.id], workspaceSession: context, model };
          useSessionStore.getState().setHandoff(session.id, capability, state as unknown as Record<string, unknown>, true);
          navigate(getSessionPath(session.id, capability), { state });
        }} />}
    </> : <Typography.Text type="secondary">当前为独立工作。选择来源后继承实体引用，模型与专业参数由你选择和填写。</Typography.Text>}
    {['doe', 'analysis', 'digitalTwin', 'virtualCondition'].includes(capability) && <Alert type="info" showIcon message="原始记录与 CSV 图表来自本机数据；专业推荐、异常、校准与预测当前为演示计算，保存及引用时保留此标识。模型输入由用户手工填写。" />}
  </Card>;
}
