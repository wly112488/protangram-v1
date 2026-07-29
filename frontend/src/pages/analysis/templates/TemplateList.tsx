import React, { useEffect } from 'react';
import { Card, Typography, Button, Table, Tag, Space, Empty, Popconfirm, message } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisTemplates, saveAnalysisTemplates } from '@/utils/storage';
import type { AnalysisTemplate } from '@/types';

const { Title, Text } = Typography;

/**
 * 数据分析模板列表页面
 * @description 列表展示已有模板，支持分组展示/查看/编辑/新建（需求2.2.1）
 */
const TemplateList: React.FC = () => {
  const navigate = useNavigate();
  const { analysisTemplates, setAnalysisTemplates, deleteAnalysisTemplate } = useAppStore();

  useEffect(() => {
    const saved = loadAnalysisTemplates();
    if (saved.length > 0) setAnalysisTemplates(saved);
  }, [setAnalysisTemplates]);

  /**
   * 删除模板
   * @param id - 模板ID
   */
  const handleDelete = (id: string) => {
    deleteAnalysisTemplate(id);
    const updated = analysisTemplates.filter((t) => t.id !== id);
    saveAnalysisTemplates(updated);
    message.success('模板已删除');
  };

  /**
   * 选择模板后进入数据分析流程（需求2.2.3）
   * @param templateId - 模板ID
   */
  const handleUseTemplate = (templateId: string) => {
    navigate(`/analysis/projects/create?templateId=${templateId}`);
  };

  const columns = [
    { title: '模板名称', dataIndex: 'name', key: 'name', render: (text: string) => <Text strong>{text}</Text> },
    { title: '对应试验', dataIndex: 'experimentName', key: 'experimentName', render: (text: string) => <Tag color="blue">{text || '通用'}</Tag> },
    { title: '对应工况', dataIndex: 'condition', key: 'condition', render: (text: string) => <Tag color="green">{text || '默认'}</Tag> },
    { title: '创建日期', dataIndex: 'createDate', key: 'createDate' },
    {
      title: '操作', key: 'actions', width: 250,
      render: (_: unknown, record: AnalysisTemplate) => (
        <Space>
          <Button size="small" icon={<PlayCircleOutlined />} type="primary" ghost
            onClick={() => handleUseTemplate(record.id)}>
            使用
          </Button>
          <Button size="small" icon={<EditOutlined />}
            onClick={() => navigate(`/analysis/templates/edit/${record.id}`)}>
            编辑
          </Button>
          <Popconfirm title="确认删除？" onConfirm={() => handleDelete(record.id)} okText="确认" cancelText="取消">
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 按试验名称+工况分组展示
  const groupedData = analysisTemplates.reduce<Record<string, AnalysisTemplate[]>>((acc, t) => {
    const group = `${t.experimentName || '通用'} / ${t.condition || '默认'}`;
    if (!acc[group]) acc[group] = [];
    acc[group].push(t);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>模板管理</Title>
          <Text type="secondary">管理数据分析模板，支持按试验名称及工况分组展示</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          onClick={() => navigate('/analysis/templates/create')}>
          新建模板
        </Button>
      </div>

      {analysisTemplates.length === 0 ? (
        <Card>
          <Empty description={
            <span>暂无分析模板，点击
              <Button type="link" onClick={() => navigate('/analysis/templates/create')}>新建模板</Button>
              开始
            </span>
          } />
        </Card>
      ) : (
        Object.entries(groupedData).map(([group, templates]) => (
          <Card key={group} title={<Tag color="orange">{group}</Tag>} style={{ marginBottom: 16 }}>
            <Table dataSource={templates} columns={columns} rowKey="id" size="small" pagination={false} />
          </Card>
        ))
      )}
    </div>
  );
};

export default TemplateList;
