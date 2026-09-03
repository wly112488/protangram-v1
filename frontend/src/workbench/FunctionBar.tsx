import React, { useState } from 'react';
import { Button, Form, Input, Modal, Popover, Select, Typography, message } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import EquipmentManagerWindow, { type ResearchObject } from './EquipmentManagerWindow';

const { Text, Title } = Typography;

const functionItems = [
  { key: 'experiment', label: '试验管理', groups: ['关联对象管理', '试验科目', '试验设计方法', '采样要求'] },
  { key: 'doe', label: '试验设计（DOE）', groups: ['快速设计', '模板设计', '智能试验设计', '筛选', '因子', '响应曲面', '混料', '田口'] },
  { key: 'analysis', label: '数据分析', groups: ['模块管理', '模板管理', '试验数据分析', '试验数字孪生', '虚拟工况扩展'] },
  { key: 'report', label: '报告生成', groups: ['报告模板管理', '分析报告管理', '报告生成'] },
];

interface MethodRow {
  title: string;
  description: string;
  icon: string;
  factorTypeMode: 'editable' | 'fixed';
  fixedFactorType?: FactorType;
  allowedFactorTypes?: FactorType[];
  levelMode: 'two-level' | 'multi-level';
  hasChangeType?: boolean;
}

type FactorType = '连续' | '类别' | '混料';

