import React, { useEffect, useState } from 'react';
import { Alert, Button, Dropdown, Empty, Input, Modal, Select, Tag } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, BarChartOutlined, DatabaseOutlined, EllipsisOutlined, ExperimentOutlined, FileTextOutlined, LineChartOutlined, PushpinOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCapabilityFromPath, getSessionEntryPath, getSessionPath, getSessionResourcesPath, sessionCapabilities } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import TaskArtifactScope from './TaskArtifactScope';

const capabilityIcons = {
  doeMethods: <ExperimentOutlined />,
  doe: <ExperimentOutlined />,
  analysis: <BarChartOutlined />,
  digitalTwin: <DatabaseOutlined />,
  virtualCondition: <LineChartOutlined />,
  report: <FileTextOutlined />,
  task: <UnorderedListOutlined />,
};

const SessionWorkbench: React.FC = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  const saveError = useSessionStore(state => state.saveError);
  const projects = useProjectStore(state => state.projects);
  const activeResourceView = useProjectStore(state => state.activeView);
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState<string | undefined>();
  const [lastSavedArtifactId, setLastSavedArtifactId] = useState<string | null>(null);
  useEffect(() => {
    const onArtifactSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string; artifactId: string }>).detail;
      if (detail.sessionId === session?.id) setLastSavedArtifactId(detail.artifactId);
    };
    window.addEventListener('protangram:session-artifact-saved', onArtifactSaved);
    return () => window.removeEventListener('protangram:session-artifact-saved', onArtifactSaved);
  }, [session?.id]);
  if (!session) return <div className="session-missing"><Empty description="此会话不存在或本机数据不可用" /><Button onClick={() => navigate('/')}>返回工作台</Button></div>;
  const capability = getCapabilityFromPath(location.pathname);
  const project = projects.find(item => item.id === session.projectId && !item.sessionOwnerId);
  const context = useSessionStore.getState().getWorkspaceSession(session.id);
  const routeState = location.state as { returnTo?: string; returnState?: unknown } | null;
  const returnTo = routeState?.returnTo;
  const resourceProject = projects.find(item => item.id === session.storageProjectId);
  const lastSavedArtifact = resourceProject?.artifacts.find(item => item.id === lastSavedArtifactId);
  const openSavedArtifact = (artifact: NonNullable<typeof lastSavedArtifact>) => {
    useProjectStore.getState().setActiveProject(session.storageProjectId);
    useProjectStore.getState().setActiveView(artifact.type);
    setLastSavedArtifactId(null);
    navigate(getSessionPath(session.id, 'resources'), { state: {
      workspaceSession: context,
      returnTo: `${location.pathname}${location.search}${location.hash}`,
      returnState: location.state,
    } });
  };
  const openSessionResources = () => {
    if (capability === 'resources') {
      if (activeResourceView !== 'overview') {
        useProjectStore.getState().setActiveView('overview');
        return;
      }
      navigate(returnTo ?? getSessionPath(session.id), {
        state: routeState?.returnState ?? { workspaceSession: context },
      });
      return;
    }
    useProjectStore.getState().setActiveProject(session.storageProjectId);
    useProjectStore.getState().setActiveView('overview');
    navigate(getSessionResourcesPath(session.id), { state: {
      workspaceSession: context,
      returnTo: `${location.pathname}${location.search}${location.hash}`,
      returnState: location.state,
    } });
  };
  return <div className="session-workbench">
    <header className="session-workbench-header"><div><div className="session-title-line"><h1>{session.title}</h1>{session.pinned && <PushpinOutlined />}{session.archived && <Tag>已归档</Tag>}</div><div className="session-meta"><span>{session.taskId ? '正式任务会话' : project ? project.name : '独立会话'}</span><span className={saveError ? 'session-save-error' : 'session-saved'}>{saveError ? '尚未保存' : '已保存到本机'}</span></div></div><div className="session-header-actions"><Button icon={capability === 'resources' ? <ArrowLeftOutlined /> : <DatabaseOutlined />} onClick={openSessionResources}>{capability === 'resources' ? activeResourceView === 'overview' ? '返回原工作界面' : '返回成果总览' : '数据与成果'}</Button><Dropdown trigger={['click']} menu={{ items: [{ key: 'edit', label: '重命名与项目归属' }, { key: 'pin', label: session.pinned ? '取消置顶' : '置顶会话' }, { key: 'archive', label: session.archived ? '恢复会话' : '归档会话' }], onClick: ({ key }) => { if (key === 'edit') { setTitle(session.title); setProjectId(session.projectId); setEditOpen(true); } if (key === 'pin') useSessionStore.getState().togglePinned(session.id); if (key === 'archive') useSessionStore.getState().archiveSession(session.id, !session.archived); } }}><Button icon={<EllipsisOutlined />} aria-label="会话操作" /></Dropdown></div></header>
    {saveError && <Alert type="error" showIcon title={saveError} action={<Button size="small" onClick={() => useSessionStore.getState().retrySave()}>重试保存</Button>} />}
    {lastSavedArtifact && <Alert type="success" showIcon closable title={`“${lastSavedArtifact.title}”已保存到当前会话`} action={<Button type="link" icon={<ArrowRightOutlined />} onClick={() => openSavedArtifact(lastSavedArtifact)}>查看刚保存的结果</Button>} />}
    {capability !== 'overview' && capability !== 'resources' && <nav className="session-capability-tabs" aria-label="当前会话专业能力">
      {session.taskId && <button className={capability === 'task' ? 'is-active' : ''} aria-current={capability === 'task' ? 'page' : undefined} onClick={() => navigate(`${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId!)}`, { state: { workspaceSession: context } })}>
        <span className="session-capability-tab-icon">{capabilityIcons.task}</span><span className="session-capability-tab-copy"><strong>任务工作台</strong><small>事项与结果跟踪</small></span>
      </button>}
      {sessionCapabilities.map(item => <button key={item.key} className={capability === item.key ? 'is-active' : ''} aria-current={capability === item.key ? 'page' : undefined} onClick={() => navigate(getSessionPath(session.id, item.key), { state: { workspaceSession: context } })}>
        <span className="session-capability-tab-icon">{capabilityIcons[item.key]}</span><span className="session-capability-tab-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
      </button>)}
    </nav>}
    <TaskArtifactScope />
    <div className="session-professional-content"><Outlet key={`${session.id}:${location.pathname}:${location.key}`} /></div>
    <Modal title="会话设置" open={editOpen} okText="保存" cancelText="取消" onCancel={() => setEditOpen(false)} onOk={() => { if (!title.trim()) return; useSessionStore.getState().renameSession(session.id, title); if (!session.taskId) useSessionStore.getState().moveSession(session.id, projectId); setEditOpen(false); }}><label className="session-form-label" htmlFor="session-title-input">会话名称</label><Input id="session-title-input" value={title} onChange={event => setTitle(event.target.value)} /><label className="session-form-label" htmlFor="session-project-input">所属项目</label><Select id="session-project-input" style={{ width: '100%' }} allowClear placeholder="独立会话，无需项目" value={projectId} disabled={Boolean(session.taskId)} onChange={setProjectId} options={projects.filter(item => !item.sessionOwnerId).map(item => ({ value: item.id, label: item.name }))} /><p className="session-resource-description">项目用于归类会话，会话成果仍保留在当前会话中。</p></Modal>
  </div>;
};
export const SessionEntryRedirect: React.FC = () => {
  const { sessionId } = useParams();
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  if (!session) return <Navigate to="/" replace />;
  return <Navigate to={getSessionEntryPath(session)} replace />;
};
export default SessionWorkbench;
