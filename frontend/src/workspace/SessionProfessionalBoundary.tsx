import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Alert } from 'antd';
import { useParams } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { useSessionStore } from './sessionStore';
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
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const [cfgId,setCfgId] = useState<string|undefined>(()=>{
    if (!session) return undefined;
    if (session.businessScope?.trialId || session.businessScope?.testRecordId) return session.businessScope.cfgId;
    return session.cfgIds?.at(-1) ?? session.businessScope?.cfgId;
  });
  const [selectionError,setSelectionError] = useState('');
  const base = session?.businessScope;
  const cfg = configurations.find(item=>item.id===cfgId);
  const resolved = useMemo(()=>{
    if(!cfg) return {scope:undefined,error:cfgId?'所选 CFG 已失效，请重新选择':''};
    try {return {scope:cfgOperationScope(cfg,objects,base),error:''};}
    catch(cause) {return {scope:undefined,error:cause instanceof Error?cause.message:'构型来源不可用'};}
  },[cfg,cfgId,objects,base]);
  const source = resolved.scope ? resolvePhysicalSource(objects,resolved.scope) : undefined;
  const selectCfg=useCallback((id:string)=>{
    if (!id) { setCfgId(undefined); setSelectionError(''); return; }
    try {
      const selected=useTrialConfigurationStore.getState().getConfiguration(id);
      if(!selected) throw new Error('所选 CFG 已失效');
      cfgOperationScope(selected,usePhysicalObjectStore.getState().objects,base);
      if(sessionId) useSessionStore.getState().linkConfiguration(sessionId,id);
      if(useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
      setCfgId(id);setSelectionError('');
    } catch(cause) {setSelectionError(cause instanceof Error?cause.message:'CFG 不可用');}
  },[sessionId,base]);
  const selectionValue=useMemo(()=>({cfgId,error:selectionError || resolved.error,selectCfg}),[cfgId,selectionError,resolved.error,selectCfg]);
  return <>
    {(selectionError || resolved.error) && <Alert type="error" showIcon title={selectionError || resolved.error} />}
    <ProfessionalCfgSelectionContext.Provider value={selectionValue}>
      <ProfessionalScopeContext.Provider value={resolved.scope}>
        {resolved.scope && source?.trial && sessionId && capability!=='analysis'
          ? <TrialWorksheetProvider trial={source.trial} sessionId={sessionId} capability={capability} initialRecordId={source.record?.id}>{children}</TrialWorksheetProvider>
          : children}
      </ProfessionalScopeContext.Provider>
    </ProfessionalCfgSelectionContext.Provider>
  </>;
}
