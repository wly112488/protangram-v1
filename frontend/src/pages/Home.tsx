import React from 'react';
import { Card, Typography, Row, Col, Button, Divider } from 'antd';
import {
  ExperimentOutlined,
  FundProjectionScreenOutlined,
  FileTextOutlined,
  PlusOutlined,
  LineChartOutlined,
  FileDoneOutlined,
  FileAddOutlined,
  FileSyncOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph, Text } = Typography;

const HOME_CARDS = [
  {
    key: 'experiment',
    title: '试验设计',
    icon: <ExperimentOutlined style={{ fontSize: 56, color: '#1890ff' }} />,
    description: '基于可信模型、历史数据和安全约束生成推荐试验方案。',
    path: '/experiment/design/intelligent',
    color: '#e6f7ff',
    borderColor: '#91caff',
    steps: [],
  },
  {
    key: 'analysis-projects',
    title: '试验数据分析',
    icon: <LineChartOutlined style={{ fontSize: 56, color: '#52c41a' }} />,
    description: '加载试验关联数据，识别异常并形成根因、证据与分析结论。',
    path: '/analysis/projects',
    color: '#f6ffed',
    borderColor: '#b7eb8f',
    steps: [],
  },
  {
    key: 'digital-twin',
    title: '试验数字孪生',
    icon: <FundProjectionScreenOutlined style={{ fontSize: 56, color: '#13a8a8' }} />,
    description: '校准数字孪生模型并评估可信范围。',
    path: '/analysis/digital-twin',
    color: '#e6fffb',
    borderColor: '#87e8de',
    steps: [],
  },
  {
    key: 'virtual-condition',
    title: '虚拟工况扩展',
    icon: <LineChartOutlined style={{ fontSize: 56, color: '#722ed1' }} />,
    description: '使用可信数字孪生模型扩展未实测工况。',
    path: '/analysis/virtual-condition',
    color: '#f9f0ff',
    borderColor: '#d3adf7',
    steps: [],
  },
  {
    key: 'report',
    title: '报告生成',
    icon: <FileTextOutlined style={{ fontSize: 56, color: '#722ed1' }} />,
    description: '选择报告模板，绑定分析结果数据，一键生成标准化试验分析报告。',
    path: '/report/list',
    color: '#f9f0ff',
    borderColor: '#d3adf7',
    steps: [
      { label: '报告模板', path: '/report/templates', icon: <FileDoneOutlined /> },
      { label: '报告列表', path: '/report/list', icon: <FileAddOutlined /> },
      { label: '新建报告', path: '/report/create', icon: <PlusOutlined /> },
      { label: '报告生成', path: '/report/list', icon: <FileSyncOutlined /> },
    ],
  },
];

/**
 * 系统首页
 * @description 业务页面直达卡片和报告快捷入口
 */
const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ marginBottom: 12 }}>
        <Title level={4} style={{ margin: 0 }}>ProTangram 工业试验数据数智化分析平台</Title>
        <Text type="secondary" style={{ fontSize: 13 }}> </Text>
      </div>

      <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
      <Row gutter={[16, 16]} align="stretch" style={{ width: '100%' }}>
        {HOME_CARDS.map((card) => (
          <Col key={card.key} xs={24} sm={24} md={8} style={{ display: 'flex' }}>
            <Card
              hoverable
              style={{
                borderRadius: 12,
                border: `2px solid ${card.borderColor}`,
                background: card.color,
                width: '100%',
              }}
              styles={{ body: { padding: '28px 24px 20px', display: 'flex', flexDirection: 'column', height: '100%' } }}
            >
              <div
                onClick={() => navigate(card.path)}
                style={{ cursor: 'pointer', textAlign: 'center' }}
              >
                {card.icon}
                <Title level={3} style={{ marginTop: 14, marginBottom: 6 }}>{card.title}</Title>
                <Paragraph type="secondary" style={{ fontSize: 14, margin: 0, lineHeight: 1.6 }}>
                  {card.description}
                </Paragraph>
              </div>

              {card.steps.length > 0 && (
                <>
                  <Divider style={{ margin: '14px 0' }} />

                  <Text strong style={{ fontSize: 13, marginBottom: 10, display: 'block' }}>快捷入口</Text>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {card.steps.map((step) => (
                      <Button
                        key={step.label}
                        size="middle"
                        icon={step.icon}
                        onClick={() => navigate(step.path)}
                        style={{ borderRadius: 6 }}
                      >
                        {step.label}
                      </Button>
                    ))}
                  </div>
                </>
              )}

              <div style={{ marginTop: 'auto', paddingTop: 14, textAlign: 'right' }}>
                <Button type="primary" onClick={() => navigate(card.path)} style={{ borderRadius: 6 }}>
                  进入模块 <RightOutlined />
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      </div>

      <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 15, whiteSpace: 'nowrap' }}>工作流程：</Text>
        {[
          { label: '信息管理', sub: '装备/科目/方法' },
          { label: '试验设计', sub: '智能试验方案' },
          { label: '模板搭建', sub: '拖拽/连线/配置' },
          { label: '数据分析', sub: '导入/计算/对比' },
          { label: '报告生成', sub: '绑定/生成/预览' },
        ].map((step, i, arr) => (
          <React.Fragment key={step.label}>
            <Text style={{ fontSize: 15 }}><Text strong>{step.label}</Text> <Text type="secondary">({step.sub})</Text></Text>
            {i < arr.length - 1 && <RightOutlined style={{ color: '#bbb', fontSize: 13 }} />}
          </React.Fragment>
        ))}
      </div>

      <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', justifyContent: 'center', gap: 24 }}>
        <Text type="secondary" style={{ fontSize: 11 }}>版本 v1.0.0</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>计算模块：5类 24种算法</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>报告模板：8种标准模板</Text>
        <Text type="secondary" style={{ fontSize: 11 }}>数据存储：本地持久化</Text>
      </div>
    </div>
  );
};

export default Home;
