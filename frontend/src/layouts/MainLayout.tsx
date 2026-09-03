import React from 'react';
import { Avatar, Dropdown, Layout, Space, theme, Typography } from 'antd';
import {
  HomeOutlined,
  LogoutOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import ThemeToggle from '@/components/ThemeToggle';
import ExperimentWorkbench from '@/workbench/ExperimentWorkbench';
import TrialAIAssistant, { TrialAIAssistantProvider } from '@/components/TrialAIAssistant';

const { Header } = Layout;
const { Title, Text } = Typography;

const getPathLabel = (pathname: string): string => {
  if (pathname === '/') return '实验工作台';
  if (pathname.startsWith('/experiment')) return '试验管理';
  if (pathname.startsWith('/analysis')) return '数据分析';
  if (pathname.startsWith('/report')) return '报告生成';
  return '实验工作台';
};

const MainLayout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const userMenuItems = [
    { key: 'settings', icon: <SettingOutlined />, label: '系统设置' },
    { key: 'home', icon: <HomeOutlined />, label: '返回首页' },
    { type: 'divider' as const },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录' },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === 'home') navigate('/');
  };

  return (
    <Layout className="app-shell">
      <Header className="app-header">
        <div className="brand-mark">
          <svg width="20" height="20" viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
            <defs>
              <style>
                {`.tangram-line { fill: none; stroke: ${token.colorPrimary}; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }`}
                {`.tangram-circle { fill: none; stroke: ${token.colorPrimary}; stroke-width: 2; }`}
              </style>
            </defs>
            <rect x="10" y="10" width="80" height="80" className="tangram-line" rx="4" />
            <path d="M10 10 L50 50 L90 10" className="tangram-line" />
            <path d="M10 90 L50 50 L90 90" className="tangram-line" />
            <path d="M50 10 L50 90" className="tangram-line" />
            <path d="M10 50 L90 50" className="tangram-line" />
            <circle cx="25" cy="35" r="3" className="tangram-circle" />
            <circle cx="75" cy="35" r="3" className="tangram-circle" />
            <circle cx="25" cy="65" r="3" className="tangram-circle" />
            <circle cx="75" cy="65" r="3" className="tangram-circle" />
            <circle cx="40" cy="75" r="3" className="tangram-circle" />
            <circle cx="60" cy="75" r="3" className="tangram-circle" />
            <path d="M25 35 L40 35 L40 50" className="tangram-line" />
            <path d="M75 35 L60 35 L60 50" className="tangram-line" />
            <path d="M40 75 L50 75 L60 75" className="tangram-line" />
          </svg>
          <Title level={5}>TANGram</Title>
        </div>

        <div className="address-bar">
          <HomeOutlined className="address-home" onClick={() => navigate('/')} />
          <div className="address-separator" />
          <Text className="address-path">
            protangram:/{location.pathname === '/' ? 'workbench' : location.pathname}
          </Text>
          <Text type="secondary" className="address-module">{getPathLabel(location.pathname)}</Text>
        </div>

        <Space className="header-actions">
          <ThemeToggle />
          <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
            <Space className="user-menu">
              <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: token.colorPrimary }} />
              <Text>管理员</Text>
              <SettingOutlined />
            </Space>
          </Dropdown>
        </Space>
      </Header>

      <TrialAIAssistantProvider>
        <ExperimentWorkbench />
        <TrialAIAssistant />
      </TrialAIAssistantProvider>
    </Layout>
  );
};

export default MainLayout;
