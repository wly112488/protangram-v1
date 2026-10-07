import React, { useEffect } from 'react';
import { Alert, Button, Card, Checkbox, Empty, Input, List, Progress, Select, Space, Tabs, Tag, Typography, message } from 'antd';
import { ArrowLeftOutlined, FileTextOutlined, PlusOutlined } from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { BusinessRouteState } from '@/types/businessContext';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { createTaskNavigationState } from './businessSessionModel';
import WorkspacePageHeader from './WorkspacePageHeader';
import './taskWorkspace.css';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

const CAPABILITIES = [
  { key: 'experimentDesign' as const, label: '试验设计', path: '/experiment/design/intelligent', source: 'intelligentDesign' as const, description: '设计或补充试验方案' },
  { key: 'dataAnalysis' as const, label: '试验数据分析', path: '/analysis/projects', source: 'dataAnalysis' as const, description: '分析试验数据并识别异常' },
  { key: 'digitalTwin' as const, label: '试验数字孪生', path: '/analysis/digital-twin', source: 'digitalTwin' as const, description: '校准模型并检查预测能力' },
  { key: 'virtualCondition' as const, label: '虚拟工况扩展', path: '/analysis/virtual-condition', source: 'virtualCondition' as const, description: '扩展工况并形成验证结果' },
];