interface MethodFactorRow {
  name: string;
  type: FactorType;
  lowLevel: string;
  highLevel: string;
  changeType: string;
  levels: string[];
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

const getQuickMethodOptions = (): MethodRow[] => [
  {
    title: '当各因子都具有两个水平时，估计主效应和交互作用效应',
    description: '创建两水平因子设计',
    icon: 'blue-grid',
    factorTypeMode: 'editable',
    allowedFactorTypes: ['连续', '类别'],
    levelMode: 'two-level',
  },
  {
    title: '当各因子都具有两个水平且一个因子难以改变时，估计主效应和交互作用效应',
    description: '创建两水平裂区设计',
    icon: 'green-grid',
    factorTypeMode: 'editable',
    allowedFactorTypes: ['连续', '类别'],
    levelMode: 'two-level',
    hasChangeType: true,
  },
  {
    title: '当至少一个因子具有两个以上水平时，估计主效应和交互作用效应',
    description: '创建一般全因子设计',
    icon: 'red-grid',
    factorTypeMode: 'editable',
    allowedFactorTypes: ['连续', '类别'],
    levelMode: 'multi-level',
  },
  {
    title: '估计主效应、交互作用效应和二次效应',
    description: '创建响应曲面设计',
    icon: 'surface',
    factorTypeMode: 'fixed',
    fixedFactorType: '连续',
    levelMode: 'two-level',
  },
  {
    title: '查找最优因子设置，以实现不可控噪声的稳健性',
    description: '创建田口设计',
    icon: 'taguchi',
    factorTypeMode: 'fixed',
    fixedFactorType: '类别',
    levelMode: 'multi-level',
  },
  {
    title: '了解混料成分比例变化的影响',
    description: '创建混料设计',
    icon: 'mixture',
    factorTypeMode: 'fixed',
    fixedFactorType: '混料',
    levelMode: 'two-level',
  },
];

const createMethodFactorRows = (factorCount: number, method: MethodRow, levelCount: number): MethodFactorRow[] =>
  Array.from({ length: factorCount }, (_, index) => ({
    name: String.fromCharCode(65 + index),
    type: method.fixedFactorType ?? method.allowedFactorTypes?.[0] ?? '连续',
    lowLevel: method.fixedFactorType === '类别' ? '低' : '0',
    highLevel: method.fixedFactorType === '类别' ? '高' : '2',
    changeType: index === 0 ? '难以改变' : '易于改变',
    levels: Array.from({ length: levelCount }, (_, levelIndex) => levelIndex < 2 ? String(levelIndex) : ''),
  }));

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
  const navigate = useNavigate();
  const [quickDesignOpen, setQuickDesignOpen] = useState(false);
  const [equipmentManagerOpen, setEquipmentManagerOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<MethodRow | null>(null);
  const [activeFactorCount, setActiveFactorCount] = useState(2);
  const [generalLevelCount, setGeneralLevelCount] = useState(4);
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
  const [methodFactorRows, setMethodFactorRows] = useState<MethodFactorRow[]>([]);

  const handleGroupClick = (group: string) => {
    const analysisRoutes: Record<string, string> = {
      模块管理: '/analysis/modules',
      模板管理: '/analysis/templates',
      试验数据分析: '/analysis/projects',
      试验数字孪生: '/analysis/digital-twin',
      虚拟工况扩展: '/analysis/virtual-condition',
      智能试验设计: '/experiment/design/intelligent',
    };
    if (analysisRoutes[group]) {
      navigate(analysisRoutes[group]);
      return;
    }
    if (group === '快速设计') {
      setQuickDesignOpen(true);
    }
    if (group === '模板设计') {
      setTemplateLibraryOpen(true);
    }
    if (group === '关联对象管理') {
      setEquipmentManagerOpen(true);
    }
  };

  const quickMethodOptions = getQuickMethodOptions();
  const factorCount = activeFactorCount;
  const isSplitPlotMethod = Boolean(selectedMethod?.hasChangeType);
  const isGeneralFactorialMethod = selectedMethod?.levelMode === 'multi-level';
  const methodModalWidth = isGeneralFactorialMethod
    ? Math.max(740, 190 + (generalLevelCount + 2) * 115)
    : isSplitPlotMethod
      ? 700
      : 610;

  const handleMethodConfirm = () => {
    if (!selectedMethod) return;
    onDesignGenerated?.(selectedMethod.description);
    message.success('当前设计流程已完成');
    setSelectedMethod(null);
    setQuickDesignOpen(false);
  };

  const openMethod = (method: MethodRow, nextFactorCount = factorCount) => {
    setActiveFactorCount(nextFactorCount);
    setSelectedMethod(method);
    setMethodResponseName('');
    setMethodFactorRows(createMethodFactorRows(nextFactorCount, method, generalLevelCount));
    setQuickDesignOpen(false);
  };

  const updateMethodFactorName = (index: number, value: string) => {
    setMethodFactorRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, name: value } : row)),
    );
  };

  const updateMethodFactorRow = (index: number, field: Exclude<keyof MethodFactorRow, 'levels'>, value: string) => {
    setMethodFactorRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, [field]: value } : row)),
    );
  };

  const updateMethodFactorLevel = (rowIndex: number, levelIndex: number, value: string) => {
    setMethodFactorRows((prev) =>
      prev.map((row, index) => {
        if (index !== rowIndex) return row;
        const levels = [...row.levels];
        levels[levelIndex] = value;
        return { ...row, levels };
      }),
    );
  };

  const handleGeneralLevelCountChange = (value: number) => {
    setGeneralLevelCount(value);
    setMethodFactorRows((prev) =>
      prev.map((row) => ({
        ...row,
        levels: Array.from({ length: value }, (_, index) => row.levels[index] ?? ''),
      })),
    );
  };

  const handleActiveFactorCountChange = (value: number) => {
    setActiveFactorCount(value);
    if (!selectedMethod) return;
    setMethodFactorRows((prev) => {
      const nextRows = prev.slice(0, value);
      if (nextRows.length >= value) return nextRows;
      const addedRows = createMethodFactorRows(value - nextRows.length, selectedMethod, generalLevelCount)
        .map((row, index) => ({
          ...row,
          name: String.fromCharCode(65 + nextRows.length + index),
          changeType: nextRows.length + index === 0 ? '难以改变' : '易于改变',
        }));
      return [...nextRows, ...addedRows];
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
        methodFactorRows[index]?.name?.trim() || `因子${index + 1}`,
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
        title="快速设计"
        open={quickDesignOpen}
        width={980}
        centered
        className="doe-modal"
        footer={<Button onClick={() => setQuickDesignOpen(false)}>取消</Button>}
        onCancel={() => setQuickDesignOpen(false)}
      >
        <div className="doe-modal-body">
          <div className="doe-option-list">
            <div className="doe-heading">
              <Title level={4}>选择设计方法</Title>
            </div>
            {quickMethodOptions.map((row) => (
              <button
                type="button"
                className="doe-option-card"
                key={row.title}
                onClick={() => openMethod(row)}
              >
                <span className={`doe-small-icon ${row.icon}`} />
                <div>
                  <Title level={5}>{row.title}</Title>
                  <Text type="secondary">{row.description}</Text>
                </div>
                <InfoCircleOutlined className="doe-option-info" />
              </button>
            ))}
            </div>
        </div>
      </Modal>

      <Modal
        title={selectedMethod ? selectedMethod.description : '试验设计'}
        open={Boolean(selectedMethod)}
        width={methodModalWidth}
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

              <div className="doe-factor-section-head">
                <div className="doe-method-section-title">因子</div>
                <Select
                  className="doe-factor-count-select"
                  value={activeFactorCount}
                  onChange={handleActiveFactorCountChange}
                  options={[2, 3, 4, 5, 6].map((value) => ({ value, label: `${value} 因子` }))}
                />
              </div>
              <Text>请输入因子名称和设置:</Text>
              {isGeneralFactorialMethod && (
                <div className="doe-method-row max-level-row">
                  <label>最大水平数:</label>
                  <Select
                    className="doe-max-level-select"
                    value={generalLevelCount}
                    onChange={handleGeneralLevelCountChange}
                    options={[3, 4, 5].map((value) => ({ value, label: String(value) }))}
                  />
                </div>
              )}
              {isGeneralFactorialMethod ? (
                <table className="doe-factor-table general-factorial">
                  <thead>
                    <tr>
                      <th>名称</th>
                      <th>类型</th>
                      <th colSpan={generalLevelCount}>水平数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodFactorRows.map((row, rowIndex) => (
                      <tr key={rowIndex}>
                        <td>
                          <Input
                            variant="borderless"
                            value={row.name}
                            onChange={(event) => updateMethodFactorName(rowIndex, event.target.value)}
                          />
                        </td>
                        <td>
                          {selectedMethod.factorTypeMode === 'editable' ? (
                            <Select
                              variant="borderless"
                              value={row.type}
                              onChange={(value) => updateMethodFactorRow(rowIndex, 'type', value)}
                              options={(selectedMethod.allowedFactorTypes ?? ['连续', '类别']).map((value) => ({ value, label: value }))}
                            />
                          ) : (
                            <span className="doe-factor-type-fixed">{row.type}</span>
                          )}
                        </td>
                        {Array.from({ length: generalLevelCount }, (_, levelIndex) => (
                          <td key={levelIndex}>
                            <Input
                              variant="borderless"
                              value={row.levels[levelIndex] ?? ''}
                              onChange={(event) => updateMethodFactorLevel(rowIndex, levelIndex, event.target.value)}
                            />
                          </td>
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
                      <th>类型</th>
                      <th>低</th>
                      <th>高</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methodFactorRows.map((row, index) => (
                      <tr key={index}>
                        {isSplitPlotMethod && (
                          <td>
                            <Select
                              variant="borderless"
                              value={row.changeType}
                              onChange={(value) => updateMethodFactorRow(index, 'changeType', value)}
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
                            value={row.name}
                            onChange={(event) => updateMethodFactorName(index, event.target.value)}
                          />
                        </td>
                        <td>
                          {selectedMethod.factorTypeMode === 'editable' ? (
                            <Select
                              variant="borderless"
                              value={row.type}
                              onChange={(value) => updateMethodFactorRow(index, 'type', value)}
                              options={(selectedMethod.allowedFactorTypes ?? ['连续', '类别']).map((value) => ({ value, label: value }))}
                            />
                          ) : (
                            <span className="doe-factor-type-fixed">{row.type}</span>
                          )}
                        </td>
                        <td>
                          <Input
                            variant="borderless"
                            value={row.lowLevel}
                            onChange={(event) => updateMethodFactorRow(index, 'lowLevel', event.target.value)}
                          />
                        </td>
                        <td>
                          <Input
                            variant="borderless"
                            value={row.highLevel}
                            onChange={(event) => updateMethodFactorRow(index, 'highLevel', event.target.value)}
                          />
                        </td>
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
