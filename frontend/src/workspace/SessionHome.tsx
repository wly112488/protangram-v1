import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import TaskCenter from './TaskCenter';
import TaskBookWorkspace from './TaskBookWorkspace';

const SessionHome: React.FC = () => {
  const location = useLocation();
  const taskId = new URLSearchParams(location.search).get('taskId');
  if (taskId) return <TaskBookWorkspace key={taskId} taskId={taskId} />;
  const openNewTask = new URLSearchParams(location.search).get('newTask') === '1';
  if (openNewTask) return <Navigate to="/task-book-analysis" replace />;
  return <div className="session-home"><div className="session-home-intro"><span className="session-eyebrow">PROTANGRAM WORKSPACE</span><h1>任务书</h1></div><TaskCenter /></div>;
};
export default SessionHome;
