import { createLocalId } from '../utils/createLocalId';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Card, Form, Input, Modal, Select, Space, Tabs, Typography, Upload, message } from 'antd';
import { CloseOutlined, DownOutlined, UpOutlined } from '@ant-design/icons';
import { useBlocker, useParams } from 'react-router-dom';
import type { RcFile } from 'antd/es/upload/interface';
import CsvWorksheetEditor, { type WorksheetStorage } from './CsvWorksheetEditor';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { usePhysicalObjectStore, type RawDataFile } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { collectWorkspaceResourceGroups, type ResourceOwner } from './sessionResourceModel';
import { resolvePhysicalSource } from './physicalBusinessContext';
import { saveOwnedArtifact } from './sessionResourceStore';
import { parseTrialCsv, readTrialFile, saveTrialFile } from './trialDataFiles';
import { serializeWorksheet } from './csvWorksheetModel';
import { useProfessionalScope } from './professionalScopeContext';
import { useProfessionalCfgSelection } from './professionalScopeContext';
import ProfessionalCfgField from './ProfessionalCfgField';
import ModelChoiceStrip from './ModelChoiceStrip';
import { PROFESSIONAL_MODEL_OPTIONS } from './professionalModelCatalog';
import './trialWorksheet.css';

export default function SessionDataWorkspace({ professional = false, rootCauseContent }: { professional?: boolean; rootCauseContent?: ReactNode }) {
  const { sessionId } = useParams();
  const projects = useProjectStore(state=>state.projects);
  const sessions = useSessionStore(state=>state.sessions);
  const objects = usePhysicalObjectStore(state=>state.objects);
  const configurations = useTrialConfigurationStore(state=>state.configurations);
  const scope = useProfessionalScope();
  const cfgSelection = useProfessionalCfgSelection();
  const [selectedModel,setSelectedModel] = useState(PROFESSIONAL_MODEL_OPTIONS[0]);
  const [activeId,setActiveId] = useState<string>();
  const [dirtyIds,setDirtyIds] = useState<Set<string>>(new Set());
  const [imports,setImports] = useState(0);
  const [activeFeature,setActiveFeature] = useState('charts');
  const [creating,setCreating] = useState(false);
  const [manualError,setManualError] = useState('');
  const [manualForm] = Form.useForm<{name:string}>();
  const [previewTarget,setPreviewTarget] = useState<HTMLDivElement | null>(null);
  const [openedIds,setOpenedIds] = useState<string[]>([]);
  const [didInitialOpen,setDidInitialOpen] = useState(false);
  const [dockClosed,setDockClosed] = useState(true);
  const [dockExpanded,setDockExpanded] = useState(true);
  const [dockHeight,setDockHeight] = useState(Math.min(580,window.innerHeight*.6));
  const [dragStart,setDragStart] = useState<{y:number;height:number}>();
  const dockRoot = useRef<HTMLDivElement>(null);
  const [dockGeometry,setDockGeometry] = useState({left:0,width:window.innerWidth});
  const blocker = useBlocker(dirtyIds.size>0 || imports>0);
  const session=sessions.find(item=>item.id===sessionId);
  const selectedCfgId = cfgSelection?.cfgId ?? scope?.cfgId;
  const owner: ResourceOwner = professional && selectedCfgId ? {kind:'cfg',cfgId:selectedCfgId} : {kind:'session',sessionId:sessionId ?? ''};
  const resourceGroups=useMemo(()=>collectWorkspaceResourceGroups(projects,sessions,objects,configurations,sessionId ?? ''),[projects,sessions,objects,configurations,sessionId]);
  const group = resourceGroups.find(item=>item.id===(professional&&selectedCfgId?selectedCfgId:'generic'));
  const sourceTrial=professional && scope?.trialId?resolvePhysicalSource(objects,scope).trial:undefined;
  const allowedGroups=useMemo(()=>professional?resourceGroups.filter(item=>item.id==='generic'||(selectedCfgId && item.id===selectedCfgId)):resourceGroups.filter(item=>item.id==='generic'),[professional,resourceGroups,selectedCfgId]);
  const files = useMemo(()=>[...new Map([...allowedGroups.flatMap(item=>item.files),...[...(group?.trials ?? []),...(sourceTrial?[sourceTrial]:[])].flatMap(trial=>trial.records.flatMap(record=>record.rawFiles.filter(file=>file.status!=='removed')))].map(file=>[file.id,file])).values()],[allowedGroups,group,sourceTrial]);
  const firstFileId=files[0]?.id;
  const availableFileIds=files.map(file=>file.id).join('\u0000');
  const openedKey=openedIds.join('\u0000');
  const active = files.find(file=>file.id===activeId) ?? files[0];
  const featureTabs=useMemo(()=>[
    {key:'charts',label:'数据图表',children:<>
      <Card size="small" style={{marginBottom:16}}><Form layout="vertical" style={{maxWidth:720}}><ProfessionalCfgField /></Form></Card>

    </>},
    {key:'diagnosis',label:'异常与根因分析',children:rootCauseContent ?? null},
  ],[rootCauseContent]);
  useEffect(()=>{
    const ids=availableFileIds?availableFileIds.split('\u0000'):[];
    const opened=openedKey?openedKey.split('\u0000').filter(id=>ids.includes(id)):[];
    if(opened.length!== (openedKey?openedKey.split('\u0000').length:0))setOpenedIds(opened);
    if(!didInitialOpen){setDidInitialOpen(true);if(firstFileId){setOpenedIds([firstFileId]);setActiveId(firstFileId);setDockClosed(false);}}
    else if(activeId&&!ids.includes(activeId))setActiveId(firstFileId);
  },[availableFileIds,openedKey,firstFileId,activeId,didInitialOpen]);
  useEffect(()=>{
    const main=dockRoot.current?.closest('.session-main');
    const update=()=>{const rect=main?.getBoundingClientRect();setDockGeometry({left:rect?.left??0,width:rect?.width??window.innerWidth});};
    update();window.addEventListener('resize',update);const observer=new ResizeObserver(update);if(main)observer.observe(main);
    return()=>{observer.disconnect();window.removeEventListener('resize',update);};
  },[]);
  if (!sessionId || !session) return null;
  const save = (input: Parameters<typeof saveOwnedArtifact>[2]) => {
    if(!sessionId) throw new Error('当前会话不存在');
    if (professional && !scope?.cfgId) throw new Error('请明确选择本次使用的 CFG');
    return saveOwnedArtifact(sessionId,owner,{
      ...input,payload:{...input.payload,sourceCapability:professional?'analysis':'tools',sourceScope:professional?scope:undefined},
    });
  };
  const addFile = (file:RawDataFile) => {
    save({id:`data-file:${file.id}`,type:'analysis',title:file.name,source:professional?'数据分析':'通用工具',summary:`${file.rowCount} 行 · ${file.headers.length} 列`,payload:{dataFile:file,resultMode:'measured',results:[]}});
    setOpenedIds(previous=>previous.includes(file.id)?previous:[...previous,file.id]);
    setDockClosed(false);setDockExpanded(true);
  };
  const importFile = async (file:File):Promise<boolean> => {
    if (!file.name.toLowerCase().endsWith('.csv')) throw new Error('请选择 CSV 文件');
    const parsed = parseTrialCsv(await file.text());
    if (!parsed.headers.length) throw new Error('数据表没有可用字段');
    const normalizedContents=serializeWorksheet(parsed);
    const sameNameFiles=files.filter(item=>item.status!=='removed'&&item.name.toLocaleLowerCase()===file.name.toLocaleLowerCase()&&item.size===file.size);
    for(const existing of sameNameFiles) {
      try {
        if(serializeWorksheet(await readTrialFile(existing.id))===normalizedContents) {
          setActiveId(existing.id);
          setOpenedIds(previous=>previous.includes(existing.id)?previous:[...previous,existing.id]);setDockClosed(false);setDockExpanded(true);

          return false;
        }
      } catch { /* A stale file reference should not block a new valid import. */ }
    }
    const id=`raw-${createLocalId()}`;
    await saveTrialFile(id,file);
    addFile({id,name:file.name,mimeType:file.type || 'text/csv',size:file.size,addedAt:new Date().toISOString(),headers:parsed.headers,rowCount:parsed.rows.length,status:'available'});
    setActiveId(id);
    setOpenedIds(previous=>[...previous,id]);setDockClosed(false);setDockExpanded(true);
    return true;
  };
  const upload = async (file:RcFile) => {
    setImports(value=>value+1);
    try {if(await importFile(file)) message.success('数据已保存');}
    catch(cause) { console.error(cause);message.error('导入失败');}
    finally {setImports(value=>value-1);}
  };
  const storage:WorksheetStorage = {
    files,addFile,
    saveChart: (config,option) => {
      if(!active) throw new Error('请先打开数据文件');
      save({type:'analysis',title:config.name,source:professional?'数据分析':'通用工具',summary:active.name,payload:{
        resultMode:'measured',model:professional?selectedModel:undefined,chartConfiguration:config,sourceContext:{rawFiles:[active]},
        results:[{id:'chart',name:config.name,kind:'chart',option}],
      }});
    },
    saveTable: (name,fields,data) => {
      if(!active) throw new Error('请先打开数据文件');
      save({type:'analysis',title:name,source:professional?'数据分析':'通用工具',summary:active.name,payload:{
        resultMode:'measured',model:professional?selectedModel:undefined,sourceContext:{rawFiles:[active]},
        results:[{id:'table',name,kind:'table',columns:fields.map(key=>({key,label:key})),rows:data.rows.map(row=>Object.fromEntries(fields.map(field=>[field,row[field] ?? null])))}],
      }});
    },
  };
  const selectFile = (id:string) => {
    if(dirtyIds.size && id!==active?.id) Modal.confirm({title:'切换数据文件？',content:"",okText:'放弃修改并切换',cancelText:'取消',onOk:()=>{setDirtyIds(new Set());setActiveId(id);}});
    else setActiveId(id);
  };
  const createEmptyTable = async ({name}:{name:string}) => {
    const filename=name.trim().toLowerCase().endsWith('.csv')?name.trim():`${name.trim()}.csv`;
    setImports(value=>value+1);setManualError('');
    try {await importFile(new File(['字段1,字段2'],filename,{type:'text/csv'}));setCreating(false);}
    catch(cause) { console.error(cause);setManualError('创建失败');}
    finally {setImports(value=>value-1);}
  };
  return <div className="workspace-business-page session-data-workspace" style={professional?{paddingBottom:dockClosed?0:dockExpanded?dockHeight+10:48}:undefined}>
    <Typography.Title level={4}>{professional?'数据分析':'通用工具'}</Typography.Title>
    {professional && <div className="workspace-top-choice-row"><Typography.Text type="secondary">模型</Typography.Text><ModelChoiceStrip models={PROFESSIONAL_MODEL_OPTIONS} value={selectedModel.modelId} ariaLabel="数据分析模型选择" onChange={next=>{const matched=PROFESSIONAL_MODEL_OPTIONS.find(item=>item.modelId===next.modelId);if(matched)setSelectedModel(matched);}} /></div>}
    <Card size="small">
      <Space wrap>
      <Upload accept=".csv,text/csv" multiple showUploadList={false} disabled={imports>0 || dirtyIds.size>0 || (professional && !scope?.cfgId)} beforeUpload={file=>{void upload(file);return false;}}><Button type="primary" loading={imports>0} disabled={dirtyIds.size>0 || (professional && !scope?.cfgId)}>导入数据</Button></Upload>
      <Button disabled={imports>0 || dirtyIds.size>0 || (professional && !scope?.cfgId)} onClick={()=>{manualForm.resetFields();setManualError('');setCreating(true);}}>新建数据表</Button>
      <Typography.Text type="secondary">{professional && !scope?.cfgId ? "" : '打开工作表后可编辑、绘图并保存成果。'}</Typography.Text>
      </Space>
    </Card>
    {professional ? <Tabs activeKey={activeFeature} onChange={setActiveFeature} items={featureTabs} /> : files.length===0 && null}
    <div ref={setPreviewTarget} className="session-data-preview" />
    <button type="button" className="worksheet-reopen-handle" aria-label="打开工作表区" title="上拉或点击展开工作表" hidden={!dockClosed || openedIds.length===0} onClick={()=>{setDockClosed(false);setDockExpanded(true);}}><UpOutlined /></button>
    <div ref={dockRoot} className={`trial-worksheet-dock ${dockExpanded?'is-expanded':'is-collapsed'}`} hidden={dockClosed || openedIds.length===0} style={{left:dockGeometry.left,width:dockGeometry.width,height:dockExpanded?dockHeight:44}}>
      <div className="worksheet-resize-handle" role="separator" aria-label="调整工作表高度" onPointerDown={event=>{setDragStart({y:event.clientY,height:dockHeight});event.currentTarget.setPointerCapture(event.pointerId);}} onPointerMove={event=>{if(dragStart)setDockHeight(Math.max(220,Math.min(window.innerHeight*.76,dragStart.height+dragStart.y-event.clientY)));}} onPointerUp={()=>setDragStart(undefined)} onPointerCancel={()=>setDragStart(undefined)}><span /></div>
      <div className="worksheet-dock-heading"><strong>{active?.name ?? '工作表'}</strong><Space><Button size="small" icon={dockExpanded?<DownOutlined/>:<UpOutlined/>} onClick={()=>setDockExpanded(value=>!value)}>{dockExpanded?'收起':'展开'}</Button><Button size="small" icon={<CloseOutlined/>} aria-label="关闭工作表区" onClick={()=>setDockClosed(true)} /></Space></div>
      <div className="worksheet-editor-scroll" hidden={!dockExpanded}>{files.filter(file=>openedIds.includes(file.id)).map(file=><div key={file.id} hidden={active?.id!==file.id}><CsvWorksheetEditor key={file.id} file={file} owner={storage} tabName={file.name} capability={professional?'analysis':'tools'} previewTarget={previewTarget} active={active?.id===file.id} onSavedCopy={id=>{setActiveId(id);setOpenedIds(previous=>previous.includes(id)?previous:[...previous,id]);}} onDirtyChange={(id,dirty)=>setDirtyIds(previous=>{const next=new Set(previous);if(dirty)next.add(id);else next.delete(id);return next;})} /></div>)}</div>
      <div className="worksheet-bottom-bar"><div className="worksheet-file-tabs" role="tablist" aria-label="CSV 工作表">{files.filter(file=>openedIds.includes(file.id)).map(file=><div role="tab" aria-selected={active?.id===file.id} tabIndex={0} key={file.id} className={active?.id===file.id?'is-active':''} onClick={()=>selectFile(file.id)}><span>{file.name}</span><button type="button" aria-label={`关闭工作表 ${file.name}`} onClick={event=>{event.stopPropagation();setOpenedIds(previous=>previous.filter(id=>id!==file.id));if(active?.id===file.id)setActiveId(undefined);}}><CloseOutlined/></button></div>)}</div><Select size="small" aria-label="打开已有 CSV" placeholder="打开 CSV" value={undefined} style={{width:180}} options={files.map(file=>({value:file.id,label:file.name}))} onChange={id=>{if(!id)return;setOpenedIds(previous=>previous.includes(id)?previous:[...previous,id]);setActiveId(id);setDockClosed(false);setDockExpanded(true);}}/><Button type="text" className="worksheet-toggle" icon={dockExpanded?<DownOutlined/>:<UpOutlined/>} onClick={()=>setDockExpanded(value=>!value)}>{dockExpanded?'收起表格':'展开表格'}</Button></div>
    </div>
    <Modal title="新建数据表" open={creating} footer={null} onCancel={()=>setCreating(false)} destroyOnHidden>
      <Form form={manualForm} layout="vertical" onFinish={createEmptyTable}>
        {manualError && <Alert type="error" title={manualError} />}
        <Form.Item name="name" label="数据表名称" rules={[{required:true,whitespace:true}]}><Input /></Form.Item>
        <Typography.Paragraph type="secondary">创建后会在下方工作表标签中打开空表，可添加字段和数据行。</Typography.Paragraph>
        <Button type="primary" htmlType="submit" loading={imports>0}>创建并打开</Button>
      </Form>
    </Modal>
    <Modal title={imports?'数据正在保存':""} open={blocker.state==='blocked'} okText="放弃修改并离开" cancelText="继续工作" okButtonProps={{disabled:imports>0}} onOk={()=>blocker.state==='blocked' && blocker.proceed()} onCancel={()=>blocker.state==='blocked' && blocker.reset()}>
      {imports?'请等待数据保存完成。':'离开前可取消并保存工作副本。'}
    </Modal>
  </div>;
}
