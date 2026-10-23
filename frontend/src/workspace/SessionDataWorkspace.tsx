import { useState } from 'react';
import { Alert, Button, Card, Empty, Form, Input, Modal, Space, Tabs, Typography, Upload, message } from 'antd';
import { useBlocker, useParams } from 'react-router-dom';
import type { RcFile } from 'antd/es/upload/interface';
import CsvWorksheetEditor, { type WorksheetStorage } from './CsvWorksheetEditor';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { usePhysicalObjectStore, type RawDataFile } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { collectSessionResourceGroups, type ResourceOwner } from './sessionResourceModel';
import { saveOwnedArtifact } from './sessionResourceStore';
import { parseTrialCsv, saveTrialFile } from './trialDataFiles';
import { useProfessionalScope } from './professionalScopeContext';
import './trialWorksheet.css';

export default function SessionDataWorkspace({ professional = false }: { professional?: boolean }) {
  const { sessionId } = useParams();
  const projects = useProjectStore(state=>state.projects);
  const sessions = useSessionStore(state=>state.sessions);
  const objects = usePhysicalObjectStore(state=>state.objects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const scope = useProfessionalScope();
  const [activeId,setActiveId] = useState<string>();
  const [dirtyIds,setDirtyIds] = useState<Set<string>>(new Set());
  const [imports,setImports] = useState(0);
  const [creating,setCreating] = useState(false);
  const [manualError,setManualError] = useState('');
  const [manualForm] = Form.useForm<{name:string;contents:string}>();
  const [previewTarget,setPreviewTarget] = useState<HTMLDivElement | null>(null);
  const blocker = useBlocker(dirtyIds.size>0 || imports>0);
  if (!sessionId || !sessions.some(session=>session.id===sessionId)) return <Empty description="当前会话不存在" />;
  if (professional && !scope?.cfgId) return <Empty description="请选择本次使用的 CFG" />;
  const owner: ResourceOwner = professional ? {kind:'cfg',cfgId:scope!.cfgId!} : {kind:'session',sessionId};
  const group = collectSessionResourceGroups(projects,sessions,objects,configurations,sessionId).find(item=>item.id===(professional?scope!.cfgId:'generic'));
  const files = [...new Map([...(group?.files ?? []),...(group?.trials ?? []).flatMap(trial=>trial.records.flatMap(record=>record.rawFiles.filter(file=>file.status!=='removed')))].map(file=>[file.id,file])).values()];
  const active = files.find(file=>file.id===activeId) ?? files[0];
  const save = (input: Parameters<typeof saveOwnedArtifact>[2]) => saveOwnedArtifact(sessionId,owner,{
    ...input,payload:{...input.payload,sourceCapability:professional?'analysis':'tools',sourceScope:professional?scope:undefined},
  });
  const addFile = (file:RawDataFile) => {
    save({id:`data-file:${file.id}`,type:'analysis',title:file.name,source:professional?'数据分析':'通用工具',summary:`${file.rowCount} 行 · ${file.headers.length} 列`,payload:{dataFile:file,resultMode:'measured',results:[]}});
  };
  const importFile = async (file:File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('请选择 CSV 文件');
    const parsed = parseTrialCsv(await file.text());
    if (!parsed.headers.length || !parsed.rows.length) throw new Error('数据表没有可用的字段或数据行');
    const id=`raw-${crypto.randomUUID()}`;
    await saveTrialFile(id,file);
    addFile({id,name:file.name,mimeType:file.type || 'text/csv',size:file.size,addedAt:new Date().toISOString(),headers:parsed.headers,rowCount:parsed.rows.length,status:'available'});
    setActiveId(id);
  };
  const upload = async (file:RcFile) => {
    setImports(value=>value+1);
    try {await importFile(file);message.success('数据已保存');}
    catch(cause) {message.error(cause instanceof Error?cause.message:'导入失败');}
    finally {setImports(value=>value-1);}
  };
  const storage:WorksheetStorage = {
    files,addFile,
    saveChart: (config,option) => {
      if(!active) throw new Error('请先打开数据文件');
      save({type:'analysis',title:config.name,source:professional?'数据分析':'通用工具',summary:active.name,payload:{
        resultMode:'measured',chartConfiguration:config,sourceContext:{rawFiles:[active]},
        results:[{id:'chart',name:config.name,kind:'chart',option}],
      }});
    },
    saveTable: (name,fields,data) => {
      if(!active) throw new Error('请先打开数据文件');
      save({type:'analysis',title:name,source:professional?'数据分析':'通用工具',summary:active.name,payload:{
        resultMode:'measured',sourceContext:{rawFiles:[active]},
        results:[{id:'table',name,kind:'table',columns:fields.map(key=>({key,label:key})),rows:data.rows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field] ?? null])))}],
      }});
    },
  };
  const selectFile = (id:string) => {
    if(dirtyIds.size && id!==active?.id) Modal.confirm({title:'切换数据文件？',content:'当前修改尚未保存，可以取消后先保存工作副本。',okText:'放弃修改并切换',cancelText:'取消',onOk:()=>{setDirtyIds(new Set());setActiveId(id);}});
    else setActiveId(id);
  };
  return <div className="workspace-business-page session-data-workspace">
    <Typography.Title level={4}>{professional?'数据分析':'通用工具'}</Typography.Title>
    <Card size="small"><Space wrap>
      <Upload accept=".csv,text/csv" multiple showUploadList={false} disabled={imports>0 || dirtyIds.size>0} beforeUpload={file=>{void upload(file);return false;}}><Button type="primary" loading={imports>0} disabled={dirtyIds.size>0}>导入数据</Button></Upload>
      <Button disabled={imports>0 || dirtyIds.size>0} onClick={()=>{manualForm.resetFields();setManualError('');setCreating(true);}}>新建数据表</Button>
      <Typography.Text type="secondary">打开数据后可编辑、绘图并保存成果。</Typography.Text>
    </Space></Card>
    {files.length>0 ? <>
      <Tabs activeKey={active?.id} onChange={selectFile} items={files.map(file=>({key:file.id,label:file.name}))} />
      {active && <CsvWorksheetEditor key={active.id} file={active} owner={storage} tabName={active.name} capability={professional?'analysis':'tools'} previewTarget={previewTarget} active
        onSavedCopy={id=>setActiveId(id)} onDirtyChange={(id,dirty)=>setDirtyIds(previous=>{const next=new Set(previous);if(dirty) next.add(id);else next.delete(id);return next;})} />}
    </> : <Empty description="导入数据或新建数据表开始工作" />}
    <div ref={setPreviewTarget} className="session-data-preview" />
    <Modal title="新建数据表" open={creating} footer={null} onCancel={()=>setCreating(false)} destroyOnHidden>
      <Form form={manualForm} layout="vertical" onFinish={async value=>{
        setImports(value=>value+1);setManualError('');
        try {await importFile(new File([value.contents],value.name.toLowerCase().endsWith('.csv')?value.name:`${value.name}.csv`,{type:'text/csv'}));setCreating(false);}
        catch(cause) {setManualError(cause instanceof Error?cause.message:'保存失败');}
        finally {setImports(value=>value-1);}
      }}>
        {manualError && <Alert type="error" title={manualError} />}
        <Form.Item name="name" label="数据表名称" rules={[{required:true,whitespace:true}]}><Input /></Form.Item>
        <Form.Item name="contents" label="数据内容" extra="第一行为列名，使用逗号分隔各列。" rules={[{required:true,whitespace:true}]}><Input.TextArea rows={8} placeholder={'时间,推力\n0,10\n1,12'} /></Form.Item>
        <Button type="primary" htmlType="submit" loading={imports>0}>保存数据表</Button>
      </Form>
    </Modal>
    <Modal title={imports?'数据正在保存':'有未保存的修改'} open={blocker.state==='blocked'} okText="放弃修改并离开" cancelText="继续工作" okButtonProps={{disabled:imports>0}} onOk={()=>blocker.state==='blocked' && blocker.proceed()} onCancel={()=>blocker.state==='blocked' && blocker.reset()}>
      {imports?'请等待数据保存完成。':'离开前可取消并保存工作副本。'}
    </Modal>
  </div>;
}
