import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';

// 首页
import Home from '@/pages/Home';

// 1.1 信息管理
import BOMManagement from '@/pages/experiment/info/BOMManagement';
import TestSubjects from '@/pages/experiment/info/TestSubjects';
import TestMethods from '@/pages/experiment/info/TestMethods';
import SamplingRequirements from '@/pages/experiment/info/SamplingRequirements';

// 1.2 试验设计
import ExperimentDesign from '@/pages/experiment/design/ExperimentDesign';
import ExperimentCreate from '@/pages/experiment/design/ExperimentCreate';
import OutlineDesign from '@/pages/experiment/design/OutlineDesign';

// 2.1 模块管理
import ModuleManagement from '@/pages/analysis/modules/ModuleManagement';

// 2.2 模板管理
import TemplateList from '@/pages/analysis/templates/TemplateList';
import TemplateCreate from '@/pages/analysis/templates/TemplateCreate';

// 2.3 数据分析
import AnalysisProjects from '@/pages/analysis/projects/AnalysisProjects';
import AnalysisProjectCreate from '@/pages/analysis/projects/AnalysisProjectCreate';
import AnalysisExecution from '@/pages/analysis/projects/AnalysisExecution';

// 3 报告
import ReportTemplates from '@/pages/report/ReportTemplates';
import ReportList from '@/pages/report/ReportList';
import ReportCreate from '@/pages/report/ReportCreate';
import ReportGenerate from '@/pages/report/ReportGenerate';

/**
 * 应用路由配置
 * @description 定义所有页面路由，按模块组织
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <Home /> },
      // 1.1 信息管理
      { path: 'experiment/info/bom', element: <BOMManagement /> },
      { path: 'experiment/info/subjects', element: <TestSubjects /> },
      { path: 'experiment/info/methods', element: <TestMethods /> },
      { path: 'experiment/info/sampling', element: <SamplingRequirements /> },
      // 1.2 试验设计
      { path: 'experiment/design', element: <ExperimentDesign /> },
      { path: 'experiment/design/create', element: <ExperimentCreate /> },
      { path: 'experiment/design/edit/:id', element: <ExperimentCreate /> },
      { path: 'experiment/design/outline/:id', element: <OutlineDesign /> },
      // 2.1 模块管理
      { path: 'analysis/modules', element: <ModuleManagement /> },
      // 2.2 模板管理
      { path: 'analysis/templates', element: <TemplateList /> },
      { path: 'analysis/templates/create', element: <TemplateCreate /> },
      { path: 'analysis/templates/edit/:id', element: <TemplateCreate /> },
      // 2.3 数据分析
      { path: 'analysis/projects', element: <AnalysisProjects /> },
      { path: 'analysis/projects/create', element: <AnalysisProjectCreate /> },
      { path: 'analysis/projects/execute/:id', element: <AnalysisExecution /> },
      // 3 报告
      { path: 'report/templates', element: <ReportTemplates /> },
      { path: 'report/list', element: <ReportList /> },
      { path: 'report/create', element: <ReportCreate /> },
      { path: 'report/create/:projectId', element: <ReportCreate /> },
      { path: 'report/generate', element: <Navigate to="/report/list" replace /> },
      { path: 'report/generate/:reportId', element: <ReportGenerate /> },
    ],
  },
]);

export default router;
