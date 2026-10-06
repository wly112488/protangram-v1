import React, { useEffect, useState } from 'react';
import { Card, Typography, Button, Row, Col, Tag, Empty, Space } from 'antd';
import {
  PlusOutlined, EyeOutlined, FileTextOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisReports } from '@/utils/storage';
import { loadBusinessReportItems } from '@/types/businessContext';
import type { BusinessReportItem } from '@/types/businessContext';
import { useProjectStore } from '@/workspace/projectStore';
import { getReportableArtifacts } from './reportModel.js';
import type { BusinessRouteState } from '@/types/businessContext';

const { Title, Text, Paragraph } = Typography;

/**
 * 分析报告列表页面
 * @description 列表/卡片展示已完成的报告（需求3.2.1）
 */
const ReportList: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { analysisReports, setAnalysisReports } = useAppStore();
  const { projects, activeProjectId } = useProjectStore();
  const routeProjectId = (location.state as BusinessRouteState | null)?.workspaceSession?.targetProjectId;
  const currentProjectId = routeProjectId && projects.some((project) => project.id === routeProjectId)
    ? routeProjectId
    : activeProjectId;
  const [businessResults] = useState<BusinessReportItem[]>(loadBusinessReportItems);
  const activeProject = projects.find((project) => project.id === currentProjectId);
  const reportableArtifacts = activeProject ? getReportableArtifacts(activeProject.artifacts) : [];
  const projectReports = activeProject?.artifacts.filter((artifact) => artifact.type === 'report') ?? [];

  const createProjectReport = () => navigate('/report/create', {
    state: {
      workspaceSession: { mode: 'project', targetProjectId: activeProject?.id },
      artifactIds: reportableArtifacts.map((artifact) => artifact.id),
    },
  });

  useEffect(() => {
    const saved = loadAnalysisReports();
    if (saved.length > 0) setAnalysisReports(saved);
  }, [setAnalysisReports]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={4} style={{ margin: 0 }}>分析报告管理</Title>
          <Text type="secondary">管理已生成的分析报告</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large"
          onClick={createProjectReport}>
          新建报告
        </Button>
      </div>

      {activeProject && <Card
        title={<Space><span>当前项目</span><Tag color="blue">{activeProject.name}</Tag></Space>}
        extra={<Button type="primary" size="small" onClick={createProjectReport}>基于项目成果新建报告</Button>}
        style={{ marginBottom: 16 }}
      >
        <Text type="secondary">可纳入报告的项目成果（{reportableArtifacts.length}）</Text>
        {reportableArtifacts.length > 0 ? (
          <Space wrap style={{ display: 'flex', marginTop: 8 }}>
            {reportableArtifacts.map((artifact) => (
              <Tag key={artifact.id} color="geekblue">{artifact.title}</Tag>
            ))}
          </Space>
        ) : <Paragraph type="secondary" style={{ margin: '8px 0 0' }}>当前项目暂无可纳入报告的成果</Paragraph>}
        {projectReports.length > 0 && <div style={{ marginTop: 16 }}>
          <Text type="secondary">项目内已生成报告（{projectReports.length}）</Text>
          {projectReports.map((artifact) => <div key={artifact.id} style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <Space><FileTextOutlined style={{ color: '#722ed1' }} /><Text strong>{artifact.title}</Text><Tag color="green">已生成</Tag></Space>
            <Button type="link" size="small" onClick={() => navigate(`/report/generate/${artifact.id}`)}>打开</Button>
          </div>)}
        </div>}
      </Card>}

      {businessResults.length > 0 && <Card title="业务分析结果" size="small" style={{ marginBottom: 16 }}>
        {businessResults.map((item, index) => <div key={item.id} style={{ padding: '10px 0', borderBottom: index === businessResults.length - 1 ? 'none' : '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}><Space><Tag color="blue">{item.source}</Tag><Text strong>{item.title}</Text></Space><Text type="secondary">{item.createdAt}</Text></div>
          <Paragraph style={{ margin: '6px 0 0' }}>{item.summary}</Paragraph>
        </div>)}
      </Card>}

      {analysisReports.length === 0 ? (
        <Card style={{ marginTop: 32 }}>
          <Empty description={
            <span>暂无分析报告，点击
              <Button type="link" onClick={createProjectReport}>新建报告</Button>
              或通过数据分析流程自动生成
            </span>
          } />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {analysisReports.map((report) => (
            <Col key={report.id} xs={24} sm={12} lg={8} xl={6}>
              <Card
                className="experiment-card"
                hoverable
                style={{ height: '100%', borderRadius: 12 }}
                actions={[
                  <EyeOutlined key="view"
                    onClick={() => navigate(`/report/generate/${report.id}`)} />,
                ]}
              >
                <Title level={5} style={{ marginBottom: 8 }}>
                  <FileTextOutlined style={{ marginRight: 8, color: '#722ed1' }} />
                  {report.name}
                </Title>
                <Space orientation="vertical" size={4} style={{ width: '100%' }}>
                  <div>
                    <CalendarOutlined style={{ marginRight: 4, color: '#999' }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>{report.createTime}</Text>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验名称：</Text>
                    <Tag color="blue" style={{ fontSize: 11 }}>{report.experimentName}</Tag>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验目的：</Text>
                    <Paragraph ellipsis={{ rows: 1 }} style={{ fontSize: 12, marginBottom: 0 }}>
                      {report.testGoal || '未填写'}
                    </Paragraph>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验对象：</Text>
                    <Text style={{ fontSize: 12 }}>{report.testObject || '未指定'}</Text>
                  </div>
                  <div>
                    <Text strong style={{ fontSize: 12 }}>试验科目：</Text>
                    <Text style={{ fontSize: 12 }}>{report.testSubject || '未指定'}</Text>
                  </div>
                  <div>
                    <Tag color={report.status === 'generated' ? 'green' : 'orange'}>
                      {report.status === 'generated' ? '已生成' : '草稿'}
                    </Tag>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default ReportList;
