import React, { useState } from 'react';
import { Button, Drawer } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import ProjectContent from './ProjectContent';
import ProjectSidebar from './ProjectSidebar';
import { useProjectStore } from './projectStore';

const ProjectResourcesPage: React.FC = () => {
  const [open, setOpen] = useState(false);
  const projectId = useProjectStore(state => state.activeProjectId);
  return <div className="session-shared-resources">
    <div className="session-shared-resource-actions"><Button icon={<DatabaseOutlined />} onClick={() => setOpen(true)}>项目资源目录</Button></div>
    <ProjectContent />
    <Drawer className="session-resource-drawer" title="项目共享数据与成果" open={open} onClose={() => setOpen(false)} size={370}>
      <ProjectSidebar projectId={projectId ?? undefined} onNavigate={() => setOpen(false)} />
    </Drawer>
  </div>;
};
export default ProjectResourcesPage;
