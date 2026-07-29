import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Modal, Table, message, Space, Tag, Upload, Tabs, Select, InputNumber, Divider, Input,
} from 'antd';
import {
  ArrowLeftOutlined, PlayCircleOutlined, CheckCircleOutlined,
  UploadOutlined, FileTextOutlined, FullscreenOutlined, FullscreenExitOutlined,
  BarChartOutlined, CalculatorOutlined, PlusOutlined, MinusCircleOutlined,
} from '@ant-design/icons';
import FullscreenPanel from '@/components/FullscreenPanel';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, useNodesState, useEdgesState,
  Handle, Position, type Node, type Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import Papa from 'papaparse';
import ReactECharts from 'echarts-for-react';
import useAppStore from '@/stores/useAppStore';
import {
  loadAnalysisProjects, saveAnalysisProjects, loadAnalysisTemplates,
} from '@/utils/storage';

const { Title, Text } = Typography;

/**
 * 高亮节点包裹组件
 */
const HighlightWrapper: React.FC<{
  children: React.ReactNode;
  isActive: boolean;
  isCompleted: boolean;
}> = ({ children, isActive, isCompleted }) => (
  <div style={{
    boxShadow: isActive ? '0 0 12px 4px rgba(24,144,255,0.5)' : isCompleted ? '0 0 8px 2px rgba(82,196,26,0.4)' : 'none',
    borderRadius: 8,
    transition: 'box-shadow 0.3s',
  }}>
    {children}
  </div>
);

/**
 * 执行用数据节点（支持显示varNames）
 */
const ExecDataNode = ({ data, id }: { data: { label: string; isActive?: boolean; isCompleted?: boolean; varNames?: string[]; onOutNodeClick?: (nodeId: string) => void }; id: string }) => {
  const vars = data.varNames || [];
  const isOutNode = data.label === 'OUT输出';
  
  const handleClick = () => {
    if (isOutNode && data.onOutNodeClick) {
      data.onOutNodeClick(id);
    }
  };
  
  return (
    <HighlightWrapper isActive={!!data.isActive} isCompleted={!!data.isCompleted}>
      <div 
        style={{
          padding: '8px 16px', borderRadius: 8,
          background: data.isCompleted ? '#f6ffed' : data.isActive ? '#e6f7ff' : '#fafafa',
          border: `2px solid ${data.isCompleted ? '#52c41a' : data.isActive ? '#1890ff' : '#d9d9d9'}`,
          minWidth: 120, textAlign: 'center', 
          cursor: (data.isActive || isOutNode) ? 'pointer' : 'default',
        }}
        onClick={handleClick}
      >
        <Handle type="target" position={Position.Left} />
        <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
        {data.isCompleted && <CheckCircleOutlined style={{ marginLeft: 6, color: '#52c41a' }} />}
        {isOutNode && <FullscreenOutlined style={{ marginLeft: 6, color: '#1890ff', fontSize: 12 }} />}
        {vars.length > 0 && (
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
            {vars.map((v, i) => (
              <span key={i} style={{ fontSize: 10, background: '#ffa39e', color: '#fff', borderRadius: 3, padding: '0 4px' }}>{v}</span>
            ))}
          </div>
        )}
        <Handle type="source" position={Position.Right} />
      </div>
    </HighlightWrapper>
  );
};

/**
 * 执行用对比节点（支持动态输入/输出节点数）
 */
