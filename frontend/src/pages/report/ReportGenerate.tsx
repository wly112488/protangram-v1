import { useSessionRouteState, useSessionState } from '@/workspace/useSessionState';
import { useSessionStore } from '@/workspace/sessionStore';
import { getSessionDraftKey } from '@/workspace/sessionModel';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Card, Typography, Button, Row, Col, Tag, message, Modal, Space, Select, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined,
  EyeOutlined, SaveOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisReports, saveAnalysisReports } from '@/utils/storage';
import { useProjectStore } from '@/workspace/projectStore';
import { useTaskStore } from '@/workspace/taskStore';
import { createReportArtifactInput, getReportableArtifacts, resolveReportOutputVariables, hasUnavailableReportBindings, hasReportNarrative } from './reportModel.js';
import { countUnmetTaskItems } from './taskReportModel';
import type { AnalysisReport } from '@/types';

const { Title, Text, Paragraph } = Typography;

// 模拟报告模板标签（需求3.3.1）
const TEMPLATE_TAGS = [
  '{{试验名称}}', '{{试验目的}}', '{{试验对象}}', '{{试验科目}}',
  '{{试验方法}}', '{{试验因子}}', '{{试验方案表}}',
  '{{原始数据表}}', '{{数据统计}}',
  '{{分析结果图表}}', '{{对比分析}}',
  '{{试验结论}}', '{{改进建议}}', '{{附件列表}}',
];

// 模拟数据分析输出节点（需求3.3.2）
const MOCK_OUTPUT_VARIABLES = [
  { id: 'out-1', name: '仿真数据_温度曲线' },
  { id: 'out-2', name: '试验数据_温度曲线' },
  { id: 'out-3', name: '温度对比分析图' },
  { id: 'out-4', name: '归一化后数据集' },
  { id: 'out-5', name: '统计特征表' },
  { id: 'out-6', name: '异常值分析结果' },
];

type ReportRecord = AnalysisReport & {
  workspaceProjectId?: string;
  artifactIds?: string[];
  taskId?: string;
  taskItemId?: string;
};

/**
 * 分析报告生成页面
 * @description 标签解析、拖拽绑定、报告生成（需求3.3）
 */
