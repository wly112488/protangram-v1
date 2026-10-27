import { Button, Card, List, Space, Tag, Typography, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { getTaskTrials, getTaskTrialSources, taskBookPath } from './taskTrialModel';
import { getTaskProgress } from './taskAnalysisModel';
import './taskWorkspace.css';
import { assignLegacyTaskProject } from './taskTrialWorkflow';

export default function TaskCenter({projectId}: {projectId: string}) {
  const navigate = useNavigate();
  const allTasks = useTaskStore(state => state.tasks);
  const tasks = allTasks.filter(task => task.projectId === projectId);
  const objects = usePhysicalObjectStore(state => state.objects);
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const unassigned = allTasks.filter(task => !projects.some(project => project.id === task.projectId && !project.sessionOwnerId));
  return <div className="task-center-page task-center-embedded"><section className="task-center-section">
    <div className="session-home-section-heading"><h2>已有任务书</h2><Typography.Text type="secondary">{tasks.length} 项</Typography.Text></div>
    {!tasks.length ? <Card></Card> : <List className="task-center-list" grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }} dataSource={tasks} renderItem={task => {
      const sources = getTaskTrialSources(getTaskTrials(objects, projects, sessions, task.id));
      const progress = getTaskProgress(task);
      return <List.Item><Card className="task-center-card" title={task.title} extra={<Tag color={task.status === '已完成' ? 'success' : 'processing'}>{task.status}</Tag>} actions={[<Button key="open" type="link" onClick={() => navigate(taskBookPath(task.id, task.trialDrafts?.length ? 'progress' : undefined))}>打开任务书</Button>]}><Space direction="vertical"><Typography.Text type="secondary">{task.sourceName || '无附件'}</Typography.Text><Typography.Text>{progress.completed} / {progress.total} 项完成</Typography.Text><Typography.Text type="secondary">{sources.records} 次执行 · {sources.files} 个 CSV · {sources.artifacts.length} 项成果</Typography.Text></Space></Card></List.Item>;
    }} />}
    {unassigned.length > 0 && <Card style={{marginTop:16}}><List dataSource={unassigned} renderItem={task => <List.Item actions={[<Button key="assign" onClick={() => {try {assignLegacyTaskProject(task.id,projectId);message.success('原任务书已归入当前项目，原数据与成果保留');} catch(cause) { console.error(cause);message.error('归属修改失败');}}}>归入当前项目</Button>,<Button key="review" onClick={() => navigate(taskBookPath(task.id))}>查看原任务书</Button>]}>{task.title}</List.Item>} /></Card>}
  </section></div>;
}
