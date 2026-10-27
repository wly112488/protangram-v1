import React, { useMemo, useState } from 'react';
import { Button, Input, Modal, Tree, Typography, type TreeDataNode } from 'antd';
import { FolderOpenOutlined, HomeOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { getProjectTrialEntries } from './projectTrialModel';
import { getSessionIdFromLocation, getSessionPath, getSessionResumePath } from './sessionModel';
import { getSessionSidebarContent } from './sessionSidebarModel';
import { taskBookPath } from './taskTrialModel';
import { projectWorkspacePath } from './sharedResourcesModel';
import comacLogo from '@/assets/comac_logo.png';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { buildPhysicalTreeModel, resolvePhysicalNavigation } from './physicalNavigation';
import { getEquipmentCategoryViews } from './equipmentTreeProjection';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { listCfgCategoryGroups } from './cfgCategoryModel';
import { SessionCreateDialog } from './SessionCreate';
import { buildProjectNavigation, type ProjectNavigationNode } from './projectNavigationModel';

const { Text } = Typography;
const BusinessSidebar: React.FC<{ mobileOpen: boolean; onNavigate: () => void }> = ({ mobileOpen, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const projects = useProjectStore(state => state.projects);
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const createProject = useProjectStore(state => state.createProject);
  const sessions = useSessionStore(state => state.sessions);
  const currentSessionId = getSessionIdFromLocation(location.pathname);
  const tasks = useTaskStore(state => state.tasks);
  const objects = usePhysicalObjectStore(state => state.objects);
  const cfgCategories = useTrialConfigurationStore(state => state.categories);
  const cfgs = useTrialConfigurationStore(state => state.configurations);
  const cfgGroups = listCfgCategoryGroups(cfgCategories, cfgs);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState({ objects: false, cfgs: true, projects: true });
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [sessionCreateOpen, setSessionCreateOpen] = useState(false);
  const [collapsedProjects, setCollapsedProjects] = useState<string[]>([]);
  const [projectName, setProjectName] = useState('');
  const visibleProjects = projects.filter(project => !project.sessionOwnerId && project.name.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  const { independentSessions } = getSessionSidebarContent(projects, sessions, tasks, search, false);
  const treeModel = useMemo(() => buildPhysicalTreeModel(objects), [objects]);
  const treeNodeByKey = new Map<string, (typeof treeModel)[number]>();
  const collectTreeNodes = (nodes: typeof treeModel) => nodes.forEach(node => { treeNodeByKey.set(node.key, node); collectTreeNodes(node.children); });
  collectTreeNodes(treeModel);
  const physicalSource = location.pathname === '/physical-objects' ? resolvePhysicalNavigation(objects, new URLSearchParams(location.search)) : undefined;
  const displayCategory = getEquipmentCategoryViews(objects).find(category => category.sourceCategoryIds.includes(physicalSource?.family?.id ?? ''));
  const selectedTreeKey = physicalSource?.configuration ? JSON.stringify(['object', physicalSource.family?.id, physicalSource.configuration.id])
      : displayCategory ? JSON.stringify(['category', displayCategory.id]) : undefined;
  const renderTreeNode=(node:(typeof treeModel)[number]):TreeDataNode=>({
    key:node.key,children:node.children.map(renderTreeNode),
    title:<span className="physical-tree-node-title">{node.name}<button type="button" className="business-tree-add"
      aria-label={node.kind==='category'?`在${node.name}下新建具体物理对象`:`在${node.name}下新增组成对象`}
      title={node.kind==='category'?'新建具体物理对象':'新增组成对象'} onClick={event=>{
        event.stopPropagation();open(`/physical-objects?${new URLSearchParams(node.kind==='category'?{objectId:node.id,create:'configuration'}:{objectId:node.categoryId!,configurationId:node.id,create:'component'})}`);
      }}><PlusOutlined /></button></span>,
  });
  const treeData=treeModel.map(renderTreeNode);
  const open = (path: string) => { navigate(path); onNavigate(); };
  const startSession = () => setSessionCreateOpen(true);
  const openTrial = (projectId: string, trialId: string) => {
    const entry = getProjectTrialEntries(projectId, objects, projects, sessions).find(item => item.trial.id === trialId);
    if (!entry) return;
    const id = useSessionStore.getState().ensureProjectSession(projectId, {physicalObjectId:entry.object.id, experimentId:entry.experiment.id, trialId, taskBookId:entry.trial.taskBookId});
    open(getSessionPath(id));
  };
  const selectTreeNode = (keys: React.Key[]) => {
    const node = treeNodeByKey.get(String(keys[0] ?? ''));
    if (!node) return;
    const query: Record<string, string> = node.kind === 'category' ? { objectId: node.id }
      : { objectId: node.categoryId!, configurationId: node.id };
    open(`/physical-objects?${new URLSearchParams(query)}`);
  };
  const projectTree = buildProjectNavigation(visibleProjects, sessions, objects, tasks);
  const projectNodes = new Map<string, ProjectNavigationNode>();
  const projectBranches: string[] = [];
  const currentSession = sessions.find(session => session.id === currentSessionId);
  const params = new URLSearchParams(location.search);
  const selectedProjectKeys: string[] = [];
  const renderProjectNode = (node: ProjectNavigationNode): TreeDataNode => {
    projectNodes.set(node.key, node);
    if (['project', 'trials', 'analysis'].includes(node.kind)) projectBranches.push(node.key);
    if (node.kind === 'trial' && currentSession?.businessScope?.trialId === node.targetId && currentSession?.projectId === node.projectId
      || node.kind === 'draft' && currentSessionId === node.targetId
      || node.kind === 'taskBook' && location.pathname === '/task-center' && params.get('taskId') === node.targetId
      || !currentSessionId && location.pathname === '/projects' && params.get('projectId') === node.projectId
        && node.kind === (params.get('view') === 'analysis' ? 'analysis' : 'trials')) selectedProjectKeys.push(node.key);
    return { key: node.key, isLeaf: !['project', 'trials', 'analysis'].includes(node.kind), children: node.children.map(renderProjectNode),
      title: <span className={`project-nav-title project-nav-title--${node.kind}`} title={node.name}
        data-project-id={node.kind === 'project' ? node.projectId : undefined}
        data-trial-id={node.kind === 'trial' ? node.targetId : undefined}
        data-project-draft-id={node.kind === 'draft' ? node.targetId : undefined}>
        <FolderOpenOutlined /><span className="project-nav-name">{node.name}</span>
        {node.count !== undefined && <span className="project-nav-count">{node.count}</span>}
      </span> };
  };
  // Build titles before Tree reads its controlled expansion and selection props.
  const projectTreeData = projectTree.map(renderProjectNode);
  const selectProjectNode = (node?: ProjectNavigationNode) => {
    if (!node) return;
    setActiveProject(node.projectId);
    if (node.kind === 'trial') openTrial(node.projectId, node.targetId!);
    else if (node.kind === 'draft') { const session = sessions.find(item => item.id === node.targetId); if (session) open(getSessionResumePath(session)); }
    else if (node.kind === 'taskBook') open(taskBookPath(node.targetId!));
    else open(projectWorkspacePath(node.projectId, node.kind === 'analysis' ? 'analysis' : 'trials'));
  };
  const saveProject = () => {
    if (!projectName.trim()) return;
    const id = createProject({ name: projectName.trim(), status: '进行中' });
    setActiveProject(id); setProjectName(''); setNewProjectOpen(false); open(projectWorkspacePath(id));
  };
  const workbenchActive = location.pathname === '/' || location.pathname === '/trials/new';
  return <aside className={`session-sidebar business-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="工作台导航">
    <div className="session-sidebar-scroll">
      <button type="button" className="session-brand" onClick={() => open('/')} aria-label="返回 ProTangram 工作台">
        <img className="session-brand-logo" src={comacLogo} alt="中国商飞 COMAC" />
        <span>实验敏捷迭代智能管理平台<small>ProTangram</small></span>
      </button>
      <Input className="business-nav-search" prefix={<SearchOutlined />} allowClear placeholder="搜索项目与会话" aria-label="搜索项目与会话" value={search} onChange={event => setSearch(event.target.value)} />
      <button className={`session-sidebar-link business-workbench-link ${workbenchActive ? 'is-active' : ''}`} onClick={() => open('/')}><HomeOutlined />工作台</button>
      <button className="session-sidebar-link" aria-label="新建会话" onClick={startSession}><PlusOutlined />新建会话</button>
      {independentSessions.length > 0 && <nav className="business-session-list" aria-label="独立会话">
        {independentSessions.map(session => <button key={session.id} type="button" data-session-id={session.id}
          className={`session-sidebar-link business-session-link ${currentSessionId === session.id ? 'is-active' : ''}`}
          aria-current={currentSessionId === session.id ? 'page' : undefined} title={session.title || '新会话'}
          onClick={() => open(getSessionResumePath(session))}>{session.title || '新会话'}</button>)}
      </nav>}

      <section className="session-nav-section session-nav-section--label-highlight">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, projects: !value.projects }))} aria-expanded={expanded.projects}>⌄ 项目</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建项目" title="新建项目" onClick={() => setNewProjectOpen(true)} /></div>
        {expanded.projects && <Tree className="business-project-tree" aria-label="项目树" blockNode
          treeData={projectTreeData} expandedKeys={projectBranches.filter(key => !collapsedProjects.includes(key))}
          onExpand={keys => setCollapsedProjects(projectBranches.filter(key => !keys.includes(key)))}
          selectedKeys={selectedProjectKeys} onSelect={(_keys, info) => selectProjectNode(projectNodes.get(String(info.node.key)))} />}
      </section>

      <section className="session-nav-section session-nav-section--label-highlight business-object-nav">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({ ...value, objects: !value.objects }))} aria-expanded={expanded.objects}>⌄ 物理对象</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建对象类别" title="新建对象类别" onClick={() => open('/physical-objects?create=family')} /></div>
        {expanded.objects && (treeData.length ? <Tree className="business-object-tree" blockNode defaultExpandAll treeData={treeData} selectedKeys={selectedTreeKey ? [selectedTreeKey] : []} onSelect={(_keys, info) => selectTreeNode([info.node.key])} /> : null)}
      </section>
      <section className="session-nav-section session-nav-section--label-highlight business-cfg-nav" aria-label="试验构型分类">
        <div className="session-section-label"><button type="button" onClick={() => setExpanded(value => ({...value,cfgs:!value.cfgs}))} aria-expanded={expanded.cfgs}>⌄ 试验构型 CFG</button><Button type="text" size="small" icon={<PlusOutlined />} aria-label="管理 CFG 分类" onClick={() => open('/trial-configurations')} /></div>
        {expanded.cfgs && cfgGroups.map(group => <div key={group.id}>
          <button className={`session-sidebar-link business-child-link ${location.pathname === '/trial-configurations' && new URLSearchParams(location.search).get('categoryId') === group.id ? 'is-active' : ''}`}
            onClick={() => open(`/trial-configurations?categoryId=${encodeURIComponent(group.id)}`)}>{group.name}<Text type="secondary"> {group.cfgIds.length}</Text></button>
          {cfgs.filter(cfg => group.cfgIds.includes(cfg.id)).map(cfg => <button key={cfg.id} className="session-sidebar-link business-child-link" onClick={() => open(`/trial-configurations?${new URLSearchParams({categoryId:group.id,cfgId:cfg.id})}`)}>{cfg.name}</button>)}
        </div>)}
      </section>
    </div>
    <Modal title="新建项目" open={newProjectOpen} onCancel={() => setNewProjectOpen(false)} onOk={saveProject} okText="创建" cancelText="取消">
      <Input autoFocus aria-label="项目名称" placeholder="项目名称" value={projectName} onChange={event => setProjectName(event.target.value)} onPressEnter={saveProject} />
    </Modal>
    <SessionCreateDialog open={sessionCreateOpen} onCancel={() => setSessionCreateOpen(false)} onCreated={() => setSessionCreateOpen(false)} />
  </aside>;
};
export default BusinessSidebar;
