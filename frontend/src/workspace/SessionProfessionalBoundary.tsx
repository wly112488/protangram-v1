import { useMemo, useState, type ReactNode } from 'react';
import { Alert, Button, Empty, Space, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import FeatureCfgPicker from './FeatureCfgPicker';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { useSessionStore } from './sessionStore';
import { cfgOperationScope } from './professionalScopeModel';
import { ProfessionalScopeContext } from './professionalScopeContext';
import { resolvePhysicalSource } from './physicalBusinessContext';
import TrialWorksheetProvider from './TrialWorksheetProvider';
import type { SessionCapability } from './sessionModel';

export default function SessionProfessionalBoundary({children,capability}:{children:ReactNode;capability:SessionCapability}) {
  const {sessionId} = useParams();
  const session = useSessionStore(state=>state.sessions.find(item=>item.id===sessionId));
  const objects = usePhysicalObjectStore(state=>state.objects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const [cfgId,setCfgId] = useState<string>();
  const [picking,setPicking] = useState(true);
  const cfg = configurations.find(item=>item.id===cfgId);
  const base = session?.businessScope;
  const resolved = useMemo(()=>{
    if(!cfg) return {error:cfgId?'所选 CFG 已失效，请重新选择':''};
    try {return {scope:cfgOperationScope(cfg,objects,base),error:''};}
    catch(cause) {return {error:cause instanceof Error?cause.message:'构型来源不可用'};}
  },[cfg,cfgId,objects,base]);
  const source = resolved.scope ? resolvePhysicalSource(objects,resolved.scope) : undefined;
  return <>
    {picking && <FeatureCfgPicker suggestedCfgId={cfgId ?? session?.cfgIds?.at(-1) ?? base?.cfgId}
      onCancel={()=>setPicking(false)} onConfirm={id=>{
        const selected=useTrialConfigurationStore.getState().getConfiguration(id);
        if(!selected) throw new Error('所选 CFG 已失效');
        cfgOperationScope(selected,usePhysicalObjectStore.getState().objects,base);
        if(sessionId) useSessionStore.getState().linkConfiguration(sessionId,id);
        if(useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
        setCfgId(id);setPicking(false);
      }} />}
    {!picking && <Space className="professional-cfg-summary" wrap><Typography.Text strong>{cfg?.name}</Typography.Text><Button onClick={()=>setPicking(true)}>{cfgId?'更换本次 CFG':'选择 CFG'}</Button></Space>}
    {!picking && !cfgId && <Empty description="选择 CFG 后开始使用专业功能" />}
    {resolved.error && <Alert type="error" title={resolved.error} />}
    {resolved.scope && sessionId && <div hidden={picking}>
      <ProfessionalScopeContext.Provider value={resolved.scope} key={cfgId}>
        {source?.trial && capability!=='analysis'
          ? <TrialWorksheetProvider trial={source.trial} sessionId={sessionId} capability={capability} initialRecordId={source.record?.id}>{children}</TrialWorksheetProvider>
          : children}
      </ProfessionalScopeContext.Provider>
    </div>}
  </>;
}
