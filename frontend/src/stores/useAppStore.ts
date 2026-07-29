import { create } from 'zustand';
import type {
  ExperimentCard,
  AnalysisTemplate,
  AnalysisProject,
  AnalysisReport,
  BOMNode,
  TestSubject,
  TestMethod,
  CalculationModule,
  ReportTemplate,
} from '@/types';

/**
 * 全局应用状态Store
 * @description 管理所有业务数据的集中式状态管理
 */
interface AppState {
  // ==================== 1.1 信息管理数据 ====================
  /** 装备BOM树 */
  bomTree: BOMNode[];
  setBomTree: (tree: BOMNode[]) => void;

  /** 试验科目树 */
  testSubjects: TestSubject[];
  setTestSubjects: (subjects: TestSubject[]) => void;

  /** 试验设计方法 */
  testMethods: TestMethod[];
  setTestMethods: (methods: TestMethod[]) => void;

  // ==================== 1.2 试验管理数据 ====================
  /** 试验卡片列表 */
  experiments: ExperimentCard[];
  setExperiments: (experiments: ExperimentCard[]) => void;
  addExperiment: (experiment: ExperimentCard) => void;
  updateExperiment: (id: string, data: Partial<ExperimentCard>) => void;
  deleteExperiment: (id: string) => void;

  // ==================== 2.1 模块管理数据 ====================
  /** 计算模块配置 */
  calculationModules: CalculationModule[];
  setCalculationModules: (modules: CalculationModule[]) => void;

  // ==================== 2.2 模板管理数据 ====================
  /** 数据分析模板列表 */
  analysisTemplates: AnalysisTemplate[];
  setAnalysisTemplates: (templates: AnalysisTemplate[]) => void;
  addAnalysisTemplate: (template: AnalysisTemplate) => void;
  updateAnalysisTemplate: (id: string, data: Partial<AnalysisTemplate>) => void;
  deleteAnalysisTemplate: (id: string) => void;

  // ==================== 2.3 数据分析数据 ====================
  /** 数据分析项目列表 */
  analysisProjects: AnalysisProject[];
  setAnalysisProjects: (projects: AnalysisProject[]) => void;
  addAnalysisProject: (project: AnalysisProject) => void;
  updateAnalysisProject: (id: string, data: Partial<AnalysisProject>) => void;

  // ==================== 3 报告管理数据 ====================
  /** 报告模板列表 */
  reportTemplates: ReportTemplate[];
  setReportTemplates: (templates: ReportTemplate[]) => void;

  /** 分析报告列表 */
  analysisReports: AnalysisReport[];
  setAnalysisReports: (reports: AnalysisReport[]) => void;
  addAnalysisReport: (report: AnalysisReport) => void;
  updateAnalysisReport: (id: string, data: Partial<AnalysisReport>) => void;
}

const useAppStore = create<AppState>((set) => ({
  // ==================== 1.1 信息管理 ====================
  bomTree: [],
  setBomTree: (tree) => set({ bomTree: tree }),

  testSubjects: [],
  setTestSubjects: (subjects) => set({ testSubjects: subjects }),

  testMethods: [],
  setTestMethods: (methods) => set({ testMethods: methods }),

  // ==================== 1.2 试验管理 ====================
  experiments: [],
  setExperiments: (experiments) => set({ experiments }),
  addExperiment: (experiment) =>
    set((state) => ({ experiments: [...state.experiments, experiment] })),
  updateExperiment: (id, data) =>
    set((state) => ({
      experiments: state.experiments.map((e) =>
        e.id === id ? { ...e, ...data } : e
      ),
    })),
  deleteExperiment: (id) =>
    set((state) => ({
      experiments: state.experiments.filter((e) => e.id !== id),
    })),

  // ==================== 2.1 模块管理 ====================
  calculationModules: [],
  setCalculationModules: (modules) => set({ calculationModules: modules }),

  // ==================== 2.2 模板管理 ====================
  analysisTemplates: [],
  setAnalysisTemplates: (templates) => set({ analysisTemplates: templates }),
  addAnalysisTemplate: (template) =>
    set((state) => ({
      analysisTemplates: [...state.analysisTemplates, template],
    })),
  updateAnalysisTemplate: (id, data) =>
    set((state) => ({
      analysisTemplates: state.analysisTemplates.map((t) =>
        t.id === id ? { ...t, ...data } : t
      ),
    })),
  deleteAnalysisTemplate: (id) =>
    set((state) => ({
      analysisTemplates: state.analysisTemplates.filter((t) => t.id !== id),
    })),

  // ==================== 2.3 数据分析 ====================
  analysisProjects: [],
  setAnalysisProjects: (projects) => set({ analysisProjects: projects }),
  addAnalysisProject: (project) =>
    set((state) => ({
      analysisProjects: [...state.analysisProjects, project],
    })),
  updateAnalysisProject: (id, data) =>
    set((state) => ({
      analysisProjects: state.analysisProjects.map((p) =>
        p.id === id ? { ...p, ...data } : p
      ),
    })),

  // ==================== 3 报告管理 ====================
  reportTemplates: [],
  setReportTemplates: (templates) => set({ reportTemplates: templates }),

  analysisReports: [],
  setAnalysisReports: (reports) => set({ analysisReports: reports }),
  addAnalysisReport: (report) =>
    set((state) => ({
      analysisReports: [...state.analysisReports, report],
    })),
  updateAnalysisReport: (id, data) =>
    set((state) => ({
      analysisReports: state.analysisReports.map((r) =>
        r.id === id ? { ...r, ...data } : r
      ),
    })),
}));

export default useAppStore;
