import React from 'react';
import { Button, Empty, Space, Tag, Typography } from 'antd';
import { DatabaseOutlined, FileTextOutlined, LineChartOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ExperimentWorkspace, WindowBounds, WorkbenchWindow as WorkbenchWindowModel } from './workbenchModel';
import WorksheetNetwork from './WorksheetNetwork';
import WorkbenchWindow from './WorkbenchWindow';

const { Paragraph, Text, Title } = Typography;

interface FreeCanvasProps {
  experiment: ExperimentWorkspace;
  onWindowFocus: (windowId: string) => void;
  onWindowBoundsChange: (windowId: string, bounds: Partial<WindowBounds>) => void;
  onWindowMinimize: (windowId: string) => void;
  onWindowClose: (windowId: string) => void;
}

const renderWindowBody = (experiment: ExperimentWorkspace, window: WorkbenchWindowModel) => {
  const resource = experiment.resources.find((item) => item.id === window.resourceId);
  if (window.kind === 'worksheet-network') {
    return <WorksheetNetwork nodes={experiment.worksheetNodes} edges={experiment.worksheetEdges} />;
  }
  if (window.kind === 'chart') {
    return (
      <div className="chart-preview">
        <div className="chart-preview-bars">
          {[44, 68, 52, 86, 61, 72, 58, 90].map((height, index) => (
            <span key={index} style={{ height }} />
          ))}
        </div>
        <Text type="secondary">图表窗口保留独立位置，可与工作表网络并排查看。</Text>
      </div>
    );
  }
  if (window.kind === 'worksheet') {
    return (
      <div className="worksheet-preview">
        <div className="worksheet-preview-head">
          <DatabaseOutlined />
          <Text strong>{resource?.title}</Text>
        </div>
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>因子 A</th>
              <th>因子 B</th>
              <th>响应值</th>
              <th>状态</th>
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5].map((row) => (
              <tr key={row}>
                <td>{row}</td>
                <td>{(20 + row * 2).toFixed(1)}</td>
                <td>{(0.6 + row * 0.14).toFixed(2)}</td>
                <td>{(86 + row * 1.7).toFixed(2)}</td>
                <td><Tag color={row % 2 ? 'processing' : 'success'}>{row % 2 ? '处理中' : '已校验'}</Tag></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (window.kind === 'analysis') {
    return (
      <Space direction="vertical" size={12} className="window-stack">
        <Title level={5}>分析执行链路</Title>
        {['导入数据', '字段映射', '计算模块', '对比分析', '结果输出'].map((step, index) => (
          <div className="run-step" key={step}>
            <PlayCircleOutlined />
            <Text>{step}</Text>
            <Tag color={index < 3 ? 'success' : 'processing'}>{index < 3 ? '完成' : '等待'}</Tag>
          </div>
        ))}
      </Space>
    );
  }
  if (window.kind === 'report') {
    return (
      <Space direction="vertical" className="window-stack">
        <Title level={5}>报告绑定</Title>
        <Paragraph type="secondary">将分析结果表、图表和参数明细绑定到 Word 报告模板标签。</Paragraph>
        {['${试验名称}', '${关键响应图}', '${分析结论}', '${数据表清单}'].map((tag) => (
          <div className="binding-row" key={tag}>
            <FileTextOutlined />
            <Text code>{tag}</Text>
            <Text type="secondary">已关联当前实验资源</Text>
          </div>
        ))}
      </Space>
    );
  }
  return (
    <Space direction="vertical" className="window-stack">
      <Title level={5}>{resource?.title ?? window.title}</Title>
      <Paragraph>{resource?.description}</Paragraph>
      <Text type="secondary">该窗口可自由拖拽、缩放、最小化或关闭。</Text>
    </Space>
  );
};

const FreeCanvas: React.FC<FreeCanvasProps> = ({
  experiment,
  onWindowFocus,
  onWindowBoundsChange,
  onWindowMinimize,
  onWindowClose,
}) => (
  <main className="free-canvas">
    <div className="canvas-toolbar">
      <Space>
        <LineChartOutlined />
        <Text strong>{experiment.name}</Text>
        <Tag color="blue">自由画布</Tag>
      </Space>
      <Text type="secondary">{experiment.windows.length} 个窗口</Text>
    </div>
    <div className="canvas-stage">
      {experiment.windows.length === 0 && (
        <Empty description="从左侧资源目录选择图表、表格或报告资源" className="canvas-empty" />
      )}
      {[...experiment.windows]
        .sort((a, b) => a.zIndex - b.zIndex)
        .map((window) => (
          <WorkbenchWindow
            key={window.id}
            window={window}
            onFocus={() => onWindowFocus(window.id)}
            onBoundsChange={(bounds) => onWindowBoundsChange(window.id, bounds)}
            onMinimize={() => onWindowMinimize(window.id)}
            onClose={() => onWindowClose(window.id)}
          >
            {renderWindowBody(experiment, window)}
          </WorkbenchWindow>
        ))}
    </div>
  </main>
);

export default FreeCanvas;
