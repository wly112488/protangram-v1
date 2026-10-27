import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'antd';
import { Link, useParams } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { useProjectStore } from './projectStore';
import { cfgOperationScope } from './professionalScopeModel';
import { ProfessionalCfgSelectionContext, ProfessionalScopeContext } from './professionalScopeContext';
import { resolvePhysicalSource } from './physicalBusinessContext';
import TrialWorksheetProvider from './TrialWorksheetProvider';
import type { SessionCapability } from './sessionModel';

/** Supplies an in-workflow CFG selection; it does not gate or replace the feature page. */
export default function SessionProfessionalBoundary({children,capability}:{children:ReactNode;capability:SessionCapability}) {
  const {sessionId} = useParams();
  const session = useSessionStore(state=>state.sessions.find(item=>item.id===sessionId));
  const objects = usePhysicalObjectStore(state=>state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const projects = useProjectStore(state => state.projects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const [cfgId,setCfgId] = useState<string>();
  const [selectionError,setSelectionError] = useState('');
  const base = session?.businessScope;
  const cfg = configurations.find(item=>item.id===cfgId);
  const resolved = useMemo(()=>{
    if(!cfg) return {scope:undefined,error:cfgId?'选择失败':''};
    try {return {scope:cfgOperationScope(cfg,objects,base),error:''};}
    catch(cause) { console.error(cause);return {scope:undefined,error:'操作失败'};}
  },[cfg,cfgId,objects,base]);
  const source = base ? resolvePhysicalSource(objects,base) : undefined;
  const selectCfg=useCallback((id:string)=>{
    if (!id) { setCfgId(undefined); setSelectionError(''); return; }
    try {
      const selected=useTrialConfigurationStore.getState().getConfiguration(id);
      if(!selected) throw new Error('所选 CFG 已失效');
      cfgOperationScope(selected,usePhysicalObjectStore.getState().objects,base);
      if(sessionId) useSessionStore.getState().linkConfiguration(sessionId,id);
      if(useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
      setCfgId(id);setSelectionError('');
    } catch(cause) { console.error(cause);setSelectionError('操作失败');}
  },[sessionId,base]);
  const selectionValue=useMemo(()=>({cfgId,error:selectionError || resolved.error,selectCfg}),[cfgId,selectionError,resolved.error,selectCfg]);
  const taskBookId = source?.trial?.taskBookId;
  const task = tasks.find(item => item.id === taskBookId);
  if (taskBookId && !projects.some(item => item.id === task?.projectId && !item.sessionOwnerId)) return <Link to="/projects?view=analysis">进入项目</Link>;
  return <>
    {(selectionError || resolved.error) && <Alert type="error" showIcon title={selectionError || resolved.error} />}
    <ProfessionalCfgSelectionContext.Provider value={selectionValue}>
      <ProfessionalScopeContext.Provider value={resolved.scope}>
        {sessionId && capability!=='analysis'
          ? <TrialWorksheetProvider trial={source?.trial} sessionId={sessionId} capability={capability} initialRecordId={source?.record?.id}>{children}</TrialWorksheetProvider>
          : children}
      </ProfessionalScopeContext.Provider>
    </ProfessionalCfgSelectionContext.Provider>
  </>;
}
