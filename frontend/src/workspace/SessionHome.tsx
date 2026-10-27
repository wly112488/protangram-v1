import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import TaskBookWorkspace from './TaskBookWorkspace';

const SessionHome: React.FC = () => {
  const location = useLocation();
  const taskId = new URLSearchParams(location.search).get('taskId');
  if (taskId) return <TaskBookWorkspace key={taskId} taskId={taskId} />;
  return <Navigate to="/projects?view=analysis" replace />;
};
export default SessionHome;
