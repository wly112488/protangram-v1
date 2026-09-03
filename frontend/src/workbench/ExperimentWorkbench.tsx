import React, { useState } from 'react';
import { Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import { Outlet, useLocation } from 'react-router-dom';
import FunctionBar from './FunctionBar';
import type { ResearchObject } from './EquipmentManagerWindow';

interface GeneratedExperiment {
  id: string;
  name: string;
  designName: string;
  designSummary: {
    factorCount: number;
    runCount: number;
    blockCount: number;
    wholePlotCount: number;
    wholePlotRunCount: number;
    wholePlotReplicateCount: number;
    subPlotReplicateCount: number;
    hardToChangeFactor: string;
    wholePlotGenerator: string;
    note: string;
  };
  worksheetData: Record<string, string>;
  extraItems: string[];
}

type TaskStageStatus = 'completed' | 'running' | 'waiting' | 'attention';

interface TaskStage {
  key: string;
  title: string;
  navigationKey: 'experiment' | 'doe' | 'data-model' | 'report';
  module: string;
  capability: string;
  status: TaskStageStatus;
  progress: number;
  owner: string;
  description: string;
  inputs: string[];
  activities: string[];
  outputs: string[];
  services: string[];
  algorithm: string;
}

const OBJECT_STORAGE_KEY = 'protangram-research-objects';
const EXPERIMENT_STORAGE_KEY = 'protangram-generated-experiments';

const columns = Array.from({ length: 20 }, (_, index) => `C${index + 1}`);
const rows = Array.from({ length: 24 }, (_, index) => index + 1);
const createPresetWorksheetData = (designName: string, experimentIndex: number): Record<string, string> => ({
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
  '8-C1': '实验',
  '8-C2': `实验${experimentIndex}`,
});

const createPresetDesignSummary = (designName: string): GeneratedExperiment['designSummary'] => ({
  factorCount: designName.includes('裂区') ? 2 : 2,
  runCount: designName.includes('裂区') ? 16 : 8,
  blockCount: designName.includes('裂区') ? 2 : 1,
  wholePlotCount: designName.includes('裂区') ? 4 : 0,
  wholePlotRunCount: designName.includes('裂区') ? 4 : 0,
  wholePlotReplicateCount: designName.includes('裂区') ? 2 : 2,
  subPlotReplicateCount: designName.includes('裂区') ? 2 : 0,
  hardToChangeFactor: 'A',
  wholePlotGenerator: 'A',
  note: '所有项均不混杂。',
});

const loadResearchObjects = (): ResearchObject[] => {
  try {
    const raw = localStorage.getItem(OBJECT_STORAGE_KEY);
    return raw ? JSON.parse(raw) as ResearchObject[] : [];
  } catch {
    return [];
  }
};

const saveResearchObjects = (objects: ResearchObject[]) => {
  localStorage.setItem(OBJECT_STORAGE_KEY, JSON.stringify(objects));
};

const loadStoredExperiments = (): GeneratedExperiment[] => {
  try {
    const raw = localStorage.getItem(EXPERIMENT_STORAGE_KEY);
    const experiments = raw ? JSON.parse(raw) as GeneratedExperiment[] : [];
    return experiments.map((experiment) => ({
      ...experiment,
      designSummary: experiment.designSummary ?? createPresetDesignSummary(experiment.designName),
    }));
  } catch {
    return [];
  }
};

const saveStoredExperiments = (experiments: GeneratedExperiment[]) => {
  localStorage.setItem(EXPERIMENT_STORAGE_KEY, JSON.stringify(experiments));
};

const createExperimentTree = (experiments: GeneratedExperiment[]): DataNode[] =>
  experiments.map((experiment) => ({
    key: experiment.id,
    title: experiment.name,
    children: [
      { key: `${experiment.id}-design`, title: experiment.designName },
      { key: `${experiment.id}-summary`, title: '设计摘要' },
      ...experiment.extraItems.map((item, index) => ({
        key: `${experiment.id}-extra-${index}`,
        title: item,
      })),
    ],
  }));

const taskStages: TaskStage[] = [
  {
    key: 'definition',
    title: '需求定义',
    navigationKey: 'experiment',
    module: '试验管理',
    capability: '对象与目标管理',
    status: 'completed',
    progress: 100,
    owner: '王工',
    description: '明确试验对象、验证目标、边界条件和验收指标。',
    inputs: ['发动机振动控制需求', '台架能力清单', '历史故障案例'],
    activities: ['研究对象已关联', '3 项指标已确认', '边界条件已评审'],
    outputs: ['试验任务书 V1.2', '验收指标清单', '数据采集要求'],
    services: ['权限服务', '数据服务', '知识服务'],
    algorithm: '知识检索 / 历史案例匹配',
  },
  {
    key: 'design',
    title: 'DOE设计',
    navigationKey: 'doe',
    module: '试验设计（DOE）',
    capability: '智能试验设计',
    status: 'completed',
    progress: 100,
    owner: '李工',
    description: '根据目标、因子和设备约束生成可执行的试验方案。',
    inputs: ['4 个试验因子', '2 个响应变量', '台架运行约束'],
    activities: ['全因子方案已生成', '32 次运行已排序', '风险工况已标记'],
    outputs: ['DOE方案 V2.0', '工况运行表', '随机化顺序'],
    services: ['模型服务', '算法调用', '任务调度'],
    algorithm: '试验优化算法 / 约束求解',
  },
  {
    key: 'execution',
    title: '数据准备与执行',
    navigationKey: 'experiment',
    module: '试验管理',
    capability: '数据采集与任务调度',
    status: 'running',
    progress: 68,
    owner: '赵工',
    description: '按 DOE 运行表执行试验，持续校验采集质量和工况偏差。',
    inputs: ['DOE工况运行表', '传感器通道配置', '设备接口映射'],
    activities: ['已完成 22 / 32 次运行', '数据完整率 98.7%', '当前执行工况 Run-023'],
    outputs: ['原始试验数据', '环境与控制数据', '运行日志'],
    services: ['任务调度', '接口管理', '数据服务', '日志审计'],
    algorithm: '数据质量检测 / 在线异常识别',
  },
  {
    key: 'analysis',
    title: '数据分析',
    navigationKey: 'data-model',
    module: '数据分析',
    capability: '异常与根因分析',
    status: 'waiting',
    progress: 0,
    owner: '陈工',
    description: '汇总实测数据，识别主效应、交互作用、异常和根因。',
    inputs: ['清洗后的试验数据', '环境数据', '控制与告警记录'],
    activities: ['分析模板已绑定', '等待试验执行完成', '根因规则库已加载'],
    outputs: ['主效应与交互作用图', '异常事件清单', '根因分析结论'],
    services: ['数据服务', '任务调度', '知识服务'],
    algorithm: '统计分析 / 异常诊断算法',
  },
  {
    key: 'calibration',
    title: '模型校准',
    navigationKey: 'data-model',
    module: '试验数字孪生',
    capability: '模型校准与可信度评估',
    status: 'waiting',
    progress: 0,
    owner: '周工',
    description: '利用实测结果修正仿真模型，并评估模型误差和可信度。',
    inputs: ['仿真基线模型', '实测响应数据', '模型参数边界'],
    activities: ['校准流程待启动', '基线模型已就绪', '可信度阈值 0.85'],
    outputs: ['校准模型', '误差评估', '可信区间与灵敏度'],
    services: ['模型管理', '算力调度', '数据服务'],
    algorithm: '模型校准算法 / 不确定性量化',
  },
  {
    key: 'virtual',
    title: '虚拟工况',
    navigationKey: 'data-model',
    module: '虚拟工况扩展',
    capability: '工况推演',
    status: 'attention',
    progress: 0,
    owner: '孙工',
    description: '使用通过校准的模型扩展未实测工况，并标记外推风险。',
    inputs: ['通过校准的模型', '目标工况域', '推演约束'],
    activities: ['目标工况已配置', '存在 2 个外推区间', '等待校准模型'],
    outputs: ['虚拟工况数据', '预测曲线', '风险区间'],
    services: ['模型服务', '算力调度', '告警服务'],
    algorithm: '工况推演模型 / 外推风险识别',
  },
  {
    key: 'report',
    title: '报告归档',
    navigationKey: 'report',
    module: '报告生成',
    capability: '报告与知识沉淀',
    status: 'waiting',
    progress: 0,
    owner: '王工',
    description: '汇总全过程方案、数据、模型和结论，形成可追溯报告。',
    inputs: ['DOE方案与执行记录', '分析结论', '校准与推演结果'],
    activities: ['报告模板已选择', '章节映射已创建', '等待上游结果'],
    outputs: ['综合试验报告', '数据归档包', '可复用试验模板'],
    services: ['报告服务', '知识检索', '日志审计'],
    algorithm: '检索与生成 / 结果一致性检查',
  },
];

const stageStatusLabel: Record<TaskStageStatus, string> = {
  completed: '已完成',
  running: '进行中',
  waiting: '待开始',
  attention: '需关注',
};

const taskTimeline = [
  { time: '今天 14:32', text: 'Run-022 数据校验通过，已进入 Run-023。', tone: 'normal' },
  { time: '今天 13:48', text: '振动通道 VIB-04 出现短时波动，已自动复测。', tone: 'warning' },
  { time: '今天 10:16', text: 'DOE 方案 V2.0 审核通过，执行任务已下发。', tone: 'normal' },
  { time: '昨天 17:40', text: '试验目标与验收指标完成联合评审。', tone: 'normal' },
];

type LegacyPlatformViewKey = 'home' | 'tasks' | 'visual' | 'reports' | 'alerts' | 'settings' | 'twin' | 'design' | 'analysis' | 'virtual' | 'assistant';

const legacyDisplayViews: Array<{ key: LegacyPlatformViewKey; title: string }> = [
  { key: 'home', title: '工作台/首页' },
  { key: 'tasks', title: '任务中心' },
  { key: 'visual', title: '图表与可视化' },
  { key: 'reports', title: '报告中心' },
  { key: 'alerts', title: '告警中心' },
  { key: 'settings', title: '系统设置' },
];

const legacyBusinessViews: Array<{ key: LegacyPlatformViewKey; title: string }> = [
  { key: 'twin', title: '试验数字孪生' },
  { key: 'design', title: '智能试验设计' },
  { key: 'analysis', title: '试验数据分析' },
  { key: 'virtual', title: '虚拟工况扩展' },
  { key: 'assistant', title: '试验AI助手' },
];

const legacyTasks = [
  ['机翼热载荷校准', '试验数字孪生', '数据服务 / 模型管理 / 任务调度', '模型校准类算法', '已完成'],
  ['发动机振动 DOE 推荐', '智能试验设计', '模型服务 / 算法调用 / 算力调度', '试验优化类算法', '运行中'],
  ['高温环境异常根因分析', '试验数据分析', '数据服务 / 任务调度 / 知识服务', '异常与根因分析算法', '待复核'],
  ['极端湿热虚拟工况推演', '虚拟工况扩展', '模型服务 / 算力调度', '工况推演模型', '已完成'],
];

const legacyModules = [
  ['twin', '试验数字孪生', '建立并修正仿真与实测之间的映射关系，输出校准模型与可信度。'],
  ['design', '智能试验设计', '在约束与风险可控的前提下推荐最优试验批次、试验工况与执行顺序。'],
  ['analysis', '试验数据分析', '识别异常与趋势，定位根因并形成试验结论。'],
  ['virtual', '虚拟工况扩展', '基于校准模型推演未实际试验的工况，扩展覆盖范围。'],
  ['assistant', '试验AI助手', '自然语言交互，查询、解释、生成报告并调用工具。'],
] as const;

const LegacyPlatformPrototypeView: React.FC = () => {
  const [activeView, setActiveView] = useState<LegacyPlatformViewKey>('home');
  const activeModule = legacyModules.find((module) => module[0] === activeView);
  return (
    <div className="platform-prototype">
      <div className="platform-band">
        <div className="platform-band-title">交互展示层</div>
        <div className="platform-pill-row">
          {legacyDisplayViews.map((view) => <button type="button" className={`platform-pill ${activeView === view.key ? 'active' : ''}`} key={view.key} onClick={() => setActiveView(view.key)}>{view.title}</button>)}
        </div>
      </div>
      <div className="platform-band business-band">
        <div className="platform-band-title">业务应用层</div>
        <div className="platform-pill-row">
          {legacyBusinessViews.map((view) => <button type="button" className={`platform-pill business ${activeView === view.key ? 'active' : ''}`} key={view.key} onClick={() => setActiveView(view.key)}>{view.title}</button>)}
        </div>
      </div>
      {activeView === 'home' && <div className="platform-dashboard">
        <section className="platform-hero"><div><h2>ProTangram 智能试验业务原型</h2><p>以统一任务为主线，串联数字孪生、智能试验设计、数据分析、虚拟工况和试验AI助手。</p></div><div className="platform-hero-metrics"><span>运行任务 <strong>12</strong></span><span>校准模型 <strong>4</strong></span><span>告警事件 <strong>3</strong></span></div></section>
        <div className="platform-module-grid">{legacyModules.map(([key, title, role]) => <button type="button" className="platform-module-card" key={key} onClick={() => setActiveView(key)}><strong>{title}</strong><span>{role}</span></button>)}</div>
        <div className="platform-two-column"><section className="platform-panel"><h3>最近任务</h3>{legacyTasks.map(([name,, , ,status]) => <div className="platform-list-row" key={name}><span>{name}</span><em>{status}</em></div>)}</section><section className="platform-panel"><h3>告警摘要</h3>{['模型可信度低于 0.85', '虚拟工况存在外推风险', '数据分析任务等待复核'].map((item) => <div className="platform-alert-row" key={item}>{item}</div>)}</section></div>
      </div>}
      {activeView === 'tasks' && <section className="platform-panel full"><h3>统一任务中心</h3><div className="platform-task-table"><div className="platform-task-head">任务</div><div className="platform-task-head">业务模块</div><div className="platform-task-head">平台服务</div><div className="platform-task-head">算法/模型</div><div className="platform-task-head">状态</div>{legacyTasks.map((task) => <React.Fragment key={task[0]}><div>{task[0]}</div><div>{task[1]}</div><div>{task[2]}</div><div>{task[3]}</div><div><span className="platform-status">{task[4]}</span></div></React.Fragment>)}</div></section>}
      {activeModule && <section className="platform-panel full"><h3>{activeModule[1]}</h3><div className="platform-flow"><div><span>主要输入</span><strong>试验数据、环境数据、工况参数</strong></div><div><span>平台服务</span><strong>数据服务 / 模型服务 / 任务调度</strong></div><div><span>主要输出</span><strong>结果数据、分析结论、风险提示</strong></div></div></section>}
      {['visual', 'reports', 'alerts', 'settings'].includes(activeView) && <section className="platform-panel full"><h3>{legacyDisplayViews.find((view) => view.key === activeView)?.title}</h3><div className="platform-placeholder-grid">{(activeView === 'visual' ? ['误差趋势图', '可信区间图', '异常根因图', '虚拟工况预测图'] : activeView === 'reports' ? ['模型校准报告', '智能试验设计报告', '异常分析报告', '虚拟工况推演报告'] : activeView === 'alerts' ? ['数据异常', '模型可信度低', '外推风险', '任务失败'] : ['权限管理', '接口管理', '日志审计', '算力资源']).map((item) => <div key={item}>{item}</div>)}</div></section>}
    </div>
  );
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PlatformPrototypeView: React.FC<{ selectedStageKey: string }> = ({ selectedStageKey }) => {
  const selectedStage = taskStages.find((stage) => stage.key === selectedStageKey) ?? taskStages[2];

  return (
    <div className="task-workspace">
      <header className="task-header">
        <div className="task-title-block">
          <div className="task-kicker">当前实验任务 · PT-2026-0042</div>
          <h2>发动机振动特性综合试验</h2>
          <div className="task-meta">
            <span>研究对象：航空发动机 A-03</span>
            <span>负责人：王工</span>
            <span>计划完成：2026-08-16</span>
          </div>
        </div>
        <div className="task-overview">
          <div><span>总体状态</span><strong className="running">执行中</strong></div>
          <div><span>整体进度</span><strong>38%</strong></div>
          <div><span>当前工况</span><strong>22 / 32</strong></div>
          <div><span>风险项</span><strong className="attention">2</strong></div>
        </div>
      </header>

      <div className="task-body">
        <main className="task-stage-workspace">
          <div className="stage-heading">
            <div>
              <div className="stage-module-link">
                <span>{selectedStage.module}</span>
                <span>{selectedStage.capability}</span>
              </div>
              <h3>{selectedStage.title}</h3>
              <p>{selectedStage.description}</p>
            </div>
            <div className={`stage-status-block ${selectedStage.status}`}>
              <span>{stageStatusLabel[selectedStage.status]}</span>
              <strong>{selectedStage.progress}%</strong>
              <small>负责人：{selectedStage.owner}</small>
            </div>
          </div>

          <div className="stage-progress-track">
            <span style={{ width: `${selectedStage.progress}%` }} />
          </div>

          <div className="stage-delivery-flow">
            <section>
              <div className="stage-section-label">阶段输入</div>
              {selectedStage.inputs.map((item) => <div className="stage-line-item" key={item}>{item}</div>)}
            </section>
            <section className="active-work">
              <div className="stage-section-label">处理与执行</div>
              {selectedStage.activities.map((item, index) => (
                <div className="stage-line-item" key={item}>
                  <span className={index === 0 && selectedStage.status === 'running' ? 'pulse-dot' : 'plain-dot'} />
                  {item}
                </div>
              ))}
            </section>
            <section>
              <div className="stage-section-label">阶段产物</div>
              {selectedStage.outputs.map((item) => <div className="stage-line-item output" key={item}>{item}</div>)}
            </section>
          </div>

          <div className="stage-support-row">
            <div>
              <span>调用的平台服务</span>
              <div className="support-tags">
                {selectedStage.services.map((service) => <i key={service}>{service}</i>)}
              </div>
            </div>
            <div>
              <span>算法 / 模型</span>
              <strong>{selectedStage.algorithm}</strong>
            </div>
          </div>
        </main>

        <aside className="task-activity-panel">
          <section className="task-context-section">
            <div className="activity-heading">
              <h3>任务动态</h3>
              <span>全过程</span>
            </div>
            <div className="task-timeline">
              {taskTimeline.map((item) => (
                <div className={`timeline-item ${item.tone}`} key={`${item.time}-${item.text}`}>
                  <time>{item.time}</time>
                  <p>{item.text}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="task-context-section task-risk-section">
            <div className="activity-heading">
              <h3>待处理</h3>
              <span>2 项</span>
            </div>
            <div className="risk-item">
              <strong>外推范围确认</strong>
              <span>虚拟工况有 2 个区间超出实测边界</span>
            </div>
            <div className="risk-item">
              <strong>通道波动复核</strong>
              <span>VIB-04 自动复测结果待签认</span>
            </div>
          </section>

          <button type="button" className="task-assistant-entry">
            <span>试验AI助手</span>
            <strong>询问当前任务</strong>
          </button>
        </aside>
      </div>
    </div>
  );
};

const ExperimentWorkbench: React.FC = () => {
  const location = useLocation();
  const [navigatorWidth, setNavigatorWidth] = useState(240);
  const [worksheetHeight, setWorksheetHeight] = useState(230);
  const [experiments, setExperiments] = useState<GeneratedExperiment[]>([]);
  const [storedExperiments, setStoredExperiments] = useState<GeneratedExperiment[]>(loadStoredExperiments);
  const [researchObjects, setResearchObjects] = useState<ResearchObject[]>(loadResearchObjects);
  const [activeExperimentId, setActiveExperimentId] = useState<string | null>(null);
  const [activeTreeKey, setActiveTreeKey] = useState<string | null>(null);
  const activeExperiment = experiments.find((experiment) => experiment.id === activeExperimentId) ?? null;
  const showingDesignSummary = activeTreeKey?.endsWith('-summary') && activeExperiment;

  const handleResearchObjectsChange = (objects: ResearchObject[]) => {
    setResearchObjects(objects);
    saveResearchObjects(objects);
  };

  const handleDesignGenerated = (designName: string) => {
    setExperiments((prev) => {
      const nextIndex = storedExperiments.length + 1;
      const experiment: GeneratedExperiment = {
        id: `experiment-${nextIndex}`,
        name: `实验${nextIndex}`,
        designName,
        designSummary: createPresetDesignSummary(designName),
        worksheetData: createPresetWorksheetData(designName, nextIndex),
        extraItems: [],
      };
      setActiveExperimentId(experiment.id);
      setActiveTreeKey(experiment.id);
      setStoredExperiments((storedPrev) => {
        const nextStored = [...storedPrev, experiment];
        saveStoredExperiments(nextStored);
        return nextStored;
      });
      return [...prev, experiment];
    });
  };

  const handleImportExperiment = (experimentId: string) => {
    const experiment = storedExperiments.find((item) => item.id === experimentId);
    if (!experiment) return;
    setExperiments((prev) => {
      if (prev.some((item) => item.id === experimentId)) return prev;
      return [...prev, experiment];
    });
    setActiveExperimentId(experimentId);
    setActiveTreeKey(experimentId);
  };

  const startVerticalResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = navigatorWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      setNavigatorWidth(Math.min(420, Math.max(180, nextWidth)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const startHorizontalResize = (event: React.MouseEvent) => {
    event.preventDefault();
    const startY = event.clientY;
    const startHeight = worksheetHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const nextHeight = startHeight - (moveEvent.clientY - startY);
      setWorksheetHeight(Math.min(420, Math.max(140, nextHeight)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className="layout-workbench">
      <FunctionBar
        researchObjects={researchObjects}
        onResearchObjectsChange={handleResearchObjectsChange}
        experiments={storedExperiments.map((experiment) => ({
          id: experiment.id,
          name: experiment.name,
        }))}
        onImportExperiment={handleImportExperiment}
        onAssociateObjectToExperiment={() => undefined}
        onMergeObjects={() => undefined}
        onDesignGenerated={handleDesignGenerated}
      />
      {location.pathname === '/' ? <div className="layout-content">
        <aside className="layout-navigator" style={{ width: navigatorWidth }}>
          <Tree
            blockNode
            defaultExpandAll
            selectedKeys={activeTreeKey ? [activeTreeKey] : []}
            treeData={createExperimentTree(experiments)}
            onSelect={(keys) => {
              const key = String(keys[0] ?? '');
              const experimentId = key
                .split('-design')[0]
                .split('-summary')[0]
                .split('-extra')[0];
              if (experiments.some((experiment) => experiment.id === experimentId)) {
                setActiveExperimentId(experimentId);
                setActiveTreeKey(key);
              }
            }}
          />
        </aside>
        <div className="layout-vertical-splitter" onMouseDown={startVerticalResize} />
        <section className="layout-main">
          <div className="layout-canvas">
            {showingDesignSummary ? (
              <div className="design-summary-panel">
                <h3>设计摘要</h3>
                <div className="design-summary-grid">
                  <span>因子:</span>
                  <strong>{activeExperiment.designSummary.factorCount}</strong>
                  <span>整区:</span>
                  <strong>{activeExperiment.designSummary.wholePlotCount}</strong>
                  <span>难以改变的因子:</span>
                  <strong>{activeExperiment.designSummary.hardToChangeFactor}</strong>
                  <span>每个整区的运行次数:</span>
                  <strong>{activeExperiment.designSummary.wholePlotRunCount}</strong>
                  <span>试验次数:</span>
                  <strong>{activeExperiment.designSummary.runCount}</strong>
                  <span>整区仿行数:</span>
                  <strong>{activeExperiment.designSummary.wholePlotReplicateCount}</strong>
                  <span>区组:</span>
                  <strong>{activeExperiment.designSummary.blockCount}</strong>
                  <span>子区仿行数:</span>
                  <strong>{activeExperiment.designSummary.subPlotReplicateCount}</strong>
                </div>
                <p>难以改变的因子数: {activeExperiment.designSummary.hardToChangeFactor}</p>
                <p>整区生成元: {activeExperiment.designSummary.wholePlotGenerator}</p>
                <p>{activeExperiment.designSummary.note}</p>
              </div>
            ) : null}
          </div>
          <div className="layout-horizontal-splitter" onMouseDown={startHorizontalResize} />
          <div className="layout-worksheet" style={{ height: worksheetHeight }}>
            <div className="worksheet-grid">
              <div className="worksheet-corner" />
              {columns.map((column) => (
                <div className="worksheet-column-header" key={column}>{column}</div>
              ))}
              {rows.map((row) => (
                <React.Fragment key={row}>
                  <div className="worksheet-row-header">{row}</div>
                  {columns.map((column, index) => (
                    <div
                      className={`worksheet-cell ${row === 1 && index === 0 ? 'active' : ''}`}
                      key={`${row}-${column}`}
                    >
                      {activeExperiment?.worksheetData[`${row}-${column}`] ?? ''}
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
            <div className="worksheet-tabs">
              <div className="worksheet-tab active">工作表 1</div>
            </div>
          </div>
        </section>
      </div> : <main className="main-content" style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex' }}><Outlet /></main>}
    </div>
  );
};

export default ExperimentWorkbench;
