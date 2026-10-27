import { captureCfgEquipment } from './equipmentManagementModel';
import { createLocalId } from '../utils/createLocalId';
import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { validateTrialConfiguration } from './trialConfigurationModel';
import { MODEL_FLOW_FIXTURES } from './modelFlowFixtures';
import { modelConfigurationKey, readModelEquipmentInputs, resolveModelPlan, type ModelInputBinding, type ModelPlanRequest } from './modelPlanModel';
import { useModelSchemeStore } from './modelSchemeStore';
import { useGlobalModelStore } from './globalModelStore';
import { useSessionRouteState, useSessionState } from './useSessionState';
import { useLocation } from 'react-router-dom';
import { getCapabilityFromPath, getSessionDraftKey, getSessionIdFromLocation, readSessionDraft } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { predictionInputs, type PredictionPreviewTask, type PredictionService, type PredictionTarget, type PredictionValue } from './predictionContract';
import { predictionParameterError, predictionPreparation } from './predictionParameters';
import { runPredictionPreview, savePredictionPreview } from '../services/predictionPreview';
import type { ProfessionalDataContext } from './professionalContext';

interface Draft {
  modelId:string; configurationInputs:Record<string,PredictionValue>; inputs:Record<string,PredictionValue>;
  bindingKeys:Record<string,string>; selectedSchemeId?:string;
}