const TaskWorkbench: React.FC = () => {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const focusedRequirementId = new URLSearchParams(location.search).get('taskItemId');
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const setPlanConfirmed = useTaskStore((state) => state.setPlanConfirmed);
  const setTaskStatus = useTaskStore((state) => state.setTaskStatus);
  const updateReportSection = useTaskStore((state) => state.updateReportSection);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === task?.projectId));
  const allProjects = useProjectStore((state) => state.projects);
  const artifacts = project?.artifacts ?? [];
  const allArtifacts = allProjects.flatMap((sourceProject) => sourceProject.artifacts.map((artifact) => ({
    artifact,
    projectName: sourceProject.name,
  })));

  useEffect(() => {
    if (!focusedRequirementId) return;
    window.requestAnimationFrame(() => {
      document.getElementById(`task-item-${focusedRequirementId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedRequirementId, taskId]);

  useEffect(() => {
    if (!task?.demo || !task.planConfirmed) return;
    const nextRequirement = task.requirements.find((requirement) => {
      if (requirement.status === '已满足' || !requirement.capability) return false;
      return (requirement.dependsOnIds ?? []).every((dependencyId) =>
        task.requirements.some((item) => item.id === dependencyId && item.status === '已满足'));
    });
    if (!nextRequirement) return;
    if (nextRequirement.capability === 'report') {
      navigate(`/report/create?taskId=${encodeURIComponent(task.id)}&taskItemId=${encodeURIComponent(nextRequirement.id)}`, {
        state: { source: 'dataAnalysis', ...createTaskNavigationState(task.id, task.projectId, nextRequirement.id) },
      });
      return;
    }
    const capability = CAPABILITIES.find((item) => item.key === nextRequirement.capability);
    if (!capability) return;
    const dependencyArtifacts = (nextRequirement.dependsOnIds ?? [])
      .flatMap((dependencyId) => task.requirements.find((item) => item.id === dependencyId)?.artifactRefs ?? [])
      .map((reference) => allProjects.find((item) => item.id === reference.projectId)?.artifacts.find((item) => item.id === reference.artifactId))
      .filter((artifact) => artifact !== undefined);
    navigate(`${capability.path}?taskId=${encodeURIComponent(task.id)}&taskItemId=${encodeURIComponent(nextRequirement.id)}`, {
      state: {
        source: capability.source,
        autoExecute: true,
        artifactIds: dependencyArtifacts.map((artifact) => artifact.id),
        result: dependencyArtifacts.length ? {
          resultType: '前置事项成果',
          resultSummary: dependencyArtifacts.map((artifact) => `${artifact.title}：${artifact.summary}`).join('；'),
          abnormalRange: '11800～12200 rpm',
          metrics: ['出口温度', '推力'],
        } : undefined,
        validation: {
          goal: nextRequirement.text,
          suggestedRange: '11800～12200 rpm',
          highRiskRange: '11800～12200 rpm',
          metrics: ['出口温度', '推力'],
          recommendedRuns: nextRequirement.capability === 'experimentDesign' ? 8 : 6,
        },
        data: {
          dataId: `${task.id}-${nextRequirement.id}-input`,
          dataName: dependencyArtifacts[0]?.title ?? '任务关联试验数据集（模拟）',
          dataType: '试验数据',
          source: task.sourceName || '任务书',
          taskId: task.id,
        },
        task: {
          taskId: task.id, taskName: task.title, taskType: '任务书分析',
          source: task.sourceName || '任务中心', status: task.status === '已完成' ? '已完成' : '待执行',
        },
        ...createTaskNavigationState(task.id, task.projectId, nextRequirement.id),
      },
    });
  }, [navigate, task]);

  if (!task) return <Card><Empty description="未找到这项任务，可能已被删除。"><Button onClick={() => navigate('/')}>返回任务中心</Button></Empty></Card>;

  const reportArtifactKeys = new Set(task.reportDraft.sections.flatMap((section) => section.artifactRefs.map((item) => `${item.projectId}:${item.artifactId}`)));
  const requirementsMet = task.requirements.filter((requirement) => requirement.status === '已满足').length;
  const planProgress = task.requirements.length ? Math.round((requirementsMet / task.requirements.length) * 100) : 0;
  const addToReport = (projectId: string, artifactId: string) => {
    addArtifactToReport(task.id, { projectId, artifactId });
    message.success('成果已加入任务报告草稿');
  };
  const linkArtifactToRequirement = (projectId: string, artifactId: string, requirementId: string) => {
    addArtifactToTaskItem(task.id, requirementId, { projectId, artifactId });
    message.success('独立成果已关联到任务事项');
  };

  const openCapability = (requirement: NonNullable<typeof task>['requirements'][number], capability: typeof CAPABILITIES[number]) => {
    const dependencyArtifacts = (requirement.dependsOnIds ?? [])
      .flatMap((dependencyId) => task.requirements.find((item) => item.id === dependencyId)?.artifactRefs ?? [])
      .map((reference) => allProjects.find((item) => item.id === reference.projectId)?.artifacts.find((item) => item.id === reference.artifactId))
      .filter((artifact) => artifact !== undefined);
    const suggestedRange = requirement.capability === 'dataAnalysis' ? '11800～12200 rpm'
      : requirement.capability === 'digitalTwin' ? '11800～12200 rpm'
        : requirement.capability === 'virtualCondition' ? '11800～12200 rpm'
          : '11800～12200 rpm';
    const validation: NonNullable<BusinessRouteState['validation']> = {
      goal: requirement.text,
      suggestedRange,
      highRiskRange: suggestedRange,
      metrics: ['出口温度', '推力'],
      recommendedRuns: requirement.capability === 'experimentDesign' ? 8 : 6,
    };
    navigate(`${capability.path}?taskId=${encodeURIComponent(task.id)}&taskItemId=${encodeURIComponent(requirement.id)}`, {
    state: {
      source: capability.source,
      autoExecute: Boolean(task.planConfirmed && task.demo),
      validation,
      result: dependencyArtifacts.length > 0 ? {
        resultType: '前置事项成果',
        resultSummary: dependencyArtifacts.map((artifact) => `${artifact.title}：${artifact.summary}`).join('；'),
        abnormalRange: suggestedRange,
        metrics: validation.metrics,
      } : undefined,
      data: {
        dataId: `${task.id}-${requirement.id}-input`,
        dataName: dependencyArtifacts[0]?.title ?? '任务书关联试验数据集（模拟）',
        dataType: '试验数据',
        source: task.sourceName || '任务书',
        taskId: task.id,
      },
      task: {
        taskId: task.id,
        taskName: task.title,
        taskType: '任务书分析',
        source: task.sourceName || '任务中心',
        status: task.status === '已完成' ? '已完成' : '待执行',
      },
      ...createTaskNavigationState(task.id, task.projectId, requirement.id),
    },
  });
  };
  const runRequirement = (requirementId: string) => {
    const requirement = task.requirements.find((item) => item.id === requirementId);
    if (!requirement?.capability) return;
    const unmetDependencies = (requirement.dependsOnIds ?? []).filter((dependencyId) =>
      task.requirements.some((item) => item.id === dependencyId && item.status !== '已满足'));
    if (unmetDependencies.length > 0) return message.info('请先完成此事项的前置要求');
    if (!task.planConfirmed) return message.info('请先复核并确认任务规划，再开始执行事项');
    if (requirement.capability === 'report') return openReportGeneration(requirement.id);
    const capability = CAPABILITIES.find((item) => item.key === requirement.capability);
    if (capability) openCapability(requirement, capability);
  };
  const openReportGeneration = (taskItemId?: string) => {
    navigate(`/report/create?taskId=${encodeURIComponent(task.id)}${taskItemId ? `&taskItemId=${encodeURIComponent(taskItemId)}` : ''}`, { state: { source: 'dataAnalysis', ...createTaskNavigationState(task.id, task.projectId, taskItemId) } });
  };

  const requirementsTab = (
    <div className="task-workbench-section">
      {task.sourceText && <Card size="small" title="任务书内容" className="task-source-card"><Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{task.sourceText}</Paragraph></Card>}
      {task.requirements.length === 0 && <Alert type="info" showIcon message="还没有拆分任务要求" description="可以先记录需要完成的事项；要求可随任务推进随时补充。" />}
      <List
        dataSource={task.requirements}
        renderItem={(requirement) => (
          <List.Item>
            <Checkbox
              checked={requirement.status === '已满足'}
              onChange={(event) => setRequirementStatus(task.id, requirement.id, event.target.checked ? '已满足' : '待完成')}
              disabled={false}
            >{requirement.text}</Checkbox>
          </List.Item>
        )}
      />
    </div>
  );

  const reportTab = (
    <div className="task-report-sections">
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
      <div className="task-report-footer">
        <Text type="secondary">草稿最近保存：{new Date(task.reportDraft.updatedAt).toLocaleString('zh-CN')}</Text>
        <Button type="primary" icon={<FileTextOutlined />} onClick={() => openReportGeneration()}>继续正式报告生成</Button>
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
          <Button type="primary" icon={<FileTextOutlined />} onClick={() => openReportGeneration()}>生成正式报告</Button>
          </Space>
        )}
      />

      <div className="task-progress-summary">
        <div className="task-progress-meter"><span><strong>{requirementsMet}/{task.requirements.length}</strong> 项事项已完成</span><Progress percent={planProgress} size="small" /></div>
        <span><strong>{artifacts.length}</strong> 项分析成果</span>
        <span><strong>{task.reportDraft.sections.reduce((count, section) => count + section.artifactRefs.length, 0)}</strong> 项已关联报告</span>
        <span>报告草稿：<strong>{task.reportDraft.status === 'draft' ? '编制中' : '已进入正式报告'}</strong></span>
      </div>

      <Card
        className="task-execution-plan"
        title={<Space>任务规划复核{task.demo && <Tag color="purple">AI 模拟拆解</Tag>}</Space>}
        extra={<Space><Text type="secondary">{task.demo ? '确认后，系统按前置关系自动配置并执行可开始事项' : '确认规划后可按前置要求启动事项'}</Text><Button type={task.planConfirmed ? 'default' : 'primary'} onClick={() => setPlanConfirmed(task.id, !task.planConfirmed)}>{task.planConfirmed ? '撤销确认并暂停' : task.demo ? '确认规划并开始自动执行' : '确认规划并解锁执行'}</Button></Space>}
      >
        {task.demo && <Alert className="task-demo-note" type="info" showIcon message={`原型模拟：${task.sourceName || '已选择的任务书 PDF'}尚未被实际解析；事项来源定位、推荐能力和分析输入均为预设演示数据，请先逐项核对后再确认规划。`} />}
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
                  {requirement.sourceRef && <Text type="secondary">任务书依据：{requirement.sourceRef}</Text>}
                  {requirement.sourceExcerpt && <Text type="secondary">依据摘录： “{requirement.sourceExcerpt}”</Text>}
                  {capability && <Space wrap><Tag color="geekblue">建议能力：{capability.label}</Tag>{requirement.recommendationReason && <Text type="secondary">推荐原因：{requirement.recommendationReason}</Text>}</Space>}
                  {(requirement.inputSummary || task.demo) && <Text type="secondary">已有数据 / 前置条件：{requirement.inputSummary ?? '任务书关联试验数据集（模拟）'}</Text>}
                  {task.demo && <Checkbox checked={requirement.status === '已满足'} onChange={(event) => setRequirementStatus(task.id, requirement.id, event.target.checked ? '已满足' : '待完成')}>现有资料已满足此事项</Checkbox>}
                  {requirement.artifactRefs && requirement.artifactRefs.length > 0 && <Space wrap>{requirement.artifactRefs.map((reference) => {
                    const linkedArtifact = allProjects.find((candidate) => candidate.id === reference.projectId)?.artifacts.find((artifact) => artifact.id === reference.artifactId);
                    return <Tag key={`${reference.projectId}:${reference.artifactId}`} color="cyan">成果：{linkedArtifact?.title ?? reference.artifactId}</Tag>;
                  })}</Space>}
                </div>
                {requirement.status === '已满足' ? <Tag color="green">{requirement.artifactRefs?.length ? '成果已回流' : '已确认由现有资料满足'}</Tag> : task.demo ? (
                  <Tag color={task.planConfirmed && stateLabel === '可开始' ? 'blue' : 'default'}>{task.planConfirmed && stateLabel === '可开始' ? '自动调度中' : task.planConfirmed ? stateLabel : '等待人工复核'}</Tag>
                ) : (
                  <Button size="small" type={stateLabel === '可开始' ? 'primary' : 'default'} disabled={Boolean(blocked.length) || !task.planConfirmed} onClick={() => runRequirement(requirement.id)}>
                    {requirement.capability === 'report' ? '开始编制报告' : task.demo ? '自动配置并执行' : stateLabel === '进行中' ? '继续事项' : '开始事项'}
                  </Button>
                )}
              </List.Item>
            );
          }}
        />
      </Card>

      <Card className="task-content-card">
        <Tabs
          items={[
            { key: 'requirements', label: `任务要求 (${task.requirements.length})`, children: requirementsTab },
            { key: 'report', label: '任务报告草稿', children: reportTab },
            { key: 'artifacts', label: `分析成果 (${artifacts.length})`, children: artifactsTab },
          ]}
        />
      </Card>
    </div>
  );
};

export default TaskWorkbench;
