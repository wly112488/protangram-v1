import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Drawer, Space, Spin, Tag, message } from 'antd';
import { MenuOutlined, RobotOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TrialAIAssistant from '@/components/TrialAIAssistant';
import ThemeToggle from '@/components/ThemeToggle';
import BusinessSidebar from './BusinessSidebar';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { getCapabilityFromPath, getLegacySessionPath, getSessionIdFromLocation, getSessionPath } from './sessionModel';
import type { BusinessRouteState } from '@/types/businessContext';
import { importLegacyWorkspace, initializeWorkspacePersistence, useWorkspacePersistence } from './workspacePersistence';
import './workspace.css';
import './sessionWorkspace.css';

const SessionShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const ready = useWorkspacePersistence(state => state.ready);
  const persistenceError = useWorkspacePersistence(state => state.error);
  const pending = useWorkspacePersistence(state => state.pending);
  const retry = useWorkspacePersistence(state => state.retry);
  const conflict = useWorkspacePersistence(state => state.conflict);
  const role = useWorkspacePersistence(state => state.role);
  const legacyDataAvailable = useWorkspacePersistence(state => state.legacyDataAvailable);
  const migrationWarnings = useWorkspacePersistence(state => state.migrationWarnings);
  const sessions = useSessionStore(state => state.sessions);
  const tasks = useTaskStore(state => state.tasks);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const bridgedLocation = useRef<string | null>(null);
  const routeId = getSessionIdFromLocation(location.pathname, location.search);
  const incoming = location.state as BusinessRouteState | null;
  const requestedId = routeId ?? incoming?.workspaceSession?.sessionId;
  const taskRouteId = location.pathname.match(/^\/tasks\/([^/]+)$/)?.[1];
  const taskId = taskRouteId ? decodeURIComponent(taskRouteId) : incoming?.workspaceSession?.mode === 'task' ? incoming.workspaceSession.taskId : new URLSearchParams(location.search).get('taskId');
  const task = tasks.find(item => item.id === taskId);
  const bridgeId = task ? sessions.find(item => item.taskId === task.id)?.id : requestedId;
  const legacyCapability = Boolean(getLegacySessionPath(location.pathname, 'placeholder'));
  const needBridge = Boolean(!taskRouteId && !location.pathname.startsWith('/sessions/') && legacyCapability);
  const projectLanding = location.pathname === '/projects' && !requestedId;
  useEffect(() => { void initializeWorkspacePersistence().catch(() => {}); }, []);
  useEffect(() => {
    if (!ready) return;
    setMobileOpen(false);
    if (location.pathname === '/' || location.pathname === '/task-center') { useSessionStore.getState().openSession(null); return; }
    if (projectLanding) return;
    if (needBridge) {
      if (bridgedLocation.current === location.key) return;
      bridgedLocation.current = location.key;
      const explicitProjectId = incoming?.workspaceSession?.targetProjectId ?? location.pathname.match(/^\/report\/create\/([^/]+)$/)?.[1];
      const current = sessions.find(item => item.id === bridgeId);
      if (!task && !current && !explicitProjectId) {
        navigate('/trials', { replace: true });
        return;
      }
      const id = task ? useSessionStore.getState().ensureTaskSession(task)
        : explicitProjectId && !incoming?.workspaceSession?.sessionId && current?.storageProjectId !== explicitProjectId
          ? useSessionStore.getState().ensureProjectSession(explicitProjectId)
          : current ? current.id : useSessionStore.getState().createSession();
      const destination = taskRouteId ? `${getSessionPath(id)}/tasks/${encodeURIComponent(task!.id)}` : getLegacySessionPath(location.pathname, id);
      if (!destination) return;
      const capability = getCapabilityFromPath(destination);
      const context = useSessionStore.getState().getWorkspaceSession(id);
      const nextState = { ...incoming, workspaceSession: { ...context, ...incoming?.workspaceSession, sessionId: id, targetProjectId: context?.targetProjectId } };
      const sourceCapability: Record<string, string> = { intelligentDesign: 'doe', dataAnalysis: 'analysis', digitalTwin: 'digitalTwin', virtualCondition: 'virtualCondition' };
      if (incoming?.source || incoming?.artifactIds) useSessionStore.getState().setHandoff(id, capability, nextState,
        Boolean(incoming.artifactIds) || Boolean(incoming.source && sourceCapability[incoming.source] !== capability) || Boolean(incoming.autoExecute));
      useSessionStore.getState().openSession(id, capability);
      navigate(`${destination}${location.search}`, { replace: true, state: nextState });
      return;
    }
    if (routeId && sessions.some(item => item.id === routeId)) useSessionStore.getState().openSession(routeId, getCapabilityFromPath(location.pathname));
  // Navigation changes own the bridge; draft writes must not retrigger it.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, ready]);
  if (!ready) return <div className="session-loading" style={{ padding: 48 }}>
    {persistenceError ? <Alert type="error" showIcon title="工作台数据加载失败" description={persistenceError} action={<Button onClick={() => void retry().catch(() => {})}>重试</Button>} /> : <Spin description="正在读取试验数据…" />}
  </div>;
  return <div className="workspace-shell session-shell"><BusinessSidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />{mobileOpen && <button className="session-sidebar-backdrop" aria-label="关闭业务导航" onClick={() => setMobileOpen(false)} />}
    <div className="session-main"><div className="session-topbar"><Button className="session-mobile-toggle" icon={<MenuOutlined />} aria-label="打开业务导航" aria-expanded={mobileOpen} aria-controls="session-sidebar" onClick={() => setMobileOpen(!mobileOpen)} /><span>{routeId ? '试验专业工作' : location.pathname === '/task-center' ? '任务书' : location.pathname.startsWith('/physical-objects') ? '物理对象' : '具体试验'}</span><Space><Tag>{role === 'admin' ? '管理员' : '实验人员'}</Tag><span aria-live="polite">{persistenceError ? '存在未保存的更改' : pending ? '正在保存…' : '已保存到数据库'}</span><ThemeToggle /><Button icon={<RobotOutlined />} onClick={() => setAssistantOpen(true)}>AI 助手</Button></Space></div>
    {persistenceError && <Alert type="error" showIcon title="更改未保存" description={persistenceError} action={<Button size="small" onClick={() => conflict ? window.location.reload() : void retry().catch(() => {})}>{conflict ? '重新加载最新数据' : '重试保存'}</Button>} />}
    {legacyDataAvailable && <Alert type="info" showIcon closable title="检测到本机原有工作数据" description="原数据仍保留在浏览器中，尚未导入共享数据库。请由管理员在数据库为空时导入；原 CSV 和任务书附件需在原记录中重新上传。" action={role === 'admin' ? <Button onClick={() => void importLegacyWorkspace().then(() => message.success('原有工作数据已导入数据库')).catch(error => message.error(error.message))}>导入原有数据</Button> : undefined} />}
    {migrationWarnings.length > 0 && <Alert type="warning" showIcon closable title="历史成果已保留，部分名称需要处理" description={migrationWarnings.join('；')} />}
    <main className="workspace-center session-main-content">{needBridge && !projectLanding ? <div className="session-loading">正在恢复工作上下文…</div> : <Outlet />}</main></div>
    <Drawer title="试验 AI 助手" open={assistantOpen} onClose={() => setAssistantOpen(false)} size={420} destroyOnHidden={false} className="session-assistant-drawer"><TrialAIAssistant key={`${routeId ?? 'workspace'}:${getCapabilityFromPath(location.pathname)}`} sessionId={routeId ?? undefined} embedded /></Drawer>
  </div>;
};
export default SessionShell;
