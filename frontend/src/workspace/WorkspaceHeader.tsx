import React, { useEffect, useState } from 'react';
import { Avatar, Dropdown, Layout, Space, theme, Typography } from 'antd';
import { HomeOutlined, LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import FunctionBar from '@/workbench/FunctionBar';
import type { ResearchObject } from '@/workbench/EquipmentManagerWindow';
import comacLogo from '@/assets/comac_logo.png';
import { getHeaderActiveKey } from './presentationModel';
import './visualIntegrations.css';

const { Header } = Layout;
const { Text } = Typography;

interface WorkspaceHeaderProps {
  researchObjects: ResearchObject[];
  onResearchObjectsChange: (objects: ResearchObject[]) => void;
  projects: Array<{ id: string; name: string }>;
  onImportProject: (projectId: string) => void;
  onDesignGenerated: (designName: string) => void;
}

const sectionByLabel: Record<string, 'experiment' | 'doe' | 'analysis' | 'report'> = {
  试验管理: 'experiment',
  '试验设计（DOE）': 'doe',
  数据分析: 'analysis',
  报告生成: 'report',
};

const WorkspaceHeader: React.FC<WorkspaceHeaderProps> = ({
  researchObjects,
  onResearchObjectsChange,
  projects,
  onImportProject,
  onDesignGenerated,
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
