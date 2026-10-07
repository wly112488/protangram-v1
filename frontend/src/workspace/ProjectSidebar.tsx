import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Popconfirm, Tooltip, Tree, Typography, message } from 'antd';
import { DeleteOutlined, FolderOpenOutlined, LockOutlined, SearchOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useNavigate } from 'react-router-dom';
import { buildProjectNavigation } from './projectModel';
import { filterProjectsBySearch } from './presentationModel';
import { useProjectStore } from './projectStore';
import type { ProjectView } from './types';
import { useTaskStore } from './taskStore';

const { Text } = Typography;

interface ProjectSidebarProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

const ProjectSidebar: React.FC<ProjectSidebarProps> = ({ mobileOpen = false, onNavigate }) => {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const tasks = useTaskStore((state) => state.tasks);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeView = useProjectStore((state) => state.activeView);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const deleteProject = useProjectStore((state) => state.deleteProject);

  const [search, setSearch] = useState('');

  const visibleProjects = useMemo(() => filterProjectsBySearch(projects, search), [projects, search]);
  const treeData = useMemo<DataNode[]>(() => visibleProjects.map((project) => {
    const linkedTask = tasks.find((task) => task.projectId === project.id);
    return {
      key: project.id,
      title: (
        <span className="workspace-project-title">
          <span className="workspace-project-title-main">
            <FolderOpenOutlined />{project.name}{linkedTask && <span className="workspace-project-task-marker">任务项目</span>}
          </span>
          {linkedTask ? (
            <Tooltip title={`此项目支撑正式任务“${linkedTask.title}”，暂不支持单独删除，以免任务失去数据与成果。`}>
              <span className="workspace-project-delete-disabled"><Button type="text" size="small" disabled icon={<LockOutlined />} aria-label={`项目${project.name}关联正式任务，不能单独删除`} /></span>
            </Tooltip>
          ) : (
            <Popconfirm
              title={`确认删除独立项目“${project.name}”？`}
              description="项目下已保存的工作表和专业成果也会一并删除。"
              okText="删除"
              cancelText="取消"
              okButtonProps={{ danger: true }}
              onConfirm={() => {
                deleteProject(project.id);
                message.success(`独立项目“${project.name}”已删除`);
                navigate('/projects');
                onNavigate?.();
              }}
            >
              <Button
                type="text"
                size="small"
                danger
                className="workspace-project-delete"
                icon={<DeleteOutlined />}
                aria-label={`删除独立项目${project.name}`}
                onClick={(event) => event.stopPropagation()}
              />
            </Popconfirm>
          )}
        </span>
      ),
      children: buildProjectNavigation(project).map((item) => ({
        key: item.key,
        title: item.title,
        isLeaf: true,
      })),
    };
  }), [deleteProject, navigate, tasks, visibleProjects]);

  const selectProjectView = (projectId: string, view: ProjectView) => {
    setActiveProject(projectId);
    setActiveView(view);
    navigate('/projects');
    onNavigate?.();
  };

  const handleTreeSelect = (keys: React.Key[]) => {
    const key = String(keys[0] ?? '');
    if (!key) return;
    if (!key.includes(':')) {
      selectProjectView(key, 'overview');
      return;
    }
    const [projectId, view] = key.split(':');
    selectProjectView(projectId, view as ProjectView);
  };

  return (
    <aside id="workspace-project-sidebar" className={`workspace-project-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
      <div className="workspace-project-sidebar-head">
        <div>
            <strong>项目数据与成果</strong>
            <Text type="secondary">{projects.length} 个空间 · 数据、工作表与专业结果</Text>
        </div>
      </div>

      <div className="workspace-project-search">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="搜索项目..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>

      <div className="workspace-project-tree">
        {treeData.length > 0 ? (
          <Tree
            key={visibleProjects.map((project) => project.id).join('|')}
            blockNode
            defaultExpandAll
            treeData={treeData}
            selectedKeys={activeProjectId ? [`${activeProjectId}:${activeView}`] : []}
            onSelect={handleTreeSelect}
          />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={projects.length === 0 ? '暂无项目' : '未找到项目'}
          />
        )}
      </div>

    </aside>
  );
};

export default ProjectSidebar;
