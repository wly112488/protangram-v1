import React from 'react';
import { Button, Card, Empty, Space, Typography } from 'antd';
import { ExperimentOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { getRecentSessionsForHome } from './sessionSidebarModel';
import { getSessionEntryPath } from './sessionModel';

const { Title, Text } = Typography;

const WorkbenchHome: React.FC = () => {
  const navigate = useNavigate();
  const sessions = useSessionStore(state => state.sessions);
  const recent = getRecentSessionsForHome(sessions);
  return <div className="session-home trial-workbench-home">
    <div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><Title>工作台</Title><Text type="secondary">从创建具体试验开始，或继续最近的工作。</Text></div>
    <Space wrap className="trial-workbench-actions"><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/trials/new')}>创建具体试验</Button><Button size="large" icon={<FolderOpenOutlined />} onClick={() => navigate('/physical-objects')}>浏览对象与已有试验</Button></Space>
    <div className="session-home-section-heading"><Title level={4}>最近会话</Title></div>
    {recent.length ? <div className="session-recent-grid">{recent.map(session => <Card key={session.id} hoverable onClick={() => navigate(getSessionEntryPath(session))}><Text strong>{session.title}</Text><div><Text type="secondary">{new Date(session.updatedAt).toLocaleString('zh-CN')}</Text></div></Card>)}</div> : <Empty description="从一项工作开始" />}
    <div className="trial-workbench-footnote"><ExperimentOutlined /> 五个专业功能会沿用当前试验与执行记录上下文。</div>
  </div>;
};

export default WorkbenchHome;
