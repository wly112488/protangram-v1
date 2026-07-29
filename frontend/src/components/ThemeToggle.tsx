import React from 'react';
import { Button, Tooltip } from 'antd';
import { SunOutlined, MoonOutlined } from '@ant-design/icons';
import useThemeStore from '@/stores/useThemeStore';

/**
 * 主题切换按钮组件
 * @description 提供亮色/深色主题切换功能，适用于工业仿真界面
 */
const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <Tooltip title={theme === 'light' ? '切换到深色模式' : '切换到亮色模式'}>
      <Button
        type="text"
        icon={theme === 'light' ? <MoonOutlined /> : <SunOutlined />}
        onClick={toggleTheme}
        className="theme-toggle-btn"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: 6,
          transition: 'all 0.3s ease',
        }}
      />
    </Tooltip>
  );
};

export default ThemeToggle;
