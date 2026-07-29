import React, { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import ThemeProvider from './components/ThemeProvider';
import router from './router';
import useAppStore from '@/stores/useAppStore';
import { syncAllFromBackend } from '@/utils/storage';

/**
 * 应用根组件
 * @description 配置Ant Design中文语言包和路由，应用启动时从后端同步数据
 */
function App() {
  const { setExperiments, setAnalysisTemplates, setAnalysisProjects, setAnalysisReports } = useAppStore();

  useEffect(() => {
    syncAllFromBackend().then(({ experiments, templates, projects, reports }) => {
      if (experiments.length > 0) setExperiments(experiments);
      if (templates.length > 0) setAnalysisTemplates(templates);
      if (projects.length > 0) setAnalysisProjects(projects);
      if (reports.length > 0) setAnalysisReports(reports);
    }).catch((err) => {
      console.warn('后端数据同步失败，使用本地缓存:', err);
    });
  }, [setExperiments, setAnalysisTemplates, setAnalysisProjects, setAnalysisReports]);

  return (
    <ConfigProvider locale={zhCN}>
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    </ConfigProvider>
  );
}

export default App;
