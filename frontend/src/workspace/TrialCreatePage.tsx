import React, { useState } from 'react';
import { Button, Card, Form, Input, Select, Typography, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath } from './sessionModel';
import { resolveTrialCreationContext, resolveTrialTaskBookId } from './trialCreationModel';
import { confirmTaskTrialDraft } from './taskTrialWorkflow';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { createTrialForEquipment } from './cfgTrialBridge';
import TaskBookSource from './TaskBookSource';
import './taskAnalysis.css';
import { flattenEquipment } from './equipmentCompositionModel';
import { usePhysicalObjectStore } from './physicalObjectStore';

export function TrialCreateForm({ sourceSessionId, onCreated }: { sourceSessionId?: string; onCreated?: () => void } = {}) {
  const [form] = Form.useForm();
  const location = useLocation(), navigate = useNavigate();
  const tasks = useTaskStore(state=>state.tasks), projects = useProjectStore(state=>state.projects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const sourceSession = useSessionStore(state => state.sessions.find(session => session.id === sourceSessionId));
  const creationSearch = sourceSessionId ? sourceSession?.projectId ? `?${new URLSearchParams({ projectId: sourceSession.projectId })}` : '' : location.search;
  const params = new URLSearchParams(creationSearch);
  const taskDraft = tasks.find(task=>task.id===params.get('taskBookId'))?.trialDrafts?.find(draft=>draft.id===params.get('draftId'));
  const context = resolveTrialCreationContext(creationSearch,tasks,projects);
  const objects = usePhysicalObjectStore(state => state.objects);
  const equipment = flattenEquipment(objects);
  const linkedCfg = configurations.find(item => item.id === params.get('cfgId'));
  const [objectId,setObjectId] = useState<string|undefined>(() => taskDraft?.physicalObjectId ?? linkedCfg?.primaryObjectId ?? (linkedCfg?.members.filter(member => member.role === 'tested').length === 1 ? linkedCfg.members.find(member => member.role === 'tested')?.objectId : undefined));

  const submit = (values:{name:string;description?:string;loadSpectrum?:string;loadSpectrumDescription?:string;taskBookId?:string}) => {
    if(context.mode==='missing-task'||context.mode==='missing-project') return;
    if(!objectId || !equipment.some(item => item.id === objectId)) return message.error('操作失败');
    try {
      if(taskDraft && context.mode==='task') {
        const sessionId = confirmTaskTrialDraft(context.taskId,taskDraft.id,{...values,physicalObjectId:objectId});
        navigate(getSessionPath(sessionId));
        return;
      }
      const taskBookId = resolveTrialTaskBookId(context,values.taskBookId);
      const task = tasks.find(item => item.id === taskBookId);
      const projectId = task?.projectId || (context.mode==='project'||context.mode==='task'?context.projectId:undefined);
      if (taskBookId && (!task || !projects.some(project => project.id === task.projectId && !project.sessionOwnerId))) throw new Error('任务书必须归属有效项目');
      if (context.mode === 'project' && task && task.projectId !== context.projectId) throw new Error('不能关联其他项目的任务书');
      if (sourceSessionId) {
        const current = useSessionStore.getState().sessions.find(session => session.id === sourceSessionId);
        if (!current) throw new Error('当前工作已不存在');
        if (current.businessScope?.trialId) throw new Error('当前工作已关联具体试验，请继续原试验');
        if (current.taskId || current.taskWork) throw new Error('任务书试验请从原任务中继续');
        if (current.projectId && current.projectId !== projectId) throw new Error('不能关联其他项目的任务书');
      }
      const scope = createTrialForEquipment(objectId,{...values,taskBookId});
      const sessionStore = useSessionStore.getState();
      if (sourceSessionId) {
        sessionStore.bindTrialToSession(sourceSessionId, scope, projectId);
        if (useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试保存');
        message.success('具体试验已创建并关联当前工作');
        onCreated?.();
        return;
      }
      const sessionId = projectId?sessionStore.ensureProjectSession(projectId,scope):sessionStore.ensurePhysicalSession(scope,values.name.trim());
      sessionStore.openSession(sessionId);
      if(useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试');
      message.success('具体试验已保存到本机');
      navigate(getSessionPath(sessionId));
    } catch(error) { console.error(error); message.error('具体试验保存失败'); }
  };
  if(context.mode==='missing-task'||context.mode==='missing-project'||params.has('draftId')&&!taskDraft) return <Button onClick={() => navigate('/')}>返回工作台</Button>;
  if(taskDraft?.source&&taskDraft.sessionId) return <Button onClick={()=>navigate(getSessionPath(taskDraft.sessionId!))}>继续历史试验</Button>;
  return <div className={sourceSessionId ? 'trial-inline-association' : 'trial-create-page'}>
    {!sourceSessionId && <><Button type="link" onClick={()=>navigate(-1)}>返回</Button>
    <Typography.Title level={2}>{taskDraft?'复核候选试验':'创建具体试验'}</Typography.Title></>}
    {context.mode==='task'&&<Typography.Text>{context.taskName}</Typography.Text>}
    {context.mode==='project'&&<Typography.Text>{context.projectName}</Typography.Text>}
    <div className={context.mode==='task' ? 'task-analysis-layout' : undefined}><div>
    <Card title="试验对象">
      <Form.Item label="物理对象" required><Select aria-label="具体试验的物理对象" style={{width:'100%'}} showSearch optionFilterProp="label" value={objectId} onChange={setObjectId}
        options={equipment.map(item => ({value:item.id,label:item.path}))} placeholder="选择具体物理对象" /></Form.Item>
    </Card>
    <Card title="试验信息" style={{marginTop:16}}>
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{name:taskDraft?.name ?? sourceSession?.title,description:taskDraft?.description,loadSpectrum:taskDraft?.loadSpectrum}}>
        <Form.Item name="name" label="具体试验名称" rules={[{required:true,whitespace:true,message:""}]}><Input aria-label="具体试验名称" /></Form.Item>
        <Form.Item name="loadSpectrum" label="载荷谱名称或编号（可选）"><Input placeholder="没有载荷谱也可开展试验和记录" /></Form.Item>
        <Form.Item name="loadSpectrumDescription" label="载荷谱说明（可选）"><Input /></Form.Item>
        <Form.Item name="description" label="试验说明（可选）"><Input.TextArea rows={2} /></Form.Item>
        {context.mode!=='task'&&<Form.Item name="taskBookId" label="关联任务书（可选）"><Select allowClear options={tasks.filter(item=>item.status!=='已归档' && projects.some(project => project.id === item.projectId && !project.sessionOwnerId) && (context.mode!=='project' || item.projectId===context.projectId)).map(item=>({value:item.id,label:item.title}))} /></Form.Item>}
        <Button type="primary" htmlType="submit" disabled={!objectId}>{sourceSessionId?'确认创建并关联当前工作':taskDraft?'确认并进入试验工作台':'创建并进入试验工作台'}</Button>
      </Form>
    </Card>
    </div>{context.mode==='task' && <TaskBookSource taskId={context.taskId} />}</div>
  </div>;
}
const TrialCreatePage:React.FC = () => { const location=useLocation(); return <TrialCreateForm key={location.search} />; };
export default TrialCreatePage;
