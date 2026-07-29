import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Input, Form, Select, Space, Modal, message, Drawer, InputNumber,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, RobotOutlined, PlusOutlined,
  DatabaseOutlined, CalculatorOutlined, SwapOutlined, LineChartOutlined,
  PlayCircleOutlined, StopOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Connection, type Node, type Edge, Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import { saveAnalysisTemplates, loadAnalysisTemplates } from '@/utils/storage';
import type { AnalysisTemplate } from '@/types';

const { Title, Text } = Typography;

/**
 * 自定义节点组件 - 开始节点
 */
const StartNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '10px 20px', borderRadius: 20, background: '#52c41a', color: '#fff',
    fontWeight: 'bold', textAlign: 'center', minWidth: 80,
  }}>
    {data.label}
    <Handle type="source" position={Position.Right} style={{ background: '#52c41a' }} />
  </div>
);

/**
 * 自定义节点组件 - 结束节点
 */
const EndNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '10px 20px', borderRadius: 20, background: '#ff4d4f', color: '#fff',
    fontWeight: 'bold', textAlign: 'center', minWidth: 80,
  }}>
    <Handle type="target" position={Position.Left} style={{ background: '#ff4d4f' }} />
    {data.label}
  </div>
);

/**
 * 自定义节点组件 - 数据模块节点
 */
const DataNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '8px 16px', borderRadius: 8, background: '#e6f7ff', border: '2px solid #1890ff',
    minWidth: 120, textAlign: 'center',
  }}>
    <Handle type="target" position={Position.Left} style={{ background: '#1890ff' }} />
    <DatabaseOutlined style={{ marginRight: 6, color: '#1890ff' }} />
    <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
    <Handle type="source" position={Position.Right} style={{ background: '#1890ff' }} />
  </div>
);

/**
 * 自定义节点组件 - 计算模块节点
 */
const CalcNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '8px 16px', borderRadius: 8, background: '#f9f0ff', border: '2px solid #722ed1',
    minWidth: 120, textAlign: 'center',
  }}>
    <Handle type="target" position={Position.Left} style={{ background: '#722ed1' }} />
    <CalculatorOutlined style={{ marginRight: 6, color: '#722ed1' }} />
    <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
    <Handle type="source" position={Position.Right} style={{ background: '#722ed1' }} />
  </div>
);

/**
 * 自定义节点组件 - 对比分析模块节点（支持动态输入/输出节点数）
 */
