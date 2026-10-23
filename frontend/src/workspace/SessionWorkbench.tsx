import React, { useEffect, useState } from 'react';
import { Alert, Button, Dropdown, Empty, Input, Modal, Select, Tag } from 'antd';
import { ArrowRightOutlined, BarChartOutlined, DatabaseOutlined, EllipsisOutlined, ExperimentOutlined, FileTextOutlined, LineChartOutlined, PushpinOutlined, UnorderedListOutlined } from '@ant-design/icons';
import { Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getCapabilityFromPath, getSessionEntryPath, getSessionPath, sessionCapabilities } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import TaskArtifactScope from './TaskArtifactScope';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { resolvePhysicalSource } from './physicalBusinessContext';
import TrialWorksheetProvider from './TrialWorksheetProvider';
import LegacySessionPage from './LegacySessionPage';
import { taskBookPath } from './taskTrialModel';
import { sessionResourcesPath } from './sharedResourcesModel';
import TrialSettingsPanel from './TrialSettingsPanel';

const capabilityIcons = {
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
  const objects = usePhysicalObjectStore(state => state.objects);
  const [editOpen, setEditOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const needsTrial = sessionCapabilities.some(item => item.key === capability) && !session.businessScope?.trialId;
  const taskReportMode = Boolean(session.taskId && capability === 'report');
  const project = projects.find(item => item.id === session.projectId && !item.sessionOwnerId);
  const context = useSessionStore.getState().getWorkspaceSession(session.id);
  const physicalSource = resolvePhysicalSource(objects, session.businessScope);
  const physicalSourceLabel = [context?.physicalObjectName, context?.experimentName, context?.trialName, context?.testRecordName, context?.taskBookName].filter(Boolean).join(' · ');
  const resourceProject = projects.find(item => item.id === session.storageProjectId);
  const lastSavedArtifact = resourceProject?.artifacts.find(item => item.id === lastSavedArtifactId);
  const openSessionResources = (artifactId?: string) => {
    navigate(sessionResourcesPath(session, projects), { state: {
      returnTo: `${location.pathname}${location.search}${location.hash}`,
      returnState: location.state,
      artifactId,
    } });
    setLastSavedArtifactId(null);
  };
  return <div className="session-workbench">
    <header className="session-workbench-header"><div><div className="session-title-line"><h1>{session.title}</h1>{session.pinned && <PushpinOutlined />}{session.archived && <Tag>已归档</Tag>}</div><div className="session-meta"><span>{session.businessScope ? physicalSourceLabel : session.taskId ? '正式任务会话' : project ? project.name : '独立会话'}</span><span className={saveError ? 'session-save-error' : 'session-saved'}>{saveError ? '尚未保存' : '已保存到本机'}</span></div></div><div className="session-header-actions">{session.taskWork && <Button onClick={() => navigate(taskBookPath(session.taskWork!.taskId, 'progress'))}>返回任务进度</Button>}{physicalSource.trial && !physicalSource.missing && <Button onClick={() => setSettingsOpen(true)}>试验设置</Button>}<Button aria-label="数据与成果" icon={<DatabaseOutlined />} onClick={() => openSessionResources()}>数据与成果</Button><Dropdown trigger={['click']} menu={{ items: [{ key: 'edit', label: '重命名与项目归属' }, { key: 'pin', label: session.pinned ? '取消置顶' : '置顶会话' }, { key: 'archive', label: session.archived ? '恢复会话' : '归档会话' }], onClick: ({ key }) => { if (key === 'edit') { setTitle(session.title); setProjectId(session.projectId); setEditOpen(true); } if (key === 'pin') useSessionStore.getState().togglePinned(session.id); if (key === 'archive') useSessionStore.getState().archiveSession(session.id, !session.archived); } }}><Button icon={<EllipsisOutlined />} aria-label="会话操作" /></Dropdown></div></header>
    {saveError && <Alert type="error" showIcon title={saveError} action={<Button size="small" onClick={() => useSessionStore.getState().retrySave()}>重试保存</Button>} />}
    {lastSavedArtifact && <Alert type="success" showIcon closable title={`“${lastSavedArtifact.title}”${physicalSource.trial ? '已保存到当前试验的共享成果' : '已保存到当前会话'}`} action={<Button type="link" icon={<ArrowRightOutlined />} onClick={() => openSessionResources(lastSavedArtifact.id)}>查看刚保存的结果</Button>} />}
    {!needsTrial && !taskReportMode && capability !== 'overview' && capability !== 'resources' && <nav className="session-capability-tabs" aria-label="当前会话专业能力">
      {session.taskId && <button className={capability === 'task' ? 'is-active' : ''} aria-current={capability === 'task' ? 'page' : undefined} onClick={() => navigate(`${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId!)}`, { state: { workspaceSession: context } })}>
        <span className="session-capability-tab-icon">{capabilityIcons.task}</span><span className="session-capability-tab-copy"><strong>任务工作台</strong><small>事项与结果跟踪</small></span>
      </button>}
      {sessionCapabilities.map(item => <button key={item.key} className={capability === item.key ? 'is-active' : ''} aria-current={capability === item.key ? 'page' : undefined} onClick={() => navigate(getSessionPath(session.id, item.key), { state: { workspaceSession: context } })}>
        <span className="session-capability-tab-icon">{capabilityIcons[item.key]}</span><span className="session-capability-tab-copy"><strong>{item.label}</strong></span>
      </button>)}
    </nav>}
    <TaskArtifactScope />
    {physicalSource.trial && !physicalSource.missing && <>
      <Modal title="试验设置" open={settingsOpen} onCancel={() => setSettingsOpen(false)} footer={null} destroyOnHidden width={820}>
        <TrialSettingsPanel key={physicalSource.trial.id} trial={physicalSource.trial} />
      </Modal>
    </>}
    {physicalSource.trial && !physicalSource.missing ? <TrialWorksheetProvider key={`${session.id}:${physicalSource.trial.id}`} trial={physicalSource.trial} sessionId={session.id} capability={capability} initialRecordId={physicalSource.record?.id}><Outlet key={`${session.id}:${location.pathname}:${location.key}`} /></TrialWorksheetProvider> : <div className="session-professional-content">{needsTrial
      ? <Alert type="info" showIcon message="请先创建具体试验" description="智能试验设计、数据分析、数字孪生、虚拟工况和报告都围绕具体试验开展。创建完成后，系统会自动带入试验上下文。" action={<Button type="primary" onClick={() => navigate('/trials/new')}>创建具体试验</Button>} />
      : physicalSource.missing ? <Empty description="请先修复业务来源，专业功能不会使用其他记录替代" /> : <><Outlet key={`${session.id}:${location.pathname}:${location.key}`} /></>}</div>}
    <Modal title="会话设置" open={editOpen} okText="保存" cancelText="取消" onCancel={() => setEditOpen(false)} onOk={() => { if (!title.trim()) return; useSessionStore.getState().renameSession(session.id, title); if (!session.taskId && !session.businessScope?.trialId) useSessionStore.getState().moveSession(session.id, projectId); setEditOpen(false); }}><label className="session-form-label" htmlFor="session-title-input">会话名称</label><Input id="session-title-input" value={title} onChange={event => setTitle(event.target.value)} /><label className="session-form-label" htmlFor="session-project-input">所属项目</label><Select id="session-project-input" style={{ width: '100%' }} allowClear placeholder="独立会话，无需项目" value={projectId} disabled={Boolean(session.taskId || session.businessScope?.trialId)} onChange={setProjectId} options={projects.filter(item => !item.sessionOwnerId).map(item => ({ value: item.id, label: item.name }))} /><p className="session-resource-description">{session.businessScope?.trialId ? '具体试验的项目归属由创建时确定；任务书关联不改变归属。' : '项目用于归类工作草稿，不复制或移动原有成果。'}</p></Modal>
  </div>;
};
export const SessionEntryRedirect: React.FC = () => {
  const { sessionId } = useParams();
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  if (!session) return <Navigate to="/" replace />;
  if (!session.businessScope?.trialId && !session.taskId) return <LegacySessionPage session={session} />;
  return <Navigate to={getSessionEntryPath(session)} replace />;
};
export default SessionWorkbench;
