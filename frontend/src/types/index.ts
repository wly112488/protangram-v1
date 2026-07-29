/**
 * 装备BOM结构节点
 * @description 装备结构树的节点数据类型
 */
export interface BOMNode {
  /** 唯一标识 */
  key: string;
  /** 部件类别 */
  category: string;
  /** 部件名称 */
  title: string;
  /** 关联变量列表 */
  variables: string[];
  /** 子节点 */
  children?: BOMNode[];
}

/**
 * 响应变量
 * @description 从BOM关联信息提取的响应变量
 */
export interface ResponseVariable {
  /** 所属部件类别 */
  category: string;
  /** 所属部件名称 */
  component: string;
  /** 变量名 */
  variableName: string;
  /** 采集描述 */
  description?: string;
}

/**
 * 试验科目
 * @description 试验科目树节点
 */
export interface TestSubject {
  /** 唯一标识 */
  key: string;
  /** 试验大类 */
  category: string;
  /** 具体试验项 */
  title: string;
  /** 子节点 */
  children?: TestSubject[];
}

/**
 * 试验设计方法
 * @description 试验设计方法及其关联因子
 */
export interface TestMethod {
  /** 方法名称 */
  name: string;
  /** 关联的核心试验因子 */
  factors: string[];
  /** 方法说明 */
  description?: string;
}

/**
 * 采样要求行
 * @description 采样位置及数量
 */
export interface SamplingRequirement {
  /** 唯一标识 */
  id: string;
  /** 采样位置 */
  position: string;
  /** 采样数量 */
  quantity: number;
}

/**
 * 试验因子
 * @description 试验大纲中的因子设计
 */
export interface ExperimentFactor {
  /** 唯一标识 */
  id: string;
  /** 因子名称 */
  name: string;
  /** 水平1 */
  level1: string;
  /** 水平2 */
  level2: string;
  /** 量纲 */
  dimension: string;
  /** 测量方法 */
  measureMethod: string;
  /** 精度 */
  precision: string;
  /** 频率 */
  frequency: string;
  /** 区间范围 */
  range: string;
}

/**
 * 试验大纲
 * @description 试验大纲完整数据结构
 */
export interface ExperimentOutline {
  /** 试验方法 */
  method: string;
  /** 方法说明 */
  methodDescription?: string;
  /** 基本参数 */
  basicParams: {
    factorCount: number;
    centerPointCount: number;
    levelCount: number;
    blockCount: number;
  };
  /** 采样要求 */
  samplingRequirements: SamplingRequirement[];
  /** 试验因子列表 */
  factors: ExperimentFactor[];
  /** 响应变量列表 */
  responseVariables: OutlineResponseVariable[];
  /** 试验方案表 */
  testPlan: TestPlanRow[];
  /** 当前步骤 (0-4) */
  currentStep: number;
  /** 各步骤完成状态 */
  stepStatus: StepStatus[];
}

/**
 * 步骤状态
 */
export type StepStatus = 'pending' | 'active' | 'completed';

/**
 * 大纲中的响应变量
 */
export interface OutlineResponseVariable {
  /** 唯一标识 */
  id: string;
  /** 变量名称 */
  name: string;
  /** 采集要求描述 */
  description: string;
}

/**
 * 试验方案表行
 */
export interface TestPlanRow {
  /** 标准序 */
  stdOrder: number;
  /** 运行序 */
  runOrder: number;
  /** 中心点 */
  centerPoint: number;
  /** 区组 */
  block: number;
  /** 温度 */
  temperature: string;
  /** 时间 */
  time: string;
  /** 浓度 */
  concentration: string;
  /** 压强 */
  pressure: string;
  /** 振动 */
  vibration: string;
}

/**
 * 试验卡片
 * @description 试验项目的核心数据结构
 */
export interface ExperimentCard {
  /** 唯一标识 */
  id: string;
  /** 试验名称 */
  name: string;
  /** 创建时间 */
  createTime: string;
  /** 试验对象（装备结构树选中项的key列表） */
  testObjects: string[];
  /** 试验对象名称（展示用） */
  testObjectNames: string[];
  /** 试验科目（选中的试验科目key列表） */
  testSubjects: string[];
  /** 试验科目名称（展示用） */
  testSubjectNames: string[];
  /** 试验目标/目的 */
  testGoal: string;
  /** 试验方法 */
  testMethod: string;
  /** 试验对象描述 */
  objectDescription: string;
  /** 附件列表 */
  attachments: AttachmentInfo[];
  /** 试验大纲 */
  outline?: ExperimentOutline;
  /** 是否有大纲 */
  hasOutline: boolean;
}

