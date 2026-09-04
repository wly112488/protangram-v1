import React, { useMemo, useState } from 'react';
import { Button, Dropdown, Empty, Input, List, Modal, Tree, Typography, message } from 'antd';
import { FolderOpenOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import { useNavigate } from 'react-router-dom';
import { buildProjectNavigation, type LegacyGeneratedExperiment } from './projectModel';
import { filterProjectsBySearch } from './presentationModel';
import {
  LEGACY_EXPERIMENT_STORAGE_KEY,
  useProjectStore,
} from './projectStore';
import type { ProjectView } from './types';

const { Text } = Typography;

const loadLegacyExperiments = (): LegacyGeneratedExperiment[] => {
  try {
    const raw = localStorage.getItem(LEGACY_EXPERIMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as LegacyGeneratedExperiment[] : [];
  } catch {
    return [];
  }
};

const ProjectSidebar: React.FC = () => {
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeView = useProjectStore((state) => state.activeView);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const createProject = useProjectStore((state) => state.createProject);
  const importLegacyExperiment = useProjectStore((state) => state.importLegacyExperiment);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [projectName, setProjectName] = useState('');

  const visibleProjects = useMemo(() => filterProjectsBySearch(projects, search), [projects, search]);
  const importCandidates = useMemo(
    () => loadLegacyExperiments().filter((legacy) => !projects.some((project) => project.id === legacy.id)),
    [projects, importOpen],
  );

  const treeData = useMemo<DataNode[]>(() => visibleProjects.map((project) => ({
    key: project.id,
    title: <span className="workspace-project-title"><FolderOpenOutlined />{project.name}</span>,
    children: buildProjectNavigation(project).map((item) => ({
      key: item.key,
      title: item.title,
      isLeaf: true,
    })),
  })), [visibleProjects]);

  const selectProjectView = (projectId: string, view: ProjectView) => {
    setActiveProject(projectId);
    setActiveView(view);
    navigate('/');
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

  const handleCreate = () => {
    const name = projectName.trim();
    if (!name) {
      message.warning('请输入项目名称');
      return;
    }
    createProject({ name, status: '未开始' });
    setProjectName('');
    setCreateOpen(false);
    navigate('/');
  };

  return (
    <aside className="workspace-project-sidebar">
      <div className="workspace-project-sidebar-head">
        <div>
          <strong>项目</strong>
          <Text type="secondary">{projects.length} 个项目</Text>
        </div>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [
              { key: 'new', label: '新建项目' },
              { key: 'import', label: '导入已有项目' },
            ],
            onClick: ({ key }) => key === 'new' ? setCreateOpen(true) : setImportOpen(true),
          }}
        >
          <Button type="text" className="workspace-project-add" icon={<PlusOutlined />} aria-label="新建或导入项目" />
        </Dropdown>
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

      <Modal
        title="新建项目"
        open={createOpen}
        okText="创建"
        cancelText="取消"
        onOk={handleCreate}
        onCancel={() => setCreateOpen(false)}
      >
        <Input
          autoFocus
          placeholder="请输入项目名称"
          value={projectName}
          onChange={(event) => setProjectName(event.target.value)}
          onPressEnter={handleCreate}
        />
      </Modal>

      <Modal
        title="导入已有项目"
        open={importOpen}
        footer={null}
        onCancel={() => setImportOpen(false)}
      >
        {importCandidates.length > 0 ? (
          <List
            dataSource={importCandidates}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="import"
                    type="link"
                    onClick={() => {
                      importLegacyExperiment(item);
                      setImportOpen(false);
                      navigate('/');
                    }}
                  >
                    导入
                  </Button>,
                ]}
              >
                <List.Item.Meta title={item.name} description={item.designName || '历史项目'} />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有尚未导入的历史项目" />
        )}
      </Modal>
    </aside>
  );
};

export default ProjectSidebar;
