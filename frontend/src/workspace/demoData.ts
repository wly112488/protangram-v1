import { usePhysicalObjectStore, migratePhysicalState, type PhysicalObject, type PhysicalConfiguration, type ConcreteTrial, type ValueField } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { readTrialFile, saveTrialFile } from './trialDataFiles';
import type { Project, ProjectArtifact } from './types';
import type { WorkSession, PhysicalBusinessScope } from './sessionModel';
import type { TaskRecord, TaskRequirement } from './taskTypes';

export const DEMO_STORAGE_KEY = 'protangram-demo-data-20261021-v1';
export const DEMO_TASK_TEXT = '涵道风扇性能验证任务书（演示）\n试验名称：涵道风扇高转速验证\n物理对象：涵道风扇 A（演示）\n试验构型：静推力构型 A\n载荷谱：LS-HIGH-01\n目标：分析高转速推力波动，评估数字孪生结果，扩展虚拟工况，制定补充试验并汇总报告。';
const timestamp = '2026-10-21T02:00:00.000Z';
const headers = ['time_s', 'speed_rpm', 'thrust_n', 'temperature_c', 'pressure_kpa'];
const field = (id: string, name: string, value: string, unit: string): ValueField => ({ id, name, value, unit, form: '单值', source: '演示样例' });
const blank = { parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] };
const merge = <T extends { id: string }>(existing: T[], incoming: T[]) => [...existing, ...incoming.filter(item => !existing.some(saved => saved.id === item.id))];

