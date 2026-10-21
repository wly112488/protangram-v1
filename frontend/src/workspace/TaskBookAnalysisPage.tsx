import { useEffect, useRef, useState } from 'react';
import { Button, Card, Empty, Input, List, Select, Space, Spin, Steps, Tag, Typography, Upload, message } from 'antd';
import { DeleteOutlined, FileSearchOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { saveTaskBookFile } from './taskBookStorage';
import { createTaskAnalysisPreview, taskCapabilityLabels } from './taskAnalysisModel';
import { taskBookPath } from './taskTrialModel';
import type { TaskRequirement, TaskTrialDraft } from './taskTypes';
import './taskAnalysis.css';
import { DEMO_TASK_TEXT } from './demoData';

export default function TaskBookAnalysisPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const projects = useProjectStore(state => state.projects);
  const projectId = params.get('projectId');
  const project = projects.find(item => item.id === projectId && !item.sessionOwnerId);
  const [file, setFile] = useState<File>();
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [requirements, setRequirements] = useState<TaskRequirement[]>([]);
  const [drafts, setDrafts] = useState<TaskTrialDraft[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedId = useRef<string | undefined>(undefined);
  const importVersion = useRef(0);
  const savingRef = useRef(false);
  useEffect(() => {
    if (!file) return;
    const objectUrl = URL.createObjectURL(file); setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  const importFile = async (next: File) => {
    if (!/\.(pdf|txt|md)$/i.test(next.name)) { message.error('请选择 PDF 或文本任务书'); return false; }
    const version = ++importVersion.current;
    setLoading(true);
    try {
      const sourceText = /\.(txt|md)$/i.test(next.name) ? await next.text() : '';
      if (version !== importVersion.current) return false;
      const preview = createTaskAnalysisPreview(next.name, sourceText, usePhysicalObjectStore.getState().objects);
      setFile(next); setText(sourceText); setTitle(preview.title); setRequirements(preview.requirements); setDrafts(preview.trialDrafts); savedId.current = undefined;
    } catch { message.error('文件读取失败，请重新选择'); }
    finally { if (version === importVersion.current) setLoading(false); }
    return false;
  };
  const savePlan = async () => {
    if (savingRef.current) return;
    if (!file || !title.trim() || !requirements.length || requirements.some(item => !item.text.trim()) || !drafts.length) { message.warning('请补充任务名称、试验模板和任务事项'); return; }
    if (projectId && !project) { message.error('原项目已不存在，请重新进入分析任务书'); return; }
    savingRef.current = true; setSaving(true);
    try {
      const taskId = savedId.current ?? `task-${crypto.randomUUID()}`;
      await saveTaskBookFile(taskId, file);
      const store = useTaskStore.getState();
      if (!savedId.current) store.createTask({ id: taskId, title: title.trim(), sourceName: file.name, sourceText: text, projectId: project?.id ?? '', requirementTexts: [] });
      else store.updateTask(taskId, { title: title.trim() });
      store.setAnalysisPlan(taskId, requirements, drafts);
      savedId.current = taskId;
      return taskId;
    } catch { message.error('任务规划保存失败，请重试'); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const review = async (draftId: string) => {
    const taskId = await savePlan();
    if (taskId) navigate(`/trials/new?${new URLSearchParams({ taskBookId: taskId, draftId })}`);
  };
  const removeRequirement = (id: string) => {
    setRequirements(items => items.filter(item => item.id !== id).map(item => ({ ...item, dependsOnIds: item.dependsOnIds?.filter(value => value !== id) })));
    setDrafts(items => items.map(item => ({ ...item, requirementIds: item.requirementIds.filter(value => value !== id) })));
  };
  return <div className="task-analysis-page">
    <div className="workspace-content-heading"><div><Typography.Title level={2}>分析任务书</Typography.Title>{project && <Tag>{project.name}</Tag>}</div><Space><Button disabled={saving} onClick={() => void importFile(new File([DEMO_TASK_TEXT], '涵道风扇性能验证任务书（演示）.txt', { type: 'text/plain' }))}>使用演示任务书</Button><Upload accept=".pdf,.txt,.md" showUploadList={false} beforeUpload={importFile} disabled={saving}><Button icon={<UploadOutlined />} loading={loading}>{file ? '更换任务书' : '导入任务书'}</Button></Upload></Space></div>
    <Steps size="small" current={file ? 1 : 0} items={[{ title: '导入任务书' }, { title: '复核试验模板' }, { title: '开展试验工作' }]} />
    {!file ? <Card className="task-analysis-empty"><Empty image={<FileSearchOutlined style={{ fontSize: 56, color: '#8eacd4' }} />} description="导入任务书，查看试验模板与任务拆解"><Upload accept=".pdf,.txt,.md" showUploadList={false} beforeUpload={importFile}><Button type="primary" icon={<UploadOutlined />}>导入并分析</Button></Upload></Empty></Card> : <Spin spinning={loading}><div className="task-analysis-layout">
      <Card title={file.name} className="task-analysis-source">{/\.pdf$/i.test(file.name) ? <iframe title="任务书原文" src={url} /> : <Typography.Paragraph className="task-analysis-text">{text}</Typography.Paragraph>}</Card>
      <div className="task-analysis-plan">
        <Card title="任务规划" extra={<Button loading={saving} onClick={async () => { const taskId = await savePlan(); if (taskId) navigate(taskBookPath(taskId, 'progress')); }}>保存并查看任务</Button>}><label className="session-form-label" htmlFor="task-analysis-title">任务名称</label><Input id="task-analysis-title" value={title} onChange={event => setTitle(event.target.value)} /></Card>
        <Card title="试验模板" extra={<Button type="text" icon={<PlusOutlined />} onClick={() => setDrafts(items => [...items, { id: crypto.randomUUID(), name: '', loadSpectrum: '', requirementIds: requirements.map(item => item.id) }])}>添加试验</Button>}>
          <List dataSource={drafts} renderItem={draft => <List.Item actions={[<Button key="review" type="primary" loading={saving} onClick={() => review(draft.id)}>复核并创建试验</Button>, <Button key="delete" type="text" aria-label={`删除试验模板${draft.name}`} icon={<DeleteOutlined />} onClick={() => setDrafts(items => items.filter(item => item.id !== draft.id))} />]}><List.Item.Meta title={draft.name || '待命名试验'} description={<Space wrap><Tag>{usePhysicalObjectStore.getState().objects.flatMap(item => item.configurations).find(item => item.id === draft.physicalObjectId)?.name ?? '物理对象待确认'}</Tag><Tag>{draft.experimentId ? '已匹配试验构型' : '试验构型待确认'}</Tag><Tag>{draft.loadSpectrum || '载荷谱待补充'}</Tag></Space>} /></List.Item>} />
        </Card>
        <Card title="AI 任务拆解" extra={<Button type="text" icon={<PlusOutlined />} onClick={() => { const id = crypto.randomUUID(); setRequirements(items => [...items, { id, text: '', status: '待完成', capability: 'dataAnalysis' }]); setDrafts(items => items.map(item => ({ ...item, requirementIds: [...item.requirementIds, id] }))); }}>添加事项</Button>}>
          <div className="task-analysis-items">{requirements.map((item, index) => <div className="task-analysis-item" key={item.id}><div className="task-analysis-item-heading"><Tag>{index + 1}</Tag><Input aria-label={`任务事项${index + 1}`} value={item.text} onChange={event => setRequirements(items => items.map(value => value.id === item.id ? { ...value, text: event.target.value } : value))} /><Button type="text" icon={<DeleteOutlined />} aria-label={`删除任务事项${index + 1}`} onClick={() => removeRequirement(item.id)} /></div><Space wrap><Select aria-label={`任务事项${index + 1}专业功能`} value={item.capability} options={Object.entries(taskCapabilityLabels).map(([value, label]) => ({ value, label }))} onChange={capability => setRequirements(items => items.map(value => value.id === item.id ? { ...value, capability } : value))} /><Typography.Text type="secondary">{item.dependsOnIds?.length ? `前置事项：${item.dependsOnIds.map(id => requirements.findIndex(value => value.id === id) + 1).join('、')}` : '无前置事项'}</Typography.Text></Space></div>)}</div>
        </Card>
      </div>
    </div></Spin>}
  </div>;
}
