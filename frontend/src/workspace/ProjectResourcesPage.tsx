import React, { useState } from 'react';
import { Button, Drawer, Empty, List, Modal } from 'antd';
import { DatabaseOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ProjectContent from './ProjectContent';
import ProjectSidebar from './ProjectSidebar';
import { LEGACY_EXPERIMENT_STORAGE_KEY, useProjectStore } from './projectStore';
import type { LegacyGeneratedExperiment } from './projectModel';

const loadLegacyExperiments = (): LegacyGeneratedExperiment[] => {
  try {
    const raw = localStorage.getItem(LEGACY_EXPERIMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as LegacyGeneratedExperiment[] : [];
  } catch {
    return [];
  }
};

const ProjectResourcesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const projectId = useProjectStore(state => state.activeProjectId);
  const projects = useProjectStore(state => state.projects);
  const importLegacyExperiment = useProjectStore(state => state.importLegacyExperiment);
  const setActiveProject = useProjectStore(state => state.setActiveProject);
  const importCandidates = loadLegacyExperiments().filter(legacy => !projects.some(project => project.id === legacy.id));
  const isSessionResources = location.pathname.startsWith('/sessions/');
  return <div className="session-shared-resources">
    <p className="session-resource-description">这里只展示项目共享资源；各会话成果请在对应会话中查看。</p>
    <div className="session-shared-resource-actions">
      {!isSessionResources && <Button icon={<FolderOpenOutlined />} onClick={() => setImportOpen(true)}>导入旧版项目</Button>}
      <Button icon={<DatabaseOutlined />} onClick={() => setOpen(true)}>项目资源目录</Button>
    </div>
    <ProjectContent />
    <Drawer className="session-resource-drawer" title="项目共享数据与成果" open={open} onClose={() => setOpen(false)} size={370}>
      <ProjectSidebar projectId={projectId ?? undefined} onNavigate={() => setOpen(false)} />
    </Drawer>
    <Modal title="导入旧版试验项目" open={importOpen} footer={null} onCancel={() => setImportOpen(false)}>
      {importCandidates.length > 0 ? <List dataSource={importCandidates} renderItem={item => (
        <List.Item actions={[<Button key="import" type="link" onClick={() => {
          const importedProjectId = importLegacyExperiment(item);
          setActiveProject(importedProjectId);
          setImportOpen(false);
          navigate('/projects');
        }}>导入</Button>] }>
          <List.Item.Meta title={item.name} description={item.designName || '历史项目'} />
        </List.Item>
      )} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有尚未导入的旧版试验项目" />}
    </Modal>
  </div>;
};
export default ProjectResourcesPage;
