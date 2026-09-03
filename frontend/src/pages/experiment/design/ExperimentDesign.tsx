import React, { useEffect } from 'react';
import { Alert, Card, Typography, Button, Row, Col, Tag, Popconfirm, Empty, message, Space } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  EyeOutlined,
  FileTextOutlined,
  CalendarOutlined,
  AimOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadExperiments, saveExperiments } from '@/utils/storage';

const { Title, Text, Paragraph } = Typography;

/**
 * 试验设计主页面（卡片列表）
 * @description 展示已创建的试验项目卡片（需求1.2.1）
 */
const ExperimentDesign: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as { source?: string; suggestedRange?: string; modelName?: string } | null;
  const { experiments, setExperiments, deleteExperiment } = useAppStore();

  useEffect(() => {
    const saved = loadExperiments();
    if (saved.length > 0) {
      setExperiments(saved);
    }
  }, [setExperiments]);

  /**
   * 删除试验卡片
   * @param id - 试验卡片ID
   */
  const handleDelete = (id: string) => {
    deleteExperiment(id);
    const updated = experiments.filter((e) => e.id !== id);
    saveExperiments(updated);
    message.success('试验卡片已删除');
  };

  /**
   * 点击大纲（查看/设计）
   * @param id - 试验卡片ID
   */
  const handleOutline = (id: string) => {
    navigate(`/experiment/design/outline/${id}`);
  };

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>试验设计</Title>
          <Text type="secondary">管理试验项目，创建和编辑试验卡片</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          size="large"
          onClick={() => navigate('/experiment/design/create')}
        >
          新建试验
        </Button>
      </div>
      {incoming?.source === 'experiment-analysis' && <Alert type="info" showIcon title={`建议重点验证：${incoming.suggestedRange}`} description={`当前模型：${incoming.modelName}`} style={{ marginBottom: 16 }} />}

      {experiments.length === 0 ? (
        <Card style={{ marginTop: 32 }}>
          <Empty
            description={
              <span>
                暂无试验项目，点击
                <Button type="link" onClick={() => navigate('/experiment/design/create')}>
                  新建试验
                </Button>
                开始
              </span>
            }
          />
        </Card>
      ) : (
        <div style={{ margin: '0 -8px' }}>
          <Row gutter={[16, 16]}>
            {experiments.map((exp) => (
            <Col key={exp.id} xs={24} sm={12} lg={8} xl={6} style={{ display: 'flex' }}>
              <Card
                className="experiment-card"
                hoverable
                style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 12 }}
                actions={[
                  <EyeOutlined key="view" onClick={() => navigate(`/experiment/design/edit/${exp.id}`)} />,
                  <EditOutlined key="edit" onClick={() => navigate(`/experiment/design/edit/${exp.id}`)} />,
                  <Popconfirm
                    key="delete"
                    title="确认删除该试验卡片？"
                    onConfirm={() => handleDelete(exp.id)}
                    okText="确认"
                    cancelText="取消"
                  >
                    <DeleteOutlined style={{ color: '#ff4d4f' }} />
                  </Popconfirm>,
                ]}
              >
                <div style={{ marginBottom: 12 }}>
                  <Title level={5} style={{ margin: 0 }}>
                    <ExperimentOutlined style={{ marginRight: 8, color: '#1890ff' }} />
                    {exp.name}
                  </Title>
                </div>

                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <div>
                    <CalendarOutlined style={{ marginRight: 4, color: '#999' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{exp.createTime}</Text>
                  </div>

                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验对象：</Text>
                    <div style={{ marginTop: 2 }}>
                      {exp.testObjectNames.slice(0, 2).map((name, i) => (
                        <Tag key={i} color="blue" style={{ fontSize: 11, marginBottom: 2 }}>
                          {name}
                        </Tag>
                      ))}
                      {exp.testObjectNames.length > 2 && (
                        <Tag style={{ fontSize: 11 }}>+{exp.testObjectNames.length - 2}</Tag>
                      )}
                    </div>
                  </div>

                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验科目：</Text>
                    <div style={{ marginTop: 2 }}>
                      {exp.testSubjectNames.slice(0, 2).map((name, i) => (
                        <Tag key={i} color="green" style={{ fontSize: 11, marginBottom: 2 }}>
                          {name}
                        </Tag>
                      ))}
                      {exp.testSubjectNames.length > 2 && (
                        <Tag style={{ fontSize: 11 }}>+{exp.testSubjectNames.length - 2}</Tag>
                      )}
                    </div>
                  </div>

                  <Paragraph
                    ellipsis={{ rows: 2 }}
                    style={{ fontSize: 12, color: '#666', marginBottom: 4 }}
                  >
                    <AimOutlined style={{ marginRight: 4 }} />
                    {exp.testGoal || '暂无试验目标'}
                  </Paragraph>

                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验方法：</Text>
                    <Text style={{ fontSize: 12 }}>{exp.testMethod || '未选择'}</Text>
                  </div>

                  <div style={{ marginTop: 8 }}>
                    {exp.hasOutline ? (
                      <Button
                        type="link"
                        icon={<FileTextOutlined />}
                        size="small"
                        style={{ padding: 0 }}
                        onClick={() => handleOutline(exp.id)}
                      >
                        查看试验大纲
                      </Button>
                    ) : (
                      <Button
                        type="dashed"
                        icon={<FileTextOutlined />}
                        size="small"
                        onClick={() => handleOutline(exp.id)}
                      >
                        设计试验大纲
                      </Button>
                    )}
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

export default ExperimentDesign;
