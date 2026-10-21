import { Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { FileSearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { getTaskTrials, getTaskTrialSources, taskBookPath } from './taskTrialModel';
import { getTaskProgress } from './taskAnalysisModel';
import './taskWorkspace.css';

export default function TaskCenter() {
  const navigate = useNavigate();
  const tasks = useTaskStore(state => state.tasks);
  const objects = usePhysicalObjectStore(state => state.objects);
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  return <div className="task-center-page task-center-embedded"><section className="task-center-section">
    <div className="session-home-section-heading"><h2>任务书工作台</h2><Space><Typography.Text type="secondary">{tasks.length} 项</Typography.Text><Button icon={<FileSearchOutlined />} onClick={() => navigate('/task-book-analysis')}>分析任务书</Button></Space></div>
    {!tasks.length ? <Card><Empty description="导入任务书，复核试验模板后开展工作"><Button type="primary" onClick={() => navigate('/task-book-analysis')}>导入任务书</Button></Empty></Card> : <List className="task-center-list" grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }} dataSource={tasks} renderItem={task => {
      const sources = getTaskTrialSources(getTaskTrials(objects, projects, sessions, task.id));
      const progress = getTaskProgress(task);
      return <List.Item><Card className="task-center-card" title={task.title} extra={<Tag color={task.status === '已完成' ? 'success' : 'processing'}>{task.status}</Tag>} actions={[<Button key="open" type="link" onClick={() => navigate(taskBookPath(task.id, task.trialDrafts?.length ? 'progress' : undefined))}>打开任务书</Button>]}><Space direction="vertical"><Typography.Text type="secondary">{task.sourceName || '无附件'}</Typography.Text><Typography.Text>{progress.completed} / {progress.total} 项完成</Typography.Text><Typography.Text type="secondary">{sources.records} 次执行 · {sources.files} 个 CSV · {sources.artifacts.length} 项成果</Typography.Text></Space></Card></List.Item>;
    }} />}
  </section></div>;
}
