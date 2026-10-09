import React from 'react';
import { Button, Tag } from 'antd';
import { ArrowRightOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { getSessionPath, getSessionResumePath, sessionCapabilities } from './sessionModel';

const SessionHome: React.FC = () => {
  const navigate = useNavigate();
  const sessions = useSessionStore(state => state.sessions);
  const recent = sessions.filter(session => !session.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  return <div className="session-home">
    <div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><h1>从一项工作开始</h1><p>直接开展试验与分析。每个会话保留自己的输入、进度与成果，项目按需组织。</p><Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate(getSessionPath(useSessionStore.getState().createSession()))}>新建工作会话</Button></div>
    <section><h2>选择专业能力</h2><div className="session-capability-cards">{sessionCapabilities.map((item, index) => <button key={item.key} onClick={() => navigate(getSessionPath(useSessionStore.getState().createSession({ title: `新${item.label}会话` }), item.key))}><span className="session-capability-number">0{index + 1}</span><strong>{item.label}</strong><p>{item.description}</p><ArrowRightOutlined /></button>)}</div></section>
    <section><div className="session-home-section-heading"><h2>继续最近的工作</h2><span>{recent.length} 个最近会话</span></div>{recent.length ? <div className="session-recent-grid">{recent.map(session => <button key={session.id} onClick={() => navigate(getSessionResumePath(session))}><strong>{session.title}</strong><span>{session.taskId ? <Tag>正式任务</Tag> : session.projectId ? <Tag>项目内会话</Tag> : <Tag>独立会话</Tag>}<small>{new Date(session.updatedAt).toLocaleDateString('zh-CN')}</small></span><ArrowRightOutlined /></button>)}</div> : <div className="session-home-empty">会话会自动保存在本机，之后可以从这里继续工作。</div>}</section>
  </div>;
};
export default SessionHome;
