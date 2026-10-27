import { useMemo, useState } from 'react';
import { Button, Card, Input, Modal, Select, Space, Tag, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import CfgPredictionForm from './CfgPredictionForm';
import TrialConfigurationEditor from './TrialConfigurationEditor';
import { MODEL_FLOW_FIXTURES } from './modelFlowFixtures';
import { useGlobalModelStore } from './globalModelStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { cfgOperationScope } from './professionalScopeModel';
import { ProfessionalScopeContext } from './professionalScopeContext';
import { useProfessionalScope } from './professionalScopeContext';
import { flattenEquipment } from './equipmentCompositionModel';
import { useSessionRouteState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';
import { predictionArtifactInput } from './analysisResultModel';
import { getSessionPath } from './sessionModel';
import type { PredictionPreviewTask, PredictionService, PredictionTarget } from './predictionContract';

function ConfiguredPrediction({service,modelId,cfgId}:{service:PredictionService;modelId:string;cfgId:string}) {
  const {sessionId}=useParams();
  const navigate=useNavigate();
  const {physicalSource,session,dataContext,addArtifact,recordArtifactForTaskItem}=useWorkspaceBusinessSession(useSessionRouteState());
  const scope = useProfessionalScope();
  const equipment = usePhysicalObjectStore(state => state.objects);
  const cfg = useTrialConfigurationStore(state => state.configurations.find(item => item.id === cfgId));
  const primaryId = cfg?.primaryObjectId ?? cfg?.members.find(member => member.role === 'tested')?.objectId;
  const primary = flattenEquipment(equipment).find(item => item.id === primaryId)?.equipment;
  const target:PredictionTarget | undefined=primary && physicalSource.configuration && !physicalSource.missing ? {
    physicalObjectId:primary.id,physicalObjectName:primary.name,
    experimentId:physicalSource.experiment?.id ?? '',experimentName:physicalSource.experiment?.name ?? '',
    testType:physicalSource.experiment?.testType,objectParameters:primary.parameters,
    configurationParameters:physicalSource.experiment?.parameters ?? [],
  } : undefined;
  if(!target || !dataContext) return null;
  const archive=(task:PredictionPreviewTask)=>{
    if(!session.targetProjectId) return false;
    const input=predictionArtifactInput(task);
    const artifact=addArtifact(session.targetProjectId,{...input,title:`${target.physicalObjectName} · ${service==='virtualCondition'?'虚拟工况':'数字孪生'}`});
    if(!artifact) return false;
    recordArtifactForTaskItem({projectId:artifact.projectId,artifactId:artifact.id});return true;
  };
  return <CfgPredictionForm modelId={modelId} service={service} target={target} context={{...dataContext,scope:scope ?? dataContext.scope}} cfgId={cfgId}
    trialId={physicalSource.trial?.id} archive={archive} onSavedAndReturn={sessionId?()=>navigate(getSessionPath(sessionId)):undefined} />;
}

export default function PredictionWorkspace({service}:{service:PredictionService}) {
  const {sessionId}=useParams();
  const session=useSessionStore(state=>state.sessions.find(item=>item.id===sessionId));
  const configurations=useTrialConfigurationStore(state=>state.configurations);
  const objects=usePhysicalObjectStore(state=>state.objects);
  const archivedModels=useGlobalModelStore(state=>state.models);
  const [modelId,setModelId]=useState<string>();
  const [cfgId,setCfgId]=useState<string>();
  const [query,setQuery]=useState('');
  const [creating,setCreating]=useState(false);
  const [error,setError]=useState('');
  const selectedModel=MODEL_FLOW_FIXTURES.find(item=>item.id===modelId) ?? archivedModels.find(item=>item.modelId===modelId);
  const cfg=configurations.find(item=>item.id===cfgId);
  const base=session?.businessScope;
  const resolved=useMemo(()=>{
    if(!cfg) return {scope:undefined,error:cfgId?'选择失败':''};
    try {return {scope:cfgOperationScope(cfg,objects,base),error:''};}
    catch(cause) { console.error(cause);return {scope:undefined,error:'操作失败'};}
  },[cfg,cfgId,objects,base]);
  const selectCfg=(id:string)=>{
    try {
      const chosen=useTrialConfigurationStore.getState().getConfiguration(id);
      if(!chosen) throw new Error('所选 CFG 已失效');
      cfgOperationScope(chosen,objects,base);
      if(sessionId) useSessionStore.getState().linkConfiguration(sessionId,id);
      if(useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
      setCfgId(id);setError('');
    } catch(cause) { console.error(cause);setError('操作失败');}
  };
  const available=MODEL_FLOW_FIXTURES.filter(item=>item.name.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const other=archivedModels.filter(item=>item.modelName.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  return <div className="workspace-business-page model-library-workspace">
    {!selectedModel ? <>
      <Typography.Title level={4}>{service==='virtualCondition'?'虚拟工况':'数字孪生'} · 通用模型</Typography.Title>
      <Input.Search aria-label="搜索通用模型" placeholder="搜索通用模型" value={query} onChange={event=>setQuery(event.target.value)} />
      <div className="general-model-grid">
        {available.map(model=><Card key={model.id} title={model.name} extra={<Tag>通用模型</Tag>}>
          <Typography.Paragraph type="secondary">配置装备组合和模型参数，运行本次工况。</Typography.Paragraph>
          <Button type="primary" aria-label={`配置 ${model.name}`} onClick={()=>{setModelId(model.id);setCfgId(undefined);setError('');}}>配置模型</Button>
        </Card>)}
        {other.map(model=><Card key={model.modelId} title={model.modelName} extra={<Tag>{model.version}</Tag>}>
          <Typography.Paragraph type="secondary">配置本次工况参数并运行模型。</Typography.Paragraph>
          <Button type="primary" aria-label={`配置 ${model.modelName}`} onClick={()=>{setModelId(model.modelId);setCfgId(undefined);setError('');}}>配置模型</Button>
        </Card>)}
      </div>
    </> : <>
      <Button onClick={()=>{setModelId(undefined);setCfgId(undefined);}}>返回通用模型</Button>
      <Card title={`${('name' in selectedModel ? selectedModel.name : selectedModel.modelName)} · 配置`} className="model-configuration-card">
        <div className="model-cfg-field"><Typography.Text strong>试验构型 CFG</Typography.Text>
          <Space.Compact style={{width:'100%'}}><Select aria-label="模型配置 CFG" showSearch optionFilterProp="label" placeholder="选择本次使用的试验构型" value={cfgId} status={error || resolved.error ? 'error' : undefined} style={{flex:1}}
            options={configurations.map(item=>({value:item.id,label:`${item.name} · ${item.id}`}))} onChange={selectCfg} />
            <Button onClick={()=>setCreating(true)}>新建 CFG</Button></Space.Compact>
        </div>
        {resolved.scope && cfgId ? <ProfessionalScopeContext.Provider key={modelId} value={resolved.scope}>
          <ConfiguredPrediction service={service} modelId={modelId!} cfgId={cfgId} />
        </ProfessionalScopeContext.Provider> : null}
      </Card>
    </>}
    <Modal title="新建试验构型" open={creating} footer={null} onCancel={()=>setCreating(false)} destroyOnHidden width={780}>
      <TrialConfigurationEditor onCancel={()=>setCreating(false)} onSaved={()=>{setCreating(false);setError('');}} />
    </Modal>
  </div>;
}
