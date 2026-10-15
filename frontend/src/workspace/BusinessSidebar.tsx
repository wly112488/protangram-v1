import React, { useState } from 'react';
import { Tree } from 'antd';
import { BookOutlined, HomeOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { resolvePhysicalSource } from './physicalBusinessContext';

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
  const physicalTrial = resolvePhysicalSource(objects, session?.businessScope).trial;
  const selectedTask = query.get('taskId') || routeTaskId || (physicalTrial ? physicalTrial.taskBookId : session?.businessScope?.taskBookId) || session?.taskId;
  const routeExperimentId = query.get('experimentId') || session?.businessScope?.experimentId;
  const [expansion, setExpansion] = useState<{ route: string; keys: string[] }>({ route: '', keys: [] });
  const routeObject = objects.find(item => item.id === selectedObject || item.configurations.some(config => config.id === selectedConfiguration || config.experiments.some(experiment => experiment.id === routeExperimentId)));
  const routeConfig = routeObject?.configurations.find(item => item.id === selectedConfiguration || item.experiments.some(experiment => experiment.id === routeExperimentId));
  const routeExpandedKeys = [routeObject && (selectedConfiguration || routeExperimentId || query.get('objectId') === routeObject.id) ? routeObject.id : '', routeConfig && routeExperimentId ? routeConfig.id : ''].filter(Boolean);
  const expansionRoute = `${selectedObject || ''}/${selectedConfiguration || ''}/${routeExperimentId || ''}`;
  const treeExpandedKeys = expansion.route === expansionRoute ? expansion.keys : [...new Set([...expansion.keys, ...routeExpandedKeys])];
  const open = (path: string) => { navigate(path); onNavigate(); };
  const treeData = objects.map(object => ({
    key: object.id,
    title: object.name,
    children: object.configurations.map(configuration => ({
      key: configuration.id,
      title: configuration.name,
      children: configuration.experiments.map(experiment => ({ key: experiment.id, title: experiment.name })),
    })),
  }));
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="物理对象导航">
    <button className="session-brand" onClick={() => open('/physical-objects')}><span className="session-brand-mark">P</span><span>ProTangram<small>物理对象工作台</small></span></button>
    <div className="session-sidebar-scroll">
      <button className={`session-sidebar-link ${location.pathname === '/' || location.pathname.startsWith('/physical-objects') && !selectedTask ? 'is-active' : ''}`} onClick={() => open('/')}><TableOutlined />试验工作表</button>
      <button className={`session-sidebar-link ${location.pathname === '/task-center' ? 'is-active' : ''}`} onClick={() => open('/task-center')}><HomeOutlined />任务书工作台</button>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>物理对象</span><button type="button" aria-label="新建物理对象" title="新建物理对象" className="business-tree-add" onClick={() => open('/physical-objects?create=family')}><PlusOutlined /></button></div>
        {objects.length ? <Tree className="business-object-tree" treeData={treeData} expandedKeys={treeExpandedKeys} autoExpandParent={false} onExpand={keys => setExpansion({ route: expansionRoute, keys: keys.map(String) })} selectedKeys={[routeExperimentId || query.get('configurationId') || query.get('objectId') || selectedConfiguration].filter((key): key is string => Boolean(key))} onSelect={keys => {
          const key = String(keys[0] ?? '');
          const owner = objects.find(item => item.id === key || item.configurations.some(configuration => configuration.id === key || configuration.experiments.some(experiment => experiment.id === key)));
          if (!owner) return;
          const configuration = owner.configurations.find(configuration => configuration.id === key);
          const targetConfig = configuration ?? owner.configurations.find(item => item.experiments.some(experiment => experiment.id === key));
          const experiment = targetConfig?.experiments.find(experiment => experiment.id === key);
          const path = new URLSearchParams({ objectId: owner.id });
          if (targetConfig) path.set('configurationId', targetConfig.id);
          if (experiment) path.set('experimentId', experiment.id);
          open(`/physical-objects?${path}`);
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
