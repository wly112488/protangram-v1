import React, { useState } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Typography, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath } from './sessionModel';
import { resolveTrialCreationContext, resolveTrialTaskBookId } from './trialCreationModel';
import { confirmTaskTrialDraft } from './taskTrialWorkflow';
import { taskCapabilityRoute } from './taskAnalysisModel';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { flattenEquipment } from './equipmentCompositionModel';
import { validateTrialConfiguration } from './trialConfigurationModel';
import TrialConfigurationEditor from './TrialConfigurationEditor';

function TrialCreateForm() {
  const [form] = Form.useForm();
  const location = useLocation(), navigate = useNavigate();
  const tasks = useTaskStore(state=>state.tasks), projects = useProjectStore(state=>state.projects);
  const objects = usePhysicalObjectStore(state=>state.objects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const params = new URLSearchParams(location.search);
  const taskDraft = tasks.find(task=>task.id===params.get('taskBookId'))?.trialDrafts?.find(draft=>draft.id===params.get('draftId'));
  const context = resolveTrialCreationContext(location.search,tasks,projects);
  const [cfgId,setCfgId] = useState<string|undefined>(()=>params.get('cfgId') || undefined);
  const [creating,setCreating] = useState(false);
  const cfg = configurations.find(item=>item.id===cfgId);
  const equipment = flattenEquipment(objects);

  const submit = (values:{name:string;description?:string;loadSpectrum?:string;loadSpectrumDescription?:string;taskBookId?:string}) => {
    if(context.mode==='missing-task'||context.mode==='missing-project') return;
    if(!cfg) return message.error('请选择有效的试验构型 CFG');
    try {
      const errors = validateTrialConfiguration(cfg,new Set(equipment.map(item=>item.id)));
      if(errors.length) throw new Error(errors.join('；'));
      const tested = cfg.members.filter(member=>member.role==='tested');
      const primary = cfg.primaryObjectId ?? (tested.length===1?tested[0].objectId:undefined);
      const object = equipment.find(item=>item.id===primary)?.equipment;
      if(!object) throw new Error('请在 CFG 中明确主被试对象');
      const store = usePhysicalObjectStore.getState();
      const experimentId = object.experiments.find(item=>item.category==='internal:cfg-trials')?.id
        ?? store.addExperiment(object.id,{name:'具体试验',category:'internal:cfg-trials',parameters:[]});
      if(taskDraft && context.mode==='task') {
        const sessionId = confirmTaskTrialDraft(context.taskId,taskDraft.id,{...values,loadSpectrum:values.loadSpectrum ?? '',physicalObjectId:object.id,experimentId});
        const requirement = tasks.find(task=>task.id===context.taskId)?.requirements.find(item=>taskDraft.requirementIds.includes(item.id));
        navigate(getSessionPath(sessionId,requirement?.capability?taskCapabilityRoute[requirement.capability]:'doe'));
        return;
      }
      const taskBookId = resolveTrialTaskBookId(context,values.taskBookId);
      const trialId = store.addConcreteTrial(experimentId,{...values,name:values.name.trim(),loadSpectrum:values.loadSpectrum?.trim() ?? '',taskBookId});
      const scope = {physicalObjectId:object.id,physicalObjectName:object.name,experimentId,experimentName:'具体试验',trialId,trialName:values.name.trim(),taskBookId};
      const sessionStore = useSessionStore.getState();
      const projectId = context.mode==='project'||context.mode==='task'?context.projectId:undefined;
      const sessionId = projectId?sessionStore.ensureProjectSession(projectId,scope):sessionStore.ensurePhysicalSession(scope,values.name.trim());
      sessionStore.openSession(sessionId,'doe');
      if(useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试');
      message.success('具体试验已保存到本机');
      navigate(getSessionPath(sessionId,'doe'));
    } catch(error) { message.error(error instanceof Error?error.message:'具体试验保存失败'); }
  };
  if(context.mode==='missing-task'||context.mode==='missing-project') return <Alert type="error" showIcon title="创建入口已失效" description="关联的任务或项目已不存在，请从有效入口重新开始。" />;
  if(params.has('draftId')&&!taskDraft) return <Alert type="error" title="试验模板不存在，请返回任务重新选择" />;
  return <div className="trial-create-page">
    <Button type="link" onClick={()=>navigate(-1)}>返回</Button>
    <Typography.Title level={2}>{taskDraft?'复核试验模板':'创建具体试验'}</Typography.Title>
    <Typography.Paragraph type="secondary">选择可复用的 CFG，或在这里按角色组合装备并创建。项目和任务书按需关联。</Typography.Paragraph>
    {context.mode==='task'&&<Alert type="info" showIcon title={`将自动关联正式任务：${context.taskName}`} />}
    {context.mode==='project'&&<Alert type="info" title={`所属项目：${context.projectName}`} />}
    <Card title="试验构型 CFG">
      <Form.Item label="试验构型 CFG" required><Space.Compact block>
        <Select aria-label="选择试验构型 CFG" style={{width:'100%'}} showSearch optionFilterProp="label" value={cfgId} onChange={setCfgId}
          options={configurations.map(item=>({value:item.id,label:item.name}))} placeholder="选择已有 CFG" />
        <Button onClick={()=>setCreating(true)}>新建 CFG</Button>
      </Space.Compact></Form.Item>
      <Button type="link" onClick={()=>navigate('/trial-configurations')}>管理试验构型 CFG</Button>
      {cfg&&<Typography.Text type="secondary">{cfg.name} · {cfg.id}</Typography.Text>}
    </Card>
    <Card title="试验信息" style={{marginTop:16}}>
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{name:taskDraft?.name,description:taskDraft?.description,loadSpectrum:taskDraft?.loadSpectrum}}>
        <Form.Item name="name" label="具体试验名称" rules={[{required:true,whitespace:true,message:'请填写具体试验名称'}]}><Input /></Form.Item>
        <Form.Item name="loadSpectrum" label="载荷谱名称或编号" rules={[{required:true,whitespace:true,message:'请填写载荷谱名称或编号'}]}><Input /></Form.Item>
        <Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input /></Form.Item>
        <Form.Item name="description" label="试验说明（可选）"><Input.TextArea rows={2} /></Form.Item>
        {context.mode!=='task'&&<Form.Item name="taskBookId" label="关联任务书（可选）"><Select allowClear options={tasks.filter(item=>item.status!=='已归档').map(item=>({value:item.id,label:item.title}))} /></Form.Item>}
        <Button type="primary" htmlType="submit" disabled={!cfg}>{taskDraft?'确认并进入试验工作台':'创建并进入试验工作台'}</Button>
      </Form>
    </Card>
    <Modal title="新建试验构型 CFG" open={creating} onCancel={()=>setCreating(false)} footer={null} destroyOnHidden width={780}>
      <TrialConfigurationEditor onSaved={id=>{setCfgId(id);setCreating(false);}} onCancel={()=>setCreating(false)} />
    </Modal>
  </div>;
}
const TrialCreatePage:React.FC = () => { const location=useLocation(); return <TrialCreateForm key={location.search} />; };
export default TrialCreatePage;
