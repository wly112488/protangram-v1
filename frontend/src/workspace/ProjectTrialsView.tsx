import { useMemo } from 'react';
import { Button, Empty, List, Space, Table, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { useTaskStore } from './taskStore';
import { getProjectTrialEntries, type ProjectTrialEntry } from './projectTrialModel';
import { getSessionPath } from './sessionModel';
import { projectWorkspacePath } from './sharedResourcesModel';

export default function ProjectTrialsView({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const cfgs = useTrialConfigurationStore(state => state.configurations);
  const tasks = useTaskStore(state => state.tasks);
  const project = projects.find(item => item.id === projectId);
  const entries = useMemo(() => getProjectTrialEntries(projectId, objects, projects, sessions), [projectId, objects, projects, sessions]);
  if (!project) return <Empty description="当前项目不存在或已不可用" />;
  const openTrial = (entry: ProjectTrialEntry, recordId?: string) => {
    const scope = { physicalObjectId: entry.object.id, physicalObjectName: entry.object.name,
      experimentId: entry.experiment.id, experimentName: entry.experiment.name, trialId: entry.trial.id,
      trialName: entry.trial.name, taskBookId: entry.trial.taskBookId,
      ...(entry.trial.cfgId ? { cfgId:entry.trial.cfgId } : {}),
      ...(recordId ? { testRecordId: recordId, testRecordName: entry.trial.records.find(item => item.id === recordId)?.name } : {}),
    };
    const id = useSessionStore.getState().ensureProjectSession(projectId, scope);
    navigate(getSessionPath(id, recordId ? 'analysis' : 'doe'));
  };
  return <div className="workspace-content-stack">
    <div className="workspace-content-heading"><Typography.Title level={3}>具体试验</Typography.Title><Space><Button onClick={() => navigate('/task-book-analysis?projectId=' + encodeURIComponent(projectId))}>分析任务书</Button><Button type="primary" onClick={() => navigate('/trials/new?projectId=' + encodeURIComponent(projectId))}>创建具体试验</Button></Space></div>
    <Table rowKey={entry => entry.trial.id} dataSource={entries} scroll={{ x: 800 }} pagination={{ defaultPageSize: 10 }} locale={{ emptyText: '当前项目还没有具体试验' }} columns={[
      { title: '试验名称', render: (_, entry) => <Button type="link" onClick={() => openTrial(entry)}>{entry.trial.name}</Button> },
      { title: '物理对象', render: (_, entry) => entry.object.name },
      { title: '试验构型', render: (_, entry) => entry.trial.cfgId ? cfgs.find(cfg=>cfg.id===entry.trial.cfgId)?.name ?? 'CFG 来源已失效' : entry.experiment.name },
      { title: '载荷谱', render: (_, entry) => entry.trial.loadSpectrum || '待补充' },
      { title: '任务书', render: (_, entry) => entry.trial.taskBookId ? tasks.find(task => task.id === entry.trial.taskBookId)?.title ?? '关联已失效' : '未关联' },
      { title: '执行次数', render: (_, entry) => entry.trial.records.length },
      { title: '操作', render: (_, entry) => <Space><Button onClick={() => openTrial(entry)}>打开试验</Button><Button onClick={() => navigate(projectWorkspacePath(projectId, 'resources', entry.trial.id))}>查看成果</Button></Space> },
    ]} expandable={{ expandedRowRender: entry => <List dataSource={entry.trial.records} locale={{ emptyText: '尚无执行记录；打开试验后，在数据分析中创建记录和导入 CSV。' }} renderItem={record => <List.Item actions={[<Button key="open" onClick={() => openTrial(entry, record.id)}>打开数据分析</Button>]}><List.Item.Meta title={`第 ${record.executionNumber} 次执行 · ${record.name}`} description={<Space wrap>{record.rawFiles.filter(file => file.status !== 'removed').map(file => <Tag key={file.id}>{file.name}</Tag>)}<Typography.Text type="secondary">{record.tables.length} 个派生数据表</Typography.Text></Space>} /></List.Item>} /> }} />
  </div>;
}
