import { useState } from 'react';
import { BarChartOutlined, DatabaseOutlined, ExperimentOutlined, FileTextOutlined, LineChartOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { getCapabilityFromPath, getSessionIdFromLocation, getSessionPath, sessionCapabilities, type SessionCapability } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { SessionCreateDialog } from './SessionCreate';

const icons = { doe: <ExperimentOutlined />, analysis: <BarChartOutlined />, digitalTwin: <DatabaseOutlined />, virtualCondition: <LineChartOutlined />, report: <FileTextOutlined /> };

export default function ProfessionalFeatureNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const sessionId = getSessionIdFromLocation(location.pathname, location.search);
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  const projects = useProjectStore(state => state.projects);
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const [requested, setRequested] = useState<SessionCapability>();
  const requestedProjectId = location.pathname === '/projects' ? new URLSearchParams(location.search).get('projectId') ?? activeProjectId : undefined;
  const projectId = projects.find(project => project.id === requestedProjectId && !project.sessionOwnerId)?.id;
  const capability = session ? getCapabilityFromPath(location.pathname) : undefined;
  return <>
    <nav className="session-capability-tabs" aria-label="专业功能">
      {sessionCapabilities.map(item => <button key={item.key} className={capability === item.key ? 'is-active' : ''}
        aria-current={capability === item.key ? 'page' : undefined} onClick={() => {
          if (!session) { setRequested(item.key); return; }
          if (capability === item.key) return;
          navigate(getSessionPath(session.id, item.key), { state: { workspaceSession: useSessionStore.getState().getWorkspaceSession(session.id) } });
        }}><span className="session-capability-tab-icon">{icons[item.key]}</span><span className="session-capability-tab-copy"><strong>{item.label}</strong></span></button>)}
    </nav>
    <SessionCreateDialog open={Boolean(requested)} projectId={projectId} purpose={projectId ? 'trial' : 'session'} initialCapability={requested}
      onCancel={() => setRequested(undefined)} onCreated={() => setRequested(undefined)} />
  </>;
}
