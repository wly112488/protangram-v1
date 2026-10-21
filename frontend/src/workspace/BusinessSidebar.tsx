import React, { useMemo, useState } from 'react';
import { Button, Input, Modal, Tree, Typography } from 'antd';
import { BookOutlined, FolderOpenOutlined, HomeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { getSessionEntryPath, getSessionPath } from './sessionModel';
import { getRecentSessionsForHome, getSessionCreationSource, getSessionSidebarContent } from './sessionSidebarModel';
import { taskBookPath } from './taskTrialModel';
import comacLogo from '@/assets/comac_logo.png';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { buildPhysicalTreeModel, resolvePhysicalNavigation } from './physicalNavigation';

const { Text } = Typography;
const BusinessSidebar: React.FC<{ mobileOpen: boolean; onNavigate: () => void }> = ({ mobileOpen, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const projects = useProjectStore(state => state.projects);
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const createProject = useProjectStore(state => state.createProject);
  const sessions = useSessionStore(state => state.sessions);
  const tasks = useTaskStore(state => state.tasks);
  const objects = usePhysicalObjectStore(state => state.objects);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({ objects: true, recent: true, projects: true, tasks: true });
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const content = useMemo(() => getSessionSidebarContent(projects, sessions, tasks, search, false), [projects, sessions, tasks, search]);
  const visibleProjects = content.visibleProjects.filter(project => !search.trim() || project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())
    || sessions.some(session => !session.archived && session.projectId === project.id && session.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())));
  const recent = getRecentSessionsForHome(sessions).filter(item => item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const treeModel = useMemo(() => buildPhysicalTreeModel(objects), [objects]);
  const treeNodeByKey = new Map<string, (typeof treeModel)[number]>();
  const collectTreeNodes = (nodes: typeof treeModel) => nodes.forEach(node => { treeNodeByKey.set(node.key, node); collectTreeNodes(node.children); });
  collectTreeNodes(treeModel);
  const physicalSource = location.pathname === '/physical-objects' ? resolvePhysicalNavigation(objects, new URLSearchParams(location.search)) : undefined;
  const selectedTreeKey = physicalSource?.experiment
    ? JSON.stringify(['configuration', physicalSource.family?.id, physicalSource.configuration?.id, physicalSource.experiment.id])
    : physicalSource?.configuration ? JSON.stringify(['object', physicalSource.family?.id, physicalSource.configuration.id])
      : physicalSource?.family ? JSON.stringify(['category', physicalSource.family.id]) : undefined;
  const treeData = treeModel.map(category => ({
    key: category.key,
    title: <span className="physical-tree-node-title">{category.name}<button type="button" className="business-tree-add" aria-label={`在${category.name}下新建具体物理对象`} title="新建具体物理对象" onClick={event => {
      event.stopPropagation(); open(`/physical-objects?${new URLSearchParams({ objectId: category.id, create: 'configuration' })}`);
    }}><PlusOutlined /></button></span>,
    children: category.children.map(object => ({
      key: object.key,
      title: <span className="physical-tree-node-title">{object.name}<button type="button" className="business-tree-add" aria-label={`在${object.name}下新建试验构型`} title="新建试验构型" onClick={event => {
        event.stopPropagation(); open(`/physical-objects?${new URLSearchParams({ objectId: object.categoryId!, configurationId: object.id, create: 'experiment' })}`);
      }}><PlusOutlined /></button></span>,
      children: object.children.map(item => ({ key: item.key, title: item.name })),
    })),
  }));
  const open = (path: string) => { navigate(path); onNavigate(); };
  const startSession = () => {
    const sessionId = useSessionStore.getState().createSession({ title: '新会话' });
    useSessionStore.getState().openSession(sessionId, 'doe');
    open(getSessionPath(sessionId, 'doe'));
  };
  const selectTreeNode = (keys: React.Key[]) => {
    const node = treeNodeByKey.get(String(keys[0] ?? ''));
    if (!node) return;
    const query: Record<string, string> = node.kind === 'category' ? { objectId: node.id }
      : node.kind === 'object' ? { objectId: node.categoryId!, configurationId: node.id }
        : { objectId: node.categoryId!, configurationId: node.parentId!, experimentId: node.id };
    open(`/physical-objects?${new URLSearchParams(query)}`);
  };
  const saveProject = () => {
    if (!projectName.trim()) return;
    const id = createProject({ name: projectName.trim(), status: '进行中' });
    setActiveProject(id); setProjectName(''); setNewProjectOpen(false); open('/projects');
  };
  const workbenchActive = location.pathname === '/' || location.pathname === '/trials/new';
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="工作台导航">
    <div className="session-sidebar-scroll">
      <button type="button" className="session-brand" onClick={() => open('/')} aria-label="返回 ProTangram 工作台">
        <img className="session-brand-logo" src={comacLogo} alt="中国商飞 COMAC" />
        <span>实验敏捷迭代智能管理平台<small>ProTangram</small></span>
      </button>
      <Input className="business-nav-search" prefix={<SearchOutlined />} allowClear placeholder="搜索会话" aria-label="搜索会话、项目和正式任务" value={search} onChange={event => setSearch(event.target.value)} />
      <button className={`session-sidebar-link business-workbench-link ${workbenchActive ? 'is-active' : ''}`} onClick={() => open('/')}><HomeOutlined />工作台</button>

      <section className="session-nav-section session-nav-section--label-highlight business-object-nav">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, objects: !value.objects }))} aria-expanded={expanded.objects}>⌄ 物理对象</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建对象类别" title="新建对象类别" onClick={() => open('/physical-objects?create=family')} /></div>
        {expanded.objects && (treeData.length ? <Tree className="business-object-tree" blockNode defaultExpandAll treeData={treeData} selectedKeys={selectedTreeKey ? [selectedTreeKey] : []} onSelect={selectTreeNode} /> : <p className="session-nav-empty">暂无对象类别</p>)}
      </section>

      <section className="session-nav-section session-nav-section--label-highlight">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, recent: !value.recent }))} aria-expanded={expanded.recent}>⌄ 最近会话</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建会话" title="新建会话" onClick={startSession} /></div>
        {expanded.recent && (recent.length ? recent.slice(0, 8).map(session => <button key={session.id} className={`session-sidebar-link business-child-link ${location.pathname.includes(encodeURIComponent(session.id)) ? 'is-active' : ''}`} onClick={() => open(getSessionEntryPath(session))}><span>{session.title}</span></button>) : <p className="session-nav-empty">从一项工作开始</p>)}
      </section>

      <section className="session-nav-section session-nav-section--label-highlight">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, projects: !value.projects }))} aria-expanded={expanded.projects}>⌄ 项目</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建项目" title="新建项目" onClick={() => setNewProjectOpen(true)} /></div>
        {expanded.projects && (visibleProjects.length ? visibleProjects.map(project => {
          const children = sessions.filter(session => !session.archived && !session.taskId && getSessionCreationSource(session) === 'project' && session.projectId === project.id && session.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
          return <div className="business-project-group" key={project.id}>
            <div className="business-project-row"><button type="button" className="business-project-open" onClick={() => { setActiveProject(project.id); open('/projects'); }}><FolderOpenOutlined />{project.name}<Text type="secondary">{children.length}</Text></button><Button type="text" size="small" icon={<PlusOutlined />} aria-label={`在项目${project.name}中新建具体试验`} title="在此项目下创建具体试验" onClick={() => open(`/trials/new?projectId=${encodeURIComponent(project.id)}`)} /></div>
            {children.length ? children.map(session => <button key={session.id} className="session-sidebar-link business-child-link" onClick={() => open(getSessionEntryPath(session))}>{session.title}</button>) : <p className="session-nav-empty business-project-empty">还没有项目内会话</p>}
            <button className="session-sidebar-link business-child-link business-project-resources" onClick={() => { setActiveProject(project.id); open('/projects'); }}>项目共享数据与成果</button>
          </div>;
        }) : <p className="session-nav-empty">暂无项目</p>)}
      </section>

      <section className="session-nav-section session-nav-section--label-highlight">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, tasks: !value.tasks }))} aria-expanded={expanded.tasks}>⌄ 正式任务 <small>{content.visibleTasks.length}</small></button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建正式任务" title="新建正式任务" onClick={() => open('/task-center?newTask=1')} /></div>
        {expanded.tasks && (content.visibleTasks.length ? content.visibleTasks.map(task => <button key={task.id} className="session-sidebar-link business-task-link" onClick={() => open(taskBookPath(task.id))}><BookOutlined /><span>{task.title}</span></button>) : <p className="session-nav-empty">暂无正式任务</p>)}
      </section>
    </div>
    <Modal title="新建项目" open={newProjectOpen} onCancel={() => setNewProjectOpen(false)} onOk={saveProject} okText="创建" cancelText="取消">
      <Input autoFocus aria-label="项目名称" placeholder="项目名称" value={projectName} onChange={event => setProjectName(event.target.value)} onPressEnter={saveProject} />
    </Modal>
  </aside>;
};
export default BusinessSidebar;
