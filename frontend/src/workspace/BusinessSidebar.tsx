import React, { useMemo } from 'react';
import { Tree } from 'antd';
import { BookOutlined, HomeOutlined, TableOutlined, ToolOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { physicalSourcePath } from './physicalBusinessContext';

const BusinessSidebar: React.FC<{ mobileOpen: boolean; onNavigate: () => void }> = ({ mobileOpen, onNavigate }) => {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const sessionId = location.pathname.match(/^\/sessions\/([^/]+)/)?.[1];
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  const routeTaskId = location.pathname.match(/^\/tasks\/([^/]+)/)?.[1];
  const selectedObject = query.get('objectId') || session?.businessScope?.physicalObjectId;
  const selectedConfiguration = query.get('configurationId') || selectedObject;
  const selectedTask = query.get('taskId') || routeTaskId || session?.businessScope?.taskBookId || session?.taskId;
  const treeData = useMemo(() => objects.map((object) => ({
    key: object.id,
    title: object.name,
    children: object.configurations.map(configuration => ({ key: configuration.id, title: configuration.name })),
  })), [objects]);
  const open = (path: string) => { navigate(path); onNavigate(); };
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="物理对象导航">
    <button className="session-brand" onClick={() => open('/physical-objects')}><span className="session-brand-mark">P</span><span>ProTangram<small>物理对象工作台</small></span></button>
    <div className="session-sidebar-scroll">
      <button className={`session-sidebar-link ${location.pathname === '/' || location.pathname.startsWith('/physical-objects') && !selectedTask ? 'is-active' : ''}`} onClick={() => open('/')}><TableOutlined />试验工作表</button>
      <button className={`session-sidebar-link ${location.pathname === '/task-center' ? 'is-active' : ''}`} onClick={() => open('/task-center')}><HomeOutlined />任务书工作台</button>
      <button className={`session-sidebar-link ${query.get('view') === 'tools' ? 'is-active' : ''}`} onClick={() => open(physicalSourcePath(objects, session?.businessScope, 'tools') ?? `/physical-objects?${new URLSearchParams({ ...Object.fromEntries(query), view: 'tools' })}`)}><ToolOutlined />专业功能</button>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>物理对象</span></div>
        {objects.length ? <Tree className="business-object-tree" treeData={treeData} selectedKeys={selectedConfiguration ? [selectedConfiguration] : []} defaultExpandAll onSelect={keys => {
          const key = String(keys[0] ?? '');
          const owner = objects.find(item => item.id === key || item.configurations.some(configuration => configuration.id === key));
          if (!owner) return;
          const configurationId = owner.configurations.some(configuration => configuration.id === key) ? key : owner.configurations[0]?.id;
          open(`/physical-objects?objectId=${encodeURIComponent(owner.id)}${configurationId ? `&configurationId=${encodeURIComponent(configurationId)}` : ''}`);
        }} /> : <p className="session-nav-empty">暂无物理对象</p>}
      </section>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>任务书</span></div>
        {tasks.length ? tasks.map(task => <button key={task.id} className={`session-sidebar-link business-task-link ${selectedTask === task.id ? 'is-active' : ''}`} onClick={() => open(`/physical-objects?taskId=${encodeURIComponent(task.id)}`)}><BookOutlined /><span>{task.title}</span></button>) : <p className="session-nav-empty">暂无任务书</p>}
      </section>
    </div>
  </aside>;
};
export default BusinessSidebar;
