import React, { useEffect } from 'react';
import { Card, Typography, Button, Row, Col, Tag, Empty, Space, message } from 'antd';
import {
  PlusOutlined, PlayCircleOutlined, EyeOutlined, ExperimentOutlined,
  FileTextOutlined, BlockOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisProjects } from '@/utils/storage';

const { Title, Text, Paragraph } = Typography;

/**
 * 数据分析项目卡片列表页面
 * @description 展示已有数据分析项目卡片（需求2.3.1）
 */
const AnalysisProjects: React.FC = () => {
  const navigate = useNavigate();
  const { analysisProjects, setAnalysisProjects } = useAppStore();

  useEffect(() => {
    const saved = loadAnalysisProjects();
    if (saved.length > 0) setAnalysisProjects(saved);
  }, [setAnalysisProjects]);

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>数据分析</Title>
          <Text type="secondary">管理数据分析项目，执行分析流程</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          onClick={() => navigate('/analysis/projects/create')}>
          新建分析项目
        </Button>
      </div>

      {analysisProjects.length === 0 ? (
        <Card style={{ marginTop: 32 }}>
          <Empty description={
            <span>暂无分析项目，点击
              <Button type="link" onClick={() => navigate('/analysis/projects/create')}>新建项目</Button>
              开始
            </span>
          } />
        </Card>
      ) : (
        <div style={{ margin: '0 -8px' }}>
          <Row gutter={[16, 16]}>
          {analysisProjects.map((project) => (
            <Col key={project.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                className="experiment-card"
                hoverable
                style={{ height: '100%', borderRadius: 12 }}
                actions={[
                  <EyeOutlined key="view" onClick={() => navigate(`/analysis/projects/execute/${project.id}`)} />,
                  project.status === 'completed' ? (
                    <Tag key="status" color="green">已完成</Tag>
                  ) : (
                    <PlayCircleOutlined key="run"
                      onClick={() => navigate(`/analysis/projects/execute/${project.id}`)}
                      style={{ color: '#1890ff' }} />
                  ),
                ]}
              >
                <Title level={5} style={{ marginBottom: 8 }}>
                  <ExperimentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                  {project.name}
                </Title>

                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <div>
                    <CalendarOutlined style={{ marginRight: 4, color: '#999' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{project.createTime}</Text>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>关联试验：</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{project.experimentName}</Tag>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>分析模板：</Text>
                    <Tag color="green" style={{ fontSize: 11 }}>{project.templateName}</Tag>
                  </div>
                  {project.outlineSummary && (
                    <Paragraph ellipsis={{ rows: 2 }} style={{ fontSize: 12, color: '#666', marginBottom: 0 }}>
                      <FileTextOutlined style={{ marginRight: 4 }} />
                      {project.outlineSummary}
                    </Paragraph>
                  )}
                  <div>
                    <Tag color={project.status === 'completed' ? 'green' : project.status === 'running' ? 'blue' : 'default'}>
                      {project.status === 'completed' ? '已完成' : project.status === 'running' ? '执行中' : '草稿'}
                    </Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
          </Row>
        </div>
      )}
    </div>
  );
};

export default AnalysisProjects;
