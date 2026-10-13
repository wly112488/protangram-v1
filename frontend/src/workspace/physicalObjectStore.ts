import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DataForm = '单值' | '分组' | '表格' | '序列' | '文件';
export interface ValueField { id: string; name: string; description?: string; unit?: string; form: DataForm; value: string; source?: string }
export interface DesignField extends ValueField { usage: '条件' | '参考' | '要求'; comparison?: '目标' | '下限' | '上限' | '区间' }
export interface DesignCase { id: string; name: string; description?: string; fields: DesignField[] }
export interface TestRecord { id: string; name: string; description?: string; createdAt: string; data: ValueField[] }
export interface ExperimentDefinition { id: string; name: string; category: string; description?: string; taskBookId?: string; settings: ValueField[]; records: TestRecord[] }
export interface CalculationRecord extends TestRecord { inputs: ValueField[] }
export interface Calculation { id: string; name: string; description?: string; inputs: ValueField[]; records: CalculationRecord[] }
export interface SimulationModel { id: string; name: string; description: string; inputs: ValueField[]; outputs: ValueField[]; defaults: ValueField[]; method: string; calculations: Calculation[] }
export interface PhysicalObject { id: string; name: string; type: string; description: string; basedOnId?: string; parameters: ValueField[]; materials: ValueField[]; children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[] }