export function createDemoData() {
  const files: Array<{ id: string; name: string; contents: string }> = [];
  const sessions: WorkSession[] = [];
  const projects: Project[] = [];
  const scopes: PhysicalBusinessScope[] = [];
  const projectId = 'demo-project-fan-validation';
  const taskId = 'demo-task-fan-validation';
  const devices: PhysicalConfiguration[] = ['A', 'B'].map((letter, deviceIndex) => ({
    ...blank, id: `demo-fan-${letter}`, name: `涵道风扇 ${letter}（演示）`, description: '固定演示样例，可编辑参数；非实测设备数据。',
    parameters: [field(`demo-diameter-${letter}`, '涵道直径', deviceIndex ? '320' : '280', 'mm'), field(`demo-blades-${letter}`, '叶片数量', deviceIndex ? '9' : '7', ''), field(`demo-power-${letter}`, '额定功率', deviceIndex ? '8' : '5', 'kW')],
    materials: [field(`demo-material-${letter}`, '叶片材料', '碳纤维复合材料', '')],
    experiments: ['静推力', '变转速'].map((kind, configurationIndex) => {
      const index = deviceIndex * 2 + configurationIndex;
      const experimentId = `demo-configuration-${index}`;
      const trialId = `demo-trial-${index}`;
      const trialName = ['静推力基线验证（演示）', '变转速性能验证（演示）', '大直径风扇推力验证（演示）', '高转速补充验证（演示）'][index];
      const scope: PhysicalBusinessScope = { physicalObjectId: `demo-fan-${letter}`, physicalObjectName: `涵道风扇 ${letter}（演示）`, experimentId, experimentName: `${kind}构型 ${letter}`, trialId, trialName };
      scopes.push(scope);
      const trial: ConcreteTrial = { id: trialId, name: trialName, description: '仓库内置演示试验，CSV 为可编辑的合成样例。', loadSpectrum: `LS-DEMO-0${index + 1}`, ...(index === 1 ? { taskBookId: taskId } : {}), charts: [], records: [] };
      for (let execution = 0; execution < (index === 0 ? 2 : 1); execution++) {
        const recordId = `demo-record-${index}-${execution}`;
        const rawFiles = Array.from({ length: index === 0 && execution === 0 ? 2 : 1 }, (_, fileIndex) => {
          const id = `demo-csv-${index}-${execution}-${fileIndex}`;
          const name = `${fileIndex ? '复核' : '推力'}记录_${letter}_${configurationIndex + 1}_${execution + 1}.csv`;
          const rows = Array.from({ length: 120 }, (_, row) => {
            const speed = 3000 + row * 25 + index * 200;
            return [row, speed, (18 + row * 0.16 + Math.sin(row / 8) * 0.8 + index * 2 + execution * 0.3).toFixed(3), (24 + row * 0.08 + Math.sin(row / 12) * 0.4).toFixed(2), (101.3 + Math.sin(row / 10) * 0.15).toFixed(3)].join(',');
          });
          const contents = [headers.join(','), ...rows].join('\n');
          files.push({ id, name, contents });
          return { id, name, mimeType: 'text/csv', size: new TextEncoder().encode(contents).length, addedAt: timestamp, headers: [...headers], rowCount: 120, status: 'available' as const };
        });
        trial.records.push({ id: recordId, name: execution ? '复测记录' : '基线记录', executionNumber: execution + 1, createdAt: timestamp, actualConditions: [field(`demo-temperature-${index}`, '环境温度', '25', '℃'), field(`demo-speed-${index}`, '转速', '5000', 'rpm')], measurements: [], rawFiles, tables: [{ id: `demo-table-${index}-${execution}`, name: `${trialName} · 第${execution + 1}次数据表`, rawFileId: rawFiles[0].id, fields: [...headers], startRow: 0, endRow: 0, createdAt: timestamp, updatedAt: timestamp }] });
        trial.charts.push(...(['line', 'scatter'] as const).map((chartType, chartIndex) => ({ id: `demo-chart-${index}-${execution}-${chartIndex}`, name: `${execution ? '复测' : '基线'} · ${chartIndex ? '转速与推力关系' : '推力随时间变化'}`, sourceRecordId: recordId, rawFileId: rawFiles[0].id, xField: chartIndex ? 'speed_rpm' : 'time_s', yField: 'thrust_n', chartType, startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false, sourceCapability: 'analysis', createdAt: timestamp, updatedAt: timestamp })));
      }
      const inProject = index === 1 || index === 2;
      const sessionId = `demo-session-${index}`;
      const storageProjectId = inProject ? projectId : `demo-storage-${index}`;
      const artifacts: ProjectArtifact[] = (['design', 'analysis', 'calibration', 'virtualCondition', 'report'] as const).map((type, artifactIndex) => ({
        id: `demo-artifact-${index}-${type}`, projectId: storageProjectId, type,
        title: ['补充试验推荐方案', 'CSV 趋势分析样例', '数字孪生对比样例', '虚拟工况扩展样例', '性能验证报告样例'][artifactIndex],
        source: ['智能试验设计', '试验数据分析', '试验数字孪生', '虚拟工况扩展', '报告'][artifactIndex],
        summary: `${trialName}：${['在 3500、5000、6500 rpm 下设置补充验证点。', '合成数据中推力随转速平稳上升，可查看原 CSV 和图表。', '展示不同转速下的预测推力与对比偏差。', '展示转速扩展工况及风险等级。', '本报告汇总演示试验的执行记录、图表和专业成果；所有数值均为合成样例。'][artifactIndex]}`,
        createdAt: timestamp, updatedAt: timestamp,
        payload: { resultMode: 'demo', sourceScope: scope, sourceContext: { loadSpectrum: trial.loadSpectrum, trialName, rawFiles: [trial.records[0].rawFiles[0]] },
          results: type === 'report' ? [] : [{ id: `demo-result-${type}`, name: ['推荐试验点', '趋势摘要', '预测对比', '扩展工况'][artifactIndex], kind: 'table', columns: [{ key: 'speed', label: '转速', unit: 'rpm' }, { key: 'thrust', label: '推力', unit: 'N' }, { key: 'note', label: '说明' }], rows: [3500, 5000, 6500].map((speed, row) => ({ speed, thrust: 22 + row * 8 + index, note: ['基线工况', '重点验证', '上边界验证'][row] })), basis: ['仓库内置合成演示样例，用于展示页面与来源追溯。'] }] },
      }));
      const worksheetView = { opened: [trial.records[0].rawFiles[0].id], active: trial.records[0].rawFiles[0].id, expanded: false };
      sessions.push({ id: sessionId, title: trialName, creationSource: inProject ? 'project' : 'standalone', projectId: inProject ? projectId : undefined, storageProjectId, capability: 'analysis', businessScope: scope, pinned: index === 0, archived: false, createdAt: timestamp, updatedAt: timestamp,
        ...(index === 1 ? { taskWork: { taskId, trialDraftId: 'demo-task-trial-draft' }, sidebarVisible: true } : {}),
        drafts: { analysis: { worksheetView: { ...worksheetView, expanded: true } }, doe: { confirmed: { config: true, constraints: true }, generated: true, worksheetView }, digitalTwin: { worksheetView }, virtualCondition: { worksheetView } }, handoffs: {} });
      const existingProject = projects.find(item => item.id === storageProjectId);
      if (existingProject) { existingProject.artifacts.push(...artifacts); existingProject.trialSources!.push(scope as Required<Pick<PhysicalBusinessScope, 'physicalObjectId' | 'experimentId' | 'trialId'>>); }
      else projects.push({ id: storageProjectId, name: inProject ? '涵道风扇性能验证（演示项目）' : trialName, ...(inProject ? {} : { sessionOwnerId: sessionId }), status: '进行中', description: '仓库内置演示样例', createdAt: timestamp, updatedAt: timestamp, basicInfo: { testObject: scope.physicalObjectName }, datasets: [], artifacts, trialSources: [scope as Required<Pick<PhysicalBusinessScope, 'physicalObjectId' | 'experimentId' | 'trialId'>>] });
      return { id: experimentId, name: `${kind}构型 ${letter}`, description: '演示构型，可在对象树查看参数。', testType: 'thrust', parameters: [field(`demo-angle-${index}`, '安装角度', configurationIndex ? '5' : '0', '°'), field(`demo-target-${index}`, '目标转速', '5000', 'rpm')], trials: [trial] };
    }),
  }));
  const category: PhysicalObject = { ...blank, id: 'category-fan', name: '涵道风扇', type: '涵道风扇', description: '两台演示风扇，每台包含两个试验构型。', configurations: devices };
  const capabilities: NonNullable<TaskRequirement['capability']>[] = ['dataAnalysis', 'digitalTwin', 'virtualCondition', 'experimentDesign', 'report'];
  const requirements: TaskRequirement[] = capabilities.map((capability, index) => ({ id: `demo-requirement-${index}`, text: ['分析高转速试验数据及推力变化', '评估数字孪生预测结果', '扩展未覆盖的虚拟工况', '制定补充试验方案', '汇总证据并形成性能验证报告'][index], capability, status: index < 2 ? '已满足' : index === 2 ? '进行中' : '待完成', executionProgress: index < 2 ? 100 : index === 2 ? 40 : 0, dependsOnIds: index ? [`demo-requirement-${index - 1}`] : [], ...(index < 2 ? { satisfactionNote: '演示样例已复核，关联成果可在共享数据与成果查看。' } : {}) }));
  const task: TaskRecord = { id: taskId, title: '涵道风扇性能验证任务书（演示）', sourceName: '涵道风扇性能验证任务书.txt', sourceText: DEMO_TASK_TEXT, projectId, planConfirmed: true, status: '进行中', requirements, trialDrafts: [{ id: 'demo-task-trial-draft', name: scopes[1].trialName!, loadSpectrum: 'LS-DEMO-02', categoryId: category.id, physicalObjectId: scopes[1].physicalObjectId, experimentId: scopes[1].experimentId, requirementIds: requirements.map(item => item.id), source: scopes[1], sessionId: 'demo-session-1', confirmedAt: timestamp }], artifactRefs: projects.find(item => item.id === projectId)!.artifacts.filter(item => item.id.startsWith('demo-artifact-1-')).map(item => ({ projectId, artifactId: item.id, addedAt: timestamp })), reportDraft: { status: 'draft', updatedAt: timestamp, sections: [{ id: 'task-background', title: '任务背景与目标', body: '验证两型涵道风扇在不同转速和安装条件下的推力响应。', artifactRefs: [] }, { id: 'task-analysis', title: '分析过程与结果', body: '已完成数据复核和数字孪生样例评估；正在开展虚拟工况扩展。', artifactRefs: [] }, { id: 'task-conclusion', title: '结论与建议', body: '在高转速区域增加补充试验点，并汇总最终报告。', artifactRefs: [] }] }, createdAt: timestamp, updatedAt: timestamp };
  return { objects: [category], projects, sessions, tasks: [task], files };
}

