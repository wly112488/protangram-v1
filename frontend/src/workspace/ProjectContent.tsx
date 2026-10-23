import { Alert, Button, Select, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { collectSharedResources, sessionResourcesPath } from './sharedResourcesModel';
import AnalysisResults from './AnalysisResults';
import { collectSessionResourceGroups } from './sessionResourceModel';
import { useTrialConfigurationStore } from './trialConfigurationStore';

// One shared catalog for project, trial and legacy session links. No second result store.
export default function ProjectContent({sessionViewId}:{sessionViewId?:string} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();
  const [params, setParams] = useSearchParams();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const configurations = useTrialConfigurationStore(state => state.configurations);
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const legacySession = sessions.find(item => item.id === routeSessionId);
  const sessionId = sessionViewId ?? params.get('sessionId') ?? undefined;
  const projectId = params.get('projectId') ?? (location.pathname === '/projects' ? activeProjectId ?? undefined : undefined);
  const trialId = params.get('trialId') ?? undefined;
  const cfgId = params.get('cfgId') ?? undefined;
  const resourceGroups = sessionId ? collectSessionResourceGroups(projects,sessions,objects,configurations,sessionId)
    : cfgId ? collectSessionResourceGroups(projects,[{id:'cfg-view',storageProjectId:'',cfgIds:[cfgId]} as typeof sessions[number]],objects,configurations,'cfg-view').filter(group=>group.id===cfgId) : undefined;
  const scope = collectSharedResources(projects, sessions, objects, { projectId, sessionId, trialId });
  const routeState = location.state as { returnTo?: string; returnState?: unknown; artifactId?: string } | null;
  const returnTo = routeState?.returnTo;
  if (routeSessionId && !sessionViewId) {
    return legacySession ? <Navigate to={sessionResourcesPath(legacySession, projects)} replace state={location.state} />
      : <Alert type="error" showIcon message="原会话不存在，未切换到其他项目成果。" />;
  }
  return <div className="workspace-content-stack">
    <div className="workspace-content-heading">
      <Typography.Title level={3}>共享数据与成果</Typography.Title>
      {returnTo?.startsWith('/') && !returnTo.startsWith('//') && <Button aria-label="返回原工作界面" icon={<ArrowLeftOutlined />} onClick={() => navigate(returnTo, { state: routeState?.returnState })}>返回原工作界面</Button>}
    </div>
    {!sessionId && !cfgId && <Space wrap><Typography.Text>具体试验</Typography.Text><Select aria-label="筛选具体试验" style={{ minWidth: 260 }} value={trialId ?? 'all'} options={[{ value: 'all', label: '本项目全部试验及历史成果' }, ...scope.related.map(entry => ({ value: entry.trial.id, label: `${entry.trial.name} · ${entry.object.name} / ${entry.experiment.name}` }))]} onChange={value => { const next = new URLSearchParams(params); if (value === 'all') next.delete('trialId'); else next.set('trialId', value); setParams(next, { state: location.state }); }} /></Space>}
    {(resourceGroups ? !resourceGroups.length : scope.missing) ? <Alert type="warning" showIcon message="当前项目、会话或试验来源不可用" description="未切换到其他试验，也未删除已有成果。可返回项目重新选择查看范围。" />
      : <AnalysisResults key={`${projectId ?? sessionId}:${trialId ?? 'all'}`} entries={resourceGroups?.flatMap(group=>group.entries) ?? scope.entries} trials={scope.trials} groups={resourceGroups} shared hideTitle initialArtifactId={routeState?.artifactId} />}
  </div>;
}