const ExecCompareNode = ({ data }: { data: { label: string; isActive?: boolean; isCompleted?: boolean; inputCount?: number; outputCount?: number } }) => {
  const inCount = data.inputCount || 2;
  const outCount = data.outputCount || 2;
  const maxHandles = Math.max(inCount, outCount);
  const nodeHeight = Math.max(50, maxHandles * 20 + 16);
  return (
    <HighlightWrapper isActive={!!data.isActive} isCompleted={!!data.isCompleted}>
      <div style={{
        padding: '8px 16px', borderRadius: 8,
        background: data.isCompleted ? '#f6ffed' : data.isActive ? '#fff7e6' : '#fafafa',
        border: `2px solid ${data.isCompleted ? '#52c41a' : data.isActive ? '#fa8c16' : '#d9d9d9'}`,
        minWidth: 140, minHeight: nodeHeight, textAlign: 'center', cursor: data.isActive ? 'pointer' : 'default',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        {Array.from({ length: inCount }, (_, i) => (
          <Handle
            key={`in-${i + 1}`}
            type="target"
            position={Position.Left}
            id={`in-${i + 1}`}
            style={{ top: `${((i + 1) / (inCount + 1)) * 100}%` }}
          />
        ))}
        <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
        {data.isCompleted && <CheckCircleOutlined style={{ marginLeft: 6, color: '#52c41a' }} />}
        <div style={{ fontSize: 10, color: '#fa8c16', marginTop: 2 }}>
          入{inCount} / 出{outCount}
        </div>
        {Array.from({ length: outCount }, (_, i) => (
          <Handle
            key={`out-${i + 1}`}
            type="source"
            position={Position.Right}
            id={`out-${i + 1}`}
            style={{ top: `${((i + 1) / (outCount + 1)) * 100}%` }}
          />
        ))}
      </div>
    </HighlightWrapper>
  );
};

/**
 * 执行用开始节点
 */
const ExecStartNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '10px 20px', borderRadius: 20, background: '#52c41a', color: '#fff',
    fontWeight: 'bold', textAlign: 'center',
  }}>
    {data.label}
    <Handle type="source" position={Position.Right} />
  </div>
);

/**
 * 执行用结束节点
 */
const ExecEndNode = ({ data }: { data: { label: string; isCompleted?: boolean } }) => (
  <div style={{
    padding: '10px 20px', borderRadius: 20,
    background: data.isCompleted ? '#52c41a' : '#ff4d4f', color: '#fff',
    fontWeight: 'bold', textAlign: 'center',
  }}>
    <Handle type="target" position={Position.Left} />
    {data.label}
  </div>
);

const execNodeTypes = {
  startNode: ExecStartNode,
  endNode: ExecEndNode,
  dataNode: ExecDataNode,
  calcNode: ExecDataNode,
  compareNode: ExecCompareNode,
  chartNode: ExecDataNode,
  outNode: ExecDataNode,
};

/**
 * 数据分析项目执行页面
 * @description 画布加载模板，按逻辑执行顺序高亮引导（需求2.3.3）
 */
