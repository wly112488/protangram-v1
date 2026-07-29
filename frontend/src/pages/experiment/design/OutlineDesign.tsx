import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Steps, Button, Form, InputNumber, Input, Table, Select, message, Space, Tag, Descriptions, List, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckOutlined, PlusOutlined, DeleteOutlined, RobotOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import useAppStore from '@/stores/useAppStore';
import { loadExperiments, saveExperiments } from '@/utils/storage';
import { parseTestMethodCsv } from '@/utils/csvParser';
import type {
  ExperimentOutline, StepStatus, ExperimentFactor, OutlineResponseVariable,
  TestPlanRow, SamplingRequirement, TestMethod,
} from '@/types';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const TESTMETHOD_CSV = `试验设计方法,核心试验因子
单因子轮换法（OFAT）,发动机转速
单因子轮换法（OFAT）,飞行攻角
单因子轮换法（OFAT）, 环境温度
单因子轮换法（OFAT）,航电工作电压
全因子试验设计,环境温度
全因子试验设计, 振动加速度
全因子试验设计, 航电输入电压
全因子试验设计,工作载荷
部分因子试验设计,马赫数
部分因子试验设计,侧滑角
部分因子试验设计,燃油流量
部分因子试验设计,冷却风速
正交试验设计,风洞攻角
正交试验设计,风洞攻角
正交试验设计,结构载荷
正交试验设计, 环境湿度
响应曲面法（RSM）,燃烧室温度
响应曲面法（RSM）,燃油喷射压力
响应曲面法（RSM）,涡轮转速
响应曲面法（RSM）, 进气压力
均匀设计,高空低气压值
均匀设计,环境温度
均匀设计,振动频率
均匀设计,发动机负荷
拉丁超立方设计（LHD）,多场耦合应力（温度+振动+气压）
拉丁超立方设计（LHD）,材料疲劳载荷
拉丁超立方设计（LHD）,航电噪声干扰
拉丁超立方设计（LHD）,飞行姿态角
序贯试验设计,飞行速度
序贯试验设计,极限载荷
序贯试验设计,颤振激励频率
序贯试验设计,颤振激励频率`;

/**
 * 试验大纲设计页面
 * @description 五步时序流程：试验方法→基本参数→试验因子→响应变量→试验方案（需求1.2.5）
 */
