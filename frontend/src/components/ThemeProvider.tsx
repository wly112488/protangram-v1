import React, { useEffect } from 'react';
import { ConfigProvider, theme } from 'antd';
import useThemeStore from '@/stores/useThemeStore';

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * 主题提供者组件
 * @description 为整个应用提供主题配置，支持Ant Design组件的深色主题
 */
const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { theme: currentTheme } = useThemeStore();

  useEffect(() => {
    // 确保document上的data-theme属性与store状态同步
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  // Ant Design主题配置
  const antdThemeConfig = {
    algorithm: currentTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      // 工业仿真深色主题的定制化token
      ...(currentTheme === 'dark' && {
        colorPrimary: '#4096ff',
        colorBgContainer: '#1e2532',
        colorBgElevated: '#242b3d',
        colorBgLayout: '#0f1419',
        colorBorder: '#2a3441',
        colorBorderSecondary: '#1e2532',
        colorText: '#e6e8eb',
        colorTextSecondary: '#a8adb7',
        colorTextTertiary: '#6c7584',
        colorFill: '#1a1f2e',
        colorFillSecondary: '#161b26',
        colorFillTertiary: '#242b3d',
        colorFillQuaternary: '#2a3441',
        borderRadius: 8,
        borderRadiusLG: 12,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        boxShadowSecondary: '0 6px 16px rgba(0, 0, 0, 0.35)',
      }),
      // 亮色主题保持默认配置
      ...(currentTheme === 'light' && {
        borderRadius: 8,
        borderRadiusLG: 12,
      }),
    },
    components: {
      // 针对特定组件的样式覆盖
      Layout: {
        ...(currentTheme === 'dark' && {
          bodyBg: '#0f1419',
          headerBg: '#161b26',
          siderBg: '#161b26',
        }),
      },
      Menu: {
        ...(currentTheme === 'dark' && {
          itemBg: 'transparent',
          itemSelectedBg: '#242b3d',
          itemHoverBg: '#1e2532',
          itemColor: '#a8adb7',
          itemSelectedColor: '#4096ff',
          itemHoverColor: '#4096ff',
        }),
      },
      Card: {
        ...(currentTheme === 'dark' && {
          headerBg: '#1e2532',
        }),
      },
      Button: {
        ...(currentTheme === 'dark' && {
          defaultBg: '#242b3d',
          defaultBorderColor: '#2a3441',
          defaultColor: '#e6e8eb',
        }),
      },
    },
  };

  return (
    <ConfigProvider theme={antdThemeConfig}>
      {children}
    </ConfigProvider>
  );
};

export default ThemeProvider;
