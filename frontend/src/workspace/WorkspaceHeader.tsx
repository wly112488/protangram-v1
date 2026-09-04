import React from 'react';
import { Avatar, Dropdown, Layout, Space, theme, Typography } from 'antd';
import { HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import FunctionBar from '@/workbench/FunctionBar';
import type { ResearchObject } from '@/workbench/EquipmentManagerWindow';

const { Header } = Layout;
const { Text } = Typography;

interface WorkspaceHeaderProps {
  researchObjects: ResearchObject[];
  onResearchObjectsChange: (objects: ResearchObject[]) => void;
  projects: Array<{ id: string; name: string }>;
  onImportProject: (projectId: string) => void;
  onDesignGenerated: (designName: string) => void;
}

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  researchObjects,
  onResearchObjectsChange,
  projects,
  onImportProject,
  onDesignGenerated,
}) => {
  const navigate = useNavigate();
  const { token } = theme.useToken();

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { key: 'home', icon: <HomeOutlined />, label: '返回工作台' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  return (
    <Header className="workspace-header">
      <button type="button" className="workspace-brand" onClick={() => navigate('/')}>
        <svg width="30" height="30" viewBox="0 0 100 100" aria-hidden="true">
          <rect x="10" y="10" width="80" height="80" fill="none" stroke={token.colorPrimary} strokeWidth="4" rx="8" />
          <path d="M10 10 L50 50 L90 10 M10 90 L50 50 L90 90 M50 10 L50 90 M10 50 L90 50" fill="none" stroke={token.colorPrimary} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>
          <strong>实验敏捷迭代智能管理平台</strong>
          <small>ProTangram</small>
        </span>
      </button>

      <FunctionBar
        variant="header"
        researchObjects={researchObjects}
        onResearchObjectsChange={onResearchObjectsChange}
        experiments={projects}
        onImportExperiment={onImportProject}
        onAssociateObjectToExperiment={() => undefined}
        onMergeObjects={() => undefined}
        onDesignGenerated={onDesignGenerated}
      />

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
