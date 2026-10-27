import { Button, Collapse, Select, Space, Typography } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { collectSharedResources } from './sharedResourcesModel';
import AnalysisResults from './AnalysisResults';
import { collectSessionResourceGroups, collectWorkspaceResourceGroups, collectTrialResourceGroups, type SessionResourceGroup } from './sessionResourceModel';
import { resolveArtifactTrialScope } from './artifactTrialContext';
import { useTrialConfigurationStore } from './trialConfigurationStore';

// One shared catalog for project, trial and legacy session links. No second result store.
export default function ProjectContent({sessionViewId,trialViewId,embedded=false}:{sessionViewId?:string;trialViewId?:string;embedded?:boolean} = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: routeSessionId } = useParams();
  const [params, setParams] = useSearchParams();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const configurations = useTrialConfigurationStore(state => state.configurations);
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const sessionId = sessionViewId ?? routeSessionId ?? params.get('sessionId') ?? undefined;
  const projectId = sessionId ? undefined : params.get('projectId') ?? (location.pathname === '/projects' ? activeProjectId ?? undefined : undefined);
  const trialId = sessionId ? undefined : trialViewId ?? params.get('trialId') ?? undefined;
  const cfgId = params.get('cfgId') ?? undefined;
  const boundSession=sessions.find(item=>item.id===sessionId);
  const scopedTrial=boundSession?.businessScope?.trialId ?? trialId;
  const resourceGroups = sessionId ? collectWorkspaceResourceGroups(projects,sessions,objects,configurations,sessionId)
    : scopedTrial ? collectTrialResourceGroups(projects,sessions,objects,configurations,{trialId:scopedTrial,projectId})
    : cfgId && !projectId ? collectSessionResourceGroups(projects,[{id:'cfg-view',storageProjectId:'',cfgIds:[cfgId]} as typeof sessions[number]],objects,configurations,'cfg-view').filter(group=>group.id===cfgId) : undefined;
  const scope = collectSharedResources(projects, sessions, objects, { projectId, sessionId, trialId });
  const filterCfgId = projectId || sessionId ? params.get('cfgId') ?? undefined : undefined;
  const filterSessionId = params.get('sourceSessionId') ?? undefined;
  const executionId = params.get('executionId') ?? undefined;
  const hasFilter = Boolean(filterCfgId || filterSessionId || executionId);
  const mergedGroups = new Map<string,SessionResourceGroup>();
  for (const group of resourceGroups ?? scope.related.flatMap(entry => collectTrialResourceGroups(projects,sessions,objects,configurations,{projectId,trialId:entry.trial.id}))) {
    const previous = mergedGroups.get(group.id);
    mergedGroups.set(group.id, previous ? {...group,
      entries:[...new Map([...previous.entries,...group.entries].map(entry => [entry.key,entry])).values()],
      trials:[...new Map([...previous.trials,...group.trials].map(trial => [trial.id,trial])).values()],
      files:[...new Map([...previous.files,...group.files].map(file => [file.id,file])).values()],
    } : group);
  }
  const catalogKeys = new Set([...mergedGroups.values()].flatMap(group => group.entries.map(entry => entry.key)));
  const loose = sessionId ? [] : scope.entries.filter(entry => !catalogKeys.has(entry.key));
  if (loose.length) {
    const generic = mergedGroups.get('generic');
    mergedGroups.set('generic',{id:'generic',name:'通用',trials:[],files:[],...generic,entries:[...(generic?.entries ?? []),...loose]});
  }
  const allGroups = [...mergedGroups.values()];
  const executions = [...new Map(allGroups.flatMap(group => group.entries.flatMap(entry => {
    const execution = entry.artifact?.payload.execution as {id?:string;completedAt?:string} | undefined;
    return execution?.id ? [[execution.id,{value:execution.id,label:`运行 · ${entry.artifact!.title} · ${execution.completedAt ? new Date(execution.completedAt).toLocaleString('zh-CN') : execution.id} · ${execution.id.slice(-8)}`} ] as const] : [];
  }))).values()];
  const recordOptions = scope.trials.flatMap(trial => trial.records.map(record => ({value:record.id,label:`${trial.name} · 第 ${record.executionNumber} 次 · ${record.name}`})));
  const selectedSession = sessions.find(item => item.id === filterSessionId);
  const matchesEntry = (entry: (typeof scope.entries)[number]) => {
    if (filterSessionId && !(entry.artifact ? entry.artifact.payload.sourceSessionId === filterSessionId
      || selectedSession?.resourceRefs?.some(ref => ref.artifactId === entry.artifact!.id && ref.projectId === entry.artifact!.projectId)
      || projects.find(project => project.id === entry.artifact!.projectId)?.sessionOwnerId === filterSessionId
      : selectedSession?.businessScope?.trialId === (entry.trialId ?? entry.resolvedScope?.trialId ?? scope.related.find(item => item.trial.records.some(record => record.id === entry.record?.id))?.trial.id))) return false;
    if (!executionId) return true;
    const execution = entry.artifact?.payload.execution as {id?:string} | undefined;
    const source = entry.artifact?.payload.sourceScope as {testRecordId?:string} | undefined;
    return execution?.id === executionId || source?.testRecordId === executionId || entry.record?.id === executionId;
  };
  const filteredGroups = allGroups.filter(group => !filterCfgId || group.id === filterCfgId).map(group => ({...group,
    entries:group.entries.filter(matchesEntry),
    trials:executions.some(item => item.value === executionId) ? [] : group.trials.filter(trial => !filterSessionId || selectedSession?.businessScope?.trialId === trial.id),
    files:hasFilter ? [] : group.files,
  }));
  const setFilter = (key:string,value?:string) => {const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);setParams(next,{state:location.state});};
  const routeState = location.state as { returnTo?: string; returnState?: unknown; artifactId?: string } | null;
  const returnTo = routeState?.returnTo;
  return <div className="workspace-content-stack">
    {!embedded && <div className="workspace-content-heading">
      <Typography.Title level={3}>共享数据与成果</Typography.Title>
      {returnTo?.startsWith('/') && !returnTo.startsWith('//') && <Button aria-label="返回原工作界面" icon={<ArrowLeftOutlined />} onClick={() => navigate(returnTo, { state: routeState?.returnState })}>返回原工作界面</Button>}
    </div>}
    {!trialViewId && !sessionId && <Space wrap><Typography.Text>具体试验</Typography.Text><Select aria-label="筛选具体试验" style={{ minWidth: 260 }} value={trialId ?? 'all'} options={[{ value: 'all', label: '本项目全部试验及历史成果' }, ...scope.related.map(entry => ({ value: entry.trial.id, label: `${entry.trial.name} · ${entry.object.name} / ${entry.experiment.name}` }))]} onChange={value => { const next = new URLSearchParams(params); if (value === 'all') next.delete('trialId'); else next.set('trialId', value); setParams(next, { state: location.state }); }} /></Space>}
    {!embedded && (sessionId ? Boolean(boundSession) : Boolean(projectId && !scope.missing)) && <Space wrap style={{marginBottom:16}}>
      {projectId && <Select aria-label="按会话检索成果" allowClear placeholder="全部会话" style={{minWidth:200}} value={filterSessionId} options={sessions.filter(item => item.projectId===projectId || item.storageProjectId===projectId).map(item => ({value:item.id,label:item.title}))} onChange={value => setFilter('sourceSessionId',value)} />}
      <Select aria-label="按 CFG 检索成果" allowClear placeholder="全部 CFG" style={{minWidth:200}} value={filterCfgId} options={allGroups.filter(group => group.id!=='generic').map(group => ({value:group.id,label:group.name}))} onChange={value => setFilter('cfgId',value)} />
      <Select aria-label="按执行记录检索成果" allowClear showSearch optionFilterProp="label" placeholder="全部执行记录与运行" style={{minWidth:260}} value={executionId} options={[...recordOptions,...executions]} onChange={value => setFilter('executionId',value)} />
    </Space>}
    {hasFilter ? <AnalysisResults entries={[]} groups={filteredGroups} recordId={recordOptions.some(item => item.value===executionId)?executionId:undefined} shared hideTitle /> : !sessionId && !cfgId && !trialId && !scope.missing ? <Collapse className="project-trial-resource-catalog" defaultActiveKey={scope.related[0]?[scope.related[0].trial.id]:[]} items={[
      ...scope.related.map(entry=>({key:entry.trial.id,label:entry.trial.name,children:<AnalysisResults entries={[]} groups={collectTrialResourceGroups(projects,sessions,objects,configurations,{projectId,trialId:entry.trial.id})} shared hideTitle />})),
      ...((()=>{const entries=scope.entries.filter(entry=>!entry.trialId && !(entry.artifact && resolveArtifactTrialScope(entry.artifact,sessions,objects,configurations)));return entries.length?[{key:'project-data',label:'项目资料',children:<AnalysisResults entries={entries} shared hideTitle />}]:[];})()),
    ]} /> : (resourceGroups ? !resourceGroups.length : scope.missing) ? null
      : <AnalysisResults key={`${projectId ?? sessionId}:${trialId ?? 'all'}`} entries={resourceGroups?.flatMap(group=>group.entries) ?? scope.entries} trials={scope.trials} groups={resourceGroups} rootLabel={sessionId ? boundSession?.title : scopedTrial ? scope.related.find(entry=>entry.trial.id===scopedTrial)?.trial.name : undefined} shared hideTitle={!embedded} initialArtifactId={routeState?.artifactId} />}
  </div>;
}