const id = (prefix: string) => `${prefix}-${crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const field = (name: string, value: string, unit = '', form: DataForm = '单值'): ValueField => ({ id: id('field'), name, value, unit, form });
const initialObjects: PhysicalObject[] = [{
  id: 'object-fan-a', name: '涵道风扇 A', type: '涵道风扇', description: '演示对象；类型决定可用字段和子对象模板。参数与组成共同描述当前构型。',
  parameters: [field('外径', '600', 'mm'), field('动 / 静叶片数', '6 / 11'), field('设计点转速', '1200', 'r/min')],
  materials: [field('外观照片', 'fan-a.jpg', '', '文件')],
  children: [{ id: 'object-rotor-a', name: '转子 A', type: '转子', description: '参数保存在转子自身，不复制到父对象。', parameters: [field('叶片数', '6', '片'), field('中弦长', '131', 'mm')], materials: [], children: [], designs: [], experiments: [], models: [] }],
  designs: [{ id: 'design-nominal', name: '起飞设计点', description: '一组适用条件下的条件、参考值和要求。', fields: [
    { ...field('转速', '1200', 'r/min'), usage: '条件' }, { ...field('推力', '目标 850', 'N'), usage: '要求', comparison: '目标' },
  ] }],
  experiments: [{ id: 'experiment-vibration', name: '转子振动性能试验', category: '性能与功能类 / 性能参数测试', description: '计划设置固定；重复执行分别新增记录。', settings: [field('采样频率', '10', 'kHz'), field('载荷谱', '起飞设计点', '', '文件')], taskBookId: undefined, records: [{ id: 'record-vibration-1', name: '转子振动性能试验_记录1', createdAt: '2026-10-12T09:00:00.000Z', data: [field('振动速度有效值', '2.4', 'mm/s'), field('采集文件', 'run-001.csv', '', '文件')] }] }],
  models: [{ id: 'model-aero', name: '风扇性能预测模型', description: '可复用模型定义；训练模型也可在计算记录中追溯来源。', inputs: [field('外径', '', 'mm'), field('转速', '', 'r/min')], outputs: [field('推力', '', 'N'), field('效率', '', '%')], defaults: [field('网格等级', '中')], method: '公式 / 模型文件 / 组合均可；组合需说明模型版本和输入输出对应关系。', calculations: [{ id: 'calculation-aero-1', name: '标称点预测', description: '本计算固定实际输入与方法。', inputs: [field('转速', '1200', 'r/min')], records: [{ id: 'calc-record-1', name: '标称点预测_记录1', createdAt: '2026-10-12T10:00:00.000Z', inputs: [field('转速', '1200', 'r/min')], data: [field('推力', '862', 'N'), field('效率', '0.84', '')] }] }] }],
}];

const mapObjects = (items: PhysicalObject[], targetId: string, update: (item: PhysicalObject) => PhysicalObject): PhysicalObject[] => items.map(item => item.id === targetId ? update(item) : { ...item, children: mapObjects(item.children, targetId, update) });
const blankObject = (name: string, type = '自定义对象'): PhysicalObject => ({ id: id('object'), name, type, description: '', parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const cloneConfigurationTree = (source: PhysicalObject, overrides: ValueField[] = []): PhysicalObject => ({
  ...source, id: id('object'), basedOnId: source.id,
  parameters: source.parameters.map(item => { const override = overrides.find(value => value.name === item.name); return { ...item, id: id('field'), ...(override ? { value: override.value, unit: override.unit || item.unit } : {}) }; }),
  materials: source.materials.map(item => ({ ...item, id: id('field') })),
  children: source.children.map(child => cloneConfigurationTree(child)),
  designs: source.designs.map(design => ({ ...design, id: id('design'), fields: design.fields.map(item => ({ ...item, id: id('field') })) })),
  experiments: [], models: source.models.map(model => ({ ...model, id: id('model'), inputs: model.inputs.map(item => ({ ...item, id: id('field') })), outputs: model.outputs.map(item => ({ ...item, id: id('field') })), defaults: model.defaults.map(item => ({ ...item, id: id('field') })), calculations: [] })),
});

interface PhysicalObjectState {
  objects: PhysicalObject[];
  addRoot: (input: { name: string; type: string; description?: string }) => string;
  duplicateConfiguration: (sourceObjectId: string, input: { name: string; description?: string; parameterOverrides: ValueField[] }) => string | null;
  addChild: (parentId: string, input: { name: string; type: string; description?: string }) => string;
  addField: (objectId: string, section: 'parameters' | 'materials', item: Omit<ValueField, 'id'>) => void;
  addDesign: (objectId: string, item: Omit<DesignCase, 'id'>) => void;
  addExperiment: (objectId: string, item: Omit<ExperimentDefinition, 'id' | 'records'>) => void;
  addTestRecord: (objectId: string, experimentId: string, item: Omit<TestRecord, 'id' | 'createdAt'>) => void;
  addModel: (objectId: string, item: Omit<SimulationModel, 'id' | 'calculations'>) => void;
  addCalculation: (objectId: string, modelId: string, item: Omit<Calculation, 'id' | 'records'>) => void;
  addCalculationRecord: (objectId: string, modelId: string, calculationId: string, item: Omit<CalculationRecord, 'id' | 'createdAt'>) => void;
}

export const usePhysicalObjectStore = create<PhysicalObjectState>()(persist((set) => ({
  objects: initialObjects,
  addRoot: input => { const item = { ...blankObject(input.name, input.type), description: input.description ?? '' }; set(state => ({ objects: [...state.objects, item] })); return item.id; },
  duplicateConfiguration: (sourceObjectId, input) => {
    let created: PhysicalObject | undefined;
    set(state => {
      const source = flattenObjects(state.objects).find(entry => entry.object.id === sourceObjectId)?.object;
      if (!source) return state;
      created = { ...cloneConfigurationTree(source, input.parameterOverrides), name: input.name, description: input.description || `由“${source.name}”另存为的新构型` };
      return { objects: [...state.objects, created] };
    });
    return created?.id ?? null;
  },
  addChild: (parentId, input) => { const child = { ...blankObject(input.name, input.type), description: input.description ?? '' }; set(state => ({ objects: mapObjects(state.objects, parentId, parent => ({ ...parent, children: [...parent.children, child] })) })); return child.id; },
  addField: (objectId, section, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, [section]: [...object[section], { ...item, id: id('field') }] })) })),
  addDesign: (objectId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, designs: [...object.designs, { ...item, id: id('design') }] })) })),
  addExperiment: (objectId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, experiments: [...object.experiments, { ...item, id: id('experiment'), records: [] }] })) })),
  addTestRecord: (objectId, experimentId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, experiments: object.experiments.map(experiment => experiment.id === experimentId ? { ...experiment, records: [...experiment.records, { ...item, id: id('record'), createdAt: new Date().toISOString() }] } : experiment) })) })),
  addModel: (objectId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, models: [...object.models, { ...item, id: id('model'), calculations: [] }] })) })),
  addCalculation: (objectId, modelId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, models: object.models.map(model => model.id === modelId ? { ...model, calculations: [...model.calculations, { ...item, id: id('calculation'), records: [] }] } : model) })) })),
  addCalculationRecord: (objectId, modelId, calculationId, item) => set(state => ({ objects: mapObjects(state.objects, objectId, object => ({ ...object, models: object.models.map(model => model.id === modelId ? { ...model, calculations: model.calculations.map(calculation => calculation.id === calculationId ? { ...calculation, records: [...calculation.records, { ...item, id: id('calc-record'), createdAt: new Date().toISOString() }] } : calculation) } : model) })) })),
}), { name: 'protangram-physical-objects-v1', storage: createJSONStorage(() => localStorage) }));

export const flattenObjects = (objects: PhysicalObject[], path = ''): Array<{ object: PhysicalObject; path: string }> => objects.flatMap(object => {
  const nextPath = path ? `${path} / ${object.name}` : object.name;
  return [{ object, path: nextPath }, ...flattenObjects(object.children, nextPath)];
});
