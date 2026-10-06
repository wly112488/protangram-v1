import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Form, Select, Space, Descriptions, Tag, message, Checkbox, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, FileSyncOutlined, LinkOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisProjects, loadExperiments, loadAnalysisReports, saveAnalysisReports } from '@/utils/storage';
import { useProjectStore } from '@/workspace/projectStore';
import { getReportableArtifacts, resolveReportProjectId } from './reportModel.js';
import type { AnalysisProject, AnalysisReport } from '@/types';
import type { BusinessRouteState } from '@/types/businessContext';

const { Title, Text } = Typography;

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

type ReportRecord = AnalysisReport & {
  workspaceProjectId?: string;
  artifactIds?: string[];
};

const ReportCreate: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId: legacyRouteProjectId } = useParams<{ projectId: string }>();
  const routeState = location.state as BusinessRouteState | null;
  const routeProjectId = routeState?.workspaceSession?.targetProjectId || legacyRouteProjectId;
  const [form] = Form.useForm();
  const {
    setAnalysisProjects, setExperiments, addAnalysisReport,
  } = useAppStore();
  const { projects, activeProjectId } = useProjectStore();
  const [legacyProjects, setLegacyProjects] = useState<AnalysisProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<string[]>([]);

  useEffect(() => {
    const savedProjects = loadAnalysisProjects();
    setLegacyProjects(savedProjects);
    if (savedProjects.length > 0) setAnalysisProjects(savedProjects);
    const experiments = loadExperiments();
    if (experiments.length > 0) setExperiments(experiments);

    const validProjectIds = [...projects.map((project) => project.id), ...savedProjects.map((project) => project.id)];
    const initialProjectId = routeProjectId && validProjectIds.includes(routeProjectId)
      ? routeProjectId
      : resolveReportProjectId({ activeProjectId, projectIds: projects.map((project) => project.id) });
    setSelectedProjectId(initialProjectId);
    form.setFieldsValue({ analysisProjectId: initialProjectId });

    const initialProject = projects.find((project) => project.id === initialProjectId);
    const availableArtifactIds = initialProject
      ? getReportableArtifacts(initialProject.artifacts).map((artifact) => artifact.id)
      : [];
    const requestedArtifactIds = routeState?.artifactIds;
    setSelectedArtifactIds(requestedArtifactIds && routeProjectId === initialProjectId
      ? requestedArtifactIds.filter((id) => availableArtifactIds.includes(id))
      : availableArtifactIds);
  // Initialize once for each route handoff; project data is available synchronously from the persisted store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedProject = projects.find((project) => project.id === selectedProjectId);
  const selectedLegacyProject = legacyProjects.find((project) => project.id === selectedProjectId);
  const reportableArtifacts = selectedProject ? getReportableArtifacts(selectedProject.artifacts) : [];

  const handleProjectChange = (id: string) => {
    setSelectedProjectId(id);
    const nextProject = projects.find((project) => project.id === id);
    setSelectedArtifactIds(nextProject
      ? getReportableArtifacts(nextProject.artifacts).map((artifact) => artifact.id)
      : []);
  };

  const handleGenerate = async () => {
    try {
      const values = await form.validateFields();
      const project = projects.find((item) => item.id === values.analysisProjectId);
      const legacyProject = legacyProjects.find((item) => item.id === values.analysisProjectId);
      const report: ReportRecord = {
        id: uuidv4(),
        name: `${project?.name || legacyProject?.experimentName || '未命名'}_分析报告`,
        experimentName: project?.name || legacyProject?.experimentName || '',
        testGoal: '',
        testObject: project?.basicInfo.testObject || '',
        testSubject: '',
        hasOutline: false,
        analysisProjectId: values.analysisProjectId,
        reportTemplateId: values.reportTemplateId,
        tagBindings: {},
        createTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        status: 'draft',
        workspaceProjectId: project?.id,
        artifactIds: project ? selectedArtifactIds : [],
      };

      addAnalysisReport(report);
      const all = loadAnalysisReports().filter((item) => item.id !== report.id);
      all.push(report);
      saveAnalysisReports(all);

      message.success('报告已创建');
      navigate(`/report/generate/${report.id}`);
    } catch {
      message.error('请选择项目和报告模板');
    }
  };

  const projectOptions = [
    ...projects.map((project) => ({ label: `${project.name} · ${project.artifacts.length} 项成果`, value: project.id })),
    ...legacyProjects.map((project) => ({ label: `${project.name} · 旧分析项目`, value: project.id })),
  ];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16, gap: 12 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/report/list')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>新建分析报告</Title>
      </div>

      <div style={{ maxWidth: 850, margin: '0 auto' }}>
        <Card title="报告配置" style={{ marginBottom: 16 }}>
          <Form form={form} layout="vertical" initialValues={{ analysisProjectId: selectedProjectId }}>
            <Form.Item label="选择项目" name="analysisProjectId"
              rules={[{ required: true, message: '请选择项目' }]}>
              <Select
                showSearch
                optionFilterProp="label"
                placeholder="选择项目或兼容的旧分析项目"
                onChange={handleProjectChange}
                options={projectOptions}
                notFoundContent={<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有可用于报告的项目" />}
              />
            </Form.Item>
            <Form.Item label="选择报告模板" name="reportTemplateId"
              rules={[{ required: true, message: '请选择报告模板' }]}>
              <Select placeholder="选择报告模板" options={REPORT_TEMPLATE_OPTIONS} />
            </Form.Item>
          </Form>
        </Card>

        {selectedProject && (
          <Card title="选择项目成果" style={{ marginBottom: 16 }}
            extra={<Button type="link" icon={<LinkOutlined />} size="small"
              onClick={() => navigate('/analysis/projects')}>查看项目</Button>}>
            <Descriptions column={2} size="small" style={{ marginBottom: 12 }}>
              <Descriptions.Item label="项目名称">{selectedProject.name}</Descriptions.Item>
              <Descriptions.Item label="项目状态"><Tag color="blue">{selectedProject.status}</Tag></Descriptions.Item>
              <Descriptions.Item label="试验对象">{selectedProject.basicInfo.testObject || '未填写'}</Descriptions.Item>
              <Descriptions.Item label="可用成果">{reportableArtifacts.length} 项</Descriptions.Item>
            </Descriptions>
            {reportableArtifacts.length > 0 ? (
              <Checkbox.Group value={selectedArtifactIds} onChange={(values) => setSelectedArtifactIds(values as string[])}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  {reportableArtifacts.map((artifact) => (
                    <Checkbox key={artifact.id} value={artifact.id}>
                      <Space wrap>
                        <Text strong>{artifact.title}</Text>
                        <Tag color="blue">{artifact.type}</Tag>
                        <Text type="secondary">{artifact.summary}</Text>
                      </Space>
                    </Checkbox>
                  ))}
                </Space>
              </Checkbox.Group>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="项目暂无可纳入报告的设计、分析或校准成果" />}
          </Card>
        )}

        {selectedLegacyProject && (
          <Card title="兼容旧分析项目" style={{ marginBottom: 16 }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="分析项目">{selectedLegacyProject.name}</Descriptions.Item>
              <Descriptions.Item label="关联试验">{selectedLegacyProject.experimentName}</Descriptions.Item>
              <Descriptions.Item label="分析模板">{selectedLegacyProject.templateName}</Descriptions.Item>
              <Descriptions.Item label="项目状态"><Tag color="green">{selectedLegacyProject.status}</Tag></Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Space size="large">
            <Button size="large" onClick={() => navigate('/report/list')}>取消</Button>
            <Button type="primary" size="large" icon={<FileSyncOutlined />} onClick={handleGenerate}>
              生成报告
            </Button>
          </Space>
        </div>
      </div>
    </div>
  );
};

export default ReportCreate;
