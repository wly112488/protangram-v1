import { useSessionState, useSessionRouteState } from '@/workspace/useSessionState';
import { useSessionStore } from '@/workspace/sessionStore';
import { getSessionDraftKey, getSessionPath } from '@/workspace/sessionModel';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Card, Typography, Button, Form, Input, Select, Space, Descriptions, Tag, message, Checkbox, Empty, Drawer,
} from 'antd';
import {
  ArrowLeftOutlined, FileSyncOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisProjects, loadExperiments, loadAnalysisReports, saveAnalysisReports } from '@/utils/storage';
import { useProjectStore } from '@/workspace/projectStore';
import { useTrialConfigurationStore } from '@/workspace/trialConfigurationStore';
import { collectSessionResourceGroups } from '@/workspace/sessionResourceModel';
import ProjectSidebar from '@/workspace/ProjectSidebar';
import { useTaskStore } from '@/workspace/taskStore';
import { getReportableArtifacts, resolveReportProjectId } from './reportModel.js';
import { resolveTaskReportProjectId } from './taskReportModel';
import type { AnalysisProject, AnalysisReport } from '@/types';
import type { ProjectArtifact } from '@/workspace/types';
import { getRecordCharts, usePhysicalObjectStore } from '@/workspace/physicalObjectStore';
import { artifactResultLabel, getSourceArtifacts, recordChartKey, resolvePhysicalSource, type ArtifactReference, type RecordChartReference } from '@/workspace/physicalBusinessContext';

import { getTaskTrials, getTaskTrialSources, getTaskReportArtifacts, taskBookPath } from '@/workspace/taskTrialModel';

const { Title, Text } = Typography;

const REPORT_TEMPLATE_OPTIONS = [
  { label: '航空装备地面综合试验报告', value: 'rt-1' },
  { label: '机载设备性能测试报告', value: 'rt-2' },
  { label: '系统联调试验验证报告', value: 'rt-3' },
  { label: '环境适应性试验报告', value: 'rt-4' },
  { label: '可靠性与耐久性试验报告', value: 'rt-5' },
  { label: '稳定性测试分析报告', value: 'rt-6' },
  { label: '功能与性能验证试验报告', value: 'rt-7' },
  { label: '高低温环境试验报告', value: 'rt-8' },
];

type ReportRecord = AnalysisReport & {
  workspaceProjectId?: string;
  artifactIds?: string[];
  artifactRefs?: ArtifactReference[];
  chartRefs?: RecordChartReference[];
  taskId?: string;
  taskItemId?: string;
};

const ReportCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: legacyRouteProjectId } = useParams<{ projectId: string }>();
  const routeState = useSessionRouteState();
  const sessionBoundMode = Boolean(routeState?.workspaceSession?.sessionId);
  const taskId = routeState?.workspaceSession?.mode === 'task'
    ? routeState.workspaceSession.taskId
    : new URLSearchParams(location.search).get('taskId') ?? undefined;
  const requestedTaskItemId = routeState?.workspaceSession?.mode === 'task'
    ? routeState.workspaceSession.taskItemId
    : new URLSearchParams(location.search).get('taskItemId') ?? undefined;
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const taskItemId = requestedTaskItemId ?? task?.requirements.find((requirement) => requirement.capability === 'report')?.id;
  const taskBoundMode = Boolean(taskId && task);
  const setTaskRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const routeProjectId = taskBoundMode
    ? task?.projectId
    : routeState?.workspaceSession?.targetProjectId || legacyRouteProjectId;
  const [form] = Form.useForm();
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const sessionTitle = useSessionStore(state => state.sessions.find(item => item.id === routeState?.workspaceSession?.sessionId)?.title);
  const {
    setAnalysisProjects, setExperiments, addAnalysisReport,
  } = useAppStore();
  const { projects, activeProjectId } = useProjectStore();
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const cfgs = useTrialConfigurationStore(state=>state.configurations);
  const scope = routeState?.workspaceSession;
  const source = resolvePhysicalSource(objects, scope);
  const taskEntries = getTaskTrials(objects, projects, sessions, task?.id ?? '');
  const taskSources = getTaskTrialSources(taskEntries);
  const taskArtifacts = task ? getReportableArtifacts(getTaskReportArtifacts(task, taskEntries, projects)) : [];
  const artifactKey = (artifact: ProjectArtifact) => taskBoundMode ? JSON.stringify([artifact.projectId, artifact.id]) : artifact.id;
  const chartChoices = taskBoundMode ? taskSources.charts : source.record ? getRecordCharts(source.trial, source.record.id).map(chart => ({ chart, label: `${chart.name} · ${chart.xField} / ${chart.yField}`, reference: { physicalObjectId: source.configuration!.id, experimentId: source.experiment!.id, trialId: source.trial!.id, testRecordId: source.record!.id, chartId: chart.id } })) : [];
  const chartKey = (item: typeof chartChoices[number]) => taskBoundMode ? recordChartKey(item.reference) : item.chart.id;
  const resourceGroups=scope?.sessionId?collectSessionResourceGroups(projects,sessions,objects,cfgs,scope.sessionId):[];
  const sessionArtifacts=[...new Map(resourceGroups.filter(group=>group.id==='generic' || group.id===scope?.cfgId).flatMap(group=>group.entries.flatMap(entry=>entry.artifact?[[`${entry.artifact.projectId}/${entry.artifact.id}`,entry.artifact] as const]:[]))).values()];
  const sourceArtifacts = getReportableArtifacts(scope?.sessionId?sessionArtifacts:getSourceArtifacts(projects,sessions,scope));
  const [selectedChartIds, setSelectedChartIds] = useSessionState<string[]>('selectedChartIds', []);
  const [legacyProjects, setLegacyProjects] = useState<AnalysisProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useSessionState('selectedProjectId', routeProjectId ?? '');
  const [selectedArtifactIds, setSelectedArtifactIds] = useSessionState<string[]>('selectedArtifactIds', []);
  const restoredCharts = useRef(useSessionStore.getState().sessions.find(item => item.id === routeState?.workspaceSession?.sessionId)?.drafts.report?.[getSessionDraftKey(`${scope?.cfgId?`cfg:${scope.cfgId}:`:''}selectedChartIds`, routeState?.workspaceSession)]);
  const restoredSelection = useRef(useSessionStore.getState().sessions.find(item => item.id === routeState?.workspaceSession?.sessionId)?.drafts.report?.[getSessionDraftKey(`${scope?.cfgId?`cfg:${scope.cfgId}:`:''}selectedArtifactIds`, routeState?.workspaceSession)]);

  const [formValues, setFormValues] = useSessionState<Record<string, unknown>>('formValues', {});

  useEffect(() => {
    const savedProjects = loadAnalysisProjects();
    setLegacyProjects(savedProjects);
    if (savedProjects.length > 0) setAnalysisProjects(savedProjects);
    const experiments = loadExperiments();
    if (experiments.length > 0) setExperiments(experiments);

    const validProjectIds = [...projects.map((project) => project.id), ...savedProjects.map((project) => project.id)];
    const taskProjectId = taskBoundMode ? resolveTaskReportProjectId(task, validProjectIds) : null;
    const initialProjectId = taskBoundMode
      ? taskProjectId ?? ''
      : routeProjectId && validProjectIds.includes(routeProjectId)
        ? routeProjectId
        : resolveReportProjectId({ activeProjectId, projectIds: projects.map((project) => project.id) });
    setSelectedProjectId(initialProjectId);
    form.setFieldsValue({ ...formValues, analysisProjectId: initialProjectId, ...(taskBoundMode ? { reportTemplateId: formValues.reportTemplateId || REPORT_TEMPLATE_OPTIONS[0].value } : {}) });
    if (taskBoundMode && restoredCharts.current === undefined) setSelectedChartIds(chartChoices.map(chartKey));

    const initialProject = projects.find((project) => project.id === initialProjectId);
    const available = taskBoundMode ? taskArtifacts : initialProject ? (scope?.physicalObjectId ? sourceArtifacts : getReportableArtifacts(initialProject.artifacts)) : [];
    if (restoredSelection.current !== undefined) return;
    const requested = routeState?.artifactIds;
    setSelectedArtifactIds(available.filter(artifact => !requested || requested.includes(artifact.id)).map(artifactKey));
  // Initialize once for each route handoff; project data is available synchronously from the persisted store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedLegacyProject = legacyProjects.find((project) => project.id === selectedProjectId);
  const reportableArtifacts = taskBoundMode ? taskArtifacts : scope?.physicalObjectId ? sourceArtifacts : selectedProject ? getReportableArtifacts(selectedProject.artifacts) : [];
  const selectedArtifacts = reportableArtifacts.filter(artifact => selectedArtifactIds.includes(artifactKey(artifact)) || selectedArtifactIds.includes(artifact.id));

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    const nextProject = projects.find((project) => project.id === id);
    setSelectedArtifactIds(nextProject
      ? getReportableArtifacts(nextProject.artifacts).map((artifact) => artifact.id)
      : []);
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      if ((taskBoundMode || sessionBoundMode) && values.analysisProjectId !== routeProjectId) {
        message.error('任务报告只能使用当前任务关联的项目');
        return;
      }
      const project = projects.find((item) => item.id === values.analysisProjectId);
      const legacyProject = legacyProjects.find((item) => item.id === values.analysisProjectId);
      const report: ReportRecord = {
        id: uuidv4(),
        name: task ? `${task.title}_任务报告` : `${project?.name || legacyProject?.experimentName || '未命名'}_分析报告`,
        experimentName: project?.name || legacyProject?.experimentName || '',
        testGoal: '',
        testObject: project?.basicInfo.testObject || '',
        testSubject: '',
        hasOutline: false,
        analysisProjectId: values.analysisProjectId,
        reportTemplateId: values.reportTemplateId,
        tagBindings: {},
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 'draft',
        workspaceProjectId: project?.id,
        artifactIds: selectedArtifacts.map(artifact => artifact.id),
        artifactRefs: selectedArtifacts.map(artifact => ({ projectId: artifact.projectId, artifactId: artifact.id })),
        chartRefs: chartChoices.filter(item => selectedChartIds.includes(chartKey(item))).map(item => item.reference),
        taskId: task?.id,
        taskItemId,
        reportContent: task ? task.reportDraft.sections.map((section) => {
          const linkedArtifacts = section.artifactRefs
            .map((reference) => projects.find((candidate) => candidate.id === reference.projectId)?.artifacts.find((artifact) => artifact.id === reference.artifactId))
            .filter((artifact): artifact is ProjectArtifact => artifact !== undefined)
            .map((artifact) => `成果：${artifact.title}\n${artifact.summary}`);
          return `## ${section.title}\n${section.body}${linkedArtifacts.length > 0 ? `\n\n${linkedArtifacts.join('\n\n')}` : ''}`;
        }).join('\n\n') : undefined,
      };

      addAnalysisReport(report);
      if (task?.id && taskItemId) setTaskRequirementStatus(task.id, taskItemId, '进行中');
      const all = loadAnalysisReports().filter((item) => item.id !== report.id);
      all.push(report);
      saveAnalysisReports(all,{localOnly:Boolean(scope?.sessionId)});

      message.success(taskBoundMode ? '报告配置已保存，可继续编制正式报告' : '报告已创建');
      navigate(`${scope?.sessionId ? getSessionPath(scope.sessionId, 'report') : '/report'}/generate/${report.id}${task ? `?taskId=${encodeURIComponent(task.id)}${taskItemId ? `&taskItemId=${encodeURIComponent(taskItemId)}` : ''}` : ''}`);
    } catch {
      message.error(taskBoundMode ? '报告配置保存失败，请检查任务资料后重试' : '请选择项目和报告模板');
    }
  };

  const projectOptions = [
    ...projects.filter(project => !project.sessionOwnerId).map((project) => ({ label: `${project.name} · ${project.artifacts.length} 项成果`, value: project.id })),
    ...legacyProjects.map((project) => ({ label: `${project.name} · 旧分析项目`, value: project.id })),
  ];

  return (
    <div className="workspace-simple-page workspace-report-create-page">
      <div className="workspace-page-heading">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(task ? taskBookPath(task.id, 'report') : scope?.sessionId ? `${getSessionPath(scope.sessionId, 'report')}/list` : '/report/list')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{taskBoundMode ? '任务报告配置' : '新建分析报告'}</Title>
      </div>

      <div className="workspace-report-form-content" style={{ maxWidth: 850, margin: '0 auto' }}>
        {taskBoundMode && !selectedProjectId && (
          <Alert
            type="error"
            showIcon
            message="当前任务没有可用的关联项目"
            description="请先在任务工作台修复项目关联，再继续配置任务报告。"
            style={{ marginBottom: 16 }}
          />
        )}

        <Card title={taskBoundMode ? '当前任务的正式报告' : '报告配置'} style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" initialValues={{ ...formValues, analysisProjectId: selectedProjectId }} onValuesChange={(_changes, values) => setFormValues(values)}>
            {taskBoundMode || sessionBoundMode ? (
              <>
                <Form.Item name="analysisProjectId" hidden rules={[{ required: true, message: '当前任务没有关联项目' }]}>
                  <Input />
                </Form.Item>
                <Form.Item label={taskBoundMode ? "当前任务书" : "当前会话"}>
                  <Input disabled value={taskBoundMode ? task?.title : sessionTitle} />
                </Form.Item>
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>{sessionBoundMode && !taskBoundMode ? scope?.physicalObjectId ? '报告可引用同一业务来源的已有专业成果和原始记录图表。' : '报告引用当前会话的成果，无需创建项目。' : '任务报告引用当前任务关联的全部试验记录、图表和专业成果。'}</Text>
              </>
            ) : (
              <Form.Item label="选择项目" name="analysisProjectId"
                rules={[{ required: true, message: '请选择项目' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder="选择项目或兼容的旧分析项目"
                  onChange={handleProjectChange}
                  options={projectOptions}
                  notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有可用于报告的项目" />}
                />
              </Form.Item>
            )}
            <Form.Item hidden={taskBoundMode} label="选择报告模板" name="reportTemplateId"
              rules={[{ required: true, message: '请选择报告模板' }]}>
              <Select placeholder="选择报告模板" options={REPORT_TEMPLATE_OPTIONS} />
            </Form.Item>
          </Form>
        </Card>

        {selectedProject && (
          <Card title={taskBoundMode ? "任务关联的专业成果" : sessionBoundMode ? "选择会话成果" : "选择项目成果"} style={{ marginBottom: 16 }}
            extra={taskBoundMode ? undefined : <Button type="link" icon={<LinkOutlined />} size="small"
              onClick={() => setResourcesOpen(true)}>{sessionBoundMode ? '查看会话成果' : '查看项目成果'}</Button>}>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label={taskBoundMode ? "任务书" : sessionBoundMode ? "会话名称" : "项目名称"}>{taskBoundMode ? task?.title : sessionBoundMode ? sessionTitle : selectedProject.name}</Descriptions.Item>
              {!taskBoundMode && <Descriptions.Item label="项目状态"><Tag color="blue">{selectedProject.status}</Tag></Descriptions.Item>}
              <Descriptions.Item label="试验对象">{taskBoundMode ? [...new Set(taskEntries.map(entry => entry.object.name))].join("、") || "暂无关联" : selectedProject.basicInfo.testObject || '未填写'}</Descriptions.Item>
              <Descriptions.Item label="可用成果">{reportableArtifacts.length} 项</Descriptions.Item>
            </Descriptions>
            {reportableArtifacts.length > 0 ? (
              <Checkbox.Group value={selectedArtifacts.map(artifactKey)} onChange={(values) => setSelectedArtifactIds(values as string[])}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {reportableArtifacts.map((artifact) => (
                    <Checkbox key={artifactKey(artifact)} value={artifactKey(artifact)}>
                      <Space wrap>
                        <Text strong>{artifact.title}</Text>
                        <Tag color="blue">{artifact.type}</Tag><Tag>{artifactResultLabel(artifact)}</Tag>
                        <Text type="secondary">{artifact.summary}</Text>
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={sessionBoundMode ? "当前会话暂无可纳入报告的成果" : "项目暂无可纳入报告的成果"} />}
          </Card>
        )}

        {(taskBoundMode || source.record) && <Card title="选择原始记录图表" style={{ marginBottom: 16 }}>
          <Text type="secondary">引用原始记录及图表配置，不复制 CSV。</Text>
          <Checkbox.Group value={selectedChartIds} onChange={values => setSelectedChartIds(values as string[])}>
            <Space direction="vertical">{chartChoices.map(item => <Checkbox key={chartKey(item)} value={chartKey(item)}>{item.label}</Checkbox>)}</Space>
          </Checkbox.Group>
          {!chartChoices.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="关联记录尚无图表" />}
        </Card>}
        {task && (
          <Card title={`任务报告草稿 · ${task.title}`} style={{ marginBottom: 16 }}>
            <Text type="secondary">已将 {task.reportDraft.sections.reduce((count, section) => count + section.artifactRefs.length, 0)} 项任务成果与各章节正文带入正式报告配置。</Text>
            <div style={{ marginTop: 12, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
              {task.reportDraft.sections.map((section) => `【${section.title}】\n${section.body}`).join('\n\n') || '报告草稿暂时为空。'}
            </div>
          </Card>
        )}

        {selectedLegacyProject && (
          <Card title="兼容旧分析项目" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="分析项目">{selectedLegacyProject.name}</Descriptions.Item>
              <Descriptions.Item label="关联试验">{selectedLegacyProject.experimentName}</Descriptions.Item>
              <Descriptions.Item label="分析模板">{selectedLegacyProject.templateName}</Descriptions.Item>
              <Descriptions.Item label="项目状态"><Tag color="green">{selectedLegacyProject.status}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <div className="workspace-form-actions" style={{ textAlign: 'center', marginTop: 24 }}>
          <Space size="large">
            <Button size="large" onClick={() => navigate(task ? taskBookPath(task.id, 'report') : scope?.sessionId ? `${getSessionPath(scope.sessionId, 'report')}/list` : '/report/list')}>取消</Button>
            <Button type="primary" size="large" icon={<FileSyncOutlined />} onClick={handleGenerate}>
              {taskBoundMode ? '保存配置并继续编制' : '进入报告编制'}
            </Button>
          </Space>
        </div>
      </div>
      <Drawer className="session-resource-drawer" title={sessionBoundMode ? "当前会话的数据与成果" : "项目数据与成果"} open={resourcesOpen} onClose={() => setResourcesOpen(false)} size={370}>
        <ProjectSidebar projectId={selectedProjectId} onNavigate={() => setResourcesOpen(false)} />
      </Drawer>
    </div>
  );
};

export default ReportCreate;
