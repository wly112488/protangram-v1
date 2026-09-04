import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  addArtifactToProject,
  migrateLegacyExperiments,
  removeArtifactFromProject,
  type LegacyGeneratedExperiment,
} from './projectModel';
import type {
  Project,
  ProjectArtifact,
  ProjectArtifactType,
  ProjectStatus,
  ProjectView,
  ProjectWorksheet,
} from './types';

export const WORKSPACE_STORAGE_KEY = 'protangram-project-workspace-v1';
export const LEGACY_EXPERIMENT_STORAGE_KEY = 'protangram-generated-experiments';

interface CreateProjectInput {
  id?: string;
  name: string;
  description?: string;
  status?: ProjectStatus;
  testObject?: string;
}

interface AddArtifactInput {
  id?: string;
  type: ProjectArtifactType;
  title: string;
  source: string;
  status?: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

interface CreateProjectFromDesignInput {
  name?: string;
  designName: string;
  designSummary: Record<string, unknown>;
  worksheetData: Record<string, string>;
}

interface ProjectWorkspaceState {
  projects: Project[];
  activeProjectId: string | null;
  activeView: ProjectView;
  setActiveProject: (projectId: string | null) => void;
  setActiveView: (view: ProjectView) => void;
  createProject: (input: CreateProjectInput) => string;
  createProjectFromDesign: (input: CreateProjectFromDesignInput) => string;
  importLegacyExperiment: (experiment: LegacyGeneratedExperiment) => string;
  setWorksheet: (projectId: string, worksheet: ProjectWorksheet) => void;
  addArtifact: (projectId: string, input: AddArtifactInput) => ProjectArtifact | null;
  removeArtifact: (projectId: string, artifactId: string) => void;
}

const newId = (prefix: string) => {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return `${prefix}-${uuid}`;
};

const getLegacyProjects = (): Project[] => {
  if (typeof window === 'undefined') return [];
  try {
    if (window.localStorage.getItem(WORKSPACE_STORAGE_KEY)) return [];
    const raw = window.localStorage.getItem(LEGACY_EXPERIMENT_STORAGE_KEY);
    if (!raw) return [];
    const legacy = JSON.parse(raw);
    if (!Array.isArray(legacy)) return [];
    return migrateLegacyExperiments(legacy);
  } catch {
    return [];
  }
};

const getWorksheetColumns = (worksheetData: Record<string, string>) => {
  const columns = new Set<string>();
  Object.keys(worksheetData).forEach((key) => {
    const separatorIndex = key.indexOf('-');
    if (separatorIndex >= 0) columns.add(key.slice(separatorIndex + 1));
  });
  return [...columns].sort((left, right) => Number(left.replace(/^C/, '')) - Number(right.replace(/^C/, '')));
};

const initialProjects = getLegacyProjects();

export const useProjectStore = create<ProjectWorkspaceState>()(
  persist(
    (set, get) => ({
      projects: initialProjects,
      activeProjectId: initialProjects[0]?.id ?? null,
      activeView: 'overview',

      setActiveProject: (projectId) => set((state) => ({
        activeProjectId: projectId && state.projects.some((project) => project.id === projectId) ? projectId : null,
        activeView: 'overview',
      })),

      setActiveView: (activeView) => set({ activeView }),

      createProject: (input) => {
        const now = new Date().toISOString();
        const id = input.id ?? newId('project');
        const project: Project = {
          id,
          name: input.name,
          description: input.description,
          status: input.status ?? '未开始',
          createdAt: now,
          updatedAt: now,
          basicInfo: { testObject: input.testObject },
          datasets: [],
          artifacts: [],
        };
        set((state) => ({
          projects: [...state.projects.filter((item) => item.id !== id), project],
          activeProjectId: id,
          activeView: 'overview',
        }));
        return id;
      },

      createProjectFromDesign: (input) => {
        const now = new Date().toISOString();
        const id = newId('project');
        const runCount = typeof input.designSummary.runCount === 'number' ? input.designSummary.runCount : undefined;
        const designArtifact: ProjectArtifact = {
          id: newId('design'),
          projectId: id,
          type: 'design',
          title: input.designName,
          source: '试验设计（DOE）',
          summary: runCount ? `${input.designName} · ${runCount} 次试验` : input.designName,
          payload: { designSummary: input.designSummary },
          createdAt: now,
          updatedAt: now,
        };
        const project: Project = {
          id,
          name: input.name ?? `实验${get().projects.length + 1}`,
          description: input.designName,
          status: '进行中',
          createdAt: now,
          updatedAt: now,
          basicInfo: {},
          worksheet: Object.keys(input.worksheetData).length > 0 ? {
            name: '试验工作表',
            columns: getWorksheetColumns(input.worksheetData),
            data: input.worksheetData,
          } : undefined,
          datasets: [],
          artifacts: [designArtifact],
        };
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: id,
          activeView: 'overview',
        }));
        return id;
      },

      importLegacyExperiment: (experiment) => {
        const existing = get().projects.find((project) => project.id === experiment.id);
        if (existing) {
          set({ activeProjectId: existing.id, activeView: 'overview' });
          return existing.id;
        }
        const [project] = migrateLegacyExperiments([experiment]);
        set((state) => ({
          projects: [...state.projects, project],
          activeProjectId: project.id,
          activeView: 'overview',
        }));
        return project.id;
      },

      setWorksheet: (projectId, worksheet) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId
          ? { ...project, worksheet, updatedAt: new Date().toISOString() }
          : project),
      })),

      addArtifact: (projectId, input) => {
        const project = get().projects.find((item) => item.id === projectId);
        if (!project) return null;
        const now = new Date().toISOString();
        const artifact: ProjectArtifact = {
          ...input,
          id: input.id ?? newId(input.type),
          projectId,
          createdAt: input.createdAt ?? now,
          updatedAt: input.updatedAt ?? now,
        };
        set((state) => ({
          projects: state.projects.map((item) => item.id === projectId ? addArtifactToProject(item, artifact) : item),
        }));
        return artifact;
      },

      removeArtifact: (projectId, artifactId) => set((state) => ({
        projects: state.projects.map((project) => project.id === projectId
          ? removeArtifactFromProject(project, artifactId)
          : project),
      })),
    }),
    {
      name: WORKSPACE_STORAGE_KEY,
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        activeView: state.activeView,
      }),
    },
  ),
);

export const getActiveProject = (state: Pick<ProjectWorkspaceState, 'projects' | 'activeProjectId'>) =>
  state.projects.find((project) => project.id === state.activeProjectId) ?? null;
