import { useState } from 'react';
import { Alert, Button, Card, Form, Input, InputNumber, Select, Space, Table, Tag, Typography } from 'antd';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { validateTrialConfiguration } from './trialConfigurationModel';
import { MODEL_FLOW_FIXTURES } from './modelFlowFixtures';
import { modelConfigurationKey, readModelEquipmentInputs, resolveModelPlan, type ModelInputBinding, type ModelPlanRequest } from './modelPlanModel';
import { useModelSchemeStore } from './modelSchemeStore';
import { useSessionState } from './useSessionState';
import { predictionInputs, type PredictionPreviewTask, type PredictionService, type PredictionTarget, type PredictionValue } from './predictionContract';
import { predictionParameterError, predictionPreparation } from './predictionParameters';
import { runPredictionPreview, savePredictionPreview } from '../services/predictionPreview';
import type { ProfessionalDataContext } from './professionalContext';

interface Draft {
  modelId:string; configurationInputs:Record<string,PredictionValue>; inputs:Record<string,PredictionValue>;
  bindingKeys:Record<string,string>; selectedSchemeId?:string;
}

export default function CfgPredictionForm({service,target,context,cfgId,trialId,archive}:{
  service:PredictionService; target:PredictionTarget; context:ProfessionalDataContext; cfgId:string; trialId:string;
  archive:(task:PredictionPreviewTask)=>boolean;
}) {
  const [form]=Form.useForm<Draft>();
  const objects=usePhysicalObjectStore(state=>state.objects);
  const cfg=useTrialConfigurationStore(state=>state.configurations.find(item=>item.id===cfgId));
  const schemes=useModelSchemeStore(state=>state.schemes);
  const [draft,setDraft]=useSessionState<Draft>('cfgModelFlowV1',{
    modelId:MODEL_FLOW_FIXTURES[0].id,configurationInputs:{mesh:'演示标准网格'},inputs:{},bindingKeys:{},
  });
  const [error,setError]=useState(''),[busy,setBusy]=useState(false),[saved,setSaved]=useState(false);
  const [result,setResult]=useState<PredictionPreviewTask>();
  const equipment=flattenEquipment(objects);
  const model=MODEL_FLOW_FIXTURES.find(item=>item.id===draft.modelId);
  // Runtime values are manual inputs. Similar parameter names never bind equipment implicitly.
  const preparation=predictionPreparation(service,{...context,objectParameters:[],configurationParameters:[],records:[]});
  const inputs=predictionInputs(preparation,draft.inputs);
  const allowedIds=cfg?.members.map(member=>member.objectId) ?? [];
  const choices=equipment.filter(item=>allowedIds.includes(item.id)).flatMap(item=>item.equipment.parameters.map(parameter=>({
    value:JSON.stringify([item.id,parameter.id,parameter.unit ?? '']),
    label:`${item.path} / ${parameter.name}（${parameter.unit || '无单位'}） · ${parameter.id}`,
  })));
  const cfgErrors=cfg?validateTrialConfiguration(cfg,new Set(equipment.map(item=>item.id))):['当前 CFG 来源已失效'];
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
  } catch(cause) {bindingError=cause instanceof Error?cause.message:'参数来源已失效';}
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
        name:`${target.physicalObjectName} · 气动模型（演示）`,configurationInputs,bindings,
      },plan?.action==='ambiguous'?value.selectedSchemeId:undefined);
      setBusy(true);
      const task=await runPredictionPreview({requestId:crypto.randomUUID(),service,targetConfiguration:structuredClone(target),context:structuredClone(context),inputs,
        modelPlan:{...request,schemeId:scheme.id,trialId,configurationInputs:structuredClone(configurationInputs),bindings:structuredClone(bindings),equipmentInputs,runtimeInputs:structuredClone(inputs)},
      },new AbortController().signal);
      setResult(task);
    } catch(cause) {setError(cause instanceof Error?cause.message:'本次演示未完成');}
    finally {setBusy(false);}
  };
  const save=async()=>{
    if(!result||busy||saved) return;
    setBusy(true);setError('');
    try {
      const task=await savePredictionPreview(result,new AbortController().signal);
      if(!archive(task)) throw new Error('本次成果未保存，请重试');
      setResult(task);setSaved(true);
    } catch(cause) {setError(cause instanceof Error?cause.message:'本次成果未保存');}
    finally {setBusy(false);}
  };
  if(cfgErrors.length) return <Alert type="error" showIcon title="CFG 来源已失效，不能规划或运行模型" description={cfgErrors.join('；')} />;
  return <div className="workspace-business-page cfg-prediction-flow">
    <Alert type="info" showIcon title="前端演示流程" description="用于确认模型配置与运行输入的使用流程，未执行真实 CFD 或其他后端模型算法。" />
    {error&&<Alert type="error" showIcon title={error} />}
    <Card size="small" title={service==='digitalTwin'?'数字孪生：模型与本次输入':'虚拟工况：模型与本次输入'}>
      <Typography.Paragraph>CFG：{cfg!.name} · {cfgId}</Typography.Paragraph>
      <Form name="cfg-prediction" form={form} layout="vertical" initialValues={{...draft,inputs}} onFinish={run}
        onValuesChange={(_,values)=>{setDraft(values);setResult(undefined);setSaved(false);setError('');}}>
        <Form.Item name="modelId" label="通用模型 MODEL" rules={[{required:true}]}><Select aria-label="通用模型 MODEL" options={MODEL_FLOW_FIXTURES.map(item=>({value:item.id,label:item.name}))} /></Form.Item>
        <Typography.Paragraph type="secondary">仿真对象：{target.physicalObjectName}（{target.physicalObjectId}）。参数来源按模型字段明确选择；不会默认读取整个 CFG 的装备参数。</Typography.Paragraph>
        <Typography.Title level={5}>模型配置</Typography.Title>
        {model?.configurationFields.map(field=><Form.Item key={field.key} name={['configurationInputs',field.key]} label={field.label} rules={[{required:field.required,whitespace:true,message:`请填写${field.label}`}]}><Input /></Form.Item>)}
        {model?.equipmentInputs.map(field=><Form.Item key={field.key} name={['bindingKeys',field.key]} label={`${field.label}来源 / ${field.unit}（${field.required?'必填':'可选'}）`}>
          <Select allowClear showSearch optionFilterProp="label" aria-label={`${field.label}来源`} placeholder="按对象和参数 ID 明确选择，不按名称猜测" options={choices} />
        </Form.Item>)}
        {bindingError&&<Alert type="error" title={bindingError} />}
        {plan&&<Alert type="info" title={plan.action==='reuse'?'复用已保存模型方案':plan.action==='ambiguous'?'存在多个匹配方案，请明确选择':'将规划新的模型方案'} description={plan.schemeId?`方案 ID：${plan.schemeId}`:'模型配置相同可复用；修改运行转速不会新建方案。'} />}
        {plan?.action==='ambiguous'&&<Form.Item name="selectedSchemeId" label="选择匹配方案" rules={[{required:true,message:'存在多个候选，请明确选择'}]}>
          <Select options={schemes.filter(item=>plan.candidateIds.includes(item.id)).map(item=>({value:item.id,label:`${item.name ?? item.id} · ${item.id}`}))} />
        </Form.Item>}
        <Typography.Title level={5}>本次运行参数</Typography.Title>
        {preparation.inputFields.map(field=><Form.Item key={field.key} name={['inputs',field.key]} label={`${field.label}${field.unit?` / ${field.unit}`:''}`}
          rules={[{required:field.required,type:'number',min:field.min,max:field.max,message:`请检查${field.label}`}]}>
          <InputNumber style={{width:'100%'}} min={field.min} max={field.max} />
        </Form.Item>)}
        <Button type="primary" htmlType="submit" loading={busy} disabled={Boolean(bindingError)}>执行演示预览</Button>
      </Form>
    </Card>
    {result&&<Card size="small" title="演示预览结果" className="cfg-model-result">
      <Space wrap><Tag color="orange">演示结果</Tag><Tag>MODEL：{result.modelPlan!.modelId}</Tag><Tag>方案：{result.modelPlan!.schemeId}</Tag><Tag>{saved?'已保存到共享成果':'待保存'}</Tag></Space>
      <Typography.Paragraph>{result.result.summary}</Typography.Paragraph>
      <Table size="small" rowKey={(_,index)=>String(index)} dataSource={result.result.rows} columns={result.result.columns.map(column=>({title:`${column.label}${column.unit?` / ${column.unit}`:''}`,dataIndex:column.key}))} pagination={{pageSize:10}} scroll={{x:true}} />
      <Button onClick={save} loading={busy} disabled={saved}>保存演示成果</Button>
    </Card>}
  </div>;
}
