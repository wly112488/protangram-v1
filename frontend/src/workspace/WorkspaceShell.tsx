import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import TrialAIAssistant from '@/components/TrialAIAssistant';
import type { ResearchObject } from '@/workbench/EquipmentManagerWindow';
import ProjectContent from './ProjectContent';
import ProjectSidebar from './ProjectSidebar';
import WorkspaceHeader from './WorkspaceHeader';
import { useProjectStore } from './projectStore';

const RESEARCH_OBJECT_STORAGE_KEY = 'protangram-research-objects';

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
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const createProjectFromDesign = useProjectStore((state) => state.createProjectFromDesign);
  const [researchObjects, setResearchObjects] = useState<ResearchObject[]>(loadResearchObjects);

  const handleResearchObjectsChange = (objects: ResearchObject[]) => {
    setResearchObjects(objects);
    saveResearchObjects(objects);
  };

  const handleDesignGenerated = (designName: string) => {
    const projectIndex = projects.length + 1;
    createProjectFromDesign({
      name: `实验${projectIndex}`,
      designName,
      designSummary: createPresetDesignSummary(designName),
      worksheetData: createPresetWorksheetData(designName, projectIndex),
    });
    navigate('/');
  };

  const handleImportProject = (projectId: string) => {
    setActiveProject(projectId);
    navigate('/');
  };

  return (
    <div className="workspace-shell">
      <WorkspaceHeader
        researchObjects={researchObjects}
        onResearchObjectsChange={handleResearchObjectsChange}
        projects={projects.map((project) => ({ id: project.id, name: project.name }))}
        onImportProject={handleImportProject}
        onDesignGenerated={handleDesignGenerated}
      />

      <div className="workspace-shell-body">
        <ProjectSidebar />
        <main className="workspace-center">
          {location.pathname === '/' ? <ProjectContent /> : <Outlet />}
        </main>
        <TrialAIAssistant />
      </div>
    </div>
  );
};

export default WorkspaceShell;
