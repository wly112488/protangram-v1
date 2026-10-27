import React, { useState } from 'react';
import { Button, Card, Empty, Space, Typography } from 'antd';
import { ExperimentOutlined, FolderOpenOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { projectWorkspacePath } from './sharedResourcesModel';
import { SessionCreateDialog } from './SessionCreate';

const { Title, Text } = Typography;

const WorkbenchHome: React.FC = () => {
  const navigate = useNavigate();
  const [sessionCreateOpen, setSessionCreateOpen] = useState(false);
  const projects = useProjectStore(state => state.projects).filter(project => !project.sessionOwnerId);
  return <div className="session-home trial-workbench-home">
    <div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><Title>工作台</Title><Text type="secondary">从项目开展正式试验，或新建会话独立探索。</Text></div>
    <Space wrap className="trial-workbench-actions"><Button type="primary" size="large" onClick={() => setSessionCreateOpen(true)}>新建会话</Button><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/trials/new')}>创建独立试验</Button><Button size="large" icon={<FolderOpenOutlined />} onClick={() => navigate('/projects')}>进入项目</Button></Space>
    <div className="session-home-section-heading"><Title level={4}>项目</Title></div>
    {projects.length ? <div className="session-recent-grid">{projects.map(project => <Card key={project.id} hoverable onClick={() => navigate(projectWorkspacePath(project.id))}><Text strong>{project.name}</Text><div><Text type="secondary">{project.status}</Text></div></Card>)}</div> : <Empty description="从左侧创建项目，组织任务书、试验和共享成果" />}
    <div className="trial-workbench-footnote"><ExperimentOutlined /> 专业功能围绕试验构型开展，通用工具可直接处理数据。</div>
    <SessionCreateDialog open={sessionCreateOpen} onCancel={() => setSessionCreateOpen(false)} onCreated={() => setSessionCreateOpen(false)} />
  </div>;
};

export default WorkbenchHome;
