import React, { useEffect, useState } from 'react';
import { Avatar, Button, Dropdown, Layout, Space, theme, Typography } from 'antd';
import { FolderOpenOutlined, HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import FunctionBar from '@/workbench/FunctionBar';
import type { ResearchObject } from '@/workbench/EquipmentManagerWindow';
import comacLogo from '@/assets/comac_logo.png';
import { getHeaderActiveKey } from './presentationModel';
import type { WorkspaceSessionState } from '@/types/businessContext';
import './visualIntegrations.css';

const { Header } = Layout;
const { Text } = Typography;

interface WorkspaceHeaderProps {
  researchObjects: ResearchObject[];
  onResearchObjectsChange: (objects: ResearchObject[]) => void;
  projects: Array<{ id: string; name: string }>;
  activeProjectId: string | null;
  workspaceSession?: WorkspaceSessionState;
  workspaceTask?: { id: string; title: string };
  onImportProject: (projectId: string) => void;
  onDesignGenerated: (designName: string) => void;
  onToggleProjectNav: () => void;
  projectNavOpen: boolean;
  showProjectNav?: boolean;
}

const sectionByLabel: Record<string, 'taskCenter' | 'experiment' | 'doe' | 'analysis' | 'digitalTwin' | 'virtualCondition' | 'report'> = {
  任务中心: 'taskCenter',
  试验管理: 'experiment',
  试验设计: 'doe',
  试验数据分析: 'analysis',
  试验数字孪生: 'digitalTwin',
  虚拟工况扩展: 'virtualCondition',
  报告生成: 'report',
};

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  researchObjects,
  onResearchObjectsChange,
  projects,
  activeProjectId,
  workspaceSession,
  workspaceTask,
  onImportProject,
  onDesignGenerated,
  onToggleProjectNav,
  projectNavOpen,
  showProjectNav = true,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();
  const activeKey = getHeaderActiveKey(location.pathname);
  const [selectedSection, setSelectedSection] = useState(activeKey);

  useEffect(() => {
    setSelectedSection(activeKey);
  }, [activeKey]);

  const handleSectionClickCapture = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest<HTMLElement>('.layout-function-item');
    if (!button) return;
    const nextSection = sectionByLabel[button.textContent?.trim() ?? ''];
    if (nextSection) setSelectedSection(nextSection);
  };

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { key: 'home', icon: <HomeOutlined />, label: '返回工作台' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  return (
    <Header
      className={`workspace-header ${selectedSection ? `workspace-active-${selectedSection}` : ''}`}
      onClickCapture={handleSectionClickCapture}
    >
      {showProjectNav && <Button
        className="workspace-mobile-project-toggle"
        type="text"
        icon={<FolderOpenOutlined />}
        aria-label={projectNavOpen ? '关闭项目导航' : '打开项目导航'}
        aria-expanded={projectNavOpen}
        aria-controls="workspace-project-sidebar"
        onClick={onToggleProjectNav}
      />}
      <button type="button" className="workspace-brand" onClick={() => navigate('/')} aria-label="返回平台首页">
        <img className="workspace-brand-logo" src={comacLogo} alt="中国商飞 COMAC" />
        <span>
          <strong>实验敏捷迭代智能管理平台</strong>
          <small>ProTangram</small>
        </span>
      </button>

      <FunctionBar
        researchObjects={researchObjects}
        onResearchObjectsChange={onResearchObjectsChange}
        experiments={projects}
        activeProjectId={activeProjectId}
        workspaceSession={workspaceSession}
        onImportExperiment={onImportProject}
        onAssociateObjectToExperiment={() => undefined}
        onMergeObjects={() => undefined}
        onDesignGenerated={onDesignGenerated}
      />

      {workspaceTask && (
        <button
          type="button"
          className="workspace-current-task"
          onClick={() => navigate(`/tasks/${workspaceTask.id}`)}
          style={{ border: 0, background: 'transparent', color: token.colorPrimary, cursor: 'pointer', whiteSpace: 'nowrap' }}
        >
          <span className="workspace-current-task-title">当前任务：{workspaceTask.title} · </span>返回任务
        </button>
      )}

      <Space className="workspace-header-actions" size={12}>
        <ThemeToggle />
        <Dropdown
          menu={{
            items: userMenuItems,
            onClick: ({ key }) => {
              if (key === 'home') navigate('/');
            },
          }}
          placement="bottomRight"
        >
          <Space className="workspace-user-menu">
            <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
            <Text>管理员</Text>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  );
};

export default WorkspaceHeader;
