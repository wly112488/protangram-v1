import React from 'react';
import { Tag } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { getSessionResumePath } from './sessionModel';

const SessionHome: React.FC = () => {
  const navigate = useNavigate();
  const sessions = useSessionStore(state => state.sessions);
  const recent = sessions.filter(session => !session.archived).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
  return <div className="session-home">
    <div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><h1>工作台</h1><p>查看并继续最近的工作。需要开始新工作时，在左侧“最近会话”旁创建会话。</p></div>
    <section><div className="session-home-section-heading"><h2>继续最近的工作</h2><span>{recent.length} 个最近会话</span></div>{recent.length ? <div className="session-recent-grid">{recent.map(session => <button key={session.id} onClick={() => navigate(getSessionResumePath(session))}><strong>{session.title}</strong><span>{session.taskId ? <Tag>正式任务</Tag> : session.projectId ? <Tag>项目内会话</Tag> : <Tag>独立会话</Tag>}<small>{new Date(session.updatedAt).toLocaleDateString('zh-CN')}</small></span></button>)}</div> : <div className="session-home-empty">还没有会话。使用左侧“最近会话”旁的＋开始一项工作。</div>}</section>
  </div>;
};
export default SessionHome;