// Versioned additive bootstrap. Never replace saved user data or resurrect deleted samples on refresh.
export async function initializeDemoData() {
  if (localStorage.getItem(DEMO_STORAGE_KEY)) return;
  const demo = createDemoData();
  for (const file of demo.files) {
    try { await readTrialFile(file.id); }
    catch { await saveTrialFile(file.id, new File([file.contents], file.name, { type: 'text/csv' })); }
  }
  usePhysicalObjectStore.setState(state => {
    const objects = migratePhysicalState({objects:state.objects}).objects;
    const fan = objects.find(category => category.name === '涵道风扇')!;
    return {objects:objects.map(category => category.id === fan.id ? {...category, configurations:merge(category.configurations, demo.objects[0].configurations)} : category)};
  });
  useProjectStore.setState(state => ({ projects: merge(state.projects, demo.projects), activeProjectId: state.activeProjectId ?? 'demo-project-fan-validation' }));
  useTaskStore.setState(state => ({ tasks: merge(state.tasks, demo.tasks) }));
  useSessionStore.setState(state => ({ sessions: merge(state.sessions, demo.sessions) }));
  useSessionStore.getState().retrySave();
  if (useSessionStore.getState().saveError) throw new Error('演示数据保存失败');
  localStorage.setItem(DEMO_STORAGE_KEY, 'complete');
}