const AnalysisExecution: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { analysisProjects, updateAnalysisProject, setAnalysisProjects, setAnalysisTemplates } = useAppStore();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [executionOrder, setExecutionOrder] = useState<string[]>([]);
  const [currentExecIdx, setCurrentExecIdx] = useState(0);
  const [completedNodes, setCompletedNodes] = useState<string[]>([]);
  const [allDone, setAllDone] = useState(false);
  
  // 全屏面板状态
  const [fullscreenVisible, setFullscreenVisible] = useState(false);
  const [fullscreenUrl, setFullscreenUrl] = useState<string>('');
  const [urlInputVisible, setUrlInputVisible] = useState(false);
  const [inputUrl, setInputUrl] = useState<string>('');

  /**
   * 处理OUT输出节点点击
   * @param nodeId - 节点ID
   */
  const handleOutNodeClick = useCallback((nodeId: string) => {
    setUrlInputVisible(true);
  }, []);

  /**
   * 确认URL并打开全屏面板
   */
  const handleUrlConfirm = () => {
    if (!inputUrl.trim()) {
      message.warning('请输入有效的URL地址');
      return;
    }
    setFullscreenUrl(inputUrl.trim());
    setUrlInputVisible(false);
    setFullscreenVisible(true);
  };

  // 数据预览弹窗
  const [dataModalVisible, setDataModalVisible] = useState(false);
  const [previewData, setPreviewData] = useState<Record<string, unknown>[]>([]);
  const [previewColumns, setPreviewColumns] = useState<{ title: string; dataIndex: string; key: string }[]>([]);
  const [activeNodeId, setActiveNodeId] = useState('');
  const [dataModalFullscreen, setDataModalFullscreen] = useState(false);
  const [selectedColKeys, setSelectedColKeys] = useState<string[]>([]);
  const [colStats, setColStats] = useState<{ col: string; max: number; min: number; avg: number }[]>([]);
  const [colChartOption, setColChartOption] = useState<Record<string, unknown>>({});
  const [colChartVisible, setColChartVisible] = useState(false);
  const [allPreviewData, setAllPreviewData] = useState<Record<string, unknown>[]>([]);

  // 对比分析弹窗
  const [compareModalVisible, setCompareModalVisible] = useState(false);
  const [chartOption, setChartOption] = useState<Record<string, unknown>>({});
  const [compareVarOptions, setCompareVarOptions] = useState<string[]>([]);
  const [selectedCompareVar, setSelectedCompareVar] = useState('');
  const [compareFullscreen, setCompareFullscreen] = useState(false);
  const [compareXVar, setCompareXVar] = useState<string>('');
  const [compareYVars, setCompareYVars] = useState<string[]>([]);
  const [inputNodeCount, setInputNodeCount] = useState(2);
  const [outputNodeCount, setOutputNodeCount] = useState(1);

  // 输出节点弹窗
  const [outModalVisible, setOutModalVisible] = useState(false);
  const [outputVarNames, setOutputVarNames] = useState<string[]>(['']);

  // 模拟数据存储
  const [loadedData, setLoadedData] = useState<Record<string, { headers: string[]; rows: unknown[][] }>>({});

  const project = analysisProjects.find((p) => p.id === id);

  useEffect(() => {
    let projects = analysisProjects;
    if (projects.length === 0) {
      projects = loadAnalysisProjects();
      if (projects.length > 0) setAnalysisProjects(projects);
    }
    const proj = projects.find((p) => p.id === id);
    if (!proj) return;

    const templates = loadAnalysisTemplates();
    if (templates.length > 0) setAnalysisTemplates(templates);
    const tpl = templates.find((t) => t.id === proj.templateId);
    if (!tpl) return;

    // 计算执行顺序：排除start/end，按x坐标排序
    const execNodes = tpl.nodes
      .filter((n) => n.type !== 'startNode' && n.type !== 'endNode')
      .sort((a, b) => a.position.x - b.position.x);
    const order = execNodes.map((n) => n.id);
    setExecutionOrder(order);
    setCompletedNodes(proj.completedNodes || []);

    const startIdx = proj.completedNodes?.length || 0;
    setCurrentExecIdx(startIdx);

    // 设置节点高亮状态
    const mappedNodes: Node[] = tpl.nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isActive: order[startIdx] === n.id,
        isCompleted: (proj.completedNodes || []).includes(n.id),
        onOutNodeClick: n.data.label === 'OUT输出' ? handleOutNodeClick : undefined,
      },
    })) as Node[];

    setNodes(mappedNodes);
    setEdges(tpl.edges as Edge[]);
  }, [id, analysisProjects, setAnalysisProjects, setAnalysisTemplates, setNodes, setEdges]);

  /**
   * 更新节点高亮状态
   */
  const updateNodeHighlight = (completed: string[], nextActiveIdx: number) => {
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isActive: executionOrder[nextActiveIdx] === n.id,
          isCompleted: completed.includes(n.id),
          onOutNodeClick: n.data.label === 'OUT输出' ? handleOutNodeClick : undefined,
        },
      }))
    );
  };

  /**
   * 处理节点点击
   */
  const handleNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.id !== executionOrder[currentExecIdx]) return;

    const nodeType = node.type;
    setActiveNodeId(node.id);

    if (nodeType === 'dataNode') {
      // 数据导入节点 - 弹出文件选择
      setDataModalVisible(true);
    } else if (nodeType === 'compareNode') {
      // 对比分析节点
      const allHeaders = Object.values(loadedData).flatMap((d) => d.headers);
      const unique = [...new Set(allHeaders)].filter((h) => h !== '');
      setCompareVarOptions(unique);
      setCompareXVar('');
      setCompareYVars([]);
      setChartOption({});
      setCompareModalVisible(true);
    } else if (nodeType === 'outNode') {
      // 输出节点 - 弹出设置输出变量名称
      setOutputVarNames(['']);
      setOutModalVisible(true);
    } else if (nodeType === 'calcNode' || nodeType === 'chartNode') {
      // 其他节点 - 直接完成
      completeCurrentNode();
    }
  }, [currentExecIdx, executionOrder, loadedData]);

  /**
   * 生成对比图表（支持指定X轴和Y轴变量）
   * @param xVar - X轴变量名
   * @param yVars - Y轴变量名数组
   */
  const generateCompareChart = (xVar?: string, yVars?: string[]) => {
    const xKey = xVar || compareXVar;
    const yKeys = yVars || compareYVars;
    if (!xKey || yKeys.length === 0) {
      setChartOption({});
      return;
    }

    // 合并所有已加载数据源
    const allEntries = Object.entries(loadedData);
    const series: { name: string; type: string; data: number[]; smooth: boolean }[] = [];
    let xAxisData: string[] = [];

    allEntries.forEach(([sourceName, data]) => {
      const xIdx = data.headers.indexOf(xKey);
      if (xIdx < 0) return;
      const xValues = data.rows.map((r) => String((r as string[])[xIdx] || ''));
      if (xAxisData.length === 0) xAxisData = xValues;

      yKeys.forEach((yKey) => {
        const yIdx = data.headers.indexOf(yKey);
        if (yIdx < 0) return;
        const yValues = data.rows.map((r) => parseFloat(String((r as string[])[yIdx])) || 0);
        const label = allEntries.length > 1 ? `${sourceName} - ${yKey}` : yKey;
        series.push({ name: label, type: 'line', data: yValues, smooth: true });
      });
    });

    setChartOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { top: 40, bottom: 40, left: 60, right: 20 },
      xAxis: { type: 'category', data: xAxisData, name: xKey },
      yAxis: { type: 'value' },
      series,
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 4 }],
    });
  };

  /**
   * 完成当前节点
   */
  const completeCurrentNode = () => {
    const nodeId = executionOrder[currentExecIdx];
    const newCompleted = [...completedNodes, nodeId];
    setCompletedNodes(newCompleted);

    const nextIdx = currentExecIdx + 1;
    setCurrentExecIdx(nextIdx);

    if (nextIdx >= executionOrder.length) {
      setAllDone(true);
      updateNodeHighlight(newCompleted, -1);
      // 结束节点变绿
      setNodes((nds) =>
        nds.map((n) =>
          n.id === 'end' ? { ...n, data: { ...n.data, isCompleted: true } } : {
            ...n,
            data: { ...n.data, isActive: false, isCompleted: newCompleted.includes(n.id) || n.id === 'start' },
          }
        )
      );
    } else {
      updateNodeHighlight(newCompleted, nextIdx);
    }

    // 保存进度
    if (project) {
      updateAnalysisProject(id!, {
        completedNodes: newCompleted,
        status: nextIdx >= executionOrder.length ? 'completed' : 'running',
      });
      const all = loadAnalysisProjects().map((p) =>
        p.id === id ? { ...p, completedNodes: newCompleted, status: (nextIdx >= executionOrder.length ? 'completed' : 'running') as 'completed' | 'running' } : p
      );
      saveAnalysisProjects(all);
    }

    setDataModalVisible(false);
    setCompareModalVisible(false);
  };

  /**
   * 处理CSV文件上传
   */
  const handleCsvUpload = (file: File) => {
    Papa.parse(file, {
      complete: (result) => {
        const headers = (result.data[0] as string[]) || [];
        const rows = result.data.slice(1) as unknown[][];
        const validRows = rows.filter((r) => (r as string[]).some((c) => c !== ''));

        const cols = headers.map((h, i) => ({ title: h || `列${i + 1}`, dataIndex: `col_${i}`, key: `col_${i}` }));
        setPreviewColumns(cols);
        const allRows = validRows.map((r, ri) => {
          const obj: Record<string, unknown> = { key: ri };
          headers.forEach((_, ci) => { obj[`col_${ci}`] = (r as string[])[ci]; });
          return obj;
        });
        setAllPreviewData(allRows);
        setPreviewData(allRows);

        // 存储数据
        setLoadedData((prev) => ({
          ...prev,
          [file.name.replace('.csv', '')]: { headers, rows: validRows },
        }));

        setSelectedColKeys([]);
        setColStats([]);
        setColChartVisible(false);
        message.success(`${file.name} 加载成功，共 ${validRows.length} 行`);
      },
      error: () => message.error('CSV文件解析失败'),
    });
    return false;
  };

  /**
   * 计算选中列的统计信息（最大值、最小值、平均值）
   * @param colKeys - 选中的列key数组
   */
  const calcColumnStats = (colKeys: string[]) => {
    if (colKeys.length === 0 || allPreviewData.length === 0) {
      setColStats([]);
      return;
    }
    const stats = colKeys.map((ck) => {
      const col = previewColumns.find((c) => c.key === ck);
      const values = allPreviewData
        .map((r) => parseFloat(String(r[ck])))
        .filter((v) => !isNaN(v));
      if (values.length === 0) return { col: col?.title || ck, max: NaN, min: NaN, avg: NaN };
      return {
        col: col?.title || ck,
        max: Math.max(...values),
        min: Math.min(...values),
        avg: parseFloat((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)),
      };
    });
    setColStats(stats);
  };

  /**
   * 根据选中列生成折线图
   * @param colKeys - 选中的列key数组
   */
  const generateColumnChart = (colKeys: string[]) => {
    if (colKeys.length === 0 || allPreviewData.length === 0) {
      setColChartVisible(false);
      return;
    }
    const series = colKeys.map((ck) => {
      const col = previewColumns.find((c) => c.key === ck);
      const values = allPreviewData.map((r) => parseFloat(String(r[ck])) || 0);
      return { name: col?.title || ck, type: 'line', data: values, smooth: true };
    });
    setColChartOption({
      tooltip: { trigger: 'axis' },
      legend: { top: 0 },
      grid: { top: 36, bottom: 30, left: 50, right: 20 },
      xAxis: { type: 'category', data: Array.from({ length: allPreviewData.length }, (_, i) => i + 1) },
      yAxis: { type: 'value' },
      series,
    });
    setColChartVisible(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analysis/projects')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>数据分析执行</Title>
        {project && <Tag color="blue">{project.name}</Tag>}
        {allDone && <Tag color="green" style={{ fontSize: 14 }}>全部完成</Tag>}
      </div>

      <Card style={{ flex: 1, minHeight: 0 }} styles={{ body: { padding: 0, height: '100%' } }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={execNodeTypes}
          fitView
          style={{ background: '#f8f9fa' }}
        >
          <Background gap={16} size={1} />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </Card>

      {allDone && (
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Button type="primary" size="large" icon={<FileTextOutlined />}
            onClick={() => navigate(`/report/create/${id}`)}>
            生成报告
          </Button>
        </div>
      )}

      {/* 数据导入弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>数据导入</span>
            <Button
              type="text"
              size="small"
              icon={dataModalFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setDataModalFullscreen(!dataModalFullscreen)}
              title={dataModalFullscreen ? '退出全屏' : '全屏'}
            />
          </div>
        }
        open={dataModalVisible}
        onCancel={() => { setDataModalVisible(false); setDataModalFullscreen(false); setColChartVisible(false); setSelectedColKeys([]); setColStats([]); }}
        width={dataModalFullscreen ? '100vw' : 1000}
        style={dataModalFullscreen ? { top: 0, maxWidth: '100vw', paddingBottom: 0 } : undefined}
        styles={dataModalFullscreen ? { body: { height: 'calc(100vh - 110px)', overflow: 'auto' } } : { body: { maxHeight: '70vh', overflow: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={() => { setDataModalVisible(false); setDataModalFullscreen(false); }}>取消</Button>,
          <Button key="ok" type="primary" onClick={completeCurrentNode}
            disabled={previewData.length === 0}>
            确认导入
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <Upload beforeUpload={handleCsvUpload} showUploadList={false} accept=".csv">
            <Button icon={<UploadOutlined />} type="primary" ghost>选择CSV文件</Button>
          </Upload>
          {previewColumns.length > 0 && (
            <>
              <Select
                mode="multiple"
                placeholder="选择列进行分析"
                style={{ minWidth: 260, maxWidth: 500 }}
                value={selectedColKeys}
                onChange={(v) => { setSelectedColKeys(v); calcColumnStats(v); }}
                options={previewColumns.map((c) => ({ label: c.title, value: c.key }))}
                maxTagCount={3}
                allowClear
              />
              <Button
                icon={<CalculatorOutlined />}
                disabled={selectedColKeys.length === 0}
                onClick={() => calcColumnStats(selectedColKeys)}
              >
                统计
              </Button>
              <Button
                icon={<BarChartOutlined />}
                disabled={selectedColKeys.length === 0}
                onClick={() => generateColumnChart(selectedColKeys)}
              >
                画图
              </Button>
            </>
          )}
        </div>

        {colStats.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Table
              dataSource={colStats.map((s, i) => ({ ...s, key: i }))}
              size="small"
              pagination={false}
              columns={[
                { title: '列名', dataIndex: 'col', key: 'col' },
                { title: '最大值', dataIndex: 'max', key: 'max', render: (v: number) => isNaN(v) ? '-' : v },
                { title: '最小值', dataIndex: 'min', key: 'min', render: (v: number) => isNaN(v) ? '-' : v },
                { title: '平均值', dataIndex: 'avg', key: 'avg', render: (v: number) => isNaN(v) ? '-' : v },
              ]}
            />
          </div>
        )}

        {colChartVisible && Object.keys(colChartOption).length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <ReactECharts option={colChartOption} style={{ height: 300 }} />
          </div>
        )}

        {previewData.length > 0 && (
          <Table
            dataSource={previewData}
            columns={previewColumns.map((col) => ({
              ...col,
              onHeaderCell: () => ({
                style: {
                  background: selectedColKeys.includes(col.key) ? '#e6f7ff' : undefined,
                  fontWeight: selectedColKeys.includes(col.key) ? 700 : undefined,
                  cursor: 'pointer',
                },
                onClick: () => {
                  const newKeys = selectedColKeys.includes(col.key)
                    ? selectedColKeys.filter((k) => k !== col.key)
                    : [...selectedColKeys, col.key];
                  setSelectedColKeys(newKeys);
                  calcColumnStats(newKeys);
                },
              }),
              onCell: () => ({
                style: {
                  background: selectedColKeys.includes(col.key) ? '#f0f9ff' : undefined,
                },
              }),
            }))}
            size="small"
            scroll={{ x: 'max-content', y: dataModalFullscreen ? 'calc(100vh - 450px)' : 300 }}
            pagination={{ pageSize: 50, size: 'small', showTotal: (t) => `共 ${t} 行` }}
          />
        )}
      </Modal>

      {/* 数据对比分析弹窗 */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>数据对比分析</span>
            <Button
              type="text"
              size="small"
              icon={compareFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={() => setCompareFullscreen(!compareFullscreen)}
              title={compareFullscreen ? '退出全屏' : '全屏'}
            />
          </div>
        }
        open={compareModalVisible}
        onCancel={() => { setCompareModalVisible(false); setCompareFullscreen(false); }}
        width={compareFullscreen ? '100vw' : 1000}
        style={compareFullscreen ? { top: 0, maxWidth: '100vw', paddingBottom: 0 } : undefined}
        styles={compareFullscreen ? { body: { height: 'calc(100vh - 110px)', overflow: 'auto' } } : { body: { maxHeight: '75vh', overflow: 'auto' } }}
        footer={[
          <Button key="cancel" onClick={() => { setCompareModalVisible(false); setCompareFullscreen(false); }}>取消</Button>,
          <Button key="ok" type="primary" onClick={completeCurrentNode}>确认完成</Button>,
        ]}
      >
        {/* 节点数量配置 */}
        <Card size="small" style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>输入节点数量：</Text>
              <InputNumber min={1} max={10} value={inputNodeCount} onChange={(v) => setInputNodeCount(v || 1)} style={{ width: 80 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text strong>输出节点数量：</Text>
              <InputNumber min={1} max={10} value={outputNodeCount} onChange={(v) => setOutputNodeCount(v || 1)} style={{ width: 80 }} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>已加载数据源：{Object.keys(loadedData).length} 个</Text>
            </div>
          </div>
        </Card>

        <Divider style={{ margin: '8px 0' }} />

        {/* X轴/Y轴变量选择 + 画图 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong>X轴：</Text>
            <Select
              placeholder="选择X轴变量"
              value={compareXVar || undefined}
              onChange={(v) => { setCompareXVar(v); generateCompareChart(v, compareYVars); }}
              options={compareVarOptions.map((v) => ({ label: v, value: v }))}
              style={{ width: 180 }}
              allowClear
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Text strong>Y轴：</Text>
            <Select
              mode="multiple"
              placeholder="选择Y轴变量（可多选）"
              value={compareYVars}
              onChange={(v) => { setCompareYVars(v); generateCompareChart(compareXVar, v); }}
              options={compareVarOptions.filter((v) => v !== compareXVar).map((v) => ({ label: v, value: v }))}
              style={{ minWidth: 260, maxWidth: 500 }}
              maxTagCount={3}
              allowClear
            />
          </div>
          <Button
            type="primary"
            icon={<BarChartOutlined />}
            disabled={!compareXVar || compareYVars.length === 0}
            onClick={() => generateCompareChart(compareXVar, compareYVars)}
          >
            查看曲线
          </Button>
        </div>

        {/* 图表展示 */}
        {Object.keys(chartOption).length > 0 && (
          <ReactECharts option={chartOption} style={{ height: compareFullscreen ? 'calc(100vh - 380px)' : 400 }} />
        )}
      </Modal>

      {/* 输出节点设置弹窗 */}
      <Modal
        title="设置输出变量"
        open={outModalVisible}
        onCancel={() => setOutModalVisible(false)}
        width={500}
        footer={[
          <Button key="cancel" onClick={() => setOutModalVisible(false)}>取消</Button>,
          <Button key="ok" type="primary" onClick={() => {
            const validNames = outputVarNames.filter((n) => n.trim() !== '');
            if (validNames.length === 0) {
              message.warning('请至少设置一个输出变量名称');
              return;
            }
            message.success(`已设置 ${validNames.length} 个输出变量：${validNames.join(', ')}`);
            setOutModalVisible(false);
            completeCurrentNode();
          }}>
            确认
          </Button>,
        ]}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
          设置该输出节点需要输出的变量名称，可添加多个变量。
        </Text>
        {outputVarNames.map((name, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Tag color="blue" style={{ minWidth: 60, textAlign: 'center' }}>变量 {idx + 1}</Tag>
            <Input
              placeholder={`请输入第 ${idx + 1} 个输出变量名称`}
              value={name}
              onChange={(e) => {
                const newNames = [...outputVarNames];
                newNames[idx] = e.target.value;
                setOutputVarNames(newNames);
              }}
              style={{ flex: 1 }}
            />
            {outputVarNames.length > 1 && (
              <Button
                type="text"
                danger
                icon={<MinusCircleOutlined />}
                onClick={() => setOutputVarNames(outputVarNames.filter((_, i) => i !== idx))}
              />
            )}
          </div>
        ))}
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => setOutputVarNames([...outputVarNames, ''])}
          block
          style={{ marginTop: 4 }}
        >
          添加输出变量
        </Button>
      </Modal>

      {/* URL输入弹窗 */}
      <Modal
        title="输入URL地址"
        open={urlInputVisible}
        onOk={handleUrlConfirm}
        onCancel={() => setUrlInputVisible(false)}
        okText="打开"
        cancelText="取消"
        width={500}
      >
        <div style={{ marginBottom: 16 }}>
          <Text type="secondary">请输入要在全屏面板中显示的URL地址：</Text>
        </div>
        <Input
          placeholder="请输入URL地址，如：https://www.example.com"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onPressEnter={handleUrlConfirm}
          style={{ marginBottom: 8 }}
        />
        <Text type="secondary" style={{ fontSize: 12 }}>
          提示：面板将与主面板大小一致，支持加载任何有效的网页地址
        </Text>
      </Modal>

      {/* 全屏面板 */}
      <FullscreenPanel
        visible={fullscreenVisible}
        onClose={() => setFullscreenVisible(false)}
        url={fullscreenUrl}
        title="OUT输出节点内容"
      />
    </div>
  );
};

export default AnalysisExecution;
