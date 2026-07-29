import React, { useEffect, useState } from 'react';
import { Card, Typography, Spin, message, Tag, Row, Col, Button, Space, Upload, Modal, Input, Popconfirm } from 'antd';
import {
  ExperimentOutlined,
  UploadOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  PlusOutlined,
  DeleteOutlined,
} from '@ant-design/icons';
import useAppStore from '@/stores/useAppStore';
import { parseTestMethodCsv } from '@/utils/csvParser';
import type { TestMethod } from '@/types';

const { Title, Text, Paragraph } = Typography;

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

/** 面板高度常量 */
const PANEL_HEIGHT = '100%';

/**
 * 试验设计方法页面
 * @description 展示试验设计方法及关联因子，支持导入CSV和编辑（需求1.1.3）
 */
const TestMethods: React.FC = () => {
  const { testMethods, setTestMethods } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [selectedMethod, setSelectedMethod] = useState<TestMethod | null>(null);
  const [editing, setEditing] = useState(false);
  const [editMethods, setEditMethods] = useState<TestMethod[]>([]);
  const [addMethodModal, setAddMethodModal] = useState(false);
  const [addFactorModal, setAddFactorModal] = useState<{ visible: boolean; methodName: string }>({ visible: false, methodName: '' });
  const [inputValue, setInputValue] = useState('');

  useEffect(() => {
    try {
      const methods = parseTestMethodCsv(TESTMETHOD_CSV);
      setTestMethods(methods);
      if (methods.length > 0) setSelectedMethod(methods[0]);
    } catch {
      message.error('试验设计方法数据解析失败');
    } finally {
      setLoading(false);
    }
  }, [setTestMethods]);

  /**
   * 处理CSV文件上传
   * @param file - 上传的CSV文件
   */
  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csvText = e.target?.result as string;
        const methods = parseTestMethodCsv(csvText);
        setTestMethods(methods);
        if (methods.length > 0) setSelectedMethod(methods[0]);
        message.success(`CSV导入成功：${methods.length} 种方法`);
      } catch {
        message.error('CSV解析失败，请检查格式');
      }
    };
    reader.readAsText(file);
    return false;
  };

  /**
   * 进入编辑模式
   */
  const enterEdit = () => {
    setEditMethods(JSON.parse(JSON.stringify(testMethods)));
    setEditing(true);
  };

  /**
   * 保存编辑
   */
  const saveEdit = () => {
    setTestMethods(editMethods);
    if (editMethods.length > 0) {
      const current = editMethods.find((m) => m.name === selectedMethod?.name);
      setSelectedMethod(current || editMethods[0]);
    } else {
      setSelectedMethod(null);
    }
    setEditing(false);
    message.success('保存成功');
  };

  /**
   * 取消编辑
   */
  const cancelEdit = () => {
    setEditMethods([]);
    setEditing(false);
  };

  /**
   * 添加方法
   * @param name - 方法名称
   */
  const addMethod = (name: string) => {
    if (!name.trim()) return;
    setEditMethods((prev) => [...prev, { name: name.trim(), factors: [], description: '' }]);
    setAddMethodModal(false);
    setInputValue('');
  };

  /**
   * 删除方法
   * @param methodName - 方法名称
   */
  const deleteMethod = (methodName: string) => {
    setEditMethods((prev) => prev.filter((m) => m.name !== methodName));
  };

  /**
   * 添加因子
   * @param methodName - 所属方法名称
   * @param factor - 因子名称
   */
  const addFactor = (methodName: string, factor: string) => {
    if (!factor.trim()) return;
    setEditMethods((prev) => prev.map((m) => {
      if (m.name !== methodName) return m;
      return { ...m, factors: [...m.factors, factor.trim()] };
    }));
    setAddFactorModal({ visible: false, methodName: '' });
    setInputValue('');
  };

  /**
   * 删除因子
   * @param methodName - 所属方法名称
   * @param factorIndex - 因子索引
   */
  const deleteFactor = (methodName: string, factorIndex: number) => {
    setEditMethods((prev) => prev.map((m) => {
      if (m.name !== methodName) return m;
      const newFactors = [...m.factors];
      newFactors.splice(factorIndex, 1);
      return { ...m, factors: newFactors };
    }));
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  /** 当前展示数据源 */
  const displayMethods = editing ? editMethods : testMethods;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', overflow: 'hidden' }}>
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexShrink: 0 }}>
        <div>
          <Title level={4} style={{ marginBottom: 4 }}>试验设计方法</Title>
          <Text type="secondary">
            共 {displayMethods.length} 种试验设计方法，
            {displayMethods.reduce((s, m) => s + m.factors.length, 0)} 个关联因子
          </Text>
        </div>
        <Space>
          {!editing ? (
            <>
              <Upload accept=".csv" showUploadList={false} beforeUpload={handleUpload}>
                <Button icon={<UploadOutlined />}>导入CSV</Button>
              </Upload>
              <Button icon={<EditOutlined />} type="primary" onClick={enterEdit}>编辑</Button>
            </>
          ) : (
            <>
              <Button icon={<PlusOutlined />} onClick={() => { setAddMethodModal(true); setInputValue(''); }}>添加方法</Button>
              <Button icon={<SaveOutlined />} type="primary" onClick={saveEdit}>保存</Button>
              <Button icon={<CloseOutlined />} onClick={cancelEdit}>取消</Button>
            </>
          )}
        </Space>
      </div>
      <div style={{ margin: '0 -6px', flex: 1, minHeight: 0 }}>
        <Row gutter={12} style={{ flex: 1, minHeight: 0 }}>
        <Col span={16}>
          <Card title="方法列表" style={{ height: PANEL_HEIGHT, overflow: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%', gap: 0 }}>
              {displayMethods.map((method, idx) => {
                const isSelected = selectedMethod?.name === method.name;
                const factors = editing ? method.factors : method.factors;
                return (
                  <div
                    key={method.name + idx}
                    onClick={() => setSelectedMethod(method)}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      background: isSelected ? '#e6f4ff' : 'transparent',
                      padding: '14px 16px',
                      borderRadius: 8,
                      border: isSelected ? '1px solid #91caff' : '1px solid #f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      marginBottom: idx < displayMethods.length - 1 ? 8 : 0,
                    }}
                  >
                    <ExperimentOutlined
                      style={{
                        fontSize: 18,
                        color: isSelected ? '#1890ff' : '#999',
                        flexShrink: 0,
                      }}
                    />
                    <Text strong style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>{method.name}</Text>
                    <div style={{ width: 1, height: 16, background: '#d9d9d9', flexShrink: 0 }} />
                    <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {factors.map((f, i) => (
                        <Tag
                          key={`${method.name}-${f}-${i}`}
                          color="cyan"
                          closable={editing}
                          onClose={(e) => { e.stopPropagation(); deleteFactor(method.name, i); }}
                          style={{ margin: 0, fontSize: 12 }}
                        >{f}</Tag>
                      ))}
                    </div>
                    {editing && (
                      <Space size={4} style={{ flexShrink: 0 }}>
                        <Button
                          type="text" size="small" icon={<PlusOutlined />}
                          onClick={(e) => { e.stopPropagation(); setAddFactorModal({ visible: true, methodName: method.name }); setInputValue(''); }}
                          style={{ fontSize: 11, color: '#1890ff' }}
                        >因子</Button>
                        <Popconfirm title="确认删除该方法？" onConfirm={() => deleteMethod(method.name)}>
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
                        </Popconfirm>
                      </Space>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
        <Col span={8}>
          <Card
            title={
              selectedMethod ? (
                <span>
                  <Tag color="blue">{selectedMethod.name}</Tag> 说明
                </span>
              ) : (
                '请选择方法'
              )
            }
            style={{ height: PANEL_HEIGHT, overflow: 'auto' }}
            styles={{ body: { height: 'calc(100% - 57px)', display: 'flex', flexDirection: 'column', justifyContent: 'center' } }}
          >
            {selectedMethod ? (
              <div>
                <Paragraph style={{ fontSize: 14, lineHeight: 1.8 }}>
                  {selectedMethod.description}
                </Paragraph>
                <Title level={5} style={{ marginTop: 16, fontSize: 14 }}>
                  关联核心试验因子
                </Title>
                <div>
                  {selectedMethod.factors.map((f, i) => (
                    <Tag key={i} color="geekblue" style={{ fontSize: 13, padding: '3px 10px', marginBottom: 6 }}>
                      {f}
                    </Tag>
                  ))}
                </div>
              </div>
            ) : (
              <Text type="secondary">请在左侧列表中选择一个试验设计方法查看详细说明</Text>
            )}
          </Card>
        </Col>
      </Row>
    </div>

    {/* 添加方法弹窗 */}
    <Modal
      title="添加试验设计方法"
      open={addMethodModal}
      onOk={() => addMethod(inputValue)}
      onCancel={() => setAddMethodModal(false)}
      okText="确定"
      cancelText="取消"
    >
      <Input
        placeholder="请输入方法名称，如：响应曲面法"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={() => addMethod(inputValue)}
      />
    </Modal>

    {/* 添加因子弹窗 */}
    <Modal title={`为 "${addFactorModal.methodName}" 添加因子`} open={addFactorModal.visible}
      onOk={() => addFactor(addFactorModal.methodName, inputValue)}
      onCancel={() => { setAddFactorModal({ visible: false, methodName: '' }); setInputValue(''); }}>
      <Input
        placeholder="请输入因子名称，如：温度梯度"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onPressEnter={() => addFactor(addFactorModal.methodName, inputValue)}
      />
    </Modal>
  </div>
  );
};

export default TestMethods;
