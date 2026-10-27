import { useMemo, useState } from 'react';
import { Button, List, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { getProjectTrialEntries, getProjectTrialDraftSessions, type ProjectTrialEntry } from './projectTrialModel';
import { getSessionPath, getSessionResumePath } from './sessionModel';
import { SessionCreateDialog } from './SessionCreate';
import { sessionResourcesPath } from './sharedResourcesModel';
import ProjectContent from './ProjectContent';

export default function ProjectTrialsView({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const [creating, setCreating] = useState(false);
  const project = projects.find(item => item.id === projectId);
  const entries = useMemo(() => getProjectTrialEntries(projectId, objects, projects, sessions), [projectId, objects, projects, sessions]);
  const drafts = getProjectTrialDraftSessions(projectId, sessions);
  if (!project) return null;
  const openTrial = (entry: ProjectTrialEntry, recordId?: string, resources = false) => {
    const scope = { physicalObjectId: entry.object.id, physicalObjectName: entry.object.name,
      experimentId: entry.experiment.id, experimentName: entry.experiment.name, trialId: entry.trial.id,
      trialName: entry.trial.name, taskBookId: entry.trial.taskBookId,
      ...(recordId ? { testRecordId: recordId, testRecordName: entry.trial.records.find(item => item.id === recordId)?.name } : {}),
    };
    const id = useSessionStore.getState().ensureProjectSession(projectId, scope);
    const session = useSessionStore.getState().sessions.find(item => item.id === id)!;
    navigate(resources ? sessionResourcesPath(session, projects) : getSessionPath(id, recordId ? 'analysis' : 'overview'));
  };
  return <div className="workspace-content-stack">
    <div className="workspace-content-heading"><Typography.Title level={3}>试验任务</Typography.Title><Space><Button onClick={() => navigate('/task-book-analysis?projectId=' + encodeURIComponent(projectId))}>分析任务书</Button><Button type="primary" onClick={() => setCreating(true)}>新建试验</Button></Space></div>
    {drafts.length > 0 && <List header="试验工作" dataSource={drafts} renderItem={session => <List.Item actions={[
      <Button key="continue" onClick={() => navigate(getSessionResumePath(session))}>继续工作</Button>,
    ]}><List.Item.Meta title={<Space>{session.title}<Tag>草稿</Tag></Space>} description="选择专业功能并填写输入后，关联或创建具体试验。" /></List.Item>} />}
    <SessionCreateDialog open={creating} projectId={projectId} purpose="trial" onCancel={() => setCreating(false)} onCreated={() => setCreating(false)} />
    <Table rowKey={entry => entry.trial.id} dataSource={entries} scroll={{ x: 800 }} pagination={{ defaultPageSize: 10 }} locale={{ emptyText: null }} columns={[
      { title: '试验名称', render: (_, entry) => <Button type="link" onClick={() => openTrial(entry)}>{entry.trial.name}</Button> },
      { title: '物理对象', render: (_, entry) => entry.object.name },
      { title: 'CFG', render: () => '在专业功能中按次选择' },
      { title: '载荷谱', render: (_, entry) => entry.trial.loadSpectrum || "" },
      { title: '任务书', render: (_, entry) => entry.trial.taskBookId ? tasks.find(task => task.id === entry.trial.taskBookId)?.title ?? "" : "" },
      { title: '执行次数', render: (_, entry) => entry.trial.records.length },
      { title: '操作', render: (_, entry) => <Space><Button onClick={() => openTrial(entry)}>打开试验</Button><Button onClick={() => openTrial(entry, undefined, true)}>查看成果</Button></Space> },
    ]} expandable={{ expandedRowRender: entry => <div className="workspace-content-stack"><List dataSource={entry.trial.records} locale={{ emptyText: null }} renderItem={record => <List.Item actions={[<Button key="open" onClick={() => openTrial(entry, record.id)}>打开数据分析</Button>]}><List.Item.Meta title={`第 ${record.executionNumber} 次执行 · ${record.name}`} description={<Space wrap>{record.rawFiles.filter(file => file.status !== 'removed').map(file => <Tag key={file.id}>{file.name}</Tag>)}<Typography.Text type="secondary">{record.tables.length} 个派生数据表</Typography.Text></Space>} /></List.Item>} /><ProjectContent trialViewId={entry.trial.id} embedded /></div> }} />
  </div>;
}
