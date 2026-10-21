import { useState } from 'react';
import { Button, Card, Input, List, Modal, Progress, Select, Space, Table, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { TaskRecord, TaskRequirement, TaskTrialDraft } from './taskTypes';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { getSessionPath } from './sessionModel';
import { getTaskProgress, taskCapabilityLabels, taskCapabilityRoute } from './taskAnalysisModel';
import { completeTaskRequirement } from './taskTrialWorkflow';
import { resolvePhysicalSource } from './physicalBusinessContext';
import { getTrialArtifacts } from './analysisResultModel';
import './taskAnalysis.css';

export default function TaskProgressView({ task }: { task: TaskRecord }) {
  const navigate = useNavigate();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const [completing, setCompleting] = useState<TaskRequirement>();
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState<string[]>([]);
  const progress = getTaskProgress(task);
  const review = (draft: TaskTrialDraft) => navigate(`/trials/new?${new URLSearchParams({ taskBookId: task.id, draftId: draft.id })}`);
  const openDraft = (draft: TaskTrialDraft, requirement?: TaskRequirement) => {
    if (!draft.source) { review(draft); return; }
    const source = resolvePhysicalSource(objects, draft.source);
    if (source.missing || source.trial?.taskBookId !== task.id) { message.error('关联试验来源已失效或任务书关联已变化'); return; }
    const project = projects.find(item => item.id === task.projectId && !item.sessionOwnerId);
    const id = useSessionStore.getState().ensureTaskTrialSession(task.id, draft.id, draft.source, project?.id);
    useTaskStore.getState().bindTrialDraft(task.id, draft.id, draft.source, id);
    if (requirement && requirement.status === '待完成') useTaskStore.getState().setRequirementStatus(task.id, requirement.id, '进行中');
    navigate(getSessionPath(id, requirement?.capability ? taskCapabilityRoute[requirement.capability] : 'doe'));
  };
  const completionDrafts = task.trialDrafts?.filter(item => completing && item.requirementIds.includes(completing.id)) ?? [];
  const artifacts = [...new Map(completionDrafts.flatMap(draft => {
    const source = resolvePhysicalSource(objects, draft.source);
    return source.trial && draft.source ? getTrialArtifacts(projects, sessions, draft.source, source.trial) : [];
  }).map(artifact => [`${artifact.projectId}/${artifact.id}`, artifact])).values()];
  const confirm = () => {
    if (!completing) return;
    if (!note.trim() && !evidence.length) { message.warning('请填写完成依据或选择已有成果'); return; }
    try {
      for (const key of evidence) {
        const artifact = artifacts.find(item => `${item.projectId}/${item.id}` === key);
        if (!artifact) throw new Error('所选成果已不存在，请重新选择');
        useTaskStore.getState().addArtifactToTaskItem(task.id, completing.id, { projectId: artifact.projectId, artifactId: artifact.id });
      }
      completeTaskRequirement(task.id, completing.id, note);
      setCompleting(undefined); setNote(''); setEvidence([]);
      message.success('事项已完成，对应会话已显示在左侧');
    } catch (error) { message.error(error instanceof Error ? error.message : '确认失败'); }
  };
  return <div className="workspace-content-stack">
    <Card><div className="task-progress-toolbar"><div><Typography.Title level={4}>任务进度</Typography.Title><Typography.Text>{progress.completed} / {progress.total} 项完成</Typography.Text></div><Progress percent={progress.percent} style={{ width: 280, maxWidth: '100%' }} /></div></Card>
    <Card title="试验模板" className="task-progress-templates"><List dataSource={task.trialDrafts ?? []} locale={{ emptyText: '尚无试验模板，可从分析任务书导入，或关联已有试验。' }} renderItem={draft => <List.Item actions={[<Button key="open" type={draft.source ? 'default' : 'primary'} onClick={() => openDraft(draft)}>{draft.source ? '继续试验工作' : '复核并创建试验'}</Button>]}><List.Item.Meta title={<Space>{draft.name || '待命名试验'}<Tag color={draft.source ? 'blue' : 'default'}>{draft.source ? '已确认' : '待复核'}</Tag></Space>} description={<Space wrap><Typography.Text>{draft.loadSpectrum || '载荷谱待补充'}</Typography.Text>{draft.source?.physicalObjectName && <Tag>{draft.source.physicalObjectName} / {draft.source.experimentName}</Tag>}</Space>} /></List.Item>} /></Card>
    <Table rowKey="id" dataSource={task.requirements} pagination={false} scroll={{ x: 700 }} columns={[
      { title: '任务事项', dataIndex: 'text' },
      { title: '专业功能', render: (_, item) => item.capability ? taskCapabilityLabels[item.capability] : '待指定' },
      { title: '前置事项', render: (_, item) => item.dependsOnIds?.map(id => task.requirements.findIndex(req => req.id === id) + 1).join('、') || '—' },
      { title: '状态', render: (_, item) => <Tag color={item.status === '已满足' ? 'success' : item.status === '进行中' ? 'processing' : 'default'}>{item.status === '已满足' ? '已完成' : item.status}</Tag> },
      { title: '操作', render: (_, item) => {
        const drafts = task.trialDrafts?.filter(draft => draft.requirementIds.includes(item.id)) ?? [];
        const draft = drafts.find(value => !value.source) ?? drafts[0];
        return <Space><Button disabled={!draft} onClick={() => { if (draft) openDraft(draft, item); }}>{item.status === '已满足' ? '查看工作' : '开展工作'}</Button>{item.status !== '已满足' ? <Button disabled={!drafts.length || drafts.some(value => !value.source)} onClick={() => { setCompleting(item); setNote(''); setEvidence([]); }}>确认完成</Button> : <Button type="link" onClick={() => { useTaskStore.getState().reopenRequirement(task.id, item.id); useTaskStore.getState().setTaskStatus(task.id, '进行中'); }}>重新打开</Button>}</Space>;
      } },
    ]} />
    <Modal title={completing ? `确认完成：${completing.text}` : '确认完成'} open={Boolean(completing)} onCancel={() => setCompleting(undefined)} onOk={confirm} okText="确认完成" cancelText="取消"><Space direction="vertical" style={{ width: '100%' }}><Typography.Text>完成依据</Typography.Text><Input.TextArea aria-label="完成依据" value={note} onChange={event => setNote(event.target.value)} rows={3} placeholder="记录核对结论或完成情况" /><Typography.Text>关联已有成果</Typography.Text><Select aria-label="关联完成成果" mode="multiple" style={{ width: '100%' }} value={evidence} onChange={setEvidence} options={artifacts.map(artifact => ({ value: `${artifact.projectId}/${artifact.id}`, label: artifact.title }))} /></Space></Modal>
  </div>;
}
