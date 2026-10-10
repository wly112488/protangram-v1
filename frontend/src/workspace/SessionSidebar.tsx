import React, { useState } from 'react';
import { Alert, Button, Card, Input, Modal, Radio, Select, Tooltip, Typography } from 'antd';
import { DeleteOutlined, EditOutlined, HomeOutlined, InboxOutlined, PlusOutlined, PushpinOutlined, RightOutlined, SearchOutlined, UndoOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { getProjectDeletionBlock, getSessionPath, getSessionResumePath, type WorkSession } from './sessionModel';
import { getSessionSidebarContent, getTaskNavigationSession } from './sessionSidebarModel';
import type { Project } from './types';
import { createDoeTemplateSessionDraft, loadDoeTemplates, type DoeTemplate } from './experimentTemplateModel';

const isArchivedProject = (project: Project) => project.archived ?? project.status === '已归档';
const { Text } = Typography;

const SessionSidebar: React.FC<{ activeId?: string | null; onNavigate: () => void; mobileOpen: boolean }> = ({ activeId, onNavigate, mobileOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const sessions = useSessionStore(state => state.sessions);
  const projects = useProjectStore(state => state.projects);
  const activeProjectId = useProjectStore(state => state.activeProjectId);
  const tasks = useTaskStore(state => state.tasks);
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);
  const [createExperimentOpen, setCreateExperimentOpen] = useState(false);
  const [createProjectId, setCreateProjectId] = useState<string | undefined>();
  const [createMode, setCreateMode] = useState<'blank' | 'template'>('blank');
  const [doeTemplates, setDoeTemplates] = useState<DoeTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [projectName, setProjectName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ kind: 'session' | 'project'; id: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [sectionExpanded, setSectionExpanded] = useState({ pinned: true, recent: true, projects: true, tasks: true });
  const { visibleProjects: allGroups, visibleSessions: sorted, independentSessions: independent, visibleTasks } =
    getSessionSidebarContent(projects, sessions, tasks, search, showArchived);
  const matchesSearch = (session: WorkSession) => session.title.toLowerCase().includes(search.trim().toLowerCase());
  const toggleSection = (key: keyof typeof sectionExpanded) => setSectionExpanded(previous => ({ ...previous, [key]: !previous[key] }));
  const groups = allGroups.filter(project => showArchived
    ? isArchivedProject(project) || sessions.some(session => session.projectId === project.id && session.archived && matchesSearch(session))
    : !isArchivedProject(project));
  const open = (path: string) => { navigate(path); onNavigate(); };
  const create = (projectId?: string) => {
    const templates = loadDoeTemplates();
    setDoeTemplates(templates);
    setSelectedTemplateId(templates[0]?.id ?? '');
    setCreateProjectId(projectId);
    setCreateMode('blank');
    setCreateExperimentOpen(true);
  };
  const confirmCreateExperiment = () => {
    const template = createMode === 'template' ? doeTemplates.find((item) => item.id === selectedTemplateId) : undefined;
    if (createMode === 'template' && !template) return;
    const id = useSessionStore.getState().createSession({
      title: template ? `${template.name}（新实验）` : '新实验',
      projectId: createProjectId,
      ...(template ? { initialDrafts: createDoeTemplateSessionDraft(template) } : {}),
    });
    setCreateExperimentOpen(false);
    open(getSessionPath(id, 'doe'));
  };
  const rename = (kind: 'session' | 'project', id: string, value: string) => { setRenameTarget({ kind, id }); setRenameValue(value); };
  const saveRename = () => {
    if (!renameTarget || !renameValue.trim()) return;
    if (renameTarget.kind === 'project') useProjectStore.getState().renameProject(renameTarget.id, renameValue);
    else useSessionStore.getState().renameSession(renameTarget.id, renameValue);
    setRenameTarget(null);
  };
  const deleteSession = (session: WorkSession) => Modal.confirm({
    title: `删除会话“${session.title}”？`, content: '会话记录将删除，已生成的成果与报告引用会保留。', okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
    onOk: () => { useSessionStore.getState().deleteSession(session.id); if (activeId === session.id) open('/'); },
  });
  const deleteProject = (project: Project) => Modal.confirm({
    title: `删除项目“${project.name}”？`, content: `项目共享数据与成果及其下的 ${sessions.filter(session => session.projectId === project.id).length} 个会话将删除。`, okText: '删除', cancelText: '取消', okButtonProps: { danger: true },
    onOk: () => {
      const deletingCurrent = sessions.some(session => session.id === activeId && session.projectId === project.id)
        || location.pathname === '/projects' && useProjectStore.getState().activeProjectId === project.id;
      if (useSessionStore.getState().deleteProjectGroup(project.id) && deletingCurrent) open('/');
    },
  });
  const row = (session: WorkSession) => <div key={session.id} className={`session-nav-row ${activeId === session.id ? 'is-active' : ''}`}>
    <button className="session-nav-title" onClick={() => open(getSessionResumePath(session))} title={session.title} aria-current={activeId === session.id ? 'page' : undefined}>
      <span className="session-nav-dot" />{session.pinned && <PushpinOutlined className="session-pin-indicator" />}<span>{session.title}</span>
    </button>
    <div className="session-row-actions">
      <Tooltip title="重命名"><Button type="text" size="small" icon={<EditOutlined />} aria-label={`重命名会话${session.title}`} onClick={() => rename('session', session.id, session.title)} /></Tooltip>
      <Tooltip title={session.archived ? '恢复会话' : '归档'}><Button type="text" size="small" icon={session.archived ? <UndoOutlined /> : <InboxOutlined />} aria-label={`${session.archived ? '恢复' : '归档'}会话${session.title}`} onClick={() => useSessionStore.getState().archiveSession(session.id, !session.archived)} /></Tooltip>
      <Tooltip title="删除"><Button type="text" size="small" danger icon={<DeleteOutlined />} aria-label={`删除会话${session.title}`} onClick={() => deleteSession(session)} /></Tooltip>
    </div>
  </div>;
  return <aside className={`session-sidebar ${mobileOpen ? 'is-open' : ''}`} id="session-sidebar" aria-label="工作会话导航">
    <button className="session-brand" onClick={() => open('/')}><span className="session-brand-mark">P</span><span>ProTangram<small>专业研究工作台</small></span></button>
    <Input prefix={<SearchOutlined />} placeholder="搜索会话" aria-label="搜索会话" value={search} onChange={event => setSearch(event.target.value)} allowClear />
    <div className="session-sidebar-scroll">
      <button className={`session-sidebar-link ${location.pathname === '/' ? 'is-active' : ''}`} onClick={() => open('/')}><HomeOutlined />工作台</button>
      {!showArchived && independent.some(session => session.pinned) && <section className="session-nav-section session-nav-section--separated"><div className="session-section-label"><button className="session-section-toggle" aria-expanded={sectionExpanded.pinned} onClick={() => toggleSection('pinned')}><RightOutlined className={sectionExpanded.pinned ? 'is-expanded' : ''} /><span>置顶</span></button></div>{sectionExpanded.pinned && independent.filter(session => session.pinned).map(row)}</section>}
      <section className="session-nav-section session-nav-section--separated session-nav-section--label-highlight session-recent-list">
        <div className="session-section-label"><button className="session-section-toggle" aria-expanded={sectionExpanded.recent} onClick={() => toggleSection('recent')}><RightOutlined className={sectionExpanded.recent ? 'is-expanded' : ''} /><span>{showArchived ? '已归档会话' : '最近会话'}</span></button>{!showArchived && <Tooltip title="新建对话或实验"><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建对话或实验" onClick={() => create()} /></Tooltip>}</div>
        {sectionExpanded.recent && <>
          {independent.filter(session => showArchived || !session.pinned).slice(0, 30).map(row)}
          {independent.length === 0 && <p className="session-nav-empty">{search ? '没有匹配的独立会话' : showArchived ? '暂无归档会话' : '从一项工作开始'}</p>}
        </>}
      </section>
      <section className="session-nav-section session-nav-section--separated session-nav-section--label-highlight">
        <div className="session-section-label"><button className="session-section-toggle" aria-expanded={sectionExpanded.projects} onClick={() => toggleSection('projects')}><RightOutlined className={sectionExpanded.projects ? 'is-expanded' : ''} /><span>{showArchived ? '已归档项目与会话' : '项目'}</span></button>{!showArchived && <Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建项目" onClick={() => setProjectOpen(true)} />}</div>
        {sectionExpanded.projects && groups.map(project => {
          const archived = isArchivedProject(project);
          const children = sorted.filter(session => session.projectId === project.id && matchesSearch(session)
            && (showArchived && archived || session.archived === showArchived));
          const deletionBlock = getProjectDeletionBlock(project.id, sessions, tasks);
          return <div key={project.id} className="session-project-group">
            <div className="session-project-heading">
              <button title={project.name} onClick={() => setExpanded(previous => ({ ...previous, [project.id]: !(previous[project.id] ?? true) }))} aria-expanded={expanded[project.id] ?? true}><RightOutlined className={`session-tree-toggle ${expanded[project.id] ?? true ? 'is-expanded' : ''}`} /><span>{project.name}</span><small>{children.length}</small></button>
              <div className="session-row-actions">
                <Tooltip title="重命名"><Button type="text" size="small" icon={<EditOutlined />} aria-label={`重命名项目${project.name}`} onClick={() => rename('project', project.id, project.name)} /></Tooltip>
                <Tooltip title={archived ? '恢复项目' : '归档'}><Button type="text" size="small" icon={archived ? <UndoOutlined /> : <InboxOutlined />} aria-label={`${archived ? '恢复' : '归档'}项目${project.name}`} onClick={() => useProjectStore.getState().archiveProject(project.id, !archived)} /></Tooltip>
                <Tooltip title={deletionBlock ?? '删除'}><Button type="text" size="small" danger disabled={Boolean(deletionBlock)} icon={<DeleteOutlined />} aria-label={`删除项目${project.name}`} onClick={() => deleteProject(project)} /></Tooltip>
              </div>
              {!showArchived && <Button type="text" size="small" icon={<PlusOutlined />} aria-label={`在${project.name}中新建实验`} onClick={() => create(project.id)} />}
            </div>
            {(expanded[project.id] ?? true) && <div className="session-group-children">
              {children.map(row)}
              {!showArchived && children.length === 0 && <p className="session-group-empty">还没有项目内会话</p>}
              {!showArchived && <button className="session-group-resources" onClick={() => { useSessionStore.getState().openSession(null); useProjectStore.getState().setActiveProject(project.id); open('/projects'); }}>项目共享数据与成果</button>}
            </div>}
          </div>;
        })}
        {sectionExpanded.projects && groups.length === 0 && <p className="session-nav-empty">{showArchived ? '暂无归档项目' : '需要时再用项目归类会话'}</p>}
      </section>
      <section className="session-nav-section session-nav-section--separated session-nav-section--label-highlight">
        <div className="session-section-label">
          <button className="session-section-toggle" aria-expanded={sectionExpanded.tasks} onClick={() => toggleSection('tasks')}><RightOutlined className={sectionExpanded.tasks ? 'is-expanded' : ''} /><span>{showArchived ? '已归档正式任务' : '正式任务'} <small>{visibleTasks.length}</small></span></button>
          {!showArchived && <Tooltip title="在工作台中新建正式任务"><Button type="text" size="small" icon={<PlusOutlined />} aria-label="新建正式任务" onClick={() => open('/?newTask=1')} /></Tooltip>}
        </div>
        {sectionExpanded.tasks && visibleTasks.map(task => {
          const taskKey = `task:${task.id}`;
          const taskExpanded = expanded[taskKey] ?? true;
          const taskSession = getTaskNavigationSession(sessions, task.id);
          const taskWorkbenchActive = location.pathname === `/tasks/${task.id}` || location.pathname.endsWith(`/tasks/${task.id}`);
          const taskResultsActive = location.pathname === '/projects' && activeProjectId === task.projectId;
          return <div key={task.id} className="session-project-group">
            <div className="session-project-heading">
              <button title={task.title} onClick={() => setExpanded(previous => ({ ...previous, [taskKey]: !taskExpanded }))} aria-expanded={taskExpanded}>
                <RightOutlined className={`session-tree-toggle ${taskExpanded ? 'is-expanded' : ''}`} /><span>{task.title}</span><small>{task.status}</small>
              </button>
            </div>
            {taskExpanded && <div className="session-group-children">
              <button className={`session-group-resources session-group-task-link ${taskWorkbenchActive ? 'is-active' : ''}`} aria-current={taskWorkbenchActive ? 'page' : undefined} onClick={() => { useSessionStore.getState().openSession(null); open(`/tasks/${encodeURIComponent(task.id)}`); }}>任务工作台</button>
              {taskSession && <button className={`session-group-resources session-group-task-link ${activeId === taskSession.id ? 'is-active' : ''}`} aria-current={activeId === taskSession.id ? 'page' : undefined} onClick={() => open(getSessionResumePath(taskSession))}>专业会话：{taskSession.title}</button>}
              <button className={`session-group-resources session-group-task-link ${taskResultsActive ? 'is-active' : ''}`} aria-current={taskResultsActive ? 'page' : undefined} onClick={() => {
                useSessionStore.getState().openSession(null);
                useProjectStore.getState().setActiveProject(task.projectId);
                useProjectStore.getState().setActiveView('overview');
                open('/projects');
              }}>任务数据与成果</button>
            </div>}
          </div>;
        })}
        {sectionExpanded.tasks && visibleTasks.length === 0 && <p className="session-nav-empty">{search ? '没有匹配的正式任务' : showArchived ? '暂无归档任务' : '还没有正式任务'}</p>}
      </section>
    </div>
    <div className="session-sidebar-footer"><button className="session-sidebar-link" onClick={() => setShowArchived(!showArchived)}><InboxOutlined />{showArchived ? '返回最近会话' : '已归档'}</button></div>
    <Modal
      title="新建实验"
      open={createExperimentOpen}
      okText={createMode === 'template' ? '基于模板创建' : '全新创建'}
      cancelText="取消"
      okButtonProps={{ disabled: createMode === 'template' && !selectedTemplateId }}
      onCancel={() => setCreateExperimentOpen(false)}
      onOk={confirmCreateExperiment}
    >
      <Radio.Group value={createMode} onChange={(event) => setCreateMode(event.target.value)} style={{ width: '100%' }}>
        <Card size="small" hoverable onClick={() => setCreateMode('blank')} style={{ marginBottom: 10, borderColor: createMode === 'blank' ? '#3479e5' : undefined }}>
          <Radio value="blank">全新创建（从 0 到 1）</Radio>
          <Text type="secondary" style={{ display: 'block', margin: '4px 0 0 24px', fontSize: 12 }}>创建空白实验，从头配置并开展专业工作。</Text>
        </Card>
        <Card size="small" hoverable onClick={() => setCreateMode('template')} style={{ borderColor: createMode === 'template' ? '#3479e5' : undefined }}>
          <Radio value="template">基于模板创建（从 1 到 100）</Radio>
          <Text type="secondary" style={{ display: 'block', margin: '4px 0 10px 24px', fontSize: 12 }}>继承模板中的设计和配置，作为独立实验继续修改。</Text>
          {doeTemplates.length > 0 ? <Select
            aria-label="选择实验模板"
            value={selectedTemplateId || undefined}
            placeholder="选择 DOE 实验模板"
            disabled={createMode !== 'template'}
            style={{ width: '100%' }}
            options={doeTemplates.map((template) => ({
              value: template.id,
              label: `${template.name} · ${template.designMethod} · ${template.factorCount} 个因子`,
            }))}
            onChange={setSelectedTemplateId}
            onClick={(event) => event.stopPropagation()}
          /> : <Alert type="info" showIcon title="暂无 DOE 模板，可先全新创建并在设计配置中保存模板。" />}
        </Card>
      </Radio.Group>
    </Modal>
    <Modal title="新建项目" open={projectOpen} okText="创建项目" cancelText="取消" onCancel={() => setProjectOpen(false)} onOk={() => { if (!projectName.trim()) return; useProjectStore.getState().createProject({ name: projectName.trim(), description: '组织研究会话与共享成果' }); setProjectName(''); setProjectOpen(false); }}><Input placeholder="项目名称" aria-label="项目名称" value={projectName} onChange={event => setProjectName(event.target.value)} /></Modal>
    <Modal title={renameTarget?.kind === 'project' ? '重命名项目' : '重命名会话'} open={Boolean(renameTarget)} okText="保存" cancelText="取消" onCancel={() => setRenameTarget(null)} onOk={saveRename}><Input aria-label="名称" autoFocus value={renameValue} onChange={event => setRenameValue(event.target.value)} onPressEnter={saveRename} /></Modal>
  </aside>;
};
export default SessionSidebar;
