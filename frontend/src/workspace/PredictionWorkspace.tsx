import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Modal, Select, Space, Tag, Typography } from 'antd';
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
import { useSessionRouteState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';
import { predictionArtifactInput } from './analysisResultModel';
import { getSessionPath } from './sessionModel';
import type { PredictionPreviewTask, PredictionService, PredictionTarget } from './predictionContract';

function ConfiguredPrediction({service,modelId,cfgId}:{service:PredictionService;modelId:string;cfgId:string}) {
  const {sessionId}=useParams();
  const navigate=useNavigate();
  const {physicalSource,session,dataContext,addArtifact,recordArtifactForTaskItem}=useWorkspaceBusinessSession(useSessionRouteState());
  const target:PredictionTarget | undefined=physicalSource.configuration && !physicalSource.missing ? {
    physicalObjectId:physicalSource.configuration.id,physicalObjectName:physicalSource.configuration.name,
    experimentId:physicalSource.experiment?.id ?? '',experimentName:physicalSource.experiment?.name ?? '',
    testType:physicalSource.experiment?.testType,objectParameters:physicalSource.configuration.parameters,
    configurationParameters:physicalSource.experiment?.parameters ?? [],
  } : undefined;
  if(!target || !dataContext) return <Alert type="error" title="构型装备来源不可用，请重新选择 CFG" />;
  const archive=(task:PredictionPreviewTask)=>{
    if(!session.targetProjectId) return false;
    const input=predictionArtifactInput(task);
    const artifact=addArtifact(session.targetProjectId,{...input,title:`${target.physicalObjectName} · ${service==='virtualCondition'?'虚拟工况':'数字孪生'}`});
    if(!artifact) return false;
    recordArtifactForTaskItem({projectId:artifact.projectId,artifactId:artifact.id});return true;
  };
  return <CfgPredictionForm modelId={modelId} service={service} target={target} context={dataContext} cfgId={cfgId}
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
  const selectedModel=MODEL_FLOW_FIXTURES.find(item=>item.id===modelId);
  const cfg=configurations.find(item=>item.id===cfgId);
  const base=session?.businessScope;
  const resolved=useMemo(()=>{
    if(!cfg) return {scope:undefined,error:cfgId?'所选 CFG 已失效，请重新选择':''};
    try {return {scope:cfgOperationScope(cfg,objects,base),error:''};}
    catch(cause) {return {scope:undefined,error:cause instanceof Error?cause.message:'构型来源不可用'};}
  },[cfg,cfgId,objects,base]);
  const selectCfg=(id:string)=>{
    try {
      const chosen=useTrialConfigurationStore.getState().getConfiguration(id);
      if(!chosen) throw new Error('所选 CFG 已失效');
      cfgOperationScope(chosen,objects,base);
      if(sessionId) useSessionStore.getState().linkConfiguration(sessionId,id);
      if(useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
      setCfgId(id);setError('');
    } catch(cause) {setError(cause instanceof Error?cause.message:'构型不可用');}
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
      {!available.length && !other.length && <Empty description="没有匹配的通用模型" />}
    </> : <>
      <Button onClick={()=>{setModelId(undefined);setCfgId(undefined);}}>返回通用模型</Button>
      <Card title={`${selectedModel.name} · 配置`} className="model-configuration-card">
        <div className="model-cfg-field"><Typography.Text strong>试验构型 CFG</Typography.Text>
          <Space.Compact style={{width:'100%'}}><Select aria-label="模型配置 CFG" showSearch optionFilterProp="label" placeholder="选择本次使用的试验构型" value={cfgId} style={{flex:1}}
            options={configurations.map(item=>({value:item.id,label:`${item.name} · ${item.id}`}))} onChange={selectCfg} />
            <Button onClick={()=>setCreating(true)}>新建 CFG</Button></Space.Compact>
        </div>
        {(error || resolved.error) && <Alert type="error" title={error || resolved.error} />}
        {resolved.scope && cfgId ? <ProfessionalScopeContext.Provider key={`${modelId}:${cfgId}`} value={resolved.scope}>
          <ConfiguredPrediction service={service} modelId={modelId!} cfgId={cfgId} />
        </ProfessionalScopeContext.Provider> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="选择 CFG 后填写模型配置与本次工况" />}
      </Card>
    </>}
    <Modal title="新建试验构型" open={creating} footer={null} onCancel={()=>setCreating(false)} destroyOnHidden width={780}>
      <TrialConfigurationEditor onCancel={()=>setCreating(false)} onSaved={()=>{setCreating(false);setError('');
        Modal.info({title:'CFG 已保存',content:'请在模型配置中选择本次使用的试验构型。',okText:'知道了'});
      }} />
    </Modal>
  </div>;
}
