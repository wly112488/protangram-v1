import React, { useState } from 'react';
import { Card, Typography, Row, Col, Tag, Modal, message } from 'antd';
import { FileWordOutlined, EyeOutlined } from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

// 内置报告模板清单（需求3.1）
const REPORT_TEMPLATES = [
  { id: 'rt-1', name: '航空装备地面综合试验报告', fileName: '航空装备地面综合试验报告.docx', description: '用于航空装备地面综合试验的标准化报告模板，包含试验概述、试验方案、数据分析、结论与建议等章节。' },
  { id: 'rt-2', name: '机载设备性能测试报告', fileName: '机载设备性能测试报告.docx', description: '用于机载设备性能参数测试的报告模板，涵盖设备功能验证、性能指标测量、合格判定等内容。' },
  { id: 'rt-3', name: '系统联调试验验证报告', fileName: '系统联调试验验证报告.docx', description: '用于多系统联合调试试验的验证报告，包含系统接口测试、联动功能验证、协同工作评估等。' },
  { id: 'rt-4', name: '环境适应性试验报告', fileName: '环境适应性试验报告.docx', description: '用于高低温、湿热、振动等环境适应性试验的报告模板，记录试验条件、过程数据和适应性评估结论。' },
  { id: 'rt-5', name: '可靠性与耐久性试验报告', fileName: '可靠性与耐久性试验报告.docx', description: '用于产品可靠性增长和耐久性验证的试验报告，包含MTBF计算、故障分析、寿命评估等。' },
  { id: 'rt-6', name: '稳定性测试分析报告', fileName: '稳定性测试分析报告.docx', description: '用于产品稳定性测试的分析报告，包含长期稳定性数据、漂移趋势分析、合格性判断。' },
  { id: 'rt-7', name: '功能与性能验证试验报告', fileName: '功能与性能验证试验报告.docx', description: '用于产品功能完整性和性能指标验证的试验报告，覆盖功能测试用例和性能基线对比。' },
  { id: 'rt-8', name: '高低温环境试验报告', fileName: '高低温环境试验报告.docx', description: '专用于高低温环境试验的报告模板，包含温度曲线记录、设备状态监控、温度影响评估。' },
];

/**
 * 报告模板管理页面
 * @description 卡片形式展示报告模板，点击查看Word内容（需求3.1）
 */
const ReportTemplates: React.FC = () => {
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<typeof REPORT_TEMPLATES[0] | null>(null);

  /**
   * 预览报告模板
   * @param template - 模板对象
   */
  const handlePreview = (template: typeof REPORT_TEMPLATES[0]) => {
    setSelectedTemplate(template);
    setPreviewVisible(true);
  };

  return (
    <div>
      <Title level={4}>报告模板管理</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        管理报告模板，点击卡片可查看具体Word模板内容。模板文件位于 wordreporttemplate 目录下。
      </Text>

      <Row gutter={[16, 16]}>
        {REPORT_TEMPLATES.map((template) => (
          <Col key={template.id} xs={24} sm={12} lg={8} xl={6}>
            <Card
              hoverable
              className="experiment-card"
              style={{ height: '100%', borderRadius: 12 }}
              onClick={() => handlePreview(template)}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <FileWordOutlined style={{ fontSize: 40, color: '#2b5797' }} />
              </div>
              <Title level={5} style={{ textAlign: 'center', fontSize: 14, marginBottom: 8 }}>
                {template.name}
              </Title>
              <Paragraph
                type="secondary"
                ellipsis={{ rows: 3 }}
                style={{ fontSize: 12, textAlign: 'center', marginBottom: 8 }}
              >
                {template.description}
              </Paragraph>
              <div style={{ textAlign: 'center' }}>
                <Tag color="blue">
                  <EyeOutlined /> 点击查看
                </Tag>
                <Tag color="green">支持更新</Tag>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* 模板预览弹窗 */}
      <Modal
        title={selectedTemplate?.name}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
      >
        {selectedTemplate && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <FileWordOutlined style={{ fontSize: 48, color: '#2b5797' }} />
            </div>
            <Paragraph>{selectedTemplate.description}</Paragraph>
            <Card size="small" style={{ background: '#fafafa' }}>
              <Title level={5}>模板结构预览</Title>
              <div style={{ lineHeight: 2 }}>
                <div><Tag color="blue">1</Tag> 封面（项目名称、编制单位、日期）</div>
                <div><Tag color="blue">2</Tag> 试验概述（{'{{试验名称}}'} / {'{{试验目的}}'} / {'{{试验对象}}'}）</div>
                <div><Tag color="blue">3</Tag> 试验方案（{'{{试验方法}}'} / {'{{试验因子}}'} / {'{{试验方案表}}'}）</div>
                <div><Tag color="blue">4</Tag> 试验数据（{'{{原始数据表}}'} / {'{{数据统计}}'}）</div>
                <div><Tag color="blue">5</Tag> 数据分析（{'{{分析结果图表}}'} / {'{{对比分析}}'}）</div>
                <div><Tag color="blue">6</Tag> 结论与建议（{'{{试验结论}}'} / {'{{改进建议}}'}）</div>
                <div><Tag color="blue">7</Tag> 附录（{'{{附件列表}}'}）</div>
              </div>
            </Card>
            <div style={{ marginTop: 16 }}>
              <Text type="secondary">文件名：{selectedTemplate.fileName}</Text>
              <br />
              <Text type="secondary">标签格式：{'{{变量名}}'} （双花括号包裹）</Text>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportTemplates;
