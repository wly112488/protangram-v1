import React from 'react';
import { useLocation } from 'react-router-dom';
import TaskCenter from './TaskCenter';

const SessionHome: React.FC = () => {
  const location = useLocation();
  const openNewTask = new URLSearchParams(location.search).get('newTask') === '1';
  return <div className="session-home"><div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><h1>任务书</h1></div><TaskCenter openCreateOnMount={openNewTask} key={openNewTask ? 'new-task' : 'task-list'} /></div>;
};
export default SessionHome;
