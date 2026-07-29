import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Form, Select, Input, Space, Descriptions, Tag, message,
} from 'antd';
import {
  ArrowLeftOutlined, SaveOutlined, PlayCircleOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import {
  loadExperiments, loadAnalysisTemplates, loadAnalysisProjects, saveAnalysisProjects,
} from '@/utils/storage';
import type { AnalysisProject } from '@/types';

const { Title, Text } = Typography;

/**
 * 数据分析项目新建页面
 * @description 关联试验卡片和分析模板，创建数据分析项目（需求2.3.2）
 */
const AnalysisProjectCreate: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preTemplateId = searchParams.get('templateId');
  const [form] = Form.useForm();
  const {
    experiments, setExperiments,
    analysisTemplates, setAnalysisTemplates,
    addAnalysisProject,
  } = useAppStore();

  const [selectedExpId, setSelectedExpId] = useState<string>('');

  useEffect(() => {
    const exps = loadExperiments();
    if (exps.length > 0) setExperiments(exps);
    const templates = loadAnalysisTemplates();
    if (templates.length > 0) setAnalysisTemplates(templates);

    if (preTemplateId) {
      form.setFieldsValue({ templateId: preTemplateId });
    }
  }, [setExperiments, setAnalysisTemplates, preTemplateId, form]);

  const selectedExp = experiments.find((e) => e.id === selectedExpId);

  /**
   * 保存并执行
   * @param execute - 是否立即跳转执行
   */
  const handleSave = async (execute: boolean) => {
    try {
      const values = await form.validateFields();
      const exp = experiments.find((e) => e.id === values.experimentId);
      const tpl = analysisTemplates.find((t) => t.id === values.templateId);

      const project: AnalysisProject = {
        id: uuidv4(),
        name: values.name || `${exp?.name || ''}_分析项目`,
        experimentId: values.experimentId,
        experimentName: exp?.name || '',
        outlineSummary: exp?.hasOutline ? `方法:${exp.outline?.method} | 因子:${exp.outline?.basicParams.factorCount}` : '',
        templateId: values.templateId,
        templateName: tpl?.name || '',
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 'draft',
        completedNodes: [],
      };

      addAnalysisProject(project);
      const all = loadAnalysisProjects();
      all.push(project);
      saveAnalysisProjects(all);

      message.success('分析项目已创建');
      if (execute) {
        navigate(`/analysis/projects/execute/${project.id}`);
      } else {
        navigate('/analysis/projects');
      }
    } catch {
      message.error('请填写必要信息');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/analysis/projects')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>新建数据分析项目</Title>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', width: '100%', flex: 1, minHeight: 0, overflow: 'auto' }}>
        <Card title="项目配置" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical">
            <Form.Item label="项目名称" name="name">
              <Input placeholder="可选，默认使用试验名称" />
            </Form.Item>
            <Form.Item label="选择试验卡片" name="experimentId"
              rules={[{ required: true, message: '请选择试验卡片' }]}>
              <Select placeholder="选择试验卡片" onChange={(v) => setSelectedExpId(v)}
                options={experiments.map((e) => ({
                  label: <span>{e.name} <Tag color={e.hasOutline ? 'green' : 'default'} style={{ fontSize: 11 }}>{e.hasOutline ? '有大纲' : '无大纲'}</Tag></span>,
                  value: e.id,
                }))} />
            </Form.Item>
            <Form.Item label="选择分析模板" name="templateId"
              rules={[{ required: true, message: '请选择分析模板' }]}>
              <Select placeholder="选择分析模板"
                options={analysisTemplates.map((t) => ({
                  label: `${t.name} (${t.experimentName || '通用'})`,
                  value: t.id,
                }))} />
            </Form.Item>
          </Form>
        </Card>

        {selectedExp && (
          <Card title="试验卡片信息" style={{ marginBottom: 16 }}
            extra={
              <Button type="link" icon={<LinkOutlined />}
                onClick={() => navigate(`/experiment/design/edit/${selectedExp.id}`)}>
                查看详情
              </Button>
            }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="试验名称">{selectedExp.name}</Descriptions.Item>
              <Descriptions.Item label="创建时间">{selectedExp.createTime}</Descriptions.Item>
              <Descriptions.Item label="试验目的" span={2}>{selectedExp.testGoal || '未填写'}</Descriptions.Item>
              <Descriptions.Item label="试验对象">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {selectedExp.testObjectNames.slice(0, 5).map((n, i) => <Tag key={i} color="blue">{n}</Tag>)}
                  {selectedExp.testObjectNames.length > 5 && <Tag>+{selectedExp.testObjectNames.length - 5}</Tag>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="试验科目">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {selectedExp.testSubjectNames.slice(0, 5).map((n, i) => <Tag key={i} color="green">{n}</Tag>)}
                  {selectedExp.testSubjectNames.length > 5 && <Tag>+{selectedExp.testSubjectNames.length - 5}</Tag>}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="试验大纲">
                {selectedExp.hasOutline ? (
                  <span>
                    <Tag color="green">已有大纲</Tag>
                    <Button type="link" size="small"
                      onClick={() => navigate(`/experiment/design/outline/${selectedExp.id}`)}>
                      查看大纲
                    </Button>
                  </span>
                ) : <Tag color="default">暂无大纲</Tag>}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space size="large">
            <Button size="large" onClick={() => navigate('/analysis/projects')}>取消</Button>
            <Button size="large" icon={<SaveOutlined />} onClick={() => handleSave(false)}>仅保存</Button>
            <Button type="primary" size="large" icon={<PlayCircleOutlined />}
              onClick={() => handleSave(true)}>
              保存并执行
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default AnalysisProjectCreate;
