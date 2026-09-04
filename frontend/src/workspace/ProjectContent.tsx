import React, { useMemo } from 'react';
import { Button, Card, Empty, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ProjectOverview from './ProjectOverview';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact, ProjectArtifactType, ProjectView } from './types';

const { Text, Title } = Typography;

const viewLabels: Record<ProjectView, string> = {
  overview: '项目概览',
  worksheet: '试验工作表',
  charts: '数据图表',
  design: '智能试验设计',
  analysis: '试验数据分析',
  rootCause: '根因分析',
  calibration: '模型校准',
  virtualCondition: '虚拟工况',
  report: '报告',
};

const routeByArtifactView: Partial<Record<ProjectArtifactType, string>> = {
  design: '/experiment/design/intelligent',
  analysis: '/analysis/projects',
  rootCause: '/analysis/projects',
  calibration: '/analysis/digital-twin',
  virtualCondition: '/analysis/virtual-condition',
  report: '/report/list',
};

const formatTime = (value: string) => new Date(value).toLocaleString('zh-CN', { hour12: false });

const ArtifactHistory: React.FC<{
  artifacts: ProjectArtifact[];
  projectId: string;
  view: ProjectArtifactType;
}> = ({ artifacts, projectId, view }) => {
  const navigate = useNavigate();
  const removeArtifact = useProjectStore((state) => state.removeArtifact);
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const sorted = useMemo(
    () => [...artifacts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [artifacts],
  );
  const latest = sorted[0];
  const route = routeByArtifactView[view];

  const deleteArtifact = (artifactId: string) => {
    removeArtifact(projectId, artifactId);
    if (sorted.length === 1) setActiveView('overview');
    message.success('结果已从项目中删除');
  };

  return (
    <div className="workspace-content-stack">
      <div className="workspace-content-heading">
        <div>
          <div className="workspace-kicker">项目内容</div>
          <Title level={3}>{viewLabels[view]}</Title>
          <Text type="secondary">左侧只保留内容类别，具体执行结果和历史版本在这里管理。</Text>
        </div>
        {route && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(route, { state: { workspaceSession: { mode: 'project', targetProjectId: projectId } } })}
          >
            新建{viewLabels[view]}
          </Button>
        )}
      </div>

      {latest ? (
        <Card className="workspace-card workspace-latest-artifact" bordered={false}>
          <div className="workspace-artifact-head">
            <div>
              <Tag color="blue">当前最新结果</Tag>
              <Title level={4}>{latest.title}</Title>
              <Text type="secondary">{latest.source} · {formatTime(latest.updatedAt)}</Text>
            </div>
            <Popconfirm title="确认删除这个结果？" onConfirm={() => deleteArtifact(latest.id)}>
              <Button type="text" danger icon={<DeleteOutlined />}>删除</Button>
            </Popconfirm>
          </div>
          <p className="workspace-artifact-summary">{latest.summary}</p>
          <pre className="workspace-artifact-payload">{JSON.stringify(latest.payload, null, 2)}</pre>
        </Card>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无${viewLabels[view]}结果`} />
      )}

      {sorted.length > 1 && (
        <Card className="workspace-card" title="历史记录" bordered={false}>
          <div className="workspace-artifact-history">
            {sorted.slice(1).map((artifact) => (
              <div className="workspace-artifact-history-row" key={artifact.id}>
                <div>
                  <strong>{artifact.title}</strong>
                  <Text type="secondary">{artifact.summary}</Text>
                </div>
                <Space>
                  <Text type="secondary">{formatTime(artifact.updatedAt)}</Text>
                  <Popconfirm title="确认删除这个历史结果？" onConfirm={() => deleteArtifact(artifact.id)}>
                    <Button type="text" danger size="small" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </Space>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};

const WorksheetView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId) ?? null);
  if (!project?.worksheet) return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无工作表" />;

  const rowNumbers = [...new Set(Object.keys(project.worksheet.data).map((key) => Number(key.split('-')[0])).filter(Number.isFinite))].sort((a, b) => a - b);

  return (
    <div className="workspace-content-stack">
      <div className="workspace-content-heading">
        <div>
          <div className="workspace-kicker">{project.name}</div>
          <Title level={3}>{project.worksheet.name}</Title>
          <Text type="secondary">{rowNumbers.length} 行 · {project.worksheet.columns.length} 列</Text>
        </div>
      </div>
      <Card className="workspace-card workspace-worksheet-card" bordered={false}>
        <div className="workspace-table-scroll">
          <table className="workspace-data-table">
            <thead>
              <tr><th>#</th>{project.worksheet.columns.map((column) => <th key={column}>{column}</th>)}</tr>
            </thead>
            <tbody>
              {rowNumbers.map((row) => (
                <tr key={row}>
                  <th>{row}</th>
                  {project.worksheet?.columns.map((column) => <td key={`${row}-${column}`}>{project.worksheet?.data[`${row}-${column}`] ?? ''}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

const ChartsView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const project = useProjectStore((state) => state.projects.find((item) => item.id === projectId) ?? null);
  const chartEntries = useMemo(() => {
    if (!project) return [];
    return project.artifacts.flatMap((artifact) => {
      const charts = artifact.payload.charts;
      if (!Array.isArray(charts)) return [];
      return charts.map((chart, index) => {
        const record = typeof chart === 'object' && chart !== null ? chart as Record<string, unknown> : {};
        return {
          key: `${artifact.id}-${String(record.id ?? index)}`,
          title: String(record.title ?? `图表 ${index + 1}`),
          source: artifact.title,
          artifactType: artifact.type,
        };
      });
    });
  }, [project]);

  return (
    <div className="workspace-content-stack">
      <div className="workspace-content-heading">
        <div>
          <div className="workspace-kicker">项目聚合视图</div>
          <Title level={3}>数据图表</Title>
          <Text type="secondary">聚合项目中已正式保存的分析、校准和虚拟工况结果图表。</Text>
        </div>
      </div>
      {chartEntries.length > 0 ? (
        <div className="workspace-chart-grid">
          {chartEntries.map((chart) => (
            <Card className="workspace-card workspace-chart-card" bordered={false} key={chart.key}>
              <div className="workspace-chart-placeholder">图表</div>
              <strong>{chart.title}</strong>
              <Text type="secondary">来自：{chart.source}</Text>
            </Card>
          ))}
        </div>
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存图表" />
      )}
    </div>
  );
};

const ProjectContent: React.FC = () => {
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const activeView = useProjectStore((state) => state.activeView);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === state.activeProjectId) ?? null);

  if (!project || !activeProjectId) {
    return (
      <div className="workspace-empty-center">
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={<div><strong>选择或新建一个项目</strong><p>项目用于沉淀工作表和已确认的业务结果；顶部业务能力仍可独立使用。</p></div>}
        />
      </div>
    );
  }

  if (activeView === 'overview') return <ProjectOverview project={project} />;
  if (activeView === 'worksheet') return <WorksheetView projectId={activeProjectId} />;
  if (activeView === 'charts') return <ChartsView projectId={activeProjectId} />;

  const artifacts = project.artifacts.filter((artifact) => artifact.type === activeView);
  return <ArtifactHistory artifacts={artifacts} projectId={activeProjectId} view={activeView} />;
};

export default ProjectContent;
