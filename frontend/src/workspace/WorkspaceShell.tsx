import React, { useEffect, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Button, Space, Tag, Typography } from 'antd';
import TrialAIAssistant from '@/components/TrialAIAssistant';
import type { ResearchObject } from '@/workbench/EquipmentManagerWindow';
import ProjectSidebar from './ProjectSidebar';
import WorkspaceHeader from './WorkspaceHeader';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { createTaskReturnPath } from './businessSessionModel';
import type { BusinessRouteState, WorkspaceSessionState } from '@/types/businessContext';
import './workspace.css';

const RESEARCH_OBJECT_STORAGE_KEY = 'protangram-research-objects';
const { Text } = Typography;

const loadResearchObjects = (): ResearchObject[] => {
  try {
    const raw = localStorage.getItem(RESEARCH_OBJECT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ResearchObject[] : [];
  } catch {
    return [];
  }
};

const saveResearchObjects = (objects: ResearchObject[]) => {
  localStorage.setItem(RESEARCH_OBJECT_STORAGE_KEY, JSON.stringify(objects));
};

const createPresetWorksheetData = (designName: string, projectIndex: number): Record<string, string> => ({
  '1-C1': 'Run',
  '1-C2': 'A',
  '1-C3': 'B',
  '1-C4': '响应',
  '2-C1': '1',
  '2-C2': '-1',
  '2-C3': '-1',
  '2-C4': '82.4',
  '3-C1': '2',
  '3-C2': '1',
  '3-C3': '-1',
  '3-C4': '86.1',
  '4-C1': '3',
  '4-C2': '-1',
  '4-C3': '1',
  '4-C4': '84.7',
  '5-C1': '4',
  '5-C2': '1',
  '5-C3': '1',
  '5-C4': '91.3',
  '7-C1': '方案',
  '7-C2': designName,
  '8-C1': '项目',
  '8-C2': `实验${projectIndex}`,
});

const createPresetDesignSummary = (designName: string): Record<string, unknown> => ({
  factorCount: 2,
  runCount: designName.includes('裂区') ? 16 : 8,
  blockCount: designName.includes('裂区') ? 2 : 1,
  wholePlotCount: designName.includes('裂区') ? 4 : 0,
  wholePlotRunCount: designName.includes('裂区') ? 4 : 0,
  wholePlotReplicateCount: 2,
  subPlotReplicateCount: designName.includes('裂区') ? 2 : 0,
  hardToChangeFactor: 'A',
  wholePlotGenerator: 'A',
  note: '所有项均不混杂。',
});

const WorkspaceShell: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const tasks = useTaskStore((state) => state.tasks);
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const addArtifact = useProjectStore((state) => state.addArtifact);
  const createProjectFromDesign = useProjectStore((state) => state.createProjectFromDesign);
  const [researchObjects, setResearchObjects] = useState<ResearchObject[]>(loadResearchObjects);
  const [projectNavOpen, setProjectNavOpen] = useState(false);
  const incomingSession = (location.state as BusinessRouteState | null)?.workspaceSession;
  const queryTaskId = new URLSearchParams(location.search).get('taskId');
  const queryTaskItemId = new URLSearchParams(location.search).get('taskItemId') ?? undefined;
  const activeTask = tasks.find((task) => task.id === (incomingSession?.mode === 'task' ? incomingSession.taskId : queryTaskId));
  const requestedTaskItemId = incomingSession?.mode === 'task' ? incomingSession.taskItemId ?? queryTaskItemId : queryTaskItemId;
  const isTaskSurface = location.pathname === '/' || location.pathname.startsWith('/tasks/');
  const activeTaskItem = activeTask?.requirements.find((item) => item.id === requestedTaskItemId);
  const navigationSession: WorkspaceSessionState = activeTask
    ? { mode: 'task', taskId: activeTask.id, targetProjectId: activeTask.projectId, taskItemId: activeTaskItem?.id }
    : incomingSession ?? (activeProjectId ? { mode: 'project', targetProjectId: activeProjectId } : { mode: 'standalone' });

  useEffect(() => {
    setProjectNavOpen(false);
  }, [location.pathname]);

  const handleResearchObjectsChange = (objects: ResearchObject[]) => {
    setResearchObjects(objects);
    saveResearchObjects(objects);
  };

  const handleDesignGenerated = (designName: string) => {
    if (navigationSession.mode === 'task') {
      const artifact = addArtifact(navigationSession.targetProjectId, {
        type: 'design',
        title: designName,
        source: '试验设计（DOE）',
        summary: `${designName} · 已从当前任务生成`,
        payload: { designSummary: createPresetDesignSummary(designName) },
      });
      if (artifact && navigationSession.taskItemId) {
        addArtifactToTaskItem(navigationSession.taskId, navigationSession.taskItemId, { projectId: artifact.projectId, artifactId: artifact.id });
      }
      navigate(createTaskReturnPath(navigationSession));
      return;
    }
    const projectIndex = projects.length + 1;
    createProjectFromDesign({
      name: `实验${projectIndex}`,
      designName,
      designSummary: createPresetDesignSummary(designName),
      worksheetData: createPresetWorksheetData(designName, projectIndex),
    });
    navigate('/projects');
  };

  const handleImportProject = (projectId: string) => {
    setActiveProject(projectId);
    navigate('/projects');
  };

  return (
    <div className="workspace-shell">
      <WorkspaceHeader
        researchObjects={researchObjects}
        onResearchObjectsChange={handleResearchObjectsChange}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        activeProjectId={activeProjectId}
        workspaceSession={navigationSession}
        workspaceTask={activeTask ? { id: activeTask.id, title: activeTask.title } : undefined}
        onImportProject={handleImportProject}
        onDesignGenerated={handleDesignGenerated}
        onToggleProjectNav={() => setProjectNavOpen((open) => !open)}
        projectNavOpen={projectNavOpen}
        showProjectNav={!isTaskSurface}
      />

      <div className={`workspace-shell-body ${isTaskSurface ? 'workspace-shell-body-task' : ''} ${projectNavOpen ? 'workspace-project-nav-open' : ''}`}>
        {!isTaskSurface && <ProjectSidebar mobileOpen={projectNavOpen} onNavigate={() => setProjectNavOpen(false)} />}
        {projectNavOpen && <button type="button" className="workspace-sidebar-backdrop" aria-label="关闭项目导航" onClick={() => setProjectNavOpen(false)} />}
        <main className="workspace-center">
          {activeTask && !location.pathname.startsWith('/tasks/') && (
            <div className="workspace-task-context">
              <div className="workspace-task-context-copy">
                <Tag color="blue">当前任务</Tag>
                <Text strong>{activeTask.title}</Text>
                {activeTaskItem && <Text type="secondary">当前事项：{activeTaskItem.text}</Text>}
              </div>
              <Button size="small" type="link" onClick={() => navigate(createTaskReturnPath(navigationSession))}>
                返回{activeTaskItem ? '当前事项' : '任务'}
              </Button>
            </div>
          )}
          <Outlet />
        </main>
        <TrialAIAssistant />
      </div>
    </div>
  );
};

export default WorkspaceShell;
