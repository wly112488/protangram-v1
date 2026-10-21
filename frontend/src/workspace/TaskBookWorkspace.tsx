import { useEffect, useRef, useState } from 'react';
import { Button, Card, Collapse, Drawer, Empty, Input, Modal, Select, Space, Spin, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, UploadOutlined } from '@ant-design/icons';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTaskStore } from './taskStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { getSessionPath } from './sessionModel';
import { artifactResourcesPath } from './sharedResourcesModel';
import { artifactResultLabel, recordLabel } from './physicalBusinessContext';
import { getTaskReportArtifacts, getTaskTrials, getTaskTrialSources, groupTaskTrials, taskBookPath, type TaskTrialEntry } from './taskTrialModel';
import { loadTaskBookFile, saveTaskBookFile } from './taskBookStorage';
import { loadAnalysisReports } from '@/utils/storage';
import useAppStore from '@/stores/useAppStore';
import type { AnalysisReport } from '@/types';
import type { ProjectArtifact } from './types';
import TaskProgressView from './TaskProgressView';
import './physicalObjects.css';
import './taskBookWorkspace.css';

const { Title, Text, Paragraph } = Typography;

export function TaskBookRoute() {
  const { taskId } = useParams();
  return <Navigate to={taskId ? taskBookPath(taskId) : '/task-center'} replace />;
}

