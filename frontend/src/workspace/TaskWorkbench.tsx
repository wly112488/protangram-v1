import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Drawer, Empty, Input, List, Modal, Popconfirm, Progress, Select, Space, Spin, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, EditOutlined, FileSearchOutlined, FileTextOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { TaskRequirement } from './taskTypes';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { loadTaskBookFile, saveTaskBookFile } from './taskBookStorage';
import { parseTaskBookPageRange } from './taskBookPreviewModel';
import { createMockAiTaskReport } from './taskReportAiModel';
import { createMockTaskCapabilityArtifact } from './taskExecutionModel';
import WorkspacePageHeader from './WorkspacePageHeader';
import './taskWorkspace.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const CAPABILITIES = [
  { key: 'experimentDesign' as const, label: '试验设计', description: '设计或补充试验方案' },
  { key: 'dataAnalysis' as const, label: '试验数据分析', description: '分析试验数据并识别异常' },
  { key: 'digitalTwin' as const, label: '试验数字孪生', description: '校准模型并检查预测能力' },
  { key: 'virtualCondition' as const, label: '虚拟工况扩展', description: '扩展工况并形成验证结果' },
];
const CAPABILITY_OPTIONS = [
  ...CAPABILITIES.map(({ key, label }) => ({ value: key, label })),
  { value: 'report' as const, label: '报告编制' },
];