/**
 * 附件信息
 */
export interface AttachmentInfo {
  /** 文件名 */
  fileName: string;
  /** 文件大小 */
  fileSize: number;
  /** 上传时间 */
  uploadTime: string;
  /** 文件内容（base64） */
  content?: string;
}

// ==================== 数据分析相关类型 ====================

/**
 * 数据模块类型
 */
export interface DataModule {
  /** 模块ID */
  id: string;
  /** 模块名称 */
  name: string;
  /** 使用说明 */
  description: string;
  /** 模块类型 */
  type: 'data' | 'calculation' | 'comparison' | 'chart';
}

/**
 * 计算算法定义
 */
export interface AlgorithmDef {
  /** 算法ID */
  alg_id: string;
  /** 算法名称 */
  alg_name: string;
  /** 用途说明 */
  purpose: string;
  /** WebService 配置 */
  webservice: {
    endpoint: string;
    method: string;
    timeout: number;
  };
  /** 输入参数 */
  input: {
    required: ParamDef[];
    optional: ParamDef[];
  };
  /** 输出参数 */
  output: ParamDef;
}

/**
 * 参数定义
 */
export interface ParamDef {
  param_name: string;
  param_type: string;
  param_desc: string;
  example?: unknown;
}

/**
 * 计算模块分组
 */
export interface CalculationModule {
  module_id: string;
  module_name: string;
  description: string;
  algorithms: AlgorithmDef[];
}

/**
 * 绘图模块类型
 */
export interface ChartModule {
  id: string;
  name: string;
  description: string;
  chartType: string;
  /** 图形样例图片路径 */
  sampleImage?: string;
}

/**
 * 数据分析模板
 */
export interface AnalysisTemplate {
  /** 唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 关联试验名称 */
  experimentName: string;
  /** 关联工况 */
  condition: string;
  /** 创建日期 */
  createDate: string;
  /** 画布节点数据 (React Flow) */
  nodes: CanvasNode[];
  /** 画布连线数据 (React Flow) */
  edges: CanvasEdge[];
}

/**
 * 画布节点
 */
export interface CanvasNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    moduleType: string;
    moduleId?: string;
    config?: Record<string, unknown>;
    [key: string]: unknown;
  };
}

/**
 * 画布连线
 */
export interface CanvasEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

/**
 * 数据分析项目
 */
export interface AnalysisProject {
  /** 唯一标识 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 关联试验卡片ID */
  experimentId: string;
  /** 关联试验卡片名称 */
  experimentName: string;
  /** 试验大纲摘要 */
  outlineSummary?: string;
  /** 数据分析模板ID */
  templateId: string;
  /** 数据分析模板名称 */
  templateName: string;
  /** 创建时间 */
  createTime: string;
  /** 执行状态 */
  status: 'draft' | 'running' | 'completed';
  /** 执行进度（已完成节点数） */
  completedNodes: string[];
  /** 输出变量列表 */
  outputVariables?: OutputVariable[];
}

/**
 * 输出变量
 */
export interface OutputVariable {
  id: string;
  name: string;
  value?: unknown;
  sourceNodeId: string;
}

// ==================== 报告相关类型 ====================

/**
 * 报告模板
 */
export interface ReportTemplate {
  /** 唯一标识 */
  id: string;
  /** 模板名称 */
  name: string;
  /** 模板说明 */
  description: string;
  /** 文件名 */
  fileName: string;
  /** 模板标签列表 */
  tags?: string[];
}

/**
 * 分析报告
 */
export interface AnalysisReport {
  /** 唯一标识 */
  id: string;
  /** 报告名称 */
  name: string;
  /** 关联试验名称 */
  experimentName: string;
  /** 试验目的 */
  testGoal: string;
  /** 试验对象 */
  testObject: string;
  /** 试验科目 */
  testSubject: string;
  /** 是否有大纲 */
  hasOutline: boolean;
  /** 关联数据分析项目ID */
  analysisProjectId: string;
  /** 报告模板ID */
  reportTemplateId: string;
  /** 标签绑定映射 (标签名 -> 输出变量ID) */
  tagBindings: Record<string, string>;
  /** 创建时间 */
  createTime: string;
  /** 报告状态 */
  status: 'draft' | 'generated';
  /** 报告文件内容 */
  reportContent?: string;
}
