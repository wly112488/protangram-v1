import React, { useMemo } from 'react';
import { Button, Card, Empty, Popconfirm, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import ProjectOverview from './ProjectOverview';
import { useProjectStore } from './projectStore';
import type { ProjectArtifact, ProjectArtifactType, ProjectView } from './types';
import { useSessionRouteState } from './useSessionState';
import { useSessionStore } from './sessionStore';

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

const readRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};

const displayValue = (value: unknown) => typeof value === 'string' || typeof value === 'number' ? String(value) : '';

const getArtifactFacts = (artifact: ProjectArtifact): string[] => {
  const payload = artifact.payload;
  const model = readRecord(payload.model);
  const facts: string[] = [];
  const add = (label: string, value: unknown) => {
    const text = displayValue(value);
    if (text) facts.push(`${label}：${text}`);
  };

  switch (artifact.type) {
    case 'design': {
      const plan = Array.isArray(payload.plan) ? payload.plan : [];
      const designSummary = readRecord(payload.designSummary);
      const config = readRecord(payload.config);
      add('试验次数', plan.length || payload.runCount || designSummary.runCount);
      add('目标响应', config.target);
      add('设计策略', config.strategy);
      add('预计覆盖率', typeof payload.coverage === 'number' ? `${payload.coverage}%` : undefined);
      add('高风险工况', payload.highRiskCount);
      break;
    }
    case 'analysis': {
      const config = readRecord(payload.config);
      add('异常范围', payload.abnormalRange);
      add('异常事件', Array.isArray(payload.anomalies) ? payload.anomalies.length : undefined);
      add('主要指标', Array.isArray(config.metrics) ? config.metrics.join('、') : undefined);
      add('结论', payload.conclusion);
      break;
    }
    case 'rootCause':
      add('异常范围', payload.affectedRange);
      add('主要根因', readRecord(payload.confirmedRootCause).reason);
      add('关联程度', readRecord(payload.confirmedRootCause).relevance);
      add('证据数量', Array.isArray(payload.evidence) ? payload.evidence.length : undefined);
      break;
    case 'calibration':
      add('校准模型', [displayValue(model.modelName), displayValue(model.version)].filter(Boolean).join(' '));
      add('校准结果', payload.errorLimit);
      add('可信度', typeof payload.credibility === 'number' ? `${payload.credibility}%` : undefined);
      add('可信范围', payload.trustedRange);
      break;
    case 'virtualCondition': {
      const conditions = Array.isArray(payload.conditions) ? payload.conditions : [];
      add('预测工况', Array.isArray(payload.conditions) ? payload.conditions.length : undefined);
      add('高风险工况', payload.highRiskCount);
      add('可信范围', payload.trustedRange);
      add('风险摘要', conditions.filter((condition) => readRecord(condition).risk === '高').length > 0
        ? `包含 ${conditions.filter((condition) => readRecord(condition).risk === '高').length} 个高风险工况`
        : undefined);
      break;
    }
    case 'report':
      add('报告状态', artifact.status);
      break;
  }

  return facts;
};

const ArtifactHistory: React.FC<{
  artifacts: ProjectArtifact[];
  projectId: string;
  view: ProjectArtifactType;
  isSessionWorkspace: boolean;
}> = ({ artifacts, projectId, view, isSessionWorkspace }) => {
  const navigate = useNavigate();
  const removeArtifact = useProjectStore((state) => state.removeArtifact);
  const setActiveView = useProjectStore((state) => state.setActiveView);
  const sorted = useMemo(
    () => [...artifacts].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [artifacts],
  );
  const latest = sorted[0];
  const route = routeByArtifactView[view];
  const latestFacts = latest ? getArtifactFacts(latest) : [];

  const deleteArtifact = (artifactId: string) => {
    removeArtifact(projectId, artifactId);
    if (sorted.length === 1) setActiveView('overview');
    message.success('结果已从项目中删除');
  };

  return (
    <div className="workspace-content-stack">
      <div className="workspace-content-heading">
        <div>
          <div className="workspace-kicker">{isSessionWorkspace ? '当前会话成果' : '项目内容'}</div>
          <Title level={3}>{viewLabels[view]}</Title>
          <Text type="secondary">{isSessionWorkspace ? '这里展示当前会话保存的结果和历史版本。' : '左侧只保留内容类别，具体执行结果和历史版本在这里管理。'}</Text>
        </div>
        {route && (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate(route, { state: { workspaceSession: { mode: 'project', targetProjectId: projectId } } })}
          >
            {latest ? `继续${viewLabels[view]}` : `新建${viewLabels[view]}`}
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
          {latestFacts.length > 0 && (
            <ul className="workspace-artifact-facts">
              {latestFacts.map((fact) => <li key={fact}>{fact}</li>)}
            </ul>
          )}
          <details className="workspace-artifact-debug">
            <summary>查看原始数据（调试信息）</summary>
            <pre className="workspace-artifact-payload">{JSON.stringify(latest.payload, null, 2)}</pre>
          </details>
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
  const incoming = useSessionRouteState();
  const sessionId = incoming?.workspaceSession?.sessionId;
  const sessionTitle = useSessionStore(state => state.sessions.find(item => item.id === sessionId)?.title);
  const storedActiveProjectId = useProjectStore((state) => state.activeProjectId);
  const activeProjectId = incoming?.workspaceSession?.targetProjectId ?? storedActiveProjectId;
  const activeView = useProjectStore((state) => state.activeView);
  const project = useProjectStore((state) => state.projects.find((item) => item.id === activeProjectId) ?? null);

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

  if (activeView === 'overview') return <ProjectOverview project={project} isSessionWorkspace={Boolean(sessionId)} sessionTitle={sessionTitle} />;
  if (activeView === 'worksheet') return <WorksheetView projectId={activeProjectId} />;
  if (activeView === 'charts') return <ChartsView projectId={activeProjectId} />;

  const artifacts = project.artifacts.filter((artifact) => artifact.type === activeView);
  return <ArtifactHistory artifacts={artifacts} projectId={activeProjectId} view={activeView} isSessionWorkspace={Boolean(sessionId)} />;
};

export default ProjectContent;
