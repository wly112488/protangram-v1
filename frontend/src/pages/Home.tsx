import React from 'react';
import { Card, Typography, Row, Col, Button, Divider } from 'antd';
import {
  ExperimentOutlined,
  FundProjectionScreenOutlined,
  FileTextOutlined,
  PlusOutlined,
  AppstoreOutlined,
  ProfileOutlined,
  FormOutlined,
  EditOutlined,
  BlockOutlined,
  LineChartOutlined,
  PlayCircleOutlined,
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
    description: '创建和管理试验项目，设计试验大纲，配置试验方法、因子与响应变量，生成试验方案。',
    path: '/experiment/design',
    color: '#e6f7ff',
    borderColor: '#91caff',
    steps: [
      { label: '装备管理', path: '/experiment/info/bom', icon: <AppstoreOutlined /> },
      { label: '试验科目', path: '/experiment/info/subjects', icon: <ProfileOutlined /> },
      { label: '设计方法', path: '/experiment/info/methods', icon: <FormOutlined /> },
      { label: '新建试验', path: '/experiment/design/create', icon: <PlusOutlined /> },
      { label: '试验列表', path: '/experiment/design', icon: <EditOutlined /> },
    ],
  },
  {
    key: 'analysis',
    title: '数据分析',
    icon: <FundProjectionScreenOutlined style={{ fontSize: 56, color: '#52c41a' }} />,
    description: '构建数据分析模板，执行分析流程，支持数据导入、计算处理、对比分析与图表可视化。',
    path: '/analysis/projects',
    color: '#f6ffed',
    borderColor: '#b7eb8f',
    steps: [
      { label: '模块管理', path: '/analysis/modules', icon: <AppstoreOutlined /> },
      { label: '模板列表', path: '/analysis/templates', icon: <BlockOutlined /> },
      { label: '新建模板', path: '/analysis/templates/create', icon: <PlusOutlined /> },
      { label: '分析项目', path: '/analysis/projects', icon: <LineChartOutlined /> },
      { label: '新建项目', path: '/analysis/projects/create', icon: <PlayCircleOutlined /> },
    ],
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
 * @description 三个大卡片入口：试验设计、数据分析、报告生成，含快捷导航按钮
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
          { label: '试验设计', sub: '卡片/大纲/方案' },
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