const ReportGenerate: React.FC = () => {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { analysisReports, updateAnalysisReport, setAnalysisReports } = useAppStore();
  const { projects, addArtifact, removeArtifact } = useProjectStore();
  const setFormalTaskReportArtifact = useTaskStore((state) => state.setFormalReportArtifact);
  const setTaskRequirementStatus = useTaskStore((state) => state.setRequirementStatus);
  const addArtifactToTaskItem = useTaskStore((state) => state.addArtifactToTaskItem);
  const tasks = useTaskStore((state) => state.tasks);

  const [tagBindings, setTagBindings] = useSessionState<Record<string, string>>(`report:${reportId}:tagBindings`, {});
  const routeState = useSessionRouteState();
  const restoredBindings = useRef(useSessionStore.getState().sessions.find(item => item.id === routeState?.workspaceSession?.sessionId)?.drafts.report?.[getSessionDraftKey(`report:${reportId}:tagBindings`, routeState?.workspaceSession)]);
  const [demoEnabled, setDemoEnabled] = useSessionState(`report:${reportId}:demoEnabled`, () => (analysisReports.find(item => item.id === reportId) ?? loadAnalysisReports().find(item => item.id === reportId))?.dataSource === 'demo');
  const [dragItem, setDragItem] = useState<string>('');
  const [reportGenerated, setReportGenerated] = useState(false);

  const report = analysisReports.find((r) => r.id === reportId) as ReportRecord | undefined;
  const task = tasks.find((item) => item.id === report?.taskId);
  const workspaceProjectId = report?.workspaceProjectId
    || projects.find((project) => project.id === report?.analysisProjectId)?.id;
  const workspaceProject = projects.find((project) => project.id === workspaceProjectId);
  const selectedArtifactIds = report?.artifactIds;
  const projectOutputVariables = workspaceProject
    ? getReportableArtifacts(workspaceProject.artifacts)
      .filter((artifact) => !selectedArtifactIds || selectedArtifactIds.includes(artifact.id))
      .map((artifact) => ({ id: artifact.id, name: artifact.title }))
    : [];
  const hasFormalEvidence = projects.some(project => project.artifacts.some(artifact => artifact.id === reportId && artifact.type === 'report'))
    || tasks.some(item => item.reportDraft.formalReportArtifact?.artifactId === reportId);
  const usingDemo = projectOutputVariables.length === 0 && demoEnabled && !hasFormalEvidence;
  const outputVariables = resolveReportOutputVariables(projectOutputVariables, MOCK_OUTPUT_VARIABLES, demoEnabled && !hasFormalEvidence);
  const unavailableBindings = hasUnavailableReportBindings(tagBindings, outputVariables);
  const dataSource = usingDemo ? 'demo' as const : 'artifacts' as const;
  const hasReportContent = outputVariables.length > 0 || hasReportNarrative(report?.reportContent);

  useEffect(() => {
    let reports = analysisReports;
    if (reports.length === 0) {
      reports = loadAnalysisReports();
      if (reports.length > 0) setAnalysisReports(reports);
    }
    const r = reports.find((r) => r.id === reportId);
    if (r?.tagBindings && restoredBindings.current === undefined) {
      setTagBindings(r.tagBindings);
      restoredBindings.current = r.tagBindings;
    }
    if (r?.status === 'generated') {
      setReportGenerated(true);
    }
  }, [reportId, analysisReports, setAnalysisReports, setTagBindings]);

  /**
   * 开始拖拽输出变量
   * @param varId - 变量ID
   */
  const handleDragStart = (varId: string) => {
    setDragItem(varId);
  };

  /**
   * 将变量拖入标签
   * @param tagName - 标签名
   */
  const handleDropToTag = (tagName: string) => {
    if (!outputVariables.some(item => item.id === dragItem)) return;
    setTagBindings((prev) => ({ ...prev, [tagName]: dragItem }));
    setDragItem('');
  };

  /**
   * 取消标签绑定
   * @param tagName - 标签名
   */
  const handleUnbindTag = (tagName: string) => {
    setTagBindings((prev) => {
      const next = { ...prev };
      delete next[tagName];
      return next;
    });
  };

  /**
   * 保存绑定关系
   */
  const handleSave = () => {
    // Saving configuration does not regenerate a report or change its generated provenance.
    updateAnalysisReport(reportId!, { tagBindings, status: 'draft' });
    const current = report ? { ...report, tagBindings, status: 'draft' as const } : undefined;
    const all = loadAnalysisReports().filter((r) => r.id !== reportId);
    if (current) all.push(current);
    saveAnalysisReports(all);
    setReportGenerated(false);
    message.success('绑定关系已保存');
  };

  /**
   * 生成报告
   */
  const handleGenerateReport = () => {
    updateAnalysisReport(reportId!, { tagBindings, dataSource, status: 'generated' });
    const current = report ? { ...report, tagBindings, dataSource, status: 'generated' as const } : undefined;
    const all = loadAnalysisReports().filter((r) => r.id !== reportId);
    if (current) all.push(current);
    saveAnalysisReports(all);
    if (workspaceProject && report && !usingDemo) {
      const existingArtifact = workspaceProject.artifacts.find((artifact) => artifact.id === report.id);
      if (existingArtifact) removeArtifact(workspaceProject.id, existingArtifact.id);
      const reportArtifact = addArtifact(workspaceProject.id, createReportArtifactInput({
        reportId: report.id,
        title: report.name,
        summary: `${report.name} · 已绑定 ${Object.keys(tagBindings).length} 项内容`,
        reportTemplateId: report.reportTemplateId,
        artifactIds: selectedArtifactIds || projectOutputVariables.map((item) => item.id),
        tagBindings,
      }));
      if (reportArtifact && report?.taskId) {
        setFormalTaskReportArtifact(report.taskId, { projectId: reportArtifact.projectId, artifactId: reportArtifact.id });
        const reportRequirementId = report.taskItemId ?? task?.requirements.find((requirement) => requirement.capability === 'report')?.id;
        if (reportRequirementId) {
          addArtifactToTaskItem(report.taskId, reportRequirementId, { projectId: reportArtifact.projectId, artifactId: reportArtifact.id });
          setTaskRequirementStatus(report.taskId, reportRequirementId, '已满足');
        }
      }
    }
    setReportGenerated(true);
    message.success(usingDemo ? '演示报告已生成（模拟成果）' : '报告生成成功！');
  };

  /**
   * 获取变量名称
   */
  const getVarName = (varId: string) => {
    return outputVariables.find((v) => v.id === varId)?.name || varId;
  };

  const boundCount = Object.keys(tagBindings).length;
  const totalTags = TEMPLATE_TAGS.length;
  const unmetTaskItemCount = task
    ? countUnmetTaskItems(task.requirements, report?.taskItemId)
    : 0;

  const confirmGenerateReport = () => {
    if (unavailableBindings || !hasReportContent) {
      message.error('请先选择可用成果并修正失效绑定');
      return;
    }
    if (!usingDemo && unmetTaskItemCount > 0) {
      Modal.confirm({
        title: '仍有任务事项未满足',
        content: `当前还有 ${unmetTaskItemCount} 项任务事项未完成。继续会正式生成报告，但不会自动标记任务完成。`,
        okText: '仍要生成正式报告',
        cancelText: '返回继续处理',
        onOk: handleGenerateReport,
      });
      return;
    }
    handleGenerateReport();
  };

  return (
    <div className="workspace-simple-page workspace-report-generator-page">
      <div className="workspace-page-heading">
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(report?.taskId ? `/tasks/${report.taskId}${report.taskItemId ? `?taskItemId=${encodeURIComponent(report.taskItemId)}` : ''}` : '/report/list')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>分析报告生成</Title>
        {report && <Tag color="purple">{report.name}</Tag>}
        {report?.dataSource === 'demo' && <Tag color="orange">演示报告 · 模拟成果</Tag>}
        <Tag color={boundCount === totalTags ? 'green' : 'orange'}>
          已绑定 {boundCount}/{totalTags}
        </Tag>
      </div>

      {usingDemo && <Alert type="warning" showIcon message="演示报告 · 模拟成果" description="以下数据仅用于体验绑定流程，不会作为正式任务成果，也不会改变任务事项的满足状态。" style={{ marginBottom: 12 }} action={<Button onClick={() => setDemoEnabled(false)}>退出演示</Button>} />}
      {unavailableBindings && <Alert type="error" showIcon message="部分绑定成果已不可用，请重新选择或解绑后生成报告。" style={{ marginBottom: 12 }} />}
      {report?.reportContent && (
        <Card size="small" title="任务报告草稿内容" style={{ marginBottom: 12, maxHeight: 180, overflow: 'auto' }}>
          <Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>{report.reportContent}</Paragraph>
        </Card>
      )}

      {report?.taskId && !usingDemo && (
        <Alert
          type="info"
          showIcon
          message="当前正在编制正式报告"
          description="保存绑定只保留报告配置；正式生成后报告状态会更新。正式报告生成与任务完成是两件事，任务状态需在任务工作台单独确认。"
          style={{ marginBottom: 12 }}
        />
      )}

      <Row className="workspace-report-generator-layout" gutter={16} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左侧：数据分析输出节点（需求3.3.2） */}
        <Col span={8} style={{ height: '100%', display: 'flex' }}>
          <Card title={
            <span><FileTextOutlined /> 数据分析输出节点</span>
          }
          style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto' } }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              可拖拽成果，也可在每个标签右侧选择成果
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {outputVariables.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前报告没有可引用的成果">
                <Button disabled={hasFormalEvidence} onClick={() => setDemoEnabled(true)}>启用演示报告数据</Button>
                {hasFormalEvidence && <Paragraph type="secondary" style={{ marginTop: 8 }}>此报告已有正式成果，请新建报告体验演示数据。</Paragraph>}
              </Empty>}
              {outputVariables.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(item.id)}
                  style={{
                    cursor: 'grab',
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: '#f0f5ff',
                    border: '1px dashed #91caff',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#d6e4ff'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#f0f5ff'; }}
                >
                  <Space>
                    <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#1890ff' }} />
                    <Text strong style={{ fontSize: 13 }}>{usingDemo ? `模拟成果 · ${item.name}` : item.name}</Text>
                  </Space>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        {/* 右侧：报告模板标签（需求3.3.1, 3.3.3） */}
        <Col span={16} style={{ height: '100%', display: 'flex' }}>
          <Card title={
            <span><FileDoneOutlined /> 报告模板标签</span>
          }
          style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto' } }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              选择或拖入成果，完成数据与报告标签的映射
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEMPLATE_TAGS.map((tag) => {
                const bound = tagBindings[tag];
                return (
                  <div
                    key={tag}
                    className="report-tag-binding"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDropToTag(tag)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: bound ? '2px solid #52c41a' : '2px dashed #d9d9d9',
                      background: bound ? '#f6ffed' : '#fafafa',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s',
                    }}
                  >
                    <Space>
                      {bound ? (
                        <CheckCircleOutlined style={{ color: '#52c41a' }} />
                      ) : (
                        <span style={{ width: 14, height: 14, borderRadius: 7, border: '2px solid #d9d9d9', display: 'inline-block' }} />
                      )}
                      <Text strong>{tag}</Text>
                    </Space>
                    <div className="report-tag-controls">
                      <Select aria-label={`为${tag}选择成果`} placeholder="选择成果" allowClear value={bound || undefined} style={{ width: 220, maxWidth: '100%' }}
                        options={outputVariables.map(item => ({ value: item.id, label: usingDemo ? `模拟成果 · ${item.name}` : item.name }))}
                        onChange={value => value ? setTagBindings(previous => ({ ...previous, [tag]: value })) : handleUnbindTag(tag)} />
                      {bound ? (
                        <Space>
                          <Tag color="green">{getVarName(bound)}</Tag>
                          <Button type="text" size="small" danger
                            onClick={() => handleUnbindTag(tag)}>
                            解绑
                          </Button>
                        </Space>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 12 }}>拖入变量到此处</Text>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      <div className="workspace-form-actions" style={{ textAlign: 'center', marginTop: 16, flexShrink: 0 }}>
        <Space size="large">
          <Button size="large" onClick={() => navigate(report?.taskId ? `/tasks/${report.taskId}` : '/report/list')}>{report?.taskId ? '返回任务工作台' : '返回列表'}</Button>
          <Button size="large" icon={<SaveOutlined />} onClick={handleSave}>保存绑定</Button>
          <Button type="primary" size="large" icon={<FileDoneOutlined />}
            disabled={!report || !hasReportContent || unavailableBindings} onClick={confirmGenerateReport}>
            {usingDemo ? '生成演示报告' : '正式生成报告'}
          </Button>
          {reportGenerated && (
            <Button type="primary" size="large" icon={<EyeOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => message.success('报告预览功能：实际项目中将打开Word文档在线预览')}>
              查看报告
            </Button>
          )}
        </Space>
      </div>
    </div>
  );
};

export default ReportGenerate;