const CompareNode = ({ data }: { data: { label: string; inputCount?: number; outputCount?: number } }) => {
  const inCount = data.inputCount || 2;
  const outCount = data.outputCount || 2;
  const maxHandles = Math.max(inCount, outCount);
  const nodeHeight = Math.max(50, maxHandles * 20 + 16);
  return (
    <div style={{
      padding: '8px 16px', borderRadius: 8, background: '#fff7e6', border: '2px solid #fa8c16',
      minWidth: 140, minHeight: nodeHeight, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      {Array.from({ length: inCount }, (_, i) => (
        <Handle
          key={`in-${i + 1}`}
          type="target"
          position={Position.Left}
          id={`in-${i + 1}`}
          style={{ background: '#fa8c16', top: `${((i + 1) / (inCount + 1)) * 100}%` }}
        />
      ))}
      <SwapOutlined style={{ marginRight: 6, color: '#fa8c16' }} />
      <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
      <div style={{ fontSize: 10, color: '#fa8c16', marginTop: 2 }}>
        入{inCount} / 出{outCount}
      </div>
      {Array.from({ length: outCount }, (_, i) => (
        <Handle
          key={`out-${i + 1}`}
          type="source"
          position={Position.Right}
          id={`out-${i + 1}`}
          style={{ background: '#fa8c16', top: `${((i + 1) / (outCount + 1)) * 100}%` }}
        />
      ))}
    </div>
  );
};

/**
 * 自定义节点组件 - 绘图模块节点
 */
const ChartNode = ({ data }: { data: { label: string } }) => (
  <div style={{
    padding: '8px 16px', borderRadius: 8, background: '#f6ffed', border: '2px solid #52c41a',
    minWidth: 120, textAlign: 'center',
  }}>
    <Handle type="target" position={Position.Left} id="in-1" style={{ background: '#52c41a', top: '30%' }} />
    <Handle type="target" position={Position.Left} id="in-2" style={{ background: '#52c41a', top: '70%' }} />
    <LineChartOutlined style={{ marginRight: 6, color: '#52c41a' }} />
    <Text strong style={{ fontSize: 12 }}>{data.label}</Text>
    <Handle type="source" position={Position.Right} style={{ background: '#52c41a' }} />
  </div>
);

/**
 * 自定义节点组件 - 输出模块节点（支持显示接入变量名称）
 */
const OutNode = ({ data }: { data: { label: string; varNames?: string[] } }) => {
  const vars = data.varNames || [];
  return (
    <div style={{
      padding: '8px 16px', borderRadius: 8, background: '#fff1f0', border: '2px solid #f5222d',
      minWidth: 100, textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ background: '#f5222d' }} />
      <Text strong style={{ fontSize: 12, color: '#f5222d' }}>{data.label}</Text>
      {vars.length > 0 && (
        <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
          {vars.map((v, i) => (
            <span key={i} style={{ fontSize: 10, background: '#ffa39e', color: '#fff', borderRadius: 3, padding: '0 4px' }}>{v}</span>
          ))}
        </div>
      )}
    </div>
  );
};

const nodeTypes = {
  startNode: StartNode,
  endNode: EndNode,
  dataNode: DataNode,
  calcNode: CalcNode,
  compareNode: CompareNode,
  chartNode: ChartNode,
  outNode: OutNode,
};

// 可拖入的模块定义
const DRAG_MODULES = [
  { category: '数据模块', icon: <DatabaseOutlined />, items: [
    { type: 'dataNode', label: '导入训练数据' }, { type: 'dataNode', label: '导入验证数据' },
    { type: 'dataNode', label: '导入试验数据' }, { type: 'dataNode', label: '导入仿真数据' },
    { type: 'dataNode', label: '导入样本数据' }, { type: 'dataNode', label: '导入基准数据' },
  ]},
  { category: '计算模块', icon: <CalculatorOutlined />, items: [
    { type: 'calcNode', label: '均值' }, { type: 'calcNode', label: '标准差' },
    { type: 'calcNode', label: '归一化' }, { type: 'calcNode', label: '标准化' },
    { type: 'calcNode', label: '异常值剔除' }, { type: 'calcNode', label: '平滑处理' },
  ]},
  { category: '对比分析', icon: <SwapOutlined />, items: [
    { type: 'compareNode', label: '数据对比分析' },
  ]},
  { category: '绘图模块', icon: <LineChartOutlined />, items: [
    { type: 'chartNode', label: '折线图' }, { type: 'chartNode', label: '柱状图' },
    { type: 'chartNode', label: '散点图' }, { type: 'chartNode', label: '热力图' },
  ]},
  { category: '输出模块', icon: <StopOutlined />, items: [
    { type: 'outNode', label: 'OUT输出' },
  ]},
];

/**
 * 数据分析模板新建/编辑页面
 * @description React Flow拖拽画布构建分析模板（需求2.2.2）
 */
const TemplateCreate: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { experiments, analysisTemplates, addAnalysisTemplate, updateAnalysisTemplate, setAnalysisTemplates } = useAppStore();
  const [form] = Form.useForm();
  const [aiModalVisible, setAiModalVisible] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [compareSettingVisible, setCompareSettingVisible] = useState(false);
  const [compareSettingNodeId, setCompareSettingNodeId] = useState('');
  const [compareInputCount, setCompareInputCount] = useState(2);
  const [compareOutputCount, setCompareOutputCount] = useState(2);
  const [outSettingVisible, setOutSettingVisible] = useState(false);
  const [outSettingNodeId, setOutSettingNodeId] = useState('');
  const [outVarNames, setOutVarNames] = useState<string[]>(['']);
  const isEdit = !!id;

  const defaultNodes: Node[] = [
    { id: 'start', type: 'startNode', position: { x: 50, y: 200 }, data: { label: '开始' } },
    { id: 'end', type: 'endNode', position: { x: 800, y: 200 }, data: { label: '结束' } },
  ];

  const [nodes, setNodes, onNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (isEdit) {
      let templates = analysisTemplates;
      if (templates.length === 0) {
        templates = loadAnalysisTemplates();
        if (templates.length > 0) setAnalysisTemplates(templates);
      }
      const template = templates.find((t) => t.id === id);
      if (template) {
        form.setFieldsValue({ name: template.name, experimentName: template.experimentName, condition: template.condition });
        if (template.nodes.length > 0) setNodes(template.nodes as Node[]);
        if (template.edges.length > 0) setEdges(template.edges as Edge[]);
      }
    }
  }, [id, isEdit, analysisTemplates, form, setAnalysisTemplates, setNodes, setEdges]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({ ...params, animated: true, style: { stroke: '#1890ff' } }, eds)),
    [setEdges]
  );

  /**
   * 从侧边栏拖拽模块到画布
   */
  const handleAddNode = (type: string, label: string) => {
    const newNode: Node = {
      id: uuidv4(),
      type,
      position: { x: 200 + Math.random() * 400, y: 100 + Math.random() * 300 },
      data: {
        label,
        moduleType: type,
        ...(type === 'compareNode' ? { inputCount: 2, outputCount: 2 } : {}),
      },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  /**
   * 双击节点事件，对比分析模块弹出设置弹窗
   */
  const handleNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === 'compareNode') {
      setCompareSettingNodeId(node.id);
      setCompareInputCount(node.data.inputCount || 2);
      setCompareOutputCount(node.data.outputCount || 2);
      setCompareSettingVisible(true);
    } else if (node.type === 'outNode') {
      setOutSettingNodeId(node.id);
      setOutVarNames(node.data.varNames?.length ? [...node.data.varNames] : ['']);
      setOutSettingVisible(true);
    }
  }, []);

  /**
   * 确认修改输出节点的接入变量名称
   */
  const handleOutSettingOk = () => {
    const validNames = outVarNames.filter((n) => n.trim() !== '');
    setNodes((nds) =>
      nds.map((n) =>
        n.id === outSettingNodeId
          ? { ...n, data: { ...n.data, varNames: validNames } }
          : n
      )
    );
    setOutSettingVisible(false);
    if (validNames.length > 0) message.success(`已设置 ${validNames.length} 个接入变量`);
  };

  /**
   * 确认修改对比分析节点的输入/输出节点数
   */
  const handleCompareSettingOk = () => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === compareSettingNodeId
          ? { ...n, data: { ...n.data, inputCount: compareInputCount, outputCount: compareOutputCount } }
          : n
      )
    );
    setCompareSettingVisible(false);
    message.success(`已设置输入节点 ${compareInputCount} 个，输出节点 ${compareOutputCount} 个`);
  };

  /**
   * 保存模板
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const template: AnalysisTemplate = {
        id: isEdit ? id! : uuidv4(),
        name: values.name,
        experimentName: values.experimentName || '',
        condition: values.condition || '',
        createDate: dayjs().format('YYYY-MM-DD'),
        nodes: nodes as AnalysisTemplate['nodes'],
        edges: edges as AnalysisTemplate['edges'],
      };

      if (isEdit) {
        updateAnalysisTemplate(id!, template);
        const all = loadAnalysisTemplates().map((t) => t.id === id ? template : t);
        saveAnalysisTemplates(all);
      } else {
        addAnalysisTemplate(template);
        const all = loadAnalysisTemplates();
        all.push(template);
        saveAnalysisTemplates(all);
      }
      message.success(isEdit ? '模板已更新' : '模板已保存');
      navigate('/analysis/templates');
    } catch {
      message.error('请填写模板名称');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analysis/templates')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>{isEdit ? '编辑分析模板' : '新建分析模板'}</Title>
      </div>

      <Card size="small" style={{ marginBottom: 10, flexShrink: 0 }}>
        <Form form={form} layout="inline" style={{ display: 'flex', gap: 16, width: '100%' }}>
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]} style={{ flex: 1, marginRight: 0 }}>
            <Input placeholder="请输入模板名称" />
          </Form.Item>
          <Form.Item label="关联试验" name="experimentName" style={{ flex: 1, marginRight: 0 }}>
            <Select placeholder="选择试验" allowClear
              options={experiments.map((e) => ({ label: e.name, value: e.name }))} />
          </Form.Item>
          <Form.Item label="关联工况" name="condition" style={{ flex: 1, marginRight: 0 }}>
            <Input placeholder="如：常温常压" />
          </Form.Item>
        </Form>
      </Card>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* 左侧模块面板 */}
        <Card title="模块库" style={{ width: 200, overflow: 'auto', flexShrink: 0 }} size="small">
          {DRAG_MODULES.map((group) => (
            <div key={group.category} style={{ marginBottom: 12 }}>
              <Text strong style={{ fontSize: 12, color: '#666' }}>{group.icon} {group.category}</Text>
              <div style={{ marginTop: 4 }}>
                {group.items.map((item) => (
                  <div
                    key={item.label}
                    onClick={() => handleAddNode(item.type, item.label)}
                    style={{
                      padding: '4px 8px', marginBottom: 2, borderRadius: 4, cursor: 'pointer',
                      fontSize: 12, background: '#fafafa', border: '1px solid #f0f0f0',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => { (e.target as HTMLDivElement).style.background = '#e6f7ff'; }}
                    onMouseLeave={(e) => { (e.target as HTMLDivElement).style.background = '#fafafa'; }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>

        {/* 右侧画布 */}
        <Card style={{ flex: 1 }} styles={{ body: { padding: 0, height: '100%' } }}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDoubleClick={handleNodeDoubleClick}
            nodeTypes={nodeTypes}
            deleteKeyCode={['Backspace', 'Delete']}
            defaultEdgeOptions={{ style: { stroke: '#1890ff', strokeWidth: 2 }, animated: true }}
            edgesFocusable
            fitView
            style={{ background: '#f8f9fa' }}
          >
            <Background gap={16} size={1} />
            <Controls />
            <MiniMap />
          </ReactFlow>
        </Card>
      </div>

      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Space size="large">
          <Button size="large" onClick={() => navigate('/analysis/templates')}>取消</Button>
          <Button size="large" icon={<RobotOutlined />} onClick={() => setAiModalVisible(true)}>
            AI 生成
          </Button>
          <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSave}>保存模板</Button>
        </Space>
      </div>

      {/* 对比分析节点设置弹窗 */}
      <Modal
        title="设置对比分析节点"
        open={compareSettingVisible}
        onCancel={() => setCompareSettingVisible(false)}
        onOk={handleCompareSettingOk}
        width={400}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '12px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text strong style={{ minWidth: 100 }}>输入节点数：</Text>
            <InputNumber min={1} value={compareInputCount} onChange={(v) => setCompareInputCount(v || 1)} style={{ width: 120 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text strong style={{ minWidth: 100 }}>输出节点数：</Text>
            <InputNumber min={1} value={compareOutputCount} onChange={(v) => setCompareOutputCount(v || 1)} style={{ width: 120 }} />
          </div>
          <Text type="secondary" style={{ fontSize: 12 }}>
            提示：输入节点用于接收数据，输出节点用于将结果传递给下游模块。
          </Text>
        </div>
      </Modal>

      {/* 输出节点变量设置弹窗 */}
      <Modal
        title="设置接入变量"
        open={outSettingVisible}
        onCancel={() => setOutSettingVisible(false)}
        onOk={handleOutSettingOk}
        width={450}
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          设置该输出节点接入的变量名称，变量名将直接显示在模块上。
        </Text>
        {outVarNames.map((name, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 10, background: '#ffa39e', color: '#fff', borderRadius: 3, padding: '0 6px', minWidth: 50, textAlign: 'center' }}>变量 {idx + 1}</span>
            <Input
              placeholder={`请输入第 ${idx + 1} 个变量名称`}
              value={name}
              onChange={(e) => {
                const newNames = [...outVarNames];
                newNames[idx] = e.target.value;
                setOutVarNames(newNames);
              }}
              style={{ flex: 1 }}
              size="small"
            />
            {outVarNames.length > 1 && (
              <Button
                type="text"
                danger
                size="small"
                onClick={() => setOutVarNames(outVarNames.filter((_, i) => i !== idx))}
              >
                删除
              </Button>
            )}
          </div>
        ))}
        <Button
          type="dashed"
          size="small"
          icon={<PlusOutlined />}
          onClick={() => setOutVarNames([...outVarNames, ''])}
          block
        >
          添加变量
        </Button>
      </Modal>

      {/* AI对话窗口（需求2.2.2.3） */}
      <Modal title="AI 辅助生成模板" open={aiModalVisible} onCancel={() => setAiModalVisible(false)}
        onOk={() => { message.info('AI模板生成功能需要配置LLM接口'); setAiModalVisible(false); }}
        width={600}>
        <div style={{ minHeight: 300 }}>
          <div style={{
            height: 200, overflow: 'auto', border: '1px solid #f0f0f0', borderRadius: 8,
            padding: 12, marginBottom: 12, background: '#fafafa',
          }}>
            <Text type="secondary">AI助手：请描述您需要的数据分析模板，我将根据您的描述自动生成画布节点和连线。</Text>
          </div>
          <Input.TextArea
            rows={3}
            placeholder="例如：我需要一个对比试验数据和仿真数据的模板，包含数据导入、归一化处理和折线图绘制..."
            value={aiInput}
            onChange={(e) => setAiInput(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default TemplateCreate;