export default function CfgPredictionForm({service,target,context,cfgId,trialId,archive,onSavedAndReturn,modelId}:{
  service:PredictionService; target:PredictionTarget; context:ProfessionalDataContext; cfgId:string; trialId?:string; modelId:string;
  archive:(task:PredictionPreviewTask)=>boolean;
  onSavedAndReturn?:()=>void;
}) {
  const [form]=Form.useForm<Draft>();
  const objects=usePhysicalObjectStore(state=>state.objects);
  const cfg=useTrialConfigurationStore(state=>state.configurations.find(item=>item.id===cfgId));
  const catalogModel=useGlobalModelStore(state=>state.models.find(item=>item.modelId===modelId));
  const schemes=useModelSchemeStore(state=>state.schemes);
  const location=useLocation();
  const routeState=useSessionRouteState();
  const [draft,setDraft]=useSessionState<Draft>(`cfgModelFlowV3:${modelId}`,()=>{
    const selected=MODEL_FLOW_FIXTURES.find(item=>item.id===modelId);
    const initial:Draft={modelId,configurationInputs:Object.fromEntries((selected?.configurationFields ?? []).flatMap(field=>field.defaultValue!==undefined?[[field.key,field.defaultValue]]:[])),inputs:{},bindingKeys:{}};
    // Preserve pre-picker drafts for their original CFG; each CFG then keeps
    // separate manual inputs without changing or deleting the legacy draft.
    if(context.scope.cfgId!==cfgId) return initial;
    const session=useSessionStore.getState().sessions.find(item=>item.id===getSessionIdFromLocation(location.pathname,location.search));
    const legacy=readSessionDraft(session,getCapabilityFromPath(location.pathname),getSessionDraftKey(`cfgModelFlowV2:${cfgId}`,routeState?.workspaceSession),readSessionDraft(session,getCapabilityFromPath(location.pathname),getSessionDraftKey('cfgModelFlowV1',routeState?.workspaceSession),initial));
    return legacy.modelId===modelId?legacy:initial;
  });
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  const [result,setResult]=useState<PredictionPreviewTask>();
  useEffect(() => {setResult(undefined);setSaved(false);setError('');}, [cfgId]);
  const controller=useRef<AbortController | null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  const equipment=flattenEquipment(objects);
  const model=MODEL_FLOW_FIXTURES.find(item=>item.id===modelId) ?? (catalogModel ? {
    id:catalogModel.modelId,name:catalogModel.modelName,version:catalogModel.version,resultMode:'demo' as const,
    configurationFields:[],equipmentInputs:[],
  } : undefined);
  // Runtime values are manual inputs. Similar parameter names never bind equipment implicitly.
  const preparation=predictionPreparation(service,{...context,objectParameters:[],configurationParameters:[],records:[]});
  const inputs=predictionInputs(preparation,draft.inputs);
  const allowedIds=cfg?.members.map(member=>member.objectId) ?? [];
  const choices=equipment.filter(item=>allowedIds.includes(item.id)).flatMap(item=>item.equipment.parameters.map(parameter=>({
    value:JSON.stringify([item.id,parameter.id,parameter.unit ?? '']),
    label:`${item.path} / ${parameter.name}（${parameter.unit || '无单位'}） · ${parameter.id}`,
  })));
  const cfgErrors=cfg?validateTrialConfiguration(cfg,new Set(equipment.map(item=>item.id))):[""];
  if(!allowedIds.includes(target.physicalObjectId)) cfgErrors.push('当前试验的被试对象不属于此 CFG');
  const bindings:ModelInputBinding[]=[];
  let equipmentInputs:Record<string,PredictionValue>={};
  let bindingError='';
  try {
    for(const definition of model?.equipmentInputs ?? []) {
      const value=draft.bindingKeys[definition.key];
      if(!value) continue;
      const source:unknown=JSON.parse(value);
      if(!Array.isArray(source)||source.length!==3||!source.every(item=>typeof item==='string')) throw new Error('参数来源格式已失效，请重新选择');
      bindings.push({key:definition.key,objectId:source[0],parameterId:source[1],unit:source[2]});
    }
    equipmentInputs=readModelEquipmentInputs(model?.equipmentInputs ?? [],bindings,objects,allowedIds);
  } catch(cause) { console.error(cause);bindingError='操作失败';}
  const configurationInputs={...draft.configurationInputs,$modelVersion:model?.version ?? '',...Object.fromEntries(Object.entries(equipmentInputs).map(([key,value])=>[`equipment:${key}`,value]))};
  const request:ModelPlanRequest={modelId:model?.id ?? '',cfgId,objectIds:[...new Set([target.physicalObjectId,...bindings.map(item=>item.objectId)])],configKey:modelConfigurationKey(configurationInputs,bindings)};
  const plan=model&&!cfgErrors.length&&!bindingError?resolveModelPlan(request,schemes):undefined;

  const run=async(value:Draft)=>{
    if(busy) return;
    setError('');setSaved(false);setResult(undefined);
    try {
      if(cfgErrors.length||bindingError||!model) throw new Error([...cfgErrors,bindingError,!model?'请选择通用模型':''].filter(Boolean).join('；'));
      const invalid=predictionParameterError(inputs);
      if(invalid) throw new Error(invalid);
      const equipmentInputs=readModelEquipmentInputs(model.equipmentInputs,bindings,objects,allowedIds);
      const scheme=useModelSchemeStore.getState().confirmScheme(request,{
        name:`${target.physicalObjectName} · ${model.name}（演示）`,configurationInputs,bindings,
      },plan?.action==='ambiguous'?value.selectedSchemeId:undefined);
      setBusy(true);
      const active=new AbortController();controller.current=active;
      const task=await runPredictionPreview({requestId:createLocalId(),service,targetConfiguration:structuredClone(target),context:structuredClone({...context,scope:{...context.scope,cfgId}}),inputs,
        modelPlan:{...request,equipmentSnapshot:captureCfgEquipment(objects,cfg!.members),schemeId:scheme.id,trialId,configurationInputs:structuredClone(configurationInputs),bindings:structuredClone(bindings),equipmentInputs,runtimeInputs:structuredClone(inputs)},
      },active.signal);
      if(!active.signal.aborted) setResult(task);
    } catch(cause) { console.error(cause);if(!controller.current?.signal.aborted) setError('本次演示未完成');}
    finally {if(!controller.current?.signal.aborted) setBusy(false);}
  };
  const save=async(shouldReturn=false)=>{
    if(!result||busy) return;
    if(saved) {if(shouldReturn) onSavedAndReturn?.();return;}
    setBusy(true);setError('');
    const active=new AbortController();controller.current=active;
    try {
      const task=await savePredictionPreview(result,active.signal);
      if(active.signal.aborted) return;
      if(!archive(task)) throw new Error('本次成果未保存，请重试');
      setResult(task);setSaved(true);
      if(shouldReturn) onSavedAndReturn?.();
    } catch(cause) { console.error(cause);if(!active.signal.aborted) setError('操作失败');}
    finally {if(!active.signal.aborted) setBusy(false);}
  };
  if(cfgErrors.length) return null;
  return <div className="workspace-business-page cfg-prediction-flow">
    {error&&<Alert type="error" showIcon title={error} />}
    <div>

      <Form name="cfg-prediction" form={form} layout="vertical" initialValues={{...draft,inputs}} onFinish={run}
        onValuesChange={(_,values)=>{setDraft(values);setResult(undefined);setSaved(false);setError('');}}>

        <Typography.Title level={5}>模型配置</Typography.Title>
        {model?.configurationFields.map(field=><Form.Item key={field.key} name={['configurationInputs',field.key]} label={field.label} rules={[{required:field.required,whitespace:true,message:""}]}><Input aria-label={field.label} /></Form.Item>)}
        {model?.equipmentInputs.map(field=><Form.Item key={field.key} name={['bindingKeys',field.key]} label={`${field.label}来源 / ${field.unit}`} required={field.required}>
          <Select allowClear showSearch optionFilterProp="label" aria-label={`${field.label}来源`} options={choices} />
        </Form.Item>)}
        {bindingError&&<Alert type="error" title={bindingError} />}
        {plan?.action==='ambiguous'&&<Form.Item name="selectedSchemeId" label="选择匹配方案" rules={[{required:true,message:''}]}>
          <Select options={schemes.filter(item=>plan.candidateIds.includes(item.id)).map(item=>({value:item.id,label:`${item.name ?? item.id} · ${item.id}`}))} />
        </Form.Item>}
        <Typography.Title level={5}>本次运行参数</Typography.Title>
        {preparation.inputFields.map(field=><Form.Item key={field.key} name={['inputs',field.key]} label={`${field.label}${field.unit?` / ${field.unit}`:''}`}
          rules={[{required:field.required,type:'number',min:field.min,max:field.max,message:''}]}>
          <InputNumber aria-label={`${field.label}${field.unit?` / ${field.unit}`:''}`} style={{width:'100%'}} min={field.min} max={field.max} />
        </Form.Item>)}
        <Button type="primary" htmlType="submit" loading={busy} disabled={Boolean(bindingError)}>运行模型</Button>
      </Form>
    </div>
    {result&&<Card size="small" title="运行结果" className="cfg-model-result">
      <Space wrap><Tag>CFG：{result.modelPlan!.cfgId}</Tag><Tag>MODEL：{result.modelPlan!.modelId}</Tag><Tag>方案：{result.modelPlan!.schemeId}</Tag><Tag>{saved?'已保存到共享成果':'待保存'}</Tag></Space>
      <Typography.Paragraph>{result.result.summary}</Typography.Paragraph>
      <Table size="small" rowKey={(_,index)=>String(index)} dataSource={result.result.rows} columns={result.result.columns.map(column=>({title:`${column.label}${column.unit?` / ${column.unit}`:''}`,dataIndex:column.key}))} pagination={{pageSize:10}} scroll={{x:true}} />
      <Space wrap><Button onClick={()=>save()} loading={busy} disabled={saved}>保存成果</Button>
        {onSavedAndReturn && <Button type="primary" onClick={()=>save(true)} loading={busy}>{saved?'返回工作台':'保存并返回工作台'}</Button>}
      </Space>
    </Card>}
  </div>;
}
