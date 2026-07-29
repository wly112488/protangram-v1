import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Form, Select, Space, Descriptions, Tag, message,
} from 'antd';
import {
  ArrowLeftOutlined, FileSyncOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import {
  loadAnalysisProjects, loadExperiments, loadAnalysisReports, saveAnalysisReports,
} from '@/utils/storage';
import type { AnalysisReport } from '@/types';

const { Title, Text } = Typography;

// 报告模板选项
const REPORT_TEMPLATE_OPTIONS = [
  { label: '航空装备地面综合试验报告', value: 'rt-1' },
  { label: '机载设备性能测试报告', value: 'rt-2' },
  { label: '系统联调试验验证报告', value: 'rt-3' },
  { label: '环境适应性试验报告', value: 'rt-4' },
  { label: '可靠性与耐久性试验报告', value: 'rt-5' },
  { label: '稳定性测试分析报告', value: 'rt-6' },
  { label: '功能与性能验证试验报告', value: 'rt-7' },
  { label: '高低温环境试验报告', value: 'rt-8' },
];

/**
 * 报告新建页面
 * @description 支持从数据分析流转或主动新建报告（需求3.2.2）
 */
const ReportCreate: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [form] = Form.useForm();
  const {
    analysisProjects, setAnalysisProjects,
    experiments, setExperiments,
    addAnalysisReport,
  } = useAppStore();

  const [selectedProjectId, setSelectedProjectId] = useState<string>(projectId || '');
  const isFromAnalysis = !!projectId;

  useEffect(() => {
    const projs = loadAnalysisProjects();
    if (projs.length > 0) setAnalysisProjects(projs);
    const exps = loadExperiments();
    if (exps.length > 0) setExperiments(exps);

    if (projectId) {
      form.setFieldsValue({ analysisProjectId: projectId });
      setSelectedProjectId(projectId);
    }
  }, [projectId, setAnalysisProjects, setExperiments, form]);

  const selectedProject = analysisProjects.find((p) => p.id === selectedProjectId);
  const relatedExperiment = selectedProject
    ? experiments.find((e) => e.id === selectedProject.experimentId)
    : undefined;

  /**
   * 生成报告，跳转到报告生成页面
   */
  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      const project = analysisProjects.find((p) => p.id === values.analysisProjectId);
      const exp = project ? experiments.find((e) => e.id === project.experimentId) : undefined;

      const report: AnalysisReport = {
        id: uuidv4(),
        name: `${exp?.name || '未命名'}_分析报告`,
        experimentName: exp?.name || '',
        testGoal: exp?.testGoal || '',
        testObject: exp?.testObjectNames?.join(', ') || '',
        testSubject: exp?.testSubjectNames?.join(', ') || '',
        hasOutline: exp?.hasOutline || false,
        analysisProjectId: values.analysisProjectId,
        reportTemplateId: values.reportTemplateId,
        tagBindings: {},
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 'draft',
      };

      addAnalysisReport(report);
      const all = loadAnalysisReports();
      all.push(report);
      saveAnalysisReports(all);

      message.success('报告已创建');
      navigate(`/report/generate/${report.id}`);
    } catch {
      message.error('请填写必要信息');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/report/list')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>
          {isFromAnalysis ? '流程顺延 - 新建报告' : '新建分析报告'}
        </Title>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <Card title="报告配置" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical">
            <Form.Item label="选择数据分析项目" name="analysisProjectId"
              rules={[{ required: true, message: '请选择数据分析项目' }]}>
              <Select
                placeholder="选择已完成的数据分析项目"
                onChange={(v) => setSelectedProjectId(v)}
                disabled={isFromAnalysis}
                options={analysisProjects.map((p) => ({
                  label: (
                    <span>
                      {p.name}
                      <Tag color={p.status === 'completed' ? 'green' : 'orange'} style={{ marginLeft: 8, fontSize: 11 }}>
                        {p.status === 'completed' ? '已完成' : p.status}
                      </Tag>
                    </span>
                  ),
                  value: p.id,
                }))}
              />
            </Form.Item>
            <Form.Item label="选择报告模板" name="reportTemplateId"
              rules={[{ required: true, message: '请选择报告模板' }]}>
              <Select placeholder="选择报告模板" options={REPORT_TEMPLATE_OPTIONS} />
            </Form.Item>
          </Form>
        </Card>

        {selectedProject && (
          <Card title="关联信息" style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Button type="link" icon={<LinkOutlined />} size="small"
                  onClick={() => navigate(`/analysis/projects/execute/${selectedProject.id}`)}>
                  查看分析项目
                </Button>
                {relatedExperiment && (
                  <Button type="link" icon={<LinkOutlined />} size="small"
                    onClick={() => navigate(`/experiment/design/edit/${relatedExperiment.id}`)}>
                    查看试验卡片
                  </Button>
                )}
              </Space>
            }>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="分析项目">{selectedProject.name}</Descriptions.Item>
              <Descriptions.Item label="试验名称">{selectedProject.experimentName}</Descriptions.Item>
              <Descriptions.Item label="分析模板">{selectedProject.templateName}</Descriptions.Item>
              <Descriptions.Item label="项目状态">
                <Tag color={selectedProject.status === 'completed' ? 'green' : 'orange'}>
                  {selectedProject.status === 'completed' ? '已完成' : selectedProject.status}
                </Tag>
              </Descriptions.Item>
              {relatedExperiment && (
                <>
                  <Descriptions.Item label="试验目的" span={2}>{relatedExperiment.testGoal || '未填写'}</Descriptions.Item>
                  <Descriptions.Item label="试验对象">
                    {relatedExperiment.testObjectNames.map((n, i) => <Tag key={i} color="blue">{n}</Tag>)}
                  </Descriptions.Item>
                  <Descriptions.Item label="试验科目">
                    {relatedExperiment.testSubjectNames.map((n, i) => <Tag key={i} color="green">{n}</Tag>)}
                  </Descriptions.Item>
                  <Descriptions.Item label="试验大纲">
                    <Tag color={relatedExperiment.hasOutline ? 'green' : 'default'}>
                      {relatedExperiment.hasOutline ? '已有大纲' : '暂无大纲'}
                    </Tag>
                  </Descriptions.Item>
                </>
              )}
            </Descriptions>
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space size="large">
            <Button size="large" onClick={() => navigate('/report/list')}>取消</Button>
            <Button type="primary" size="large" icon={<FileSyncOutlined />} onClick={handleGenerate}>
              {isFromAnalysis ? '一键生成报告' : '生成报告'}
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default ReportCreate;
