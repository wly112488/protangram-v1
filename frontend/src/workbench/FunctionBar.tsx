import React, { useState } from 'react';
import { Button, Form, Input, Modal, Popover, Select, Typography, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import EquipmentManagerWindow, { type ResearchObject } from './EquipmentManagerWindow';

const { Text, Title } = Typography;

const functionItems = [
  { key: 'experiment', label: '试验管理', groups: ['关联对象管理', '试验科目', '试验设计方法', '采样要求'] },
  { key: 'doe', label: '试验设计（DOE）', groups: ['快速设计', '模板设计', '筛选', '因子', '响应曲面', '混料', '田口'] },
  { key: 'analysis', label: '数据分析', groups: ['模块管理', '模板管理', '数据分析'] },
  { key: 'report', label: '报告生成', groups: ['报告模板管理', '分析报告管理', '报告生成'] },
];

interface DesignEntry {
  key: string;
  title: string;
  numberLabel: string;
  description: string;
  action: string;
  type: 'factor' | 'screening';
}

type DetailOptionKind = 'category' | 'continuous' | 'mixed' | 'mixture';

interface DetailOption {
  kind: DetailOptionKind;
  title: string;
  description: string;
}

interface MethodRow {
  title: string;
  description: string;
  icon: string;
}

interface DoeTemplate {
  id: string;
  name: string;
  designMethod: string;
  factorCount: number;
  factors: string[];
  responses: string[];
}

interface TemplateLevelRow {
  factorName: string;
  lowLevel: string;
  highLevel: string;
  changeType?: string;
}

const TEMPLATE_STORAGE_KEY = 'protangram-doe-templates';

const loadDoeTemplates = (): DoeTemplate[] => {
  try {
    const raw = localStorage.getItem(TEMPLATE_STORAGE_KEY);
    return raw ? JSON.parse(raw) as DoeTemplate[] : [];
  } catch {
    return [];
  }
};

const saveDoeTemplates = (templates: DoeTemplate[]) => {
  localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

const designEntries: DesignEntry[] = [
  {
    key: 'two-factor',
    title: '双因子设计',
    numberLabel: '2',
    description: '创建一个具有两个独立变量的试验，以探索因子的主效应和交互作用效应、优化响应、增强不可控噪声因子的稳健性或研究混料中的混合效应。',
    action: '选择双因子设计',
    type: 'factor',
  },
  {
    key: 'three-factor',
    title: '三因子设计',
    numberLabel: '3',
    description: '创建一个具有三个独立变量的试验，以探索因子的主效应和交互作用效应、优化响应、增强不可控噪声因子的稳健性或研究混料中的混合效应。',
    action: '选择三因子设计',
    type: 'factor',
  },
  {
    key: 'four-factor',
    title: '四因子设计',
    numberLabel: '4',
    description: '创建一个具有四个独立变量的试验，以探索因子的主效应和交互作用效应、优化响应、增强不可控噪声因子的稳健性或研究混料中的混合效应。',
    action: '选择四因子设计',
    type: 'factor',
  },
  {
    key: 'five-factor',
    title: '五因子设计',
    numberLabel: '5',
    description: '创建一个具有五个独立变量的试验，以探索因子的主效应和交互作用效应、优化响应、增强不可控噪声因子的稳健性或研究混料中的混合效应。',
    action: '选择五因子设计',
    type: 'factor',
  },
  {
    key: 'six-factor',
    title: '六因子设计',
    numberLabel: '6',
    description: '创建一个具有六个独立变量的试验，以探索因子的主效应和交互作用效应、优化响应、增强不可控噪声因子的稳健性或研究混料中的混合效应。',
    action: '选择六因子设计',
    type: 'factor',
  },
  {
    key: 'screening',
    title: '筛选设计',
    numberLabel: '筛',
    description: '为 7-48 个因子创建筛选设计，以高效识别许多潜在候选项中最显著的变量。',
    action: '选择筛选设计',
    type: 'screening',
  },
];

const countText: Record<string, string> = {
  'two-factor': '两个',
  'three-factor': '三个',
  'four-factor': '四个',
  'five-factor': '五个',
  'six-factor': '六个',
};

const renderDesignIcon = (label: string) => (
  <div className="doe-card-icon">
    <span className="doe-icon-corner top-left" />
    <span className="doe-icon-corner top-right" />
    <span className="doe-icon-corner bottom-left" />
    <span className="doe-icon-corner bottom-right" />
    <span>{label}</span>
  </div>
);

const getFactorOptions = (entry: DesignEntry) => {
  const count = countText[entry.key] ?? entry.numberLabel;
  return [
    {
      kind: 'category',
      title: `创建一个具有${count}类别因子的试验`,
      description: '当因子由可区分的组或类别组成时，估计效应。',
    },
    {
      kind: 'continuous',
      title: `创建一个具有${count}连续因子的试验`,
      description: '当因子由数值范围组成时，估计效应。',
    },
    {
      kind: 'mixed',
      title: '创建一个具有一个类别因子和一个连续因子的试验',
      description: '当一个因子由可区分的类别组成，而另一个因子由数值范围组成时，估计效应。',
    },
    {
      kind: 'mixture',
      title: `创建一个具有${count}混料分量的试验`,
      description: '估计不同混料分量的比率发生变化时所产生的效应。',
    },
  ] satisfies DetailOption[];
};

const getThirdLevelContent = (option: DetailOption, design: DesignEntry) => {
  const count = countText[design.key] ?? design.numberLabel;
  if (option.kind === 'category') {
    return {
      description: '主效应显示单个因子对响应的影响，而交互作用效应体现多个因子对响应的综合影响。因子水平是指在试验中为因子设置的特定值。当一个因子从一个因子水平更改到下一个水平较为困难或成本较高时，该因子即被视为难以改变。',
      rows: [
        {
          title: `当${count}因子都具有两个水平时，估计主效应和交互作用效应`,
          description: '创建两水平因子设计',
          icon: 'blue-grid',
        },
        {
          title: `当${count}因子都具有两个水平且一个因子难以改变时，估计主效应和交互作用效应`,
          description: '创建两水平裂区设计',
          icon: 'green-grid',
        },
        {
          title: '当至少一个因子具有两个以上水平时，估计主效应和交互作用效应',
          description: '创建一般全因子设计',
          icon: 'red-grid',
        },
        {
          title: '查找最优因子设置，以实现不可控噪声的稳健性',
          description: '创建田口设计',
          icon: 'taguchi',
        },
      ],
    };
  }
  if (option.kind === 'continuous') {
    return {
      description: '主效应显示单个因子对响应的影响，而交互作用效应体现多个因子对响应的综合影响，二次效应捕获因子与响应之间关系的曲率。当一个因子从一个因子水平更改到下一个水平较为困难或成本较高时，该因子即被视为难以改变。',
      rows: [
        {
          title: '估计主效应和交互作用效应',
          description: '创建两水平因子设计',
          icon: 'blue-grid',
        },
        {
          title: '当一个因子难以改变时，估计主效应和交互作用效应',
          description: '创建两水平裂区设计',
          icon: 'green-grid',
        },
        {
          title: '估计主效应、交互作用效应和二次效应',
          description: '创建响应曲面设计',
          icon: 'surface',
        },
      ],
    };
  }
  if (option.kind === 'mixed') {
    return {
      description: '主效应显示单个因子对响应的影响，而交互作用效应体现多个因子对响应的综合影响。当一个因子从一个因子水平更改到下一个水平较为困难或成本较高时，该因子即被视为难以改变。',
      rows: [
        {
          title: '估计主效应和交互作用效应',
          description: '创建两水平因子设计',
          icon: 'blue-grid',
        },
        {
          title: '当一个因子难以改变时，估计主效应和交互作用效应',
          description: '创建两水平裂区设计',
          icon: 'green-grid',
        },
      ],
    };
  }
  return {
    description: '分量是构成混料的各个成分或因子，可以通过更改它们的比率来研究它们对响应的效应。',
    rows: [
      {
        title: '了解混料成分比例变化的影响',
        description: '创建混料设计',
        icon: 'mixture',
      },
    ],
  };
};

interface FunctionBarProps {
  researchObjects: ResearchObject[];
  onResearchObjectsChange: (objects: ResearchObject[]) => void;
  onDesignGenerated?: (designName: string) => void;
  experiments: Array<{ id: string; name: string; associationObjectId?: string }>;
  onAssociateObjectToExperiment: (objectId: string, experimentId: string) => void;
  onMergeObjects: (sourceObjectId: string, targetObjectId: string) => void;
  onImportExperiment: (experimentId: string) => void;
}

const FunctionBar: React.FC<FunctionBarProps> = ({
  researchObjects,
  onResearchObjectsChange,
  onDesignGenerated,
  experiments,
  onAssociateObjectToExperiment,
  onMergeObjects,
  onImportExperiment,
}) => {
  const [quickDesignOpen, setQuickDesignOpen] = useState(false);
  const [equipmentManagerOpen, setEquipmentManagerOpen] = useState(false);
  const [selectedDesign, setSelectedDesign] = useState<DesignEntry | null>(null);
  const [selectedDetailOption, setSelectedDetailOption] = useState<DetailOption | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<MethodRow | null>(null);
  const [generalLevelCount, setGeneralLevelCount] = useState(4);
  const [quickDesignTab, setQuickDesignTab] = useState<'new' | 'template'>('new');
  const [templates, setTemplates] = useState<DoeTemplate[]>(loadDoeTemplates);
  const [templateLibraryOpen, setTemplateLibraryOpen] = useState(false);
  const [templateNameModalOpen, setTemplateNameModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<DoeTemplate | null>(null);
  const [templateLevelRows, setTemplateLevelRows] = useState<TemplateLevelRow[]>([]);
  const [templateResponseName, setTemplateResponseName] = useState('');
  const [templateReplicateCount, setTemplateReplicateCount] = useState(2);
  const [templateHardReplicateCount, setTemplateHardReplicateCount] = useState(2);
  const [templateEasyReplicateCount, setTemplateEasyReplicateCount] = useState('无');
  const [methodResponseName, setMethodResponseName] = useState('');
  const [methodFactorNames, setMethodFactorNames] = useState<string[]>([]);

  const handleGroupClick = (group: string) => {
    if (group === '快速设计') {
      setQuickDesignOpen(true);
      setQuickDesignTab('new');
    }
    if (group === '模板设计') {
      setTemplateLibraryOpen(true);
    }
    if (group === '关联对象管理') {
      setEquipmentManagerOpen(true);
    }
  };

  const thirdLevelContent =
    selectedDesign && selectedDetailOption ? getThirdLevelContent(selectedDetailOption, selectedDesign) : null;
  const factorCount = selectedDesign?.type === 'factor' ? Number(selectedDesign.numberLabel) || 2 : 2;
  const isSplitPlotMethod = selectedMethod?.description === '创建两水平裂区设计';
  const isGeneralFactorialMethod = selectedMethod?.description === '创建一般全因子设计';
  const methodModalWidth = isGeneralFactorialMethod
    ? Math.max(620, 190 + (generalLevelCount + 1) * 115)
    : isSplitPlotMethod
      ? 650
      : 494;

  const handleFlowConfirm = () => {
    message.success('当前设计流程已完成');
  };

  const handleMethodConfirm = () => {
    if (!selectedMethod) return;
    onDesignGenerated?.(selectedMethod.description);
    message.success('当前设计流程已完成');
    setSelectedMethod(null);
    setSelectedDetailOption(null);
    setSelectedDesign(null);
    setQuickDesignOpen(false);
  };

  const updateMethodFactorName = (index: number, value: string) => {
    setMethodFactorNames((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const openTemplateNameModal = () => {
    if (!selectedMethod) return;
    setTemplateName(`${selectedMethod.description}模板${templates.length + 1}`);
    setTemplateNameModalOpen(true);
  };

  const saveCurrentTemplate = () => {
    if (!selectedMethod) return;
    const template: DoeTemplate = {
      id: `doe-template-${Date.now()}`,
      name: templateName.trim() || `${selectedMethod.description}模板${templates.length + 1}`,
      designMethod: selectedMethod.description,
      factorCount,
      factors: Array.from({ length: factorCount }, (_, index) =>
        methodFactorNames[index]?.trim() || `因子${index + 1}`,
      ),
      responses: [methodResponseName.trim() || '响应变量'],
    };
    const nextTemplates = [...templates, template];
    setTemplates(nextTemplates);
    saveDoeTemplates(nextTemplates);
    setTemplateNameModalOpen(false);
    message.success('模板已保存');
  };

  const openTemplateDesign = (template: DoeTemplate) => {
    setSelectedTemplate(template);
    setTemplateResponseName(template.responses[0] ?? '响应变量');
    setTemplateReplicateCount(2);
    setTemplateHardReplicateCount(2);
    setTemplateEasyReplicateCount('无');
    setTemplateLevelRows(template.factors.map((factorName, index) => ({
      factorName,
      lowLevel: '',
      highLevel: '',
      changeType: index === 0 ? '难以改变' : '易于改变',
    })));
  };

  const updateTemplateLevel = (index: number, field: keyof TemplateLevelRow, value: string) => {
    setTemplateLevelRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  };

  const confirmTemplateDesign = () => {
    if (!selectedTemplate) return;
    onDesignGenerated?.(selectedTemplate.designMethod);
    message.success('已根据模板生成实验');
    setSelectedTemplate(null);
    setTemplateLevelRows([]);
    setTemplateLibraryOpen(false);
  };

  return (
    <>
      <div className="layout-function-bar">
        {functionItems.map((item) => (
          <Popover
            key={item.key}
            trigger="click"
            placement="bottomLeft"
            overlayClassName="layout-function-popover"
            content={
              <div className="layout-function-popover-content">
                {item.groups.map((group) => (
                  <button
                    className="layout-function-group"
                    key={group}
                    type="button"
                    onClick={() => handleGroupClick(group)}
                  >
                    {group}
                  </button>
                ))}
              </div>
            }
          >
            <button className="layout-function-item" type="button">{item.label}</button>
          </Popover>
        ))}
      </div>

      <EquipmentManagerWindow
        open={equipmentManagerOpen}
        researchObjects={researchObjects}
        onResearchObjectsChange={onResearchObjectsChange}
        experiments={experiments}
        onAssociateObjectToExperiment={onAssociateObjectToExperiment}
        onMergeObjects={onMergeObjects}
        onImportExperiment={onImportExperiment}
        onClose={() => setEquipmentManagerOpen(false)}
      />

      <Modal
        title="快速设计中心"
        open={quickDesignOpen}
        width={1100}
        centered
        className="doe-modal"
        footer={<Button onClick={() => setQuickDesignOpen(false)}>取消</Button>}
        onCancel={() => setQuickDesignOpen(false)}
      >
        <div className="doe-modal-body">
          <div className="doe-mode-tabs">
            <button
              type="button"
              className={`doe-mode-tab ${quickDesignTab === 'new' ? 'active' : ''}`}
              onClick={() => setQuickDesignTab('new')}
            >
              新建设计
            </button>
            <button
              type="button"
              className={`doe-mode-tab ${quickDesignTab === 'template' ? 'active' : ''}`}
              onClick={() => setQuickDesignTab('template')}
            >
              从模板开始
            </button>
          </div>
          {quickDesignTab === 'new' ? (
            <div className="doe-quick-layout">
              <aside className="doe-quick-sidebar">
                {designEntries.map((entry) => (
                  <button
                    key={entry.key}
                    type="button"
                    className={`doe-quick-item ${selectedDesign?.key === entry.key ? 'active' : ''}`}
                    onClick={() => setSelectedDesign(entry)}
                  >
                    <span className="doe-quick-item-title">{entry.title}</span>
                    <span className="doe-quick-item-meta">{entry.numberLabel} 因子</span>
                  </button>
                ))}
              </aside>
              <section className="doe-quick-main">
                <div className="doe-heading">
                  <Title level={4}>{selectedDesign ? selectedDesign.title : '选择一种设计'}</Title>
                  <Text type="secondary">
                    {selectedDesign ? selectedDesign.description : '先从左侧选择因子数量和设计类型。'}
                  </Text>
                </div>
                {selectedDesign && (
                  <div className="doe-quick-options">
                    {selectedDesign.type === 'screening' ? (
                      <button
                        type="button"
                        className="doe-option-card"
                        onClick={() => setSelectedMethod({ title: '创建筛选设计', description: '创建定义筛选设计', icon: 'screen' })}
                      >
                        <div>
                          <Title level={5}>创建一个具有 7-48 个因子的试验</Title>
                          <Text type="secondary">创建定义筛选设计</Text>
                        </div>
                      </button>
                    ) : (
                      getFactorOptions(selectedDesign).map((option) => (
                        <button
                          type="button"
                          className="doe-option-card"
                          key={option.title}
                          onClick={() => setSelectedDetailOption(option)}
                        >
                          <div>
                            <Title level={5}>{option.title}</Title>
                            <Text type="secondary">{option.description}</Text>
                          </div>
                          <InfoCircleOutlined className="doe-option-info" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </section>
            </div>
          ) : (
            <div className="doe-template-quick">
              <div className="doe-template-quick-head">
                <Text type="secondary">从已保存模板快速开始，只补因子水平。</Text>
                <Button onClick={() => setTemplateLibraryOpen(true)}>打开模板库</Button>
              </div>
              <div className="doe-template-list">
                {templates.slice(0, 4).map((template) => (
                  <button
                    className="doe-template-card"
                    key={template.id}
                    type="button"
                    onClick={() => openTemplateDesign(template)}
                  >
                    <Text strong>{template.name}</Text>
                    <Text type="secondary">{template.designMethod}</Text>
                  </button>
                ))}
                {templates.length === 0 && <div className="doe-template-empty">暂无模板</div>}
              </div>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        title={selectedDesign ? `试验设计: ${selectedDesign.title}` : '试验设计'}
        open={Boolean(selectedDesign)}
        width={1028}
        centered
        className="doe-detail-modal"
        footer={
          <div className="doe-detail-footer">
            <Button onClick={() => setSelectedDesign(null)}>返回</Button>
            <div className="doe-detail-footer-actions">
              <Button type="primary" onClick={handleFlowConfirm}>确定</Button>
              <Button onClick={() => setSelectedDesign(null)}>取消</Button>
            </div>
          </div>
        }
        onCancel={() => setSelectedDesign(null)}
      >
        {selectedDesign && (
          <div className="doe-detail-body">
            <div className="doe-heading">
              <Title level={4}>{selectedDesign.title} <InfoCircleOutlined /></Title>
              <Text type="secondary">手工定义因子结构，再选择本次实验采用的设计方法。</Text>
            </div>
            <div className="doe-structure-editor">
              <section className="doe-structure-panel">
                <div className="doe-method-section-title">因子结构</div>
                <div className="doe-structure-grid">
                  {Array.from({ length: factorCount }, (_, index) => (
                    <div className="doe-factor-structure-card" key={index}>
                      <div className="doe-factor-structure-head">因子 {String.fromCharCode(65 + index)}</div>
                      <label>
                        名称
                        <Input
                          value={methodFactorNames[index] ?? ''}
                          onChange={(event) => updateMethodFactorName(index, event.target.value)}
                          placeholder={`因子${index + 1}`}
                        />
                      </label>
                      <label>
                        类型
                        <Select
                          defaultValue={selectedDesign.type === 'screening' ? '筛选' : '连续'}
                          options={['连续', '类别', '混料', '筛选'].map((value) => ({ value, label: value }))}
                        />
                      </label>
                      <label>
                        水平数
                        <Select
                          defaultValue={2}
                          options={[2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                        />
                      </label>
                      <label>
                        更改方式
                        <Select
                          defaultValue={index === 0 ? '难以改变' : '易于改变'}
                          options={[
                            { value: '易于改变', label: '易于改变' },
                            { value: '难以改变', label: '难以改变' },
                          ]}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </section>
              <aside className="doe-structure-methods">
                <div className="doe-method-section-title">设计方法</div>
                {[
                  { title: '两水平效应设计', description: '创建两水平因子设计', icon: 'blue-grid' },
                  { title: '裂区效应设计', description: '创建两水平裂区设计', icon: 'green-grid' },
                  { title: '响应曲面设计', description: '创建响应曲面设计', icon: 'surface' },
                  { title: '一般全因子设计', description: '创建一般全因子设计', icon: 'red-grid' },
                ].map((row) => (
                  <button
                    type="button"
                    className="doe-method-chip"
                    key={row.description}
                    onClick={() => {
                      setSelectedMethod(row);
                      setMethodResponseName('');
                    }}
                  >
                    <strong>{row.title}</strong>
                    <span>{row.description}</span>
                  </button>
                ))}
              </aside>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={selectedDetailOption ? `试验设计: ${selectedDetailOption.title}` : '试验设计'}
        open={Boolean(selectedDetailOption)}
        width={1028}
        centered
        className="doe-detail-modal"
        footer={
          <div className="doe-detail-footer">
            <Button onClick={() => setSelectedDetailOption(null)}>返回</Button>
            <div className="doe-detail-footer-actions">
              <Button type="primary" onClick={handleFlowConfirm}>确定</Button>
              <Button onClick={() => setSelectedDetailOption(null)}>取消</Button>
            </div>
          </div>
        }
        onCancel={() => setSelectedDetailOption(null)}
      >
        {selectedDetailOption && thirdLevelContent && (
          <div className="doe-detail-body">
            <div className="doe-heading">
              <Title level={4}>设计方法设置 <InfoCircleOutlined /></Title>
              <Text type="secondary">根据当前因子结构，手动选择效应目标和运行结构。</Text>
            </div>
            <div className="doe-method-composer">
              <section className="doe-method-composer-main">
                <div className="doe-method-section-title">目标效应</div>
                <div className="doe-toggle-grid">
                  <button type="button" className="doe-toggle-card active">主效应</button>
                  <button type="button" className="doe-toggle-card active">交互作用</button>
                  <button type="button" className="doe-toggle-card">二次效应</button>
                  <button type="button" className="doe-toggle-card">稳健性</button>
                </div>
                <div className="doe-method-section-title">运行结构</div>
                <div className="doe-run-structure-grid">
                  <label>
                    难以改变因子
                    <Select
                      defaultValue="A"
                      options={Array.from({ length: factorCount }, (_, index) => ({
                        value: String.fromCharCode(65 + index),
                        label: String.fromCharCode(65 + index),
                      }))}
                    />
                  </label>
                  <label>
                    仿行数
                    <Select defaultValue={2} options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))} />
                  </label>
                </div>
              </section>
              <aside className="doe-structure-methods">
                <div className="doe-method-section-title">方法类型</div>
                {thirdLevelContent.rows.map((row) => (
                  <button
                    type="button"
                    className="doe-method-chip"
                    key={row.title}
                    onClick={() => {
                      setSelectedMethod(row);
                      setMethodResponseName('');
                      setMethodFactorNames([]);
                    }}
                  >
                    <strong>{row.description}</strong>
                    <span>{row.title}</span>
                  </button>
                ))}
              </aside>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title={selectedMethod ? selectedMethod.description : '试验设计'}
        open={Boolean(selectedMethod)}
        width={Math.max(980, methodModalWidth)}
        centered
        className="doe-method-modal"
        footer={
          <div className="doe-method-footer">
            <div className="doe-method-footer-actions">
              <Button>帮助</Button>
              <Button onClick={openTemplateNameModal}>保存模板</Button>
            </div>
            <div className="doe-method-footer-actions">
              <Button type="primary" onClick={handleMethodConfirm}>确定</Button>
              <Button onClick={() => setSelectedMethod(null)}>取消</Button>
            </div>
          </div>
        }
        onCancel={() => setSelectedMethod(null)}
      >
        {selectedMethod && (
          <div className="doe-method-body">
            <div className="doe-config-workbench">
              <aside className="doe-config-steps">
                <div className="doe-config-step active">
                  <span>1</span>
                  <strong>响应</strong>
                </div>
                <div className="doe-config-step active">
                  <span>2</span>
                  <strong>因子水平</strong>
                </div>
                <div className="doe-config-step active">
                  <span>3</span>
                  <strong>运行设置</strong>
                </div>
                <div className="doe-config-step">
                  <span>4</span>
                  <strong>方案预览</strong>
                </div>
              </aside>
              <section className="doe-config-main">
                <Form className="doe-method-form">
              <div className="doe-method-section-title">响应</div>
              <div className="doe-method-row">
                <label>请输入响应变量的名称:</label>
                <Input
                  className="doe-response-input"
                  autoFocus
                  value={methodResponseName}
                  onChange={(event) => setMethodResponseName(event.target.value)}
                />
              </div>

              <div className="doe-method-section-title">因子</div>
              <Text>请输入因子名称和设置:</Text>
              {isGeneralFactorialMethod && (
                <div className="doe-method-row max-level-row">
                  <label>最大水平数:</label>
                  <Select
                    className="doe-max-level-select"
                    value={generalLevelCount}
                    onChange={setGeneralLevelCount}
                    options={[3, 4, 5].map((value) => ({ value, label: String(value) }))}
                  />
                </div>
              )}
              {isGeneralFactorialMethod ? (
                <table className="doe-factor-table general-factorial">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th colSpan={generalLevelCount}>水平数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: factorCount }, (_, rowIndex) => (
                      <tr key={rowIndex}>
                        <td>
                          <Input
                            variant="borderless"
                            value={methodFactorNames[rowIndex] ?? ''}
                            onChange={(event) => updateMethodFactorName(rowIndex, event.target.value)}
                          />
                        </td>
                        {Array.from({ length: generalLevelCount }, (_, levelIndex) => (
                          <td key={levelIndex}><Input variant="borderless" /></td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className={`doe-factor-table ${isSplitPlotMethod ? 'split-plot' : ''}`}>
                  <thead>
                    <tr>
                      {isSplitPlotMethod && <th>更改</th>}
                      <th>名称</th>
                      <th>级别 1</th>
                      <th>级别 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: factorCount }, (_, index) => (
                      <tr key={index}>
                        {isSplitPlotMethod && (
                          <td>
                            <Select
                              variant="borderless"
                              defaultValue={index === 0 ? '难以改变' : '易于改变'}
                              options={[
                                { value: '难以改变', label: '难以改变' },
                                { value: '易于改变', label: '易于改变' },
                              ]}
                            />
                          </td>
                        )}
                        <td>
                          <Input
                            variant="borderless"
                            value={methodFactorNames[index] ?? ''}
                            onChange={(event) => updateMethodFactorName(index, event.target.value)}
                          />
                        </td>
                        <td><Input variant="borderless" /></td>
                        <td><Input variant="borderless" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="doe-method-section-title">仿行</div>
              <Text>通过添加仿行可以使您检测到更小效应量。</Text>
              {isSplitPlotMethod ? (
                <>
                  <div className="doe-method-row replicate-row">
                    <label>难以改变因子的仿行数:</label>
                    <Select
                      className="doe-replicate-select"
                      defaultValue={2}
                      options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                    />
                  </div>
                  <div className="doe-method-row">
                    <label>易改变因子的仿行数:</label>
                    <Select
                      className="doe-replicate-select"
                      defaultValue="无"
                      options={['无', '2', '3', '4'].map((value) => ({ value, label: value }))}
                    />
                  </div>
                </>
              ) : (
                <div className="doe-method-row replicate-row">
                  <label>仿行数:</label>
                  <Select
                    className="doe-replicate-select"
                    defaultValue={2}
                    options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                  />
                </div>
              )}
                </Form>
              </section>
              <aside className="doe-config-preview">
                <Text strong>方案预览</Text>
                <div className="doe-config-preview-grid">
                  <span>设计方法</span>
                  <strong>{selectedMethod.description}</strong>
                  <span>因子数</span>
                  <strong>{factorCount}</strong>
                  <span>响应</span>
                  <strong>{methodResponseName || '响应变量'}</strong>
                  <span>仿行</span>
                  <strong>{isSplitPlotMethod ? '裂区仿行' : '2'}</strong>
                </div>
                <div className="doe-config-preview-note">
                  当前为系统内置预览，确认后生成预设实验方案。
                </div>
              </aside>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        title="保存 DOE 模板"
        open={templateNameModalOpen}
        width={420}
        centered
        okText="保存"
        cancelText="取消"
        onOk={saveCurrentTemplate}
        onCancel={() => setTemplateNameModalOpen(false)}
      >
        <div className="doe-template-save-form">
          <label>模板名称</label>
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            onPressEnter={saveCurrentTemplate}
          />
        </div>
      </Modal>

      <Modal
        title="DOE 模板设计"
        open={templateLibraryOpen}
        width={760}
        centered
        footer={<Button onClick={() => setTemplateLibraryOpen(false)}>关闭</Button>}
        onCancel={() => setTemplateLibraryOpen(false)}
      >
        <div className="doe-template-list">
          {templates.map((template) => (
            <button
              className="doe-template-card"
              key={template.id}
              type="button"
              onClick={() => openTemplateDesign(template)}
            >
              <Text strong>{template.name}</Text>
              <Text type="secondary">{template.designMethod}</Text>
              <Text type="secondary">{template.factorCount} 个因子 ・ {template.responses.join('、')}</Text>
            </button>
          ))}
          {templates.length === 0 && (
            <div className="doe-template-empty">暂无模板</div>
          )}
        </div>
      </Modal>

      <Modal
        title={selectedTemplate ? selectedTemplate.designMethod : '使用模板'}
        open={Boolean(selectedTemplate)}
        width={720}
        centered
        okText="生成实验"
        cancelText="取消"
        onOk={confirmTemplateDesign}
        onCancel={() => setSelectedTemplate(null)}
      >
        {selectedTemplate && (
          <div className="doe-template-design-form">
            <div className="doe-method-section-title">响应</div>
            <div className="doe-method-row">
              <label>请输入响应变量的名称:</label>
              <Input
                className="doe-response-input"
                value={templateResponseName}
                onChange={(event) => setTemplateResponseName(event.target.value)}
              />
            </div>
            <div className="doe-method-section-title">因子</div>
            <Text>请输入因子名称和设置:</Text>
            <table className="doe-factor-table">
              <thead>
                <tr>
                  {selectedTemplate.designMethod === '创建两水平裂区设计' && <th>更改</th>}
                  <th>名称</th>
                  <th>级别 1</th>
                  <th>级别 2</th>
                </tr>
              </thead>
              <tbody>
                {templateLevelRows.map((row, index) => (
                  <tr key={index}>
                    {selectedTemplate.designMethod === '创建两水平裂区设计' && (
                      <td>
                        <Select
                          variant="borderless"
                          value={row.changeType}
                          onChange={(value) => updateTemplateLevel(index, 'changeType', value)}
                          options={[
                            { value: '难以改变', label: '难以改变' },
                            { value: '易于改变', label: '易于改变' },
                          ]}
                        />
                      </td>
                    )}
                    <td>
                      <Input
                        variant="borderless"
                        value={row.factorName}
                        onChange={(event) => updateTemplateLevel(index, 'factorName', event.target.value)}
                      />
                    </td>
                    <td>
                      <Input
                        variant="borderless"
                        value={row.lowLevel}
                        onChange={(event) => updateTemplateLevel(index, 'lowLevel', event.target.value)}
                      />
                    </td>
                    <td>
                      <Input
                        variant="borderless"
                        value={row.highLevel}
                        onChange={(event) => updateTemplateLevel(index, 'highLevel', event.target.value)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="doe-method-section-title">仿行</div>
            <Text>通过添加仿行可以使您检测到更小效应量。</Text>
            {selectedTemplate.designMethod === '创建两水平裂区设计' ? (
              <>
                <div className="doe-method-row replicate-row">
                  <label>难以改变因子的仿行数:</label>
                  <Select
                    className="doe-replicate-select"
                    value={templateHardReplicateCount}
                    onChange={setTemplateHardReplicateCount}
                    options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                  />
                </div>
                <div className="doe-method-row">
                  <label>易改变因子的仿行数:</label>
                  <Select
                    className="doe-replicate-select"
                    value={templateEasyReplicateCount}
                    onChange={setTemplateEasyReplicateCount}
                    options={['无', '2', '3', '4'].map((value) => ({ value, label: value }))}
                  />
                </div>
              </>
            ) : (
              <div className="doe-method-row replicate-row">
                <label>仿行数:</label>
                <Select
                  className="doe-replicate-select"
                  value={templateReplicateCount}
                  onChange={setTemplateReplicateCount}
                  options={[1, 2, 3, 4, 5].map((value) => ({ value, label: String(value) }))}
                />
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
};

export default FunctionBar;
