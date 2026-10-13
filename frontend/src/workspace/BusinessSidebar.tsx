import React, { useMemo } from 'react';
import { Tree } from 'antd';
import { AppstoreOutlined, BookOutlined, HomeOutlined, ToolOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore, type PhysicalObject } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';

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
  const selectedTask = query.get('taskId') || routeTaskId || session?.businessScope?.taskBookId || session?.taskId;
  const treeData = useMemo(() => objects.map(function node(object: PhysicalObject): { key: string; title: string; children?: ReturnType<typeof node>[] } {
    return { key: object.id, title: object.name, children: object.children.map(node) };
  }), [objects]);
  const open = (path: string) => { navigate(path); onNavigate(); };
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="物理对象导航">
    <button className="session-brand" onClick={() => open('/physical-objects')}><span className="session-brand-mark">P</span><span>ProTangram<small>物理对象工作台</small></span></button>
    <div className="session-sidebar-scroll">
      <button className={`session-sidebar-link ${location.pathname === '/' || location.pathname.startsWith('/physical-objects') && !selectedTask ? 'is-active' : ''}`} onClick={() => open('/')}><AppstoreOutlined />物理对象与试验</button>
      <button className={`session-sidebar-link ${location.pathname === '/task-center' ? 'is-active' : ''}`} onClick={() => open('/task-center')}><HomeOutlined />任务书工作台</button>
      <button className={`session-sidebar-link ${query.get('view') === 'tools' ? 'is-active' : ''}`} onClick={() => open('/physical-objects?view=tools')}><ToolOutlined />专业功能</button>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>物理对象</span></div>
        {objects.length ? <Tree className="business-object-tree" treeData={treeData} selectedKeys={selectedObject ? [selectedObject] : []} defaultExpandAll onSelect={keys => keys[0] && open(`/physical-objects?objectId=${encodeURIComponent(String(keys[0]))}`)} /> : <p className="session-nav-empty">暂无物理对象</p>}
      </section>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>任务书</span></div>
        {tasks.length ? tasks.map(task => <button key={task.id} className={`session-sidebar-link business-task-link ${selectedTask === task.id ? 'is-active' : ''}`} onClick={() => open(`/physical-objects?taskId=${encodeURIComponent(task.id)}`)}><BookOutlined /><span>{task.title}</span></button>) : <p className="session-nav-empty">暂无任务书</p>}
      </section>
    </div>
  </aside>;
};
export default BusinessSidebar;