const TaskWorkbench: React.FC = () => {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const focusedRequirementId = new URLSearchParams(location.search).get('taskItemId');
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const confirmRequirementSatisfied = useTaskStore((state) => state.confirmRequirementSatisfied);
  const reopenRequirement = useTaskStore((state) => state.reopenRequirement);
  const addRequirement = useTaskStore((state) => state.addRequirement);
  const updateRequirement = useTaskStore((state) => state.updateRequirement);
  const removeRequirement = useTaskStore((state) => state.removeRequirement);
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const setRequirementProgress = useTaskStore((state) => state.setRequirementProgress);
  const setPlanConfirmed = useTaskStore((state) => state.setPlanConfirmed);
  const setTaskStatus = useTaskStore((state) => state.setTaskStatus);
  const updateReportSection = useTaskStore((state) => state.updateReportSection);
  const updateTask = useTaskStore((state) => state.updateTask);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const saveReportAiCompletion = useTaskStore((state) => state.saveReportAiCompletion);
  const setReportStatus = useTaskStore((state) => state.setReportStatus);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const addArtifact = useProjectStore((state) => state.addArtifact);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === task?.projectId));
  const allProjects = useProjectStore((state) => state.projects);
  const artifacts = project?.artifacts ?? [];
  const allArtifacts = useMemo(() => allProjects.flatMap((sourceProject) => sourceProject.artifacts.map((artifact) => ({
    artifact,
    projectName: sourceProject.name,
  }))), [allProjects]);
  const [requirementEditorOpen, setRequirementEditorOpen] = useState(false);
  const [editingRequirementId, setEditingRequirementId] = useState<string | null>(null);
  const [requirementText, setRequirementText] = useState('');
  const [requirementCapability, setRequirementCapability] = useState<TaskRequirement['capability']>();
  const [satisfactionRequirementId, setSatisfactionRequirementId] = useState<string | null>(null);
  const [satisfactionNote, setSatisfactionNote] = useState('');
  const [satisfactionArtifactKey, setSatisfactionArtifactKey] = useState<string>();
  const [activeTab, setActiveTab] = useState('requirements');
  const [selectedArtifact, setSelectedArtifact] = useState<(typeof allArtifacts)[number]['artifact'] | null>(null);
  const [sourcePreviewRequirement, setSourcePreviewRequirement] = useState<TaskRequirement | null>(null);
  const [sourcePdfUrl, setSourcePdfUrl] = useState<string | null>(null);
  const [sourcePdfLoading, setSourcePdfLoading] = useState(false);
  const [sourcePdfMissing, setSourcePdfMissing] = useState(false);
  const [sourcePdfError, setSourcePdfError] = useState(false);
  const [sourcePdfReloadKey, setSourcePdfReloadKey] = useState(0);
  const sourcePdfPicker = useRef<HTMLInputElement>(null);
  const sourcePageRange = parseTaskBookPageRange(sourcePreviewRequirement?.sourceRef);
  const isGeneralTaskBookPreview = sourcePreviewRequirement?.id === 'task-source-preview';

  const openTaskBookPreview = () => {
    setSourcePreviewRequirement({ id: 'task-source-preview', text: '任务书原文', status: '待完成' });
  };

  const completeReportWithMockAi = useCallback((notify = true, switchToReport = true) => {
    if (!task) return;
    const availableArtifacts = allArtifacts.map(({ artifact }) => ({
      projectId: artifact.projectId,
      artifactId: artifact.id,
      title: artifact.title,
      source: artifact.source,
      summary: artifact.summary,
    }));
    const result = createMockAiTaskReport(task, availableArtifacts);
    saveReportAiCompletion(task.id, result);
    if (switchToReport) setActiveTab('report');
    if (notify) message.success('已根据任务成果补全报告草稿，并保存结构化 JSON');
  }, [allArtifacts, saveReportAiCompletion, task]);

  const confirmReportComplete = () => {
    if (!task?.reportDraft.aiCompletedAt) return message.info('请先让 AI 补全任务报告');
    const reportRequirement = task.requirements.find((requirement) => requirement.capability === 'report');
    const unmetCount = task.requirements.filter((requirement) =>
      requirement.id !== reportRequirement?.id && requirement.status !== '已满足').length;
    const finalize = () => {
      setReportStatus(task.id, 'finalized');
      if (reportRequirement) setRequirementStatus(task.id, reportRequirement.id, '已满足');
      message.success('任务报告已确认完成；任务本身仍可继续处理或单独标记完成');
    };
    if (unmetCount > 0) {
      Modal.confirm({
        title: '仍有任务事项未满足',
        content: `还有 ${unmetCount} 项任务事项未完成。仍要确认当前报告完成吗？这不会自动标记任务完成。`,
        okText: '确认报告完成',
        cancelText: '返回继续处理',
        onOk: finalize,
      });
      return;
    }
    finalize();
  };

  const downloadStructuredReport = () => {
    if (!task?.reportDraft.structuredJson) return;
    const url = URL.createObjectURL(new Blob([task.reportDraft.structuredJson], { type: 'application/json;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${task.title}-任务报告.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const confirmExistingEvidence = () => {
    if (!satisfactionRequirementId) return;
    const note = satisfactionNote.trim();
    if (!note && !satisfactionArtifactKey) {
      message.warning('请填写满足依据，或关联一项已有成果');
      return;
    }
    if (satisfactionArtifactKey) {
      const reference = JSON.parse(satisfactionArtifactKey) as { projectId: string; artifactId: string };
      addArtifactToTaskItem(taskId, satisfactionRequirementId, reference);
    }
    confirmRequirementSatisfied(taskId, satisfactionRequirementId, note);
    setSatisfactionRequirementId(null);
    setSatisfactionNote('');
    setSatisfactionArtifactKey(undefined);
    message.success('事项已确认满足，并保存了核对依据');
  };

  const reopenSatisfiedRequirement = (requirementId: string) => {
    setPlanConfirmed(taskId, false);
    reopenRequirement(taskId, requirementId);
    message.info('事项已重新打开；已关联成果会保留，请复核规划后继续');
  };

  useEffect(() => {
    if (!sourcePreviewRequirement) return undefined;
    let cancelled = false;
    let objectUrl: string | null = null;
    setSourcePdfUrl(null);
    setSourcePdfLoading(true);
    setSourcePdfMissing(false);
    setSourcePdfError(false);
    loadTaskBookFile(taskId)
      .then((file) => {
        if (cancelled) return;
        if (!file) {
          setSourcePdfMissing(true);
          return;
        }
        objectUrl = URL.createObjectURL(file);
        setSourcePdfUrl(`${objectUrl}#page=${sourcePageRange?.startPage ?? 1}`);
      })
      .catch(() => {
        if (!cancelled) setSourcePdfError(true);
      })
      .finally(() => {
        if (!cancelled) setSourcePdfLoading(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [sourcePageRange?.startPage, sourcePdfReloadKey, sourcePreviewRequirement, taskId]);

  const openNewRequirement = () => {
    setEditingRequirementId(null);
    setRequirementText('');
    setRequirementCapability(undefined);
    setRequirementEditorOpen(true);
  };

  const openRequirementEditor = (requirement: TaskRequirement) => {
    setEditingRequirementId(requirement.id);
    setRequirementText(requirement.text);
    setRequirementCapability(requirement.capability);
    setRequirementEditorOpen(true);
  };

  const saveRequirement = () => {
    const text = requirementText.trim();
    if (!text) return message.warning('请填写事项内容');
    if (editingRequirementId) {
      updateRequirement(taskId, editingRequirementId, { text, capability: requirementCapability });
      message.success('任务事项已更新，请重新复核规划');
    } else {
      addRequirement(taskId, { text, capability: requirementCapability });
      message.success('任务事项已补充，请复核后再确认规划');
    }
    setRequirementEditorOpen(false);
  };

  const deleteRequirement = (requirementId: string) => {
    removeRequirement(taskId, requirementId);
    message.success('任务事项已删除，请重新复核规划');
  };

  const handleTaskBookReplacement = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      message.error('请重新选择 PDF 格式的任务书');
      return;
    }
    try {
      await saveTaskBookFile(taskId, file);
      updateTask(taskId, { sourceName: file.name });
      setSourcePdfReloadKey((key) => key + 1);
      message.success('任务书 PDF 已保存在本机');
    } catch {
      message.error('无法在本机保存这份 PDF');
    }
  };

  useEffect(() => {
    if (!focusedRequirementId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`task-item-${focusedRequirementId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedRequirementId, taskId]);

  useEffect(() => {
    if (!task?.planConfirmed) return;
    if (task.requirements.some((requirement) => requirement.status === '进行中')) return;
    const nextRequirement = task.requirements.find((requirement) => {
      if (requirement.status === '已满足' || !requirement.capability) return false;
      return (requirement.dependsOnIds ?? []).every((dependencyId) =>
        task.requirements.some((item) => item.id === dependencyId && item.status === '已满足'));
    });
    if (!nextRequirement) return;
    setRequirementStatus(task.id, nextRequirement.id, '进行中');
    setRequirementProgress(task.id, nextRequirement.id, nextRequirement.executionProgress ?? 0);
    if (nextRequirement.capability === 'report') {
      if (!task.reportDraft.aiCompletedAt) completeReportWithMockAi(false, false);
      setRequirementProgress(task.id, nextRequirement.id, 100);
      setRequirementStatus(task.id, nextRequirement.id, '已满足');
    }
  }, [completeReportWithMockAi, setRequirementProgress, setRequirementStatus, task]);

  const runningRequirement = task?.requirements.find((requirement) => requirement.status === '进行中' && requirement.capability !== 'report');
  useEffect(() => {
    if (!task || !runningRequirement || !project) return undefined;
    const timer = window.setInterval(() => {
      const latestTask = useTaskStore.getState().tasks.find((item) => item.id === task.id);
      const latestRequirement = latestTask?.requirements.find((item) => item.id === runningRequirement.id);
      if (!latestRequirement || latestRequirement.status !== '进行中') return;
      const nextProgress = Math.min(100, (latestRequirement.executionProgress ?? 0) + 10);
      setRequirementProgress(task.id, runningRequirement.id, nextProgress);
      if (nextProgress < 100) return;
      const existingReference = latestRequirement.artifactRefs?.find((reference) => reference.projectId === task.projectId);
      const existingArtifact = existingReference && useProjectStore.getState().projects
        .find((item) => item.id === existingReference.projectId)?.artifacts.find((item) => item.id === existingReference.artifactId);
      const artifact = existingArtifact ?? (() => {
        const input = createMockTaskCapabilityArtifact(latestRequirement, task.id, task.title);
        return input ? addArtifact(task.projectId, input) : null;
      })();
      if (artifact) addArtifactToTaskItem(task.id, runningRequirement.id, { projectId: artifact.projectId, artifactId: artifact.id });
      setRequirementStatus(task.id, runningRequirement.id, '已满足');
    }, 250);
    return () => window.clearInterval(timer);
  }, [addArtifact, addArtifactToTaskItem, project, runningRequirement, setRequirementProgress, setRequirementStatus, task]);

  if (!task) return <Card><Empty description="未找到这项任务，可能已被删除。"><Button onClick={() => navigate('/')}>返回任务中心</Button></Empty></Card>;

  const reportArtifactKeys = new Set(task.reportDraft.sections.flatMap((section) => section.artifactRefs.map((item) => `${item.projectId}:${item.artifactId}`)));
  const requirementsMet = task.requirements.filter((requirement) => requirement.status === '已满足').length;
  const executionProgress = task.requirements.length
    ? Math.round(task.requirements.reduce((total, requirement) => total + (requirement.status === '已满足' ? 100 : requirement.status === '进行中' ? requirement.executionProgress ?? 0 : 0), 0) / task.requirements.length)
    : 0;
  const addToReport = (projectId: string, artifactId: string) => {
    addArtifactToReport(task.id, { projectId, artifactId });
    message.success('成果已加入任务报告草稿');
  };
  const linkArtifactToRequirement = (projectId: string, artifactId: string, requirementId: string) => {
    addArtifactToTaskItem(task.id, requirementId, { projectId, artifactId });
    message.success('独立成果已关联到任务事项');
  };

  const openReportDraft = () => setActiveTab('report');

  const requirementsTab = (
    <div className="task-workbench-section">
      <Card
        size="small"
        title="任务书原文"
        extra={<Button icon={<FileSearchOutlined />} onClick={openTaskBookPreview}>打开原始任务书 PDF</Button>}
      >
        {task.sourceName && <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>{task.sourceName}</Text>}
        {task.sourceText
          ? <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{task.sourceText}</Paragraph>
          : <Alert type="info" showIcon message="尚未提取任务书正文" description="可直接打开原始 PDF 核对内容。任务事项及其来源定位显示在上方的规划复核区域。" />}
      </Card>
    </div>
  );

  const reportTab = (
    <div className="task-report-sections">
      <Alert
        type="info"
        showIcon
        message="报告在当前任务工作台内编制"
        description="原型模拟 AI 会根据已回流的专业成果补全空白章节，并将报告保存为结构化 JSON；已有正文不会被覆盖。"
        style={{ marginBottom: 12 }}
      />
      {task.reportDraft.sections.map((section) => (
        <Card key={section.id} title={section.title} size="small">
          <TextArea
            autoSize={{ minRows: 4, maxRows: 14 }}
            value={section.body}
            onChange={(event) => updateReportSection(task.id, section.id, event.target.value)}
            placeholder="在此持续编写报告正文。保存与任务状态会自动保留。"
          />
          {section.artifactRefs.length > 0 && (
            <div className="task-report-artifacts">
              {section.artifactRefs.map((reference) => {
                const artifact = artifacts.find((item) => item.id === reference.artifactId);
                return <Tag key={`${reference.projectId}:${reference.artifactId}`} color="blue">{artifact?.title ?? reference.artifactId}</Tag>;
              })}
            </div>
          )}
        </Card>
      ))}
      <Card
        size="small"
        title="结构化 JSON"
        extra={<Button size="small" icon={<FileTextOutlined />} onClick={downloadStructuredReport}>下载 JSON</Button>}
      >
        <Input.TextArea
          readOnly
          autoSize={{ minRows: 8, maxRows: 18 }}
          value={task.reportDraft.structuredJson ?? '{}'}
          style={{ fontFamily: 'Consolas, monospace', fontSize: 12 }}
        />
        {task.reportDraft.aiCompletedAt && <Text type="secondary">AI 最近补全：{new Date(task.reportDraft.aiCompletedAt).toLocaleString('zh-CN')}</Text>}
      </Card>
      <div className="task-report-footer">
        <Text type="secondary">报告草稿最近保存：{new Date(task.reportDraft.updatedAt).toLocaleString('zh-CN')} · 可随时继续编制</Text>
        <Space wrap>
          <Button icon={<FileTextOutlined />} onClick={() => completeReportWithMockAi()}>AI根据成果补全报告</Button>
          <Button type="primary" disabled={!task.reportDraft.aiCompletedAt || task.reportDraft.status === 'finalized'} onClick={confirmReportComplete}>确认报告完成</Button>
        </Space>
      </div>
    </div>
  );

  const artifactsTab = (
    <div className="task-workbench-section">
      {allArtifacts.length === 0 ? <Empty description="还没有保存的专业分析成果" /> : (
        <List
          dataSource={[...allArtifacts].sort((left, right) => right.artifact.updatedAt.localeCompare(left.artifact.updatedAt))}
          renderItem={({ artifact, projectName }) => {
            const inReport = reportArtifactKeys.has(`${artifact.projectId}:${artifact.id}`);
            const linkedRequirements = task.requirements.filter((requirement) => requirement.artifactRefs?.some((reference) =>
              reference.projectId === artifact.projectId && reference.artifactId === artifact.id));
            return (
              <List.Item actions={[
                inReport ? <Tag key="added" color="green">已加入报告</Tag> : <Button key="add" type="link" icon={<PlusOutlined />} onClick={() => addToReport(artifact.projectId, artifact.id)}>加入报告</Button>,
                ...linkedRequirements.map((requirement) => <Tag key={`linked-${requirement.id}`} color="cyan">已关联：{requirement.text}</Tag>),
                <Select
                  key="link"
                  size="small"
                  placeholder="关联到任务事项"
                  style={{ width: 180 }}
                  options={task.requirements.map((requirement) => ({ label: requirement.text, value: requirement.id }))}
                  onChange={(requirementId) => linkArtifactToRequirement(artifact.projectId, artifact.id, requirementId)}
                />,
              ]}>
                <List.Item.Meta title={<Space>{artifact.title}{artifact.projectId !== task.projectId && <Tag>独立成果</Tag>}</Space>} description={`${projectName} · ${artifact.source} · ${artifact.summary}`} />
              </List.Item>
            );
          }}
        />
      )}
    </div>
  );

  return (
    <div className="task-workbench-page">
      <WorkspacePageHeader
        title={task.title}
        level={3}
        context={(
          <Space wrap>
            <Tag color={task.status === '进行中' ? 'blue' : 'green'}>{task.status}</Tag>
            {task.sourceName && <Text type="secondary">任务书：{task.sourceName}</Text>}
            <Text type="secondary">关联项目：{project?.name ?? '未关联'}</Text>
          </Space>
        )}
        actions={(
          <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>任务中心</Button>
          <Button onClick={() => { setActiveProject(task.projectId); navigate('/projects'); }}>项目数据与成果</Button>
          <Button onClick={() => setTaskStatus(task.id, task.status === '已完成' ? '进行中' : '已完成')}>
            {task.status === '已完成' ? '重新打开任务' : '标记任务完成'}
          </Button>
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => { openReportDraft(); completeReportWithMockAi(); }}>AI整理任务报告</Button>
          </Space>
        )}
      />

      <div className="task-progress-summary">
        <div className="task-progress-meter"><span><strong>{executionProgress}%</strong> 任务执行进度 · {requirementsMet}/{task.requirements.length} 项事项已完成</span><Progress percent={executionProgress} size="small" /></div>
        <span><strong>{artifacts.length}</strong> 项分析成果</span>
        <span><strong>{task.reportDraft.sections.reduce((count, section) => count + section.artifactRefs.length, 0)}</strong> 项已关联报告</span>
        <span>报告草稿：<strong>{task.reportDraft.status === 'draft' ? '编制中' : '已确认完成'}</strong></span>
      </div>

      <Card
        className="task-execution-plan"
        title={<Space>任务规划复核{task.demo && <Tag color="purple">AI 模拟拆解</Tag>}</Space>}
        extra={<Space wrap><Button icon={<PlusOutlined />} onClick={openNewRequirement}>补充任务事项</Button><Text type="secondary">{task.demo ? '确认后，系统按前置关系自动配置并执行可开始事项' : '确认规划后可按前置要求启动事项'}</Text><Button type={task.planConfirmed ? 'default' : 'primary'} onClick={() => setPlanConfirmed(task.id, !task.planConfirmed)}>{task.planConfirmed ? '撤销确认并暂停' : task.demo ? '确认规划并开始自动执行' : '确认规划并解锁执行'}</Button></Space>}
      >
        {task.demo && <Alert className="task-demo-note" type="info" showIcon message={`原型模拟：${task.sourceName || '已选择的任务书 PDF'}尚未被实际解析；事项来源定位、推荐能力和分析输入均为预设演示数据，请先逐项核对后再确认规划。`} />}
        <Alert className="task-demo-note" type="warning" showIcon message="任务事项在当前工作台内自动执行" description="当前原型的执行进度和分析结果为模拟数据；确认规划后，系统会按已配置的前置关系逐项执行并将结果显示在对应事项下。" />
        <List
          className="task-plan-list"
          dataSource={task.requirements}
          renderItem={(requirement, index) => {
            const dependencies = (requirement.dependsOnIds ?? []).map((dependencyId) => task.requirements.find((item) => item.id === dependencyId)).filter(Boolean);
            const blocked = dependencies.filter((item) => item?.status !== '已满足');
            const stateLabel = requirement.status === '已满足' ? '已完成' : requirement.status === '进行中' ? '进行中' : blocked.length ? '等待前置事项' : '可开始';
            const capability = CAPABILITIES.find((item) => item.key === requirement.capability);
            return (
              <List.Item id={`task-item-${requirement.id}`} className={`task-plan-item ${requirement.status === '已满足' ? 'task-plan-item-done' : ''} ${focusedRequirementId === requirement.id ? 'task-plan-item-focused' : ''}`}>
                <div className="task-plan-index">{index + 1}</div>
                <div className="task-plan-body">
                  <Space wrap><Text strong>{requirement.text}</Text><Tag color={stateLabel === '已完成' ? 'green' : stateLabel === '可开始' ? 'blue' : 'default'}>{stateLabel}</Tag></Space>
                  <Text type="secondary">{requirement.recommendationReason ?? '根据任务要求选择合适的方式完成。'}</Text>
                  {dependencies.length > 0 && <Text className="task-plan-dependency" type="secondary">前置：{dependencies.map((item) => item?.text).join('；')}</Text>}
                  {requirement.sourceRef && (
                    <Button
                      type="link"
                      size="small"
                      icon={<FileSearchOutlined />}
                      style={{ alignSelf: 'flex-start', paddingInline: 0 }}
                      onClick={() => setSourcePreviewRequirement(requirement)}
                    >
                      任务书原文 · {requirement.sourceRef}
                    </Button>
                  )}
                  {requirement.sourceExcerpt && <Text type="secondary">依据摘录： “{requirement.sourceExcerpt}”</Text>}
                  {capability && <Space wrap><Tag color="geekblue">建议能力：{capability.label}</Tag>{requirement.recommendationReason && <Text type="secondary">推荐原因：{requirement.recommendationReason}</Text>}</Space>}
                  {(requirement.inputSummary || task.demo) && <Text type="secondary">已有数据 / 前置条件：{requirement.inputSummary ?? '任务书关联试验数据集（模拟）'}</Text>}
                  {requirement.status === '进行中' && (
                    <div className="task-item-execution-progress">
                      <Text type="secondary">{capability?.label ?? '事项执行'} · {requirement.executionProgress ?? 0}%</Text>
                      <Progress percent={requirement.executionProgress ?? 0} size="small" status="active" />
                    </div>
                  )}
                  {requirement.status !== '已满足' && <Button type="link" size="small" style={{ alignSelf: 'flex-start', paddingInline: 0 }} onClick={() => {
                    setSatisfactionRequirementId(requirement.id);
                    setSatisfactionNote('');
                    setSatisfactionArtifactKey(undefined);
                  }}>现有资料已满足？确认事项已满足</Button>}
                  {requirement.artifactRefs && requirement.artifactRefs.length > 0 && (
                    <div className="task-item-results">
                      <Text strong>本事项分析结果</Text>
                      {requirement.artifactRefs.map((reference) => {
                        const linkedArtifact = allProjects.find((candidate) => candidate.id === reference.projectId)?.artifacts.find((artifact) => artifact.id === reference.artifactId);
                        return linkedArtifact ? (
                          <Card key={`${reference.projectId}:${reference.artifactId}`} size="small" className="task-item-result-card">
                            <Space direction="vertical" size={4}>
                              <Button type="link" style={{ padding: 0, height: 'auto', alignSelf: 'flex-start' }} onClick={() => setSelectedArtifact(linkedArtifact)}>{linkedArtifact.title}</Button>
                              <Text type="secondary">{linkedArtifact.summary}</Text>
                              <Text type="secondary">{linkedArtifact.source}</Text>
                            </Space>
                          </Card>
                        ) : <Tag key={`${reference.projectId}:${reference.artifactId}`} color="cyan">成果：{reference.artifactId}</Tag>;
                      })}
                    </div>
                  )}
                </div>
                <Space wrap>
                  {requirement.status === '已满足' ? <Space direction="vertical" align="end">
                    <Tag color="green">{requirement.artifactRefs?.length ? '成果已回流' : '已确认由现有资料满足'}</Tag>
                    {requirement.satisfactionNote && <Text type="secondary" style={{ maxWidth: 240, textAlign: 'right' }}>满足依据：{requirement.satisfactionNote}</Text>}
                    <Button size="small" type="link" onClick={() => reopenSatisfiedRequirement(requirement.id)}>撤销满足确认</Button>
                  </Space> : task.planConfirmed
                    ? <Tag color={stateLabel === '可开始' && capability ? 'blue' : 'default'}>{stateLabel === '可开始' && capability ? '等待自动执行' : stateLabel}</Tag>
                    : <Tag color="default">等待人工复核</Tag>}
                  <Button size="small" icon={<EditOutlined />} onClick={() => openRequirementEditor(requirement)}>编辑事项</Button>
                  <Popconfirm
                    title="删除这项任务事项？"
                    description="已保存的专业成果不会删除，但后续事项将不再依赖它。"
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    onConfirm={() => deleteRequirement(requirement.id)}
                  >
                    <Button size="small" danger icon={<DeleteOutlined />}>删除事项</Button>
                  </Popconfirm>
                </Space>
              </List.Item>
            );
          }}
        />
      </Card>

      <Card className="task-content-card">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            { key: 'requirements', label: '任务书原文', children: requirementsTab },
            { key: 'report', label: '任务报告草稿', children: reportTab },
            { key: 'artifacts', label: `分析成果 (${artifacts.length})`, children: artifactsTab },
          ]}
        />
      </Card>

      <Modal
        title={editingRequirementId ? '编辑任务事项' : '补充任务事项'}
        open={requirementEditorOpen}
        okText="保存并重新复核"
        cancelText="取消"
        onOk={saveRequirement}
        onCancel={() => setRequirementEditorOpen(false)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={requirementText}
            onChange={(event) => setRequirementText(event.target.value)}
            placeholder="描述需要完成的业务事项"
          />
          <Select
            allowClear
            value={requirementCapability}
            onChange={setRequirementCapability}
            options={CAPABILITY_OPTIONS}
            placeholder="选择建议调用的专业能力（可选）"
            style={{ width: '100%' }}
          />
          <Text type="secondary">保存事项变更后，原规划确认会撤销；请复核完整计划后再开始执行。</Text>
        </Space>
      </Modal>

      <Modal
        title="确认事项已满足"
        open={Boolean(satisfactionRequirementId)}
        okText="保存核对并确认"
        cancelText="返回"
        onOk={confirmExistingEvidence}
        onCancel={() => setSatisfactionRequirementId(null)}
      >
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Text>{task.requirements.find((item) => item.id === satisfactionRequirementId)?.text}</Text>
          <Input.TextArea
            autoSize={{ minRows: 3, maxRows: 6 }}
            value={satisfactionNote}
            onChange={(event) => setSatisfactionNote(event.target.value)}
            placeholder="简要说明已核对的资料或结论（填写依据或关联成果至少一项）"
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            value={satisfactionArtifactKey}
            onChange={setSatisfactionArtifactKey}
            options={allArtifacts.map(({ artifact, projectName }) => ({
              value: JSON.stringify({ projectId: artifact.projectId, artifactId: artifact.id }),
              label: `${artifact.title} · ${projectName}`,
            }))}
            placeholder="关联一项已有成果（可选）"
            notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无可关联成果" />}
            style={{ width: '100%' }}
          />
          <Text type="secondary">填写核对依据或关联已有成果后，事项才会标记为已满足。撤销确认时，关联成果会保留。</Text>
        </Space>
      </Modal>

      <Modal
        title={selectedArtifact?.title ?? '分析结果'}
        open={Boolean(selectedArtifact)}
        footer={<Button type="primary" onClick={() => setSelectedArtifact(null)}>返回任务</Button>}
        onCancel={() => setSelectedArtifact(null)}
      >
        {selectedArtifact && (
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Space wrap><Tag color="blue">{selectedArtifact.source}</Tag><Tag>{selectedArtifact.status ?? '已保存'}</Tag></Space>
            <Paragraph>{selectedArtifact.summary}</Paragraph>
            <Card size="small" title="结构化结果">
              <pre className="task-artifact-payload">{JSON.stringify(selectedArtifact.payload, null, 2)}</pre>
            </Card>
          </Space>
        )}
      </Modal>

      <Drawer
        title={(
          <Space wrap>
            <span>任务书原文</span>
            {sourcePageRange && <Tag color="blue">第 {sourcePageRange.startPage}{sourcePageRange.endPage !== sourcePageRange.startPage ? `–${sourcePageRange.endPage}` : ''} 页</Tag>}
            {task.demo && !isGeneralTaskBookPreview && <Tag color="orange">模拟定位</Tag>}
          </Space>
        )}
        placement="right"
        width={760}
        open={Boolean(sourcePreviewRequirement)}
        onClose={() => setSourcePreviewRequirement(null)}
        destroyOnHidden
      >
        {sourcePreviewRequirement?.sourceExcerpt && (
          <Card size="small" title="事项摘录 · 辅助核对" style={{ marginBottom: 12 }}>
            <Text>{sourcePreviewRequirement.sourceExcerpt}</Text>
          </Card>
        )}
        {task.demo && !isGeneralTaskBookPreview && (
          <Alert
            type="warning"
            showIcon
            message="当前事项的页码和摘录是演示定位"
            description="下面显示的是你导入的原始 PDF；页码定位尚未由真实 AI 解析，请结合原文核对。"
            style={{ marginBottom: 12 }}
          />
        )}
        <input ref={sourcePdfPicker} type="file" accept="application/pdf,.pdf" onChange={handleTaskBookReplacement} hidden />
        {sourcePdfLoading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><Spin tip="正在打开任务书 PDF" /></div>
        ) : sourcePdfUrl ? (
          <iframe
            title="原始任务书 PDF"
            src={sourcePdfUrl}
            style={{ width: '100%', height: 'calc(100vh - 210px)', border: '1px solid #d9d9d9', borderRadius: 6 }}
          />
        ) : sourcePdfMissing || sourcePdfError ? (
          <Alert
            type={sourcePdfError ? 'error' : 'info'}
            showIcon
            message={sourcePdfError ? '暂时无法读取本机保存的 PDF' : '当前任务书 PDF 尚未保存在本机'}
            description="重新选择原始任务书 PDF 后，系统会保存在当前浏览器本机并在这里打开。"
            action={<Button icon={<UploadOutlined />} onClick={() => sourcePdfPicker.current?.click()}>选择任务书 PDF</Button>}
          />
        ) : null}
      </Drawer>
    </div>
  );
};

export default TaskWorkbench;
