import React, { useEffect, useState } from 'react';
import {
  Card, Typography, Button, Row, Col, Tag, message, Space,
} from 'antd';
import {
  ArrowLeftOutlined, FileTextOutlined, CheckCircleOutlined,
  EyeOutlined, SaveOutlined, FileDoneOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import useAppStore from '@/stores/useAppStore';
import { loadAnalysisReports, saveAnalysisReports } from '@/utils/storage';
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

/**
 * 分析报告生成页面
 * @description 标签解析、拖拽绑定、报告生成（需求3.3）
 */
const ReportGenerate: React.FC = () => {
  const navigate = useNavigate();
  const { reportId } = useParams<{ reportId: string }>();
  const { analysisReports, updateAnalysisReport, setAnalysisReports } = useAppStore();

  const [tagBindings, setTagBindings] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<string>('');
  const [reportGenerated, setReportGenerated] = useState(false);

  const report = analysisReports.find((r) => r.id === reportId);

  useEffect(() => {
    let reports = analysisReports;
    if (reports.length === 0) {
      reports = loadAnalysisReports();
      if (reports.length > 0) setAnalysisReports(reports);
    }
    const r = reports.find((r) => r.id === reportId);
    if (r?.tagBindings) {
      setTagBindings(r.tagBindings);
    }
    if (r?.status === 'generated') {
      setReportGenerated(true);
    }
  }, [reportId, analysisReports, setAnalysisReports]);

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
    if (!dragItem) return;
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
    updateAnalysisReport(reportId!, { tagBindings });
    const all = loadAnalysisReports().map((r) =>
      r.id === reportId ? { ...r, tagBindings } : r
    );
    saveAnalysisReports(all);
    message.success('绑定关系已保存');
  };

  /**
   * 生成报告
   */
  const handleGenerateReport = () => {
    updateAnalysisReport(reportId!, { tagBindings, status: 'generated' });
    const all = loadAnalysisReports().map((r) =>
      r.id === reportId ? { ...r, tagBindings, status: 'generated' as const } : r
    );
    saveAnalysisReports(all);
    setReportGenerated(true);
    message.success('报告生成成功！');
  };

  /**
   * 获取变量名称
   */
  const getVarName = (varId: string) => {
    return MOCK_OUTPUT_VARIABLES.find((v) => v.id === varId)?.name || varId;
  };

  const boundCount = Object.keys(tagBindings).length;
  const totalTags = TEMPLATE_TAGS.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, gap: 12, flexShrink: 0 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/report/list')}>返回</Button>
        <Title level={4} style={{ margin: 0 }}>分析报告生成</Title>
        {report && <Tag color="purple">{report.name}</Tag>}
        <Tag color={boundCount === totalTags ? 'green' : 'orange'}>
          已绑定 {boundCount}/{totalTags}
        </Tag>
      </div>

      <Row gutter={16} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {/* 左侧：数据分析输出节点（需求3.3.2） */}
        <Col span={8} style={{ height: '100%', display: 'flex' }}>
          <Card title={
            <span><FileTextOutlined /> 数据分析输出节点</span>
          }
          style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column' }}
          styles={{ body: { flex: 1, minHeight: 0, overflow: 'auto' } }}>
            <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
              拖拽下方变量到右侧报告标签中进行绑定
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {MOCK_OUTPUT_VARIABLES.map((item) => (
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
                    <Text strong style={{ fontSize: 13 }}>{item.name}</Text>
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
              将左侧输出变量拖入以下标签中，完成数据与报告的映射
            </Text>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {TEMPLATE_TAGS.map((tag) => {
                const bound = tagBindings[tag];
                return (
                  <div
                    key={tag}
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
                    <div>
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

      <div style={{ textAlign: 'center', marginTop: 16, flexShrink: 0 }}>
        <Space size="large">
          <Button size="large" onClick={() => navigate('/report/list')}>返回列表</Button>
          <Button size="large" icon={<SaveOutlined />} onClick={handleSave}>保存绑定</Button>
          <Button type="primary" size="large" icon={<FileDoneOutlined />}
            onClick={handleGenerateReport}>
            生成报告
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