const OutlineDesign: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { experiments, updateExperiment, setExperiments } = useAppStore();

  const [testMethods, setTestMethodsList] = useState<TestMethod[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepStatus, setStepStatus] = useState<StepStatus[]>([
    'active', 'pending', 'pending', 'pending', 'pending',
  ]);

  // 大纲数据
  const [selectedMethod, setSelectedMethod] = useState('');
  const [methodDescription, setMethodDescription] = useState('');
  const [factorCount, setFactorCount] = useState(4);
  const [centerPointCount, setCenterPointCount] = useState(2);
  const [levelCount, setLevelCount] = useState(2);
  const [blockCount, setBlockCount] = useState(1);
  const [samplingReqs, setSamplingReqs] = useState<SamplingRequirement[]>([
    { id: uuidv4(), position: '传感器位置A', quantity: 10 },
  ]);
  const [factors, setFactors] = useState<ExperimentFactor[]>([]);
  const [responseVars, setResponseVars] = useState<OutlineResponseVariable[]>([]);
  const [testPlan, setTestPlan] = useState<TestPlanRow[]>([]);
  const [experimentName, setExperimentName] = useState('');

  useEffect(() => {
    const methods = parseTestMethodCsv(TESTMETHOD_CSV);
    setTestMethodsList(methods);

    let allExps = experiments;
    if (allExps.length === 0) {
      allExps = loadExperiments();
      if (allExps.length > 0) setExperiments(allExps);
    }
    const exp = allExps.find((e) => e.id === id);
    if (exp) {
      setExperimentName(exp.name);
      if (exp.outline) {
        const o = exp.outline;
        setSelectedMethod(o.method);
        setMethodDescription(o.methodDescription || '');
        setFactorCount(o.basicParams.factorCount);
        setCenterPointCount(o.basicParams.centerPointCount);
        setLevelCount(o.basicParams.levelCount);
        setBlockCount(o.basicParams.blockCount);
        setSamplingReqs(o.samplingRequirements);
        setFactors(o.factors);
        setResponseVars(o.responseVariables);
        setTestPlan(o.testPlan);
        setCurrentStep(o.currentStep);
        setStepStatus(o.stepStatus);
      } else {
        // 根据试验对象初始化响应变量
        const vars: OutlineResponseVariable[] = exp.testObjectNames.map((name) => ({
          id: uuidv4(),
          name: `${name}_响应`,
          description: '',
        }));
        setResponseVars(vars);
      }
    }
  }, [id, experiments, setExperiments]);

  /**
   * 生成默认试验方案表（模拟数据）
   */
  const generateTestPlan = (): TestPlanRow[] => {
    const rows: TestPlanRow[] = [];
    const runCount = Math.max(factorCount * levelCount + centerPointCount, 8);
    for (let i = 1; i <= runCount; i++) {
      rows.push({
        stdOrder: i,
        runOrder: i,
        centerPoint: i <= centerPointCount ? 1 : 0,
        block: ((i - 1) % blockCount) + 1,
        temperature: `${(20 + Math.random() * 60).toFixed(1)}`,
        time: `${(10 + Math.random() * 50).toFixed(0)}`,
        concentration: `${(0.1 + Math.random() * 2).toFixed(2)}`,
        pressure: `${(100 + Math.random() * 200).toFixed(1)}`,
        vibration: `${(0.5 + Math.random() * 5).toFixed(2)}`,
      });
    }
    return rows;
  };

  /**
   * 前进到下一步
   */
  const goNext = () => {
    if (currentStep === 0 && !selectedMethod) {
      message.warning('请选择试验方法');
      return;
    }
    const newStatus = [...stepStatus];
    newStatus[currentStep] = 'completed';
    if (currentStep + 1 < 5) {
      newStatus[currentStep + 1] = 'active';
    }
    setStepStatus(newStatus);

    if (currentStep === 0) {
      // 自动填充因子
      const method = testMethods.find((m) => m.name === selectedMethod);
      if (method && factors.length === 0) {
        const newFactors: ExperimentFactor[] = method.factors.map((f) => ({
          id: uuidv4(),
          name: f,
          level1: '',
          level2: '',
          dimension: '',
          measureMethod: '',
          precision: '',
          frequency: '',
          range: '',
        }));
        setFactors(newFactors);
        setFactorCount(method.factors.length);
      }
    }

    if (currentStep === 3) {
      // 生成试验方案
      if (testPlan.length === 0) {
        setTestPlan(generateTestPlan());
      }
    }

    setCurrentStep(currentStep + 1);
  };

  /**
   * 回退到上一步（后续步骤重置为"未完成"）
   */
  const goPrev = () => {
    const newStatus = [...stepStatus];
    newStatus[currentStep] = 'pending';
    // 当前步骤及之后都重置为pending
    for (let i = currentStep; i < 5; i++) {
      newStatus[i] = 'pending';
    }
    newStatus[currentStep - 1] = 'active';
    setStepStatus(newStatus);
    setCurrentStep(currentStep - 1);
  };

  /**
   * 完成试验设计，保存大纲
   */
  const handleFinish = () => {
    const outline: ExperimentOutline = {
      method: selectedMethod,
      methodDescription,
      basicParams: { factorCount, centerPointCount, levelCount, blockCount },
      samplingRequirements: samplingReqs,
      factors,
      responseVariables: responseVars,
      testPlan,
      currentStep: 4,
      stepStatus: ['completed', 'completed', 'completed', 'completed', 'completed'],
    };

    updateExperiment(id!, { outline, hasOutline: true, testMethod: selectedMethod });
    const allExps = loadExperiments().map((e) =>
      e.id === id ? { ...e, outline, hasOutline: true, testMethod: selectedMethod } : e
    );
    saveExperiments(allExps);
    message.success('试验大纲设计完成！');
    navigate('/experiment/design');
  };

  const stepItems = [
    { title: '试验方法', content: '选择设计方法' },
    { title: '基本参数', content: '设置参数' },
    { title: '试验因子', content: '设计因子' },
    { title: '响应变量', content: '配置变量' },
    { title: '试验方案', content: '生成方案' },
  ];

  /**
   * 渲染步骤1：试验方法选择
   */
  const renderStep0 = () => (
    <div>
      <Title level={5}>选择试验设计方法</Title>
      <div style={{ display: 'flex', gap: 16 }}>
        <Card style={{ width: 350, maxHeight: 450, overflow: 'auto' }}>
          <List
            dataSource={testMethods}
            renderItem={(method) => (
              <List.Item
                onClick={() => {
                  setSelectedMethod(method.name);
                  setMethodDescription(method.description || '');
                }}
                style={{
                  cursor: 'pointer',
                  background: selectedMethod === method.name ? '#e6f4ff' : 'transparent',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: selectedMethod === method.name ? '1px solid #91caff' : '1px solid transparent',
                  marginBottom: 4,
                }}
              >
                <Text strong={selectedMethod === method.name}>{method.name}</Text>
              </List.Item>
            )}
          />
        </Card>
        <Card style={{ flex: 1 }} title={selectedMethod ? <Tag color="blue">{selectedMethod}</Tag> : '方法说明'}>
          {selectedMethod ? (
            <Paragraph style={{ lineHeight: 1.8 }}>{methodDescription}</Paragraph>
          ) : (
            <Text type="secondary">请在左侧选择一个试验方法</Text>
          )}
        </Card>
      </div>
    </div>
  );

  /**
   * 渲染步骤2：基本参数
   */
  const renderStep1 = () => (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* 试验方法 - 重点突出 */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 12, flexShrink: 0 }}>
        <Title level={5} style={{ margin: 0 }}>基本参数设置</Title>
        <Tag color="blue" style={{ fontSize: 15, padding: '4px 16px', fontWeight: 600, borderRadius: 6 }}>
          {selectedMethod}
        </Tag>
      </div>
      {/* 4个参数卡片 - 固定高度一行 */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexShrink: 0 }}>
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>因子数</Text>
          <InputNumber min={1} max={20} value={factorCount} onChange={(v) => setFactorCount(v || 1)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>中心点数</Text>
          <InputNumber min={0} max={10} value={centerPointCount} onChange={(v) => setCenterPointCount(v || 0)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>水平数</Text>
          <InputNumber min={2} max={10} value={levelCount} onChange={(v) => setLevelCount(v || 2)} style={{ width: '100%' }} />
        </div>
        <div style={{ flex: 1, background: '#fafafa', borderRadius: 8, padding: '10px 14px', border: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap' }}>区组数</Text>
          <InputNumber min={1} max={10} value={blockCount} onChange={(v) => setBlockCount(v || 1)} style={{ width: '100%' }} />
        </div>
      </div>
      {/* 采样要求列表 - 占满剩余空间 */}
      <div style={{ flex: 1, minHeight: 0, background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 14px', borderBottom: '1px solid #f0f0f0', flexShrink: 0 }}>
          <Text strong style={{ fontSize: 13 }}>采样要求列表</Text>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>
            <Table
              dataSource={samplingReqs}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                {
                  title: '采样位置',
                  dataIndex: 'position',
                  render: (text: string, record: SamplingRequirement) => (
                    <Input
                      value={text}
                      onChange={(e) =>
                        setSamplingReqs((prev) =>
                          prev.map((r) => (r.id === record.id ? { ...r, position: e.target.value } : r))
                        )
                      }
                    />
                  ),
                },
                {
                  title: '采样数量',
                  dataIndex: 'quantity',
                  width: 120,
                  render: (val: number, record: SamplingRequirement) => (
                    <InputNumber
                      min={1}
                      value={val}
                      onChange={(v) =>
                        setSamplingReqs((prev) =>
                          prev.map((r) => (r.id === record.id ? { ...r, quantity: v || 1 } : r))
                        )
                      }
                    />
                  ),
                },
                {
                  title: '操作',
                  width: 80,
                  render: (_: unknown, record: SamplingRequirement) => (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => setSamplingReqs((prev) => prev.filter((r) => r.id !== record.id))}
                    />
                  ),
                },
              ]}
              footer={() => (
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() =>
                    setSamplingReqs((prev) => [...prev, { id: uuidv4(), position: '', quantity: 1 }])
                  }
                  block
                >
                  添加采样要求
                </Button>
              )}
            />
        </div>
      </div>
    </div>
  );

  /**
   * 渲染步骤3：试验因子
   */
  const renderStep2 = () => (
    <div>
      <Title level={5}>试验因子设计</Title>
      <Descriptions bordered column={4} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="试验方法"><Tag color="blue">{selectedMethod}</Tag></Descriptions.Item>
        <Descriptions.Item label="因子数">{factorCount}</Descriptions.Item>
        <Descriptions.Item label="水平数">{levelCount}</Descriptions.Item>
        <Descriptions.Item label="区组数">{blockCount}</Descriptions.Item>
      </Descriptions>
      <Table
        dataSource={factors}
        rowKey="id"
        size="small"
        pagination={false}
        scroll={{ x: 900 }}
        columns={[
          {
            title: '因子名称', dataIndex: 'name', width: 140, fixed: 'left',
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, name: e.target.value } : f))
              } />
            ),
          },
          {
            title: '水平1', dataIndex: 'level1', width: 100,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, level1: e.target.value } : f))
              } />
            ),
          },
          {
            title: '水平2', dataIndex: 'level2', width: 100,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, level2: e.target.value } : f))
              } />
            ),
          },
          {
            title: '量纲', dataIndex: 'dimension', width: 90,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, dimension: e.target.value } : f))
              } />
            ),
          },
          {
            title: '测量方法', dataIndex: 'measureMethod', width: 110,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, measureMethod: e.target.value } : f))
              } />
            ),
          },
          {
            title: '精度', dataIndex: 'precision', width: 80,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, precision: e.target.value } : f))
              } />
            ),
          },
          {
            title: '频率', dataIndex: 'frequency', width: 80,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, frequency: e.target.value } : f))
              } />
            ),
          },
          {
            title: '区间范围', dataIndex: 'range', width: 100,
            render: (text: string, record: ExperimentFactor) => (
              <Input value={text} onChange={(e) =>
                setFactors((prev) => prev.map((f) => f.id === record.id ? { ...f, range: e.target.value } : f))
              } />
            ),
          },
          {
            title: '操作', width: 60, fixed: 'right',
            render: (_: unknown, record: ExperimentFactor) => (
              <Button type="text" danger icon={<DeleteOutlined />}
                onClick={() => setFactors((prev) => prev.filter((f) => f.id !== record.id))} />
            ),
          },
        ]}
        footer={() => (
          <Button type="dashed" icon={<PlusOutlined />} block
            onClick={() => setFactors((prev) => [...prev, {
              id: uuidv4(), name: '', level1: '', level2: '', dimension: '',
              measureMethod: '', precision: '', frequency: '', range: '',
            }])}
          >
            添加因子
          </Button>
        )}
      />
    </div>
  );

  /**
   * 渲染步骤4：响应变量
   */
  const renderStep3 = () => (
    <div>
      <Title level={5}>响应变量配置</Title>
      <Descriptions bordered column={4} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="试验方法"><Tag color="blue">{selectedMethod}</Tag></Descriptions.Item>
        <Descriptions.Item label="因子数">{factorCount}</Descriptions.Item>
        <Descriptions.Item label="水平数">{levelCount}</Descriptions.Item>
        <Descriptions.Item label="区组数">{blockCount}</Descriptions.Item>
      </Descriptions>
      <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>
        响应变量需与已选试验对象关联的参数保持一致，支持自行增加或删除
      </Text>
      <Table
        dataSource={responseVars}
        rowKey="id"
        size="small"
        pagination={false}
        columns={[
          {
            title: '变量名称', dataIndex: 'name', width: 200,
            render: (text: string, record: OutlineResponseVariable) => (
              <Input value={text} onChange={(e) =>
                setResponseVars((prev) => prev.map((v) => v.id === record.id ? { ...v, name: e.target.value } : v))
              } />
            ),
          },
          {
            title: '采集要求描述', dataIndex: 'description',
            render: (text: string, record: OutlineResponseVariable) => (
              <TextArea rows={2} value={text} onChange={(e) =>
                setResponseVars((prev) => prev.map((v) => v.id === record.id ? { ...v, description: e.target.value } : v))
              } />
            ),
          },
          {
            title: '操作', width: 60,
            render: (_: unknown, record: OutlineResponseVariable) => (
              <Button type="text" danger icon={<DeleteOutlined />}
                onClick={() => setResponseVars((prev) => prev.filter((v) => v.id !== record.id))} />
            ),
          },
        ]}
        footer={() => (
          <Button type="dashed" icon={<PlusOutlined />} block
            onClick={() => setResponseVars((prev) => [...prev, { id: uuidv4(), name: '', description: '' }])}
          >
            添加响应变量
          </Button>
        )}
      />
    </div>
  );

  /**
   * 渲染步骤5：试验方案
   */
  const renderStep4 = () => (
    <div>
      <Title level={5}>试验方案</Title>
      <Descriptions bordered column={4} size="small" style={{ marginBottom: 16 }}>
        <Descriptions.Item label="试验方法"><Tag color="blue">{selectedMethod}</Tag></Descriptions.Item>
        <Descriptions.Item label="因子数">{factorCount}</Descriptions.Item>
        <Descriptions.Item label="水平数">{levelCount}</Descriptions.Item>
        <Descriptions.Item label="区组数">{blockCount}</Descriptions.Item>
      </Descriptions>
      <Table
        dataSource={testPlan}
        rowKey="stdOrder"
        size="small"
        pagination={false}
        scroll={{ x: 900, y: 400 }}
        columns={[
          { title: '标准序', dataIndex: 'stdOrder', width: 70, fixed: 'left' },
          { title: '运行序', dataIndex: 'runOrder', width: 70 },
          { title: '中心点', dataIndex: 'centerPoint', width: 70 },
          { title: '区组', dataIndex: 'block', width: 60 },
          { title: '温度', dataIndex: 'temperature', width: 80 },
          { title: '时间', dataIndex: 'time', width: 80 },
          { title: '浓度', dataIndex: 'concentration', width: 80 },
          { title: '压强', dataIndex: 'pressure', width: 80 },
          { title: '振动', dataIndex: 'vibration', width: 80 },
        ]}
      />
    </div>
  );

  const stepRenderers = [renderStep0, renderStep1, renderStep2, renderStep3, renderStep4];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10, gap: 12, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/experiment/design')}>
          返回
        </Button>
        <Title level={4} style={{ margin: 0 }}>试验大纲设计</Title>
        <Tag color="orange" style={{ fontSize: 14, padding: '4px 12px' }}>
          {experimentName}
        </Tag>
      </div>

      <Card size="small" style={{ marginBottom: 10, flexShrink: 0 }}>
        <Steps
          current={currentStep}
          className="outline-steps"
          items={stepItems.map((item, idx) => ({
            ...item,
            status: stepStatus[idx] === 'completed' ? 'finish' : stepStatus[idx] === 'active' ? 'process' : 'wait',
          }))}
        />
      </Card>

      <Card style={{ flex: 1, display: 'flex', flexDirection: 'column' }} styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column' } }}>
        {stepRenderers[currentStep]()}
      </Card>

      <div style={{ textAlign: 'center', marginTop: 12, flexShrink: 0 }}>
        <Space size="large">
          {currentStep > 0 && (
            <Button size="large" icon={<ArrowLeftOutlined />} onClick={goPrev}>
              上一步
            </Button>
          )}
          <Button size="large" icon={<RobotOutlined />}>
            AI 辅助
          </Button>
          {currentStep < 4 ? (
            <Button type="primary" size="large" icon={<ArrowRightOutlined />} onClick={goNext}>
              下一步
            </Button>
          ) : (
            <Button type="primary" size="large" icon={<CheckOutlined />} onClick={handleFinish}>
              完成试验设计
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default OutlineDesign;
