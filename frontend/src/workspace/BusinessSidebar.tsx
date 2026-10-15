import React, { useEffect, useMemo, useState } from 'react';
import { Tree } from 'antd';
import { BookOutlined, HomeOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { taskBookPath } from './taskTrialModel';
import { physicalSourcePath, resolvePhysicalSource } from './physicalBusinessContext';
import { resolvePhysicalNavigation } from './physicalNavigation';

const expansionKey = 'protangram-physical-navigation-expanded';
// Legacy data may reuse an ID for a category and a device. Tree keys represent
// navigation locations, while the business IDs in links remain unchanged.
const categoryKey = (id: string) => JSON.stringify(['category', id]);
const objectKey = (categoryId: string, id: string) => JSON.stringify(['object', categoryId, id]);
const experimentKey = (categoryId: string, objectId: string, id: string) => JSON.stringify(['experiment', categoryId, objectId, id]);
function readExpansion(defaults: string[]): string[] {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(expansionKey) || 'null');
    return Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : defaults;
  } catch { return defaults; }
}

const BusinessSidebar: React.FC<{ mobileOpen: boolean; onNavigate: () => void }> = ({ mobileOpen, onNavigate }) => {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const sessionId = location.pathname.match(/^\/sessions\/([^/]+)/)?.[1];
  const session = useSessionStore(state => state.sessions.find(item => item.id === sessionId));
  const routeTaskId = location.pathname.match(/^\/tasks\/([^/]+)/)?.[1];
  const physicalTrial = resolvePhysicalSource(objects, session?.businessScope).trial;
  const selectedTask = query.get('taskId') || routeTaskId || (physicalTrial ? physicalTrial.taskBookId : session?.businessScope?.taskBookId) || session?.taskId;
  const sessionPath = physicalSourcePath(objects, session?.businessScope);
  const isPhysicalPage = location.pathname === '/' || location.pathname === '/physical-objects';
  const sourceQuery = isPhysicalPage ? query : new URLSearchParams(sessionPath?.split('?')[1]);
  const source = resolvePhysicalNavigation(objects, sourceQuery);
  const selectedKey = source.family && source.configuration ? source.experiment
    ? experimentKey(source.family.id, source.configuration.id, source.experiment.id)
    : objectKey(source.family.id, source.configuration.id) : undefined;
  const parentCategoryKey = source.family ? categoryKey(source.family.id) : undefined;
  const parentObjectKey = source.family && source.configuration ? objectKey(source.family.id, source.configuration.id) : undefined;
  const parents = [parentCategoryKey, parentObjectKey].filter((key): key is string => Boolean(key));
  const [expansion, setExpansion] = useState(() => ({ locationKey: location.key, keys: [...new Set([...readExpansion(objects.map(item => categoryKey(item.id))), ...parents])] }));
  // A new location reopens its ancestors. Manual collapse remains possible until
  // navigation changes, and unrelated branches retain the user's expansion state.
  const expandedKeys = useMemo(() => expansion.locationKey === location.key ? expansion.keys
    : [...new Set([...expansion.keys, ...[parentCategoryKey, parentObjectKey].filter((key): key is string => Boolean(key))])],
  [expansion, location.key, parentCategoryKey, parentObjectKey]);
  useEffect(() => {
    try { sessionStorage.setItem(expansionKey, JSON.stringify(expandedKeys)); } catch { /* Navigation still works when browser storage is unavailable. */ }
  }, [expandedKeys]);
  const expand = (keys: React.Key[]) => setExpansion({ locationKey: location.key, keys: keys.map(String) });
  const open = (path: string) => { navigate(path); onNavigate(); };
  const treeData = objects.map(object => ({
    key: categoryKey(object.id),
    selectable: false,
    title: <span className="business-category-title"><button type="button" className="business-category-toggle" aria-expanded={expandedKeys.includes(categoryKey(object.id))} onClick={event => {
      event.stopPropagation(); expand(expandedKeys.includes(categoryKey(object.id)) ? expandedKeys.filter(key => key !== categoryKey(object.id)) : [...expandedKeys, categoryKey(object.id)]);
    }}>{object.name}</button><button type="button" aria-label={`在${object.name}下新建具体物理对象`} title="新建具体物理对象" className="business-tree-add" onClick={event => {
      event.stopPropagation(); open(`/physical-objects?${new URLSearchParams({ objectId: object.id, create: 'configuration' })}`);
    }}><PlusOutlined /></button></span>,
    children: object.configurations.map(configuration => ({
      key: objectKey(object.id, configuration.id),
      title: configuration.name,
      children: configuration.experiments.map(experiment => ({ key: experimentKey(object.id, configuration.id, experiment.id), title: experiment.name })),
    })),
  }));
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="物理对象导航">
    <button className="session-brand" onClick={() => open('/physical-objects')}><span className="session-brand-mark">P</span><span>ProTangram<small>物理对象工作台</small></span></button>
    <div className="session-sidebar-scroll">
      <button className={`session-sidebar-link ${location.pathname === '/' || location.pathname.startsWith('/physical-objects') && !selectedTask ? 'is-active' : ''}`} onClick={() => open('/')}><TableOutlined />试验工作表</button>
      <button className={`session-sidebar-link ${location.pathname === '/task-center' || Boolean(routeTaskId) ? 'is-active' : ''}`} onClick={() => open('/task-center')}><HomeOutlined />任务书工作台</button>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>对象类别</span><button type="button" aria-label="新建对象类别" title="新建对象类别" className="business-tree-add" onClick={() => open('/physical-objects?create=family')}><PlusOutlined /></button></div>
        {objects.length ? <Tree className="business-object-tree" blockNode treeData={treeData} expandedKeys={expandedKeys} onExpand={expand} autoExpandParent={false} selectedKeys={selectedKey ? [selectedKey] : []} onSelect={keys => {
          const key = String(keys[0] ?? '');
          for (const category of objects) for (const configuration of category.configurations) {
            const experiment = configuration.experiments.find(item => experimentKey(category.id, configuration.id, item.id) === key);
            if (objectKey(category.id, configuration.id) !== key && !experiment) continue;
            const path = new URLSearchParams({ objectId: category.id, configurationId: configuration.id });
            if (experiment) path.set('experimentId', experiment.id);
            open(`/physical-objects?${path}`); return;
          }
        }} /> : <p className="session-nav-empty">暂无对象类别</p>}
      </section>
      <section className="session-nav-section session-nav-section--separated">
        <div className="session-section-label"><span>任务书</span></div>
        {tasks.length ? tasks.map(task => <button key={task.id} className={`session-sidebar-link business-task-link ${selectedTask === task.id ? 'is-active' : ''}`} onClick={() => open(taskBookPath(task.id))}><BookOutlined /><span>{task.title}</span></button>) : <p className="session-nav-empty">暂无任务书</p>}
      </section>
    </div>
  </aside>;
};
export default BusinessSidebar;
