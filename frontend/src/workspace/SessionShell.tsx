import React, { useEffect, useRef, useState } from 'react';
import { Button, Drawer } from 'antd';
import { MenuOutlined, RobotOutlined } from '@ant-design/icons';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TrialAIAssistant from '@/components/TrialAIAssistant';
import ThemeToggle from '@/components/ThemeToggle';
import BusinessSidebar from './BusinessSidebar';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { getCapabilityFromPath, getLegacySessionPath, getSessionIdFromLocation, getSessionPath } from './sessionModel';
import type { BusinessRouteState } from '@/types/businessContext';
import './workspace.css';
import './sessionWorkspace.css';

const SessionShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const legacyCapability = location.pathname !== '/projects' && Boolean(getLegacySessionPath(location.pathname, 'placeholder'));
  const needBridge = Boolean(!taskRouteId && !location.pathname.startsWith('/sessions/') && legacyCapability);
  const projectLanding = location.pathname === '/projects';
  useEffect(() => {
    setMobileOpen(false);
    if (location.pathname === '/' || location.pathname === '/task-center' || location.pathname === '/trials/new') { useSessionStore.getState().openSession(null); return; }
    if (projectLanding) return;
    if (needBridge) {
      if (bridgedLocation.current === location.key) return;
      bridgedLocation.current = location.key;
      const explicitProjectId = incoming?.workspaceSession?.targetProjectId ?? location.pathname.match(/^\/report\/create\/([^/]+)$/)?.[1];
      const requestedScope = incoming?.workspaceSession;
      const trialScope = requestedScope?.trialId ? { physicalObjectId: requestedScope.physicalObjectId,
        experimentId: requestedScope.experimentId, cfgId: requestedScope.cfgId, trialId: requestedScope.trialId,
        testRecordId: requestedScope.testRecordId } : undefined;
      const current = sessions.find(item => item.id === bridgeId);
      if (!task && !explicitProjectId && !current) {
        navigate('/sessions/new', { replace: true });
        return;
      }
      const id = task ? useSessionStore.getState().ensureTaskSession(task)
        : explicitProjectId && !incoming?.workspaceSession?.sessionId && current?.storageProjectId !== explicitProjectId
          ? useSessionStore.getState().ensureProjectSession(explicitProjectId, trialScope)
          : current!.id;
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
  }, [location.key]);
  return <div className="workspace-shell session-shell"><BusinessSidebar mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />{mobileOpen && <button className="session-sidebar-backdrop" aria-label="关闭业务导航" onClick={() => setMobileOpen(false)} />}
    <div className="session-main"><div className="session-topbar"><Button className="session-mobile-toggle" icon={<MenuOutlined />} aria-label="打开业务导航" aria-expanded={mobileOpen} aria-controls="session-sidebar" onClick={() => setMobileOpen(!mobileOpen)} /><span>{routeId ? '专业功能' : location.pathname === '/task-center' ? '正式任务' : location.pathname === '/trials/new' ? '创建具体试验' : location.pathname === '/projects' ? '项目' : '工作台'}</span><div><ThemeToggle /><Button icon={<RobotOutlined />} onClick={() => setAssistantOpen(true)}>AI 助手</Button></div></div><main className="workspace-center session-main-content">{needBridge && !projectLanding ? <div className="session-loading">正在恢复会话…</div> : <Outlet />}</main></div>
    <Drawer title="试验 AI 助手" open={assistantOpen} onClose={() => setAssistantOpen(false)} size={420} destroyOnHidden={false} className="session-assistant-drawer"><TrialAIAssistant key={`${routeId ?? 'workspace'}:${getCapabilityFromPath(location.pathname)}`} sessionId={routeId ?? undefined} embedded /></Drawer>
  </div>;
};
export default SessionShell;