export default function TaskBookWorkspace({ taskId }: { taskId: string }) {
  const task = useTaskStore(state => state.tasks.find(item => item.id === taskId));
  const objects = usePhysicalObjectStore(state => state.objects);
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const reports = useAppStore(state => state.analysisReports);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const view = ['source', 'report', 'progress', 'trials'].includes(params.get('view') ?? '') ? params.get('view')! : task?.trialDrafts?.length ? 'progress' : 'trials';
  const entries = getTaskTrials(objects, projects, sessions, taskId);
  const groups = groupTaskTrials(entries);
  const sources = getTaskTrialSources(entries);
  const [linkOpen, setLinkOpen] = useState(false);
  const [targetTrial, setTargetTrial] = useState<string>();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdf, setPdf] = useState<{ loading: boolean; url?: string; error?: string }>({ loading: false });
  const [pdfRevision, setPdfRevision] = useState(0);
  const [uploading, setUploading] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);
  const targets = objects.flatMap(category => category.configurations.flatMap(object => object.experiments.map(configuration => ({ category, object, configuration }))));
  const autonomous = targets.flatMap(target => target.configuration.trials.filter(trial => !trial.taskBookId).map(trial => ({ ...target, trial })));

  useEffect(() => { useAppStore.getState().setAnalysisReports(loadAnalysisReports()); }, []);
  useEffect(() => {
    if (!pdfOpen) return;
    let active = true, url: string | undefined;
    setPdf({ loading: true });
    loadTaskBookFile(taskId).then(file => {
      if (!active) return;
      if (file) url = URL.createObjectURL(file);
      setPdf({ loading: false, url, error: file ? undefined : '本机未保存任务书 PDF' });
    }).catch(() => active && setPdf({ loading: false, error: '任务书 PDF 读取失败' }));
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [taskId, pdfOpen, pdfRevision]);

  if (!task) return <Card><Empty description="任务书不存在或本机数据不可用"><Button onClick={() => navigate('/task-center')}>返回任务书工作台</Button></Empty></Card>;
  const reportArtifacts = getTaskReportArtifacts(task, entries, projects);
  const taskReports = reports.filter(report => (report as AnalysisReport & { taskId?: string }).taskId === taskId || report.id === task.reportDraft.formalReportArtifact?.artifactId);
  const openTrial = (entry: TaskTrialEntry, recordId?: string) => {
    const scope = { physicalObjectId: entry.object.id, physicalObjectName: entry.object.name,
      experimentId: entry.configuration.id, experimentName: entry.configuration.name,
      trialId: entry.trial.id, trialName: entry.trial.name, taskBookId: taskId,
      ...(recordId ? { testRecordId: recordId } : {}),
    };
    const owner = sessions.find(item => item.projectId && item.businessScope?.physicalObjectId === entry.object.id && item.businessScope?.experimentId === entry.configuration.id && item.businessScope?.trialId === entry.trial.id);
    const id = owner ? useSessionStore.getState().ensureProjectSession(owner.projectId!, scope)
      : useSessionStore.getState().ensurePhysicalSession(scope, entry.trial.name);
    navigate(getSessionPath(id, recordId ? 'analysis' : 'doe'));
  };
  const openReport = (reportId?: string) => {
    const id = useSessionStore.getState().ensureTaskSession(task);
    useSessionStore.getState().openSession(id, 'report');
    navigate(reportId ? `${getSessionPath(id, 'report')}/generate/${encodeURIComponent(reportId)}` : getSessionPath(id, 'report'));
  };
  const choosePdf = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0]; event.currentTarget.value = '';
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) return message.error('请选择 PDF 文件');
    setUploading(true);
    try {
      await saveTaskBookFile(taskId, file);
      useTaskStore.getState().updateTask(taskId, { sourceName: file.name });
      setPdfRevision(value => value + 1); message.success('任务书 PDF 已保存在本机');
    } catch { message.error('PDF 保存失败，请重试'); }
    finally { setUploading(false); }
  };
  const linkTrial = () => {
    if (!autonomous.some(item => item.trial.id === targetTrial)) return message.error('请选择仍未关联任务书的具体试验');
    usePhysicalObjectStore.getState().updateConcreteTrial(targetTrial!, { taskBookId: taskId });
    setTargetTrial(undefined); setLinkOpen(false);
  };
  const startTrial = () => {
    navigate(`/trials/new?${new URLSearchParams({ taskBookId: taskId })}`);
  };
  const openArtifact = (artifact: ProjectArtifact) => navigate(artifactResourcesPath(artifact, projects, sessions), { state: {
    artifactId: artifact.id, returnTo: taskBookPath(taskId, view === 'trials' ? undefined : view),
  } });

  return <div className="taskbook-workspace physical-page">
    <div className="taskbook-header"><div><Button type="link" icon={<ArrowLeftOutlined />} onClick={() => navigate('/task-center')}>任务书工作台</Button><Title level={3}>{task.title}</Title><Text type="secondary">任务书 ID：{task.id}</Text></div><Space><Tag>{task.status}</Tag></Space></div>
    <div className="taskbook-summary"><Tag>{groups.length} 个物理对象</Tag><Tag>{groups.reduce((count, group) => count + group.configurations.length, 0)} 个试验构型</Tag><Tag>{entries.length} 项具体试验</Tag><Tag>{sources.records} 次执行</Tag><Tag>{sources.files} 个 CSV</Tag><Tag>{sources.charts.length} 张图表</Tag><Tag>{sources.artifacts.length} 项专业成果</Tag></div>
    <Tabs activeKey={view} onChange={key => navigate(taskBookPath(taskId, key === 'trials' ? undefined : key))} items={[
      { key: 'progress', label: '任务进度', children: <TaskProgressView task={task} /> },
      { key: 'trials', label: '关联试验与成果', children: <>
        <div className="taskbook-toolbar"><Text type="secondary">按物理对象与试验构型汇总</Text><Space><Button onClick={() => setLinkOpen(true)}>关联已有试验</Button><Button type="primary" onClick={startTrial}>新建具体试验</Button></Space></div>
        <div className="physical-book-tests">{groups.length ? groups.map(group => <Card className="taskbook-object" key={group.object.id} title={group.object.name} extra={<Text type="secondary">{group.category.name}</Text>}>
          {group.configurations.map(({ configuration, entries: related }) => <section className="taskbook-configuration" key={configuration.id}><Title level={5}>{configuration.name}</Title>{related.map(entry => <Card className="taskbook-trial" size="small" key={entry.trial.id} title={entry.trial.name} extra={<Button type="link" onClick={() => openTrial(entry)}>管理具体试验</Button>}>
            <Text type="secondary">载荷谱：{entry.trial.loadSpectrum || '待补充'}</Text>
            {!entry.records.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚无执行记录" />}
            {entry.records.map(({ record, artifacts, charts }) => <div className="physical-task-record" key={record.id}><div><strong>{recordLabel(record)}</strong>
              <div className="taskbook-record-items"><Text type="secondary">CSV：</Text>{record.rawFiles.length ? record.rawFiles.map(file => <Tag key={file.id}>{file.name} · {file.rowCount} 行</Tag>) : <Text type="secondary">暂无</Text>}</div>
              <div className="taskbook-record-items"><Text type="secondary">图表与数据表：</Text>{[...charts, ...record.tables].map(item => <Tag key={item.id}>{item.name}</Tag>)}{!charts.length && !record.tables.length && <Text type="secondary">暂无</Text>}</div>
              {artifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Button type="link" onClick={() => openArtifact(artifact)}>{artifact.title}</Button><Tag>{artifactResultLabel(artifact)}</Tag></div>)}
            </div><Button type="link" onClick={() => openTrial(entry, record.id)}>查看同一记录与成果</Button></div>)}
          </Card>)}</section>)}
        </Card>) : <Empty description="尚未关联试验，可关联已有自主试验，也可在已有试验构型下发起试验。" />}</div>
      </> },
      { key: 'source', label: '任务书与资料', children: <Space direction="vertical" style={{ width: '100%' }}>
        <Card title="原始任务书" extra={<Space><Button onClick={() => setPdfOpen(true)}>查看任务书 PDF</Button><Button icon={<UploadOutlined />} loading={uploading} onClick={() => pdfInput.current?.click()}>{task.sourceName ? '更换 PDF' : '上传 PDF'}</Button></Space>}><Paragraph>{task.sourceName || '未上传任务书 PDF'}</Paragraph>{task.sourceText && <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{task.sourceText}</Paragraph>}</Card>
        <Card title="已关联资料与成果">{reportArtifacts.length ? reportArtifacts.map(artifact => <div key={`${artifact.projectId}/${artifact.id}`}><Button type="link" onClick={() => openArtifact(artifact)}>{artifact.title}</Button><Tag>{artifactResultLabel(artifact)}</Tag></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存的专业成果" />}</Card>
        {task.requirements.length > 0 && <Collapse items={[{ key: 'legacy', label: '历史任务事项（保留）', children: task.requirements.map(item => <Paragraph key={item.id}>{item.text} <Tag>{item.status}</Tag></Paragraph>) }]} />}
      </Space> },
      { key: 'report', label: '任务报告', children: <div className="task-report-sections">
        <Card title="当前报告资料"><Text>{entries.length} 项具体试验 · {sources.records} 次记录 · {sources.files} 个 CSV · {sources.charts.length} 张图表 · {sources.artifacts.length} 项专业成果</Text><div><Button type="link" onClick={() => navigate(taskBookPath(taskId))}>查看当前任务的试验与成果</Button><Button type="link" onClick={() => navigate(taskBookPath(taskId, 'source'))}>查看原始任务书</Button></div></Card>
        {task.reportDraft.sections.map(section => <Card size="small" key={section.id} title={section.title}><Input.TextArea aria-label={section.title} autoSize={{ minRows: 3, maxRows: 12 }} value={section.body} onChange={event => useTaskStore.getState().updateReportSection(taskId, section.id, event.target.value)} /><div>{section.artifactRefs.map(reference => <Tag key={`${reference.projectId}/${reference.artifactId}`}>{projects.find(project => project.id === reference.projectId)?.artifacts.find(artifact => artifact.id === reference.artifactId)?.title ?? `来源不可用：${reference.artifactId}`}</Tag>)}</div></Card>)}
        <div className="taskbook-toolbar"><Text type="secondary">正文自动保存在本机 · {new Date(task.reportDraft.updatedAt).toLocaleString('zh-CN')}</Text><Button type="primary" onClick={() => openReport()}>进入报告编制</Button></div>
        <Card title="已有任务报告">{taskReports.length ? taskReports.map(report => <div className="physical-list-row" key={report.id}><div><strong>{report.name}</strong> <Tag>{report.dataSource === 'demo' ? '历史演示报告' : report.status === 'generated' ? '已编制' : '草稿'}</Tag></div><Button onClick={() => openReport(report.id)}>查看 / 继续编辑</Button></div>) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未建立报告配置" />}</Card>
      </div> },
    ]} />
    <input ref={pdfInput} type="file" accept=".pdf,application/pdf" hidden onChange={choosePdf} />
    <Modal title="添加关联试验" open={linkOpen} onCancel={() => setLinkOpen(false)} footer={<Button onClick={() => setLinkOpen(false)}>关闭</Button>} destroyOnHidden>
      <Space direction="vertical" style={{ width: '100%' }}><Text strong>关联已有自主试验</Text><Select aria-label="选择尚未关联任务书的具体试验" style={{ width: '100%' }} value={targetTrial} options={autonomous.map(item => ({ value: item.trial.id, label: `${item.object.name} / ${item.configuration.name} / ${item.trial.name}` }))} onChange={setTargetTrial} /><Button disabled={!targetTrial} onClick={linkTrial}>关联已有试验</Button>
        </Space>
    </Modal>
    <Drawer title="原始任务书 PDF" open={pdfOpen} onClose={() => setPdfOpen(false)} size={760} destroyOnHidden>{pdf.loading ? <Spin /> : pdf.url ? <iframe title="原始任务书 PDF" src={pdf.url} style={{ width: '100%', height: 'calc(100vh - 160px)', border: 0 }} /> : <Empty description={pdf.error}><Button onClick={() => pdfInput.current?.click()}>选择 PDF</Button></Empty>}</Drawer>
  </div>;
}
