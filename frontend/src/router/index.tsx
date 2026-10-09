import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import MainLayout from '@/layouts/MainLayout';

// 1.1 信息管理
import BOMManagement from '@/pages/experiment/info/BOMManagement';
import TestSubjects from '@/pages/experiment/info/TestSubjects';
import TestMethods from '@/pages/experiment/info/TestMethods';
import SamplingRequirements from '@/pages/experiment/info/SamplingRequirements';

// 1.2 试验设计
import ExperimentCreate from '@/pages/experiment/design/ExperimentCreate';
import OutlineDesign from '@/pages/experiment/design/OutlineDesign';
import IntelligentExperimentDesign, { ExperimentTaskResult } from '@/pages/experiment/design/IntelligentExperimentDesign';

// 2.1 模块管理
import ModuleManagement from '@/pages/analysis/modules/ModuleManagement';

// 2.2 模板管理
import TemplateList from '@/pages/analysis/templates/TemplateList';
import TemplateCreate from '@/pages/analysis/templates/TemplateCreate';

// 2.3 数据分析
import AnalysisProjects from '@/pages/analysis/projects/AnalysisProjects';
import AnalysisProjectCreate from '@/pages/analysis/projects/AnalysisProjectCreate';
import AnalysisExecution from '@/pages/analysis/projects/AnalysisExecution';
import DigitalTwin from '@/pages/analysis/DigitalTwin';
import VirtualConditionExtension from '@/pages/analysis/VirtualConditionExtension';

// 3 报告
import ReportTemplates from '@/pages/report/ReportTemplates';
import ReportList from '@/pages/report/ReportList';
import ReportCreate from '@/pages/report/ReportCreate';
import ReportGenerate from '@/pages/report/ReportGenerate';
import TaskWorkbench from '@/workspace/TaskWorkbench';
import ProjectContent from '@/workspace/ProjectContent';
import ProjectResourcesPage from '@/workspace/ProjectResourcesPage';
import SessionHome from '@/workspace/SessionHome';
import SessionWorkbench, { SessionEntryRedirect } from '@/workspace/SessionWorkbench';

/**
 * 应用路由配置
 * @description 定义所有页面路由，按模块组织
 */
const router = createBrowserRouter([
  {
    path: '/',
    element: <MainLayout />,
    children: [
      { index: true, element: <SessionHome /> },
      { path: 'task-center', element: <Navigate to="/" replace /> },
      { path: 'sessions/:sessionId', element: <SessionWorkbench />, children: [
        { index: true, element: <SessionEntryRedirect /> },
        { path: 'doe', element: <IntelligentExperimentDesign /> },
        { path: 'doe/result', element: <ExperimentTaskResult /> },
        { path: 'analysis', element: <AnalysisProjects /> },
        { path: 'digital-twin', element: <DigitalTwin /> },
        { path: 'virtual-condition', element: <VirtualConditionExtension /> },
        { path: 'report', element: <ReportCreate /> },
        { path: 'report/create', element: <ReportCreate /> },
        { path: 'report/create/:projectId', element: <ReportCreate /> },
        { path: 'report/list', element: <ReportList /> },
        { path: 'report/templates', element: <ReportTemplates /> },
        { path: 'report/generate/:reportId', element: <ReportGenerate /> },
        { path: 'resources', element: <ProjectContent /> },
        { path: 'tasks/:taskId', element: <TaskWorkbench /> },
        { path: 'experiment/info/bom', element: <BOMManagement /> },
        { path: 'experiment/info/subjects', element: <TestSubjects /> },
        { path: 'experiment/info/methods', element: <TestMethods /> },
        { path: 'experiment/info/sampling', element: <SamplingRequirements /> },
      ] },
      { path: 'projects', element: <ProjectResourcesPage /> },
      { path: 'tasks/:taskId', element: <TaskWorkbench /> },
      // 1.1 信息管理
      { path: 'experiment/info/bom', element: <BOMManagement /> },
      { path: 'experiment/info/subjects', element: <TestSubjects /> },
      { path: 'experiment/info/methods', element: <TestMethods /> },
      { path: 'experiment/info/sampling', element: <SamplingRequirements /> },
      // 1.2 试验设计
      { path: 'experiment/design', element: <Navigate to="/experiment/design/intelligent" replace /> },
      { path: 'experiment/design/create', element: <ExperimentCreate /> },
      { path: 'experiment/design/edit/:id', element: <ExperimentCreate /> },
      { path: 'experiment/design/outline/:id', element: <OutlineDesign /> },
      { path: 'experiment/design/intelligent', element: <IntelligentExperimentDesign /> },
      { path: 'experiment/tasks', element: <ExperimentTaskResult /> },
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
      { path: 'analysis/digital-twin', element: <DigitalTwin /> },
      { path: 'analysis/virtual-condition', element: <VirtualConditionExtension /> },
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
