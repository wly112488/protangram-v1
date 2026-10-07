import React, { useMemo } from 'react';
import { Alert, Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { BarChartOutlined, DatabaseOutlined, FileDoneOutlined, PlusOutlined, TableOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getProjectStats } from './projectModel';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import type { Project } from './types';

const { Text, Title } = Typography;

const formatTime = (value: string) => {
  try {
    return new Date(value).toLocaleString('zh-CN', { hour12: false });
  } catch {
    return value;
  }
};

const statusColor: Record<Project['status'], string> = {
  未开始: 'default',
  进行中: 'processing',
  已完成: 'success',
  已归档: 'default',
};

type NextStep = { key: string; title: string; description: string; route: string };

const getNextSteps = (_project: Project): NextStep[] => {
  return [
    { key: 'design', title: '试验设计', description: '根据需要规划或补充试验工况。', route: '/experiment/design/intelligent' },
    { key: 'analysis', title: '试验数据分析', description: '分析试验数据并形成结构化结果。', route: '/analysis/projects' },
    { key: 'calibration', title: '试验数字孪生', description: '校准模型并评估预测能力。', route: '/analysis/digital-twin' },
    { key: 'virtual', title: '虚拟工况扩展', description: '扩展工况并检查预测结果。', route: '/analysis/virtual-condition' },
  ];
};

const ProjectOverview: React.FC<{ project: Project }> = ({ project }) => {
  const navigate = useNavigate();
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const linkedTask = useTaskStore((state) => state.tasks.find((task) => task.projectId === project.id));
  const stats = useMemo(() => getProjectStats(project), [project]);
  const recentArtifacts = useMemo(
    () => [...project.artifacts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 4),
    [project.artifacts],
  );
  const nextSteps = useMemo(() => getNextSteps(project), [project]);

  const metricCards = [
    { key: 'datasets', label: '数据集', value: stats.datasetCount, icon: <DatabaseOutlined /> },
    { key: 'records', label: '试验记录', value: stats.worksheetRowCount, icon: <TableOutlined /> },
    { key: 'charts', label: '图表', value: stats.chartCount, icon: <BarChartOutlined /> },
    { key: 'artifacts', label: '业务结果', value: stats.artifactCount, icon: <FileDoneOutlined /> },
  ];

  return (
    <div className="workspace-overview">
      <section className="workspace-overview-hero">
        <div>
          <div className="workspace-kicker">{linkedTask ? '任务关联的数据与成果空间' : '独立项目的数据与成果空间'}</div>
          <Title level={2}>{project.name}</Title>
          <Text type="secondary">{project.description || '暂无项目说明'}</Text>
        </div>
        <div className="workspace-overview-status">
          <Tag color={statusColor[project.status]}>{project.status}</Tag>
          <Text type="secondary">最近更新：{formatTime(project.updatedAt)}</Text>
        </div>
      </section>

      {linkedTask && (
        <Alert
          showIcon
          type="info"
          message={`此项目关联正式任务：${linkedTask.title}`}
          description="项目概览对所有入口保持一致，负责查看数据、工作表和已保存成果；任务事项复核与执行安排在任务工作台继续。"
          action={<Button size="small" onClick={() => navigate(`/tasks/${linkedTask.id}`)}>返回任务工作台</Button>}
        />
      )}

      <section className="workspace-overview-grid workspace-overview-info-grid">
        <Card className="workspace-card" title="项目基础信息" bordered={false}>
          <dl className="workspace-definition-list">
            <div><dt>试验对象</dt><dd>{project.basicInfo.testObject || '—'}</dd></div>
            <div><dt>当前模型</dt><dd>{project.basicInfo.currentModel || '—'}</dd></div>
            <div><dt>项目状态</dt><dd>{project.status}</dd></div>
            <div><dt>创建时间</dt><dd>{formatTime(project.createdAt)}</dd></div>
          </dl>
        </Card>

        <Card className="workspace-card" title="试验工作表" bordered={false}>
          {project.worksheet ? (
            <div className="workspace-worksheet-summary">
              <div>
                <strong>{project.worksheet.name}</strong>
                <Text type="secondary">{stats.worksheetRowCount} 行 · {project.worksheet.columns.length} 列</Text>
              </div>
              <Button type="link" onClick={() => setActiveView('worksheet')}>打开工作表</Button>
            </div>
          ) : (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作表" />
          )}
        </Card>
      </section>

      <section className="workspace-metric-grid">
        {metricCards.map((metric) => (
          <Card className="workspace-metric-card" bordered={false} key={metric.key}>
            <span className="workspace-metric-icon">{metric.icon}</span>
            <div>
              <strong>{metric.value}</strong>
              <Text type="secondary">{metric.label}</Text>
            </div>
          </Card>
        ))}
      </section>

      <Card className="workspace-card workspace-next-steps-card" title={linkedTask ? '可按需使用专业能力' : '可按需使用专业能力'} bordered={false}>
        {linkedTask && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
            这些入口不会自动完成任务事项；结果先保存到项目。需要纳入正式任务时，可在任务工作台引用成果并人工确认。
          </Text>
        )}
        <div className="workspace-next-steps">
          {nextSteps.map((step) => (
            <div className="workspace-next-step" key={step.key}>
              <div>
                <strong>{step.title}</strong>
                <Text type="secondary">{step.description}</Text>
              </div>
              <Button
                type="primary"
                ghost
                icon={<PlusOutlined />}
                onClick={() => navigate(step.route, { state: { workspaceSession: { mode: 'project', targetProjectId: project.id } } })}
              >
                {linkedTask ? '独立分析' : step.key === 'analysis' ? '进入试验数据分析' : step.title}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="workspace-card workspace-recent-card" title="最近结果" bordered={false}>
        {recentArtifacts.length > 0 ? (
          <div className="workspace-recent-list">
            {recentArtifacts.map((artifact) => (
              <button
                type="button"
                className="workspace-recent-item"
                key={artifact.id}
                onClick={() => setActiveView(artifact.type)}
              >
                <div>
                  <strong>{artifact.title}</strong>
                  <Text type="secondary">{artifact.source}</Text>
                </div>
                <div className="workspace-recent-meta">
                  <span>{artifact.summary}</span>
                  <time>{formatTime(artifact.updatedAt)}</time>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存的业务结果" />
        )}
      </Card>

      {project.legacyItems && project.legacyItems.length > 0 && (
        <Card className="workspace-card" title="历史内容" bordered={false}>
          <Space wrap>{project.legacyItems.map((item) => <Tag key={item}>{item}</Tag>)}</Space>
        </Card>
      )}
    </div>
  );
};

export default ProjectOverview;
