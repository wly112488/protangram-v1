import React, { useMemo } from 'react';
import { Button, Card, Empty, Space, Tag, Typography } from 'antd';
import { BarChartOutlined, DatabaseOutlined, FileDoneOutlined, TableOutlined } from '@ant-design/icons';
import { getProjectStats } from './projectModel';
import { useProjectStore } from './projectStore';
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

const ProjectOverview: React.FC<{ project: Project }> = ({ project }) => {
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const stats = useMemo(() => getProjectStats(project), [project]);
  const recentArtifacts = useMemo(
    () => [...project.artifacts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).slice(0, 4),
    [project.artifacts],
  );

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
          <div className="workspace-kicker">当前项目</div>
          <Title level={2}>{project.name}</Title>
          <Text type="secondary">{project.description || '暂无项目说明'}</Text>
        </div>
        <div className="workspace-overview-status">
          <Tag color={statusColor[project.status]}>{project.status}</Tag>
          <Text type="secondary">最近更新：{formatTime(project.updatedAt)}</Text>
        </div>
      </section>

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
