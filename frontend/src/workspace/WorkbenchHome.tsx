import React from 'react';
import { Button, Card, Empty, Space, Typography } from 'antd';
import { ExperimentOutlined, FileSearchOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { getRecentSessionsForHome } from './sessionSidebarModel';
import { getSessionEntryPath, getSessionPath } from './sessionModel';

const { Title, Text } = Typography;

const WorkbenchHome: React.FC = () => {
  const navigate = useNavigate();
  const sessions = useSessionStore(state => state.sessions);
  const recent = getRecentSessionsForHome(sessions);
  return <div className="session-home trial-workbench-home">
    <div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><Title>工作台</Title><Text type="secondary">创建会话、开展试验，或继续最近的工作。</Text></div>
    <Space wrap className="trial-workbench-actions"><Button type="primary" size="large" onClick={()=>navigate(getSessionPath(useSessionStore.getState().createSession()))}>新建会话</Button><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/trials/new')}>创建独立试验</Button><Button size="large" icon={<FolderOpenOutlined />} onClick={() => navigate('/projects')}>进入项目</Button><Button size="large" icon={<FileSearchOutlined />} onClick={() => navigate('/task-book-analysis')}>分析任务书</Button></Space>
    <div className="session-home-section-heading"><Title level={4}>最近会话</Title></div>
    {recent.length ? <div className="session-recent-grid">{recent.map(session => <Card key={session.id} hoverable onClick={() => navigate(getSessionEntryPath(session))}><Text strong>{session.title}</Text><div><Text type="secondary">{new Date(session.updatedAt).toLocaleString('zh-CN')}</Text></div></Card>)}</div> : <Empty description="从一项工作开始" />}
    <div className="trial-workbench-footnote"><ExperimentOutlined /> 专业功能围绕试验构型开展，通用工具可直接处理数据。</div>
  </div>;
};

export default WorkbenchHome;
