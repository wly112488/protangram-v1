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

const MOCK_OUTPUTS = {
  dataAnalysis: { type: 'analysis' as const, title: '高转速异常数据分析', summary: '识别到 11,800–12,200 rpm 温升异常，主要影响因素为进气温度。', source: '试验数据分析 · 模拟结果', payload: { sampleSize: 48, anomalyRange: '11,800–12,200 rpm', chart: '模拟温度趋势图' } },
  digitalTwin: { type: 'calibration' as const, title: '高转速模型可信性评估', summary: '校准后验证集 R² = 0.94，12,000 rpm 附近存在可控偏差。', source: '试验数字孪生 · 模拟结果', payload: { r2: 0.94, validationSamples: 12, conclusion: '模型可用于限定范围的工况扩展' } },
  virtualCondition: { type: 'virtualCondition' as const, title: '高风险区间虚拟工况扩展', summary: '扩展 6 个未覆盖工况，识别 2 个建议优先验证的高风险点。', source: '虚拟工况扩展 · 模拟结果', payload: { generatedConditions: 6, highRiskConditions: 2 } },
  experimentDesign: { type: 'design' as const, title: '高风险区域补充验证方案', summary: '形成 8 组补充试验点，覆盖两个高风险区间及中心工况。', source: '智能试验设计 · 模拟结果', payload: { runCount: 8, factors: ['转速', '进气温度'], design: '模拟验证设计' } },
  report: { type: 'report' as const, title: '高转速区域分析报告（演示稿）', summary: '已将任务背景、分析结论、扩展工况和验证方案汇总为演示报告。', source: '任务报告 · 模拟生成', payload: { status: '演示稿', sections: ['任务背景与目标', '分析过程与结果', '结论与建议'] } },
};

const TaskWorkbench: React.FC = () => {
  const { taskId = '' } = useParams<{ taskId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const focusedRequirementId = new URLSearchParams(location.search).get('taskItemId');
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === taskId));
  const setRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const setTaskStatus = useTaskStore((state) => state.setTaskStatus);
  const setReportStatus = useTaskStore((state) => state.setReportStatus);
  const updateReportSection = useTaskStore((state) => state.updateReportSection);
  const addArtifactToReport = useTaskStore((state) => state.addArtifactToReport);
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const addArtifact = useProjectStore((state) => state.addArtifact);
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

  const openCapability = (path: string, source: BusinessRouteState['source'], taskItemId?: string) => navigate(`${path}?taskId=${encodeURIComponent(task.id)}${taskItemId ? `&taskItemId=${encodeURIComponent(taskItemId)}` : ''}`, {
    state: {
      source,
      task: {
        taskId: task.id,
        taskName: task.title,
        taskType: '任务书分析',
        source: task.sourceName || '任务中心',
        status: task.status === '已完成' ? '已完成' : '待执行',
      },
      ...createTaskNavigationState(task.id, task.projectId, taskItemId),
    },
  });
  const runRequirement = (requirementId: string) => {
    const requirement = task.requirements.find((item) => item.id === requirementId);
    if (!requirement?.capability) return;
    const unmetDependencies = (requirement.dependsOnIds ?? []).filter((dependencyId) =>
      task.requirements.some((item) => item.id === dependencyId && item.status !== '已满足'));
    if (unmetDependencies.length > 0) return message.info('请先完成此事项的前置要求');
    if (!task.demo) {
      if (requirement.capability === 'report') return openReportGeneration(requirement.id);
      const capability = CAPABILITIES.find((item) => item.key === requirement.capability);
      if (capability) openCapability(capability.path, capability.source, requirement.id);
      return;
    }
    const output = MOCK_OUTPUTS[requirement.capability];
    const artifact = addArtifact(task.projectId, {
      type: output.type,
      title: output.title,
      source: output.source,
      summary: output.summary,
      payload: output.payload,
    });
    if (!artifact) return message.error('无法保存模拟成果，请检查关联项目');
    addArtifactToTaskItem(task.id, requirement.id, { projectId: artifact.projectId, artifactId: artifact.id });
    addArtifactToReport(task.id, { projectId: artifact.projectId, artifactId: artifact.id });
    setRequirementStatus(task.id, requirement.id, '已满足');
    if (requirement.capability === 'report') setReportStatus(task.id, 'finalized');
    message.success('模拟分析已完成，成果已回到任务并加入报告草稿');
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
              disabled={task.demo}
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
        title={<Space>任务执行计划{task.demo && <Tag color="purple">AI 模拟拆解</Tag>}</Space>}
        extra={<Text type="secondary">事项表达任务要求，工具只是完成事项的手段</Text>}
      >
        {task.demo && <Alert className="task-demo-note" type="info" showIcon message={`原型模拟：${task.sourceName || '已选择的任务书 PDF'}目前只记录文件名，尚未解析内容；以下事项拆解与专业分析结果为模拟数据。`} />}
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
                  {capability && <Space wrap><Tag color="geekblue">建议能力：{capability.label}</Tag>{requirement.sourceRef && <Text type="secondary">来源：{requirement.sourceRef}</Text>}</Space>}
                  {requirement.artifactRefs && requirement.artifactRefs.length > 0 && <Space wrap>{requirement.artifactRefs.map((reference) => {
                    const linkedArtifact = allProjects.find((candidate) => candidate.id === reference.projectId)?.artifacts.find((artifact) => artifact.id === reference.artifactId);
                    return <Tag key={`${reference.projectId}:${reference.artifactId}`} color="cyan">成果：{linkedArtifact?.title ?? reference.artifactId}</Tag>;
                  })}</Space>}
                </div>
                {requirement.status === '已满足' ? <Tag color="green">成果已回流</Tag> : (
                  <Button size="small" type={stateLabel === '可开始' ? 'primary' : 'default'} disabled={Boolean(blocked.length)} onClick={() => runRequirement(requirement.id)}>
                    {task.demo ? requirement.capability === 'report' ? '生成模拟报告' : '模拟执行并回传' : requirement.capability === 'report' ? '编制报告' : stateLabel === '进行中' ? '继续事项' : '开始事项'}
                  </Button>
                )}
              </List.Item>
            );
          }}
        />
      </Card>

      <Card className="task-capabilities-card" title="按任务需要调用专业能力" extra={<Text type="secondary">没有固定先后顺序，可重复调用</Text>}>
        <div className="task-capability-grid">
          {CAPABILITIES.map((capability) => (
            <button key={capability.path} type="button" className="task-capability" onClick={() => openCapability(capability.path, capability.source)}>
              <strong>{capability.label}</strong><span>{capability.description}</span>
            </button>
          ))}
        </div>
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
