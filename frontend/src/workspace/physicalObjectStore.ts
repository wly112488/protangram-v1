import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { flattenEquipment, mapEquipment } from './equipmentCompositionModel';
import { createTrialSetting, replaceTrialSetting, type TrialSetting } from './trialSettingsModel';

export type DataForm = '单值' | '分组' | '表格' | '序列' | '文件';
export interface ValueField { id: string; name: string; description?: string; unit?: string; form: DataForm; value: string; source?: string }
export interface DesignField extends ValueField { usage: '条件' | '参考' | '要求'; comparison?: '目标' | '下限' | '上限' | '区间' }
export interface DesignCase { id: string; name: string; description?: string; fields: DesignField[] }
export interface RawDataFile { id: string; name: string; mimeType: string; size: number; addedAt: string; headers: string[]; rowCount: number; status?: 'available' | 'removed'; sourceRawFileId?: string }
export interface DerivedChart {
  id: string; name: string; rawFileId: string; xField: string; yField: string; chartType: 'line' | 'scatter' | 'bar';
  startRow: number; endRow: number; scale: number; offset: number; color: string; smooth: boolean;
  modelId?: string; modelInputs?: ValueField[]; createdAt: string; updatedAt: string;
  plotKind?: 'line' | 'scatter' | 'bar' | 'histogram' | 'boxplot' | 'bubble';
  yFields?: string[]; sizeField?: string; averageEvery?: number; sourceCapability?: string;
}
export interface TrialChartResult extends DerivedChart { sourceRecordId: string }
export type ChartInput = Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>;
export interface DerivedTable { id: string; name: string; rawFileId: string; fields: string[]; startRow: number; endRow: number; createdAt: string; updatedAt: string }
export interface TestRecord { id: string; name: string; executionNumber: number; description?: string; createdAt: string; actualConditions: ValueField[]; measurements: ValueField[]; rawFiles: RawDataFile[]; tables: DerivedTable[] }
export interface ConcreteTrial { id: string; name: string; cfgId?: string; settings?: TrialSetting[]; description?: string; taskBookId?: string; loadSpectrum: string; loadSpectrumDescription?: string; designArtifactRef?: { projectId: string; artifactId: string }; designs?: DesignField[]; records: TestRecord[]; charts: TrialChartResult[] }
export const getRecordCharts = (trial: ConcreteTrial | undefined, recordId: string | undefined) => recordId ? (trial?.charts ?? []).filter(chart => chart.sourceRecordId === recordId) : [];
const chartNameKey = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase();
export const hasTrialChartNameConflict = (trial: ConcreteTrial, name: string, current?: { id: string; sourceRecordId: string }) => (trial.charts ?? []).some(chart =>
  chartNameKey(chart.name) === chartNameKey(name) && !(chart.id === current?.id && chart.sourceRecordId === current?.sourceRecordId));
export function assertTrialChartName(trial: ConcreteTrial, name: string, current?: { id: string; sourceRecordId: string }) {
  if (!name.trim()) throw new Error('请填写图表名称');
  if (hasTrialChartNameConflict(trial, name, current)) throw new Error('本具体试验已有同名图表，请使用其他名称。');
}
// Stable codes used by professional services; legacy configurations stay unset until edited.
export const TEST_TYPES = [{ value: 'aerodynamic', label: '气动试验' }, { value: 'thrust', label: '推力试验' }, { value: 'thermal', label: '热试验' }, { value: 'vibration', label: '振动试验' }, { value: 'other', label: '其他试验' }];
export interface ExperimentDefinition { testType?: string; id: string; name: string; category?: string; description?: string; designArtifactRef?: { projectId: string; artifactId: string }; parameters: ValueField[]; trials: ConcreteTrial[] }
export const isExperimentSetupLocked = (experiment: ExperimentDefinition) => experiment.trials.some(trial => trial.records.length > 0);
export interface CalculationRecord extends TestRecord { inputs: ValueField[] }
export interface Calculation { id: string; name: string; description?: string; inputs: ValueField[]; records: CalculationRecord[] }
// Existing definitions remain readable by professional model selection. They are no longer created in the object workbench.
export interface SimulationModel { id: string; name: string; description: string; inputs: ValueField[]; outputs: ValueField[]; defaults: ValueField[]; method: string; calculations: Calculation[] }
// Persisted names are retained so existing professional references keep their IDs.
// A configuration is now the concrete physical object; its parent is a category.
export interface PhysicalConfiguration {
  id: string; name: string; description: string; basedOnId?: string; parameters: ValueField[]; materials: ValueField[];
  children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}
export interface PhysicalObject {
  id: string; name: string; type: string; description: string; configurations: PhysicalConfiguration[];
  legacyCategories?: Array<{ id: string; name: string; description: string }>;
  basedOnId?: string; parameters: ValueField[]; materials: ValueField[]; children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const blankConfig = (name: string, description = ''): PhysicalConfiguration => ({ id: id('config'), name, description, parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const blankFamily = (name: string, type = '自定义对象', description = ''): PhysicalObject => ({ id: id('object'), name, type, description, configurations: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
export const findObjectCategory = (items: PhysicalObject[], categoryOrObjectId: string) => items.find(category => category.id === categoryOrObjectId || category.legacyCategories?.some(item => item.id === categoryOrObjectId) || category.id === flattenEquipment(items).find(object => object.id === categoryOrObjectId)?.categoryId);
function defaultCategories(): PhysicalObject[] {
  return [['category-fan', '涵道风扇'], ['category-motor', '电机'], ['category-propulsion', '电推进']].map(([categoryId, name]) => ({ ...blankFamily(name, name), id: categoryId, legacyCategories: [] }));
}
const mapConfig = (items: PhysicalObject[], configId: string, update: (item: PhysicalConfiguration) => PhysicalConfiguration) => mapEquipment(items, config => config.id === configId ? update(config) : config);
const mapExperiment = (items: PhysicalObject[], experimentId: string, update: (item: ExperimentDefinition) => ExperimentDefinition) => mapEquipment(items, config => ({ ...config, experiments: config.experiments.map(item => item.id === experimentId ? update(item) : item) }));
const mapTrial = (items: PhysicalObject[], trialId: string, update: (item: ConcreteTrial) => ConcreteTrial) => mapEquipment(items, config => ({ ...config, experiments: config.experiments.map(experiment => ({ ...experiment, trials: experiment.trials.map(item => item.id === trialId ? update(item) : item) })) }));
const findTrial = (items: PhysicalObject[], trialId: string) => flattenEquipment(items).flatMap(ref => ref.equipment.experiments).flatMap(experiment => experiment.trials).find(trial => trial.id === trialId);
const requireRecord = (items: PhysicalObject[], trialId: string, recordId: string) => {
  const record = findTrial(items, trialId)?.records.find(item => item.id === recordId);
  if (!record) throw new Error('指定试验记录不存在，未写入其他记录。');
  return record;
};
const mapRecord = (items: PhysicalObject[], trialId: string, recordId: string, update: (item: TestRecord) => TestRecord) => {
  requireRecord(items, trialId, recordId);
  return mapTrial(items, trialId, trial => ({ ...trial, records: trial.records.map(item => item.id === recordId ? update(item) : item) }));
};

export interface PhysicalObjectState {
  objects: PhysicalObject[];
  addRoot: (input: { name: string; type: string; description?: string }) => string;
  addConfiguration: (familyId: string, input: { name: string; description?: string }) => string;
  addComponent: (parentId: string, input: { name: string; description?: string }) => string;
  addField: (configurationId: string, section: 'parameters' | 'materials', item: Omit<ValueField, 'id'>) => void;
  updateField: (configurationId: string, section: 'parameters' | 'materials', fieldId: string, patch: Omit<ValueField, 'id'>) => void;
  addExperiment: (configurationId: string, item: Omit<ExperimentDefinition, 'id' | 'trials'>) => string;
  addConcreteTrial: (experimentId: string, item: Omit<ConcreteTrial, 'id' | 'records' | 'charts'>) => string;
  updateConcreteTrial: (trialId: string, patch: Partial<Pick<ConcreteTrial, 'name' | 'description' | 'taskBookId' | 'loadSpectrum' | 'loadSpectrumDescription' | 'designArtifactRef'>>) => void;
  updateExperiment: (experimentId: string, patch: Partial<Pick<ExperimentDefinition, 'name' | 'description' | 'parameters' | 'testType'>>) => void;
  addTrialRecord: (trialId: string, item: { name?: string; description?: string }) => string;
  addTrialSetting: (trialId:string,input:Omit<TrialSetting,'id'>) => string;
  updateTrialSetting: (trialId:string,settingId:string,patch:Partial<Omit<TrialSetting,'id'>>) => void;
  updateTrialRecord: (trialId: string, recordId: string, patch: Partial<Pick<TestRecord, 'name' | 'description'>>) => void;
  addRawFile: (trialId: string, recordId: string, file: RawDataFile) => void;
  removeRawFile: (trialId: string, recordId: string, fileId: string) => void;
  saveChart: (trialId: string, recordId: string, chart: ChartInput, chartId?: string) => string;
  saveTable: (trialId: string, recordId: string, table: Omit<DerivedTable, 'id' | 'createdAt' | 'updatedAt'>, tableId?: string) => string;
}

export const usePhysicalObjectStore = create<PhysicalObjectState>()(persist((set, get) => ({
  objects: defaultCategories(),
  addRoot: input => {
    const name = input.name.trim();
    if (!name) throw new Error('请填写对象类别名称');
    const existing = get().objects.find(category => category.name === name);
    if (existing) return existing.id;
    const family = blankFamily(name, name, input.description);
    set(state => ({ objects: [...state.objects, family] })); return family.id;
  },
  addConfiguration: (familyId, input) => {
    if (!get().objects.some(item => item.id === familyId)) throw new Error('所属对象类别不存在');
    if (!input.name.trim()) throw new Error('请填写具体物理对象名称');
    const config = blankConfig(input.name.trim(), input.description);
    set(state => ({ objects: state.objects.map(item => item.id === familyId ? { ...item, configurations: [...item.configurations, config] } : item) }));
    return config.id;
  },
  addComponent: (parentId, input) => {
    if (!flattenEquipment(get().objects).some(item => item.id === parentId)) throw new Error('所属物理对象不存在');
    if (!input.name.trim()) throw new Error('请填写组成对象名称');
    const child = blankFamily(input.name.trim(), '组成对象', input.description);
    set(state => ({ objects: mapConfig(state.objects, parentId, parent => ({ ...parent, children: [...parent.children, child] })) }));
    return child.id;
  },
  addField: (configurationId, section, item) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: [...config[section], { ...item, id: id('field') }] })) })),
  updateField: (configurationId, section, fieldId, patch) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: config[section].map(item => item.id === fieldId ? { ...item, ...patch, id: fieldId } : item) })) })),
  addExperiment: (configurationId, item) => {
    if (!flattenEquipment(get().objects).some(config => config.id === configurationId)) throw new Error('所属具体物理对象不存在');
    const experiment = { ...item, id: id('trial-configuration'), trials: [] };
    set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, experiments: [...config.experiments, experiment] })) }));return experiment.id;
  },
  addConcreteTrial: (experimentId, item) => {
    if (!item.name.trim()) throw new Error('请填写具体试验名称');
    if (!flattenEquipment(get().objects).some(config => config.equipment.experiments.some(experiment => experiment.id === experimentId))) throw new Error('所属试验构型不存在');
    const trial = { ...item, id: id('trial'), records: [], charts: [] };
    set(state => ({ objects: mapExperiment(state.objects, experimentId, experiment => ({ ...experiment, trials: [...experiment.trials, trial] })) }));return trial.id;
  },
  updateConcreteTrial: (trialId, patch) => set(state => ({ objects: mapTrial(state.objects, trialId, trial => {
    if (trial.records.length && trial.loadSpectrum && patch.loadSpectrum !== undefined && patch.loadSpectrum !== trial.loadSpectrum) throw new Error('已有执行记录，变更载荷谱请新建具体试验。');
    return { ...trial, ...patch };
  }) })),
  updateExperiment: (experimentId, patch) => set(state => ({ objects: mapExperiment(state.objects, experimentId, experiment => {
    if (isExperimentSetupLocked(experiment) && patch.parameters !== undefined) throw new Error('已有执行记录，试验构型参数不可覆盖；请新建试验构型。');
    return { ...experiment, ...patch };
  }) })),
  addTrialRecord: (trialId, input) => {
    const trial = findTrial(get().objects, trialId);
    if (!trial) throw new Error('所属具体试验不存在');
    const executionNumber = Math.max(0, ...trial.records.map(item => item.executionNumber)) + 1;
    const record: TestRecord = { ...input, id: id('record'), name: input.name?.trim() || `第 ${executionNumber} 次试验记录`, executionNumber, createdAt: new Date().toISOString(), actualConditions: [], measurements: [], rawFiles: [], tables: [] };
    set(state => ({ objects: mapTrial(state.objects, trialId, item => ({ ...item, records: [...item.records, record] })) }));return record.id;
  },
  addTrialSetting: (trialId,input) => {
    if(!findTrial(get().objects,trialId)) throw new Error('所属具体试验不存在');
    const setting = {...createTrialSetting(id('set'),input.name,input.fields),programId:input.programId};
    set(state=>({objects:mapTrial(state.objects,trialId,trial=>({...trial,settings:[...(trial.settings ?? []),setting]}))}));
    return setting.id;
  },
  updateTrialSetting: (trialId,settingId,patch) => {
    const trial = findTrial(get().objects,trialId);
    if(!trial) throw new Error('所属具体试验不存在');
    const settings = replaceTrialSetting(trial.settings ?? [],settingId,patch);
    set(state=>({objects:mapTrial(state.objects,trialId,trial=>({...trial,settings}))}));
  },
  updateTrialRecord: (trialId, recordId, patch) => set(state => ({ objects: mapRecord(state.objects, trialId, recordId, record => ({ ...record, ...patch })) })),
  addRawFile: (trialId, recordId, file) => set(state => ({ objects: mapRecord(state.objects, trialId, recordId, record => ({ ...record, rawFiles: record.rawFiles.some(item => item.id === file.id) ? record.rawFiles : [...record.rawFiles, file] })) })),
  removeRawFile: (trialId, recordId, fileId) => set(state => ({ objects: mapRecord(state.objects, trialId, recordId, record => {
    if (!record.rawFiles.some(file => file.id === fileId)) throw new Error('此执行记录中找不到该 CSV 文件');
    return { ...record, rawFiles: record.rawFiles.map(file => file.id === fileId ? { ...file, status: 'removed' } : file) };
  }) })),
  saveChart: (trialId, recordId, chart, chartId) => {
    const record = requireRecord(get().objects, trialId, recordId);
    const trial = findTrial(get().objects, trialId)!;
    if (record.rawFiles.some(file => file.id === chart.rawFileId && file.status === 'removed')) throw new Error('原始 CSV 已移除，不能用于新图表');
    const referencedFields = [chart.xField, chart.yField, ...(chart.yFields ?? []), ...(chart.sizeField ? [chart.sizeField] : [])];
    if (!record.rawFiles.some(file => file.id === chart.rawFileId && referencedFields.every(field => file.headers.includes(field)))) throw new Error('图表必须引用本记录的原始 CSV 字段');
    if (chart.plotKind === 'bubble' && !chart.sizeField) throw new Error('气泡图需要第三个大小字段');
    if (chart.averageEvery !== undefined && (!Number.isInteger(chart.averageEvery) || chart.averageEvery < 1)) throw new Error('平均分组点数应为正整数');
    if (chartId && !trial.charts.some(item => item.id === chartId && item.sourceRecordId === recordId)) throw new Error('本记录中不存在该图表，不能变更图表的来源记录');
    assertTrialChartName(trial, chart.name, chartId ? { id: chartId, sourceRecordId: recordId } : undefined);
    const now = new Date().toISOString(), idToSave = chartId ?? id('chart');
    set(state => ({ objects: mapTrial(state.objects, trialId, item => ({ ...item, charts: chartId ? item.charts.map(old => old.id === chartId && old.sourceRecordId === recordId ? { ...old, ...chart, id: old.id, createdAt: old.createdAt, name: chart.name.trim(), sourceRecordId: recordId, updatedAt: now } : old) : [...item.charts, { ...chart, name: chart.name.trim(), sourceRecordId: recordId, id: idToSave, createdAt: now, updatedAt: now }] })) }));return idToSave;
  },
  saveTable: (trialId, recordId, table, tableId) => {
    const record = requireRecord(get().objects, trialId, recordId);
    const trial = findTrial(get().objects, trialId)!;
    if (!table.name.trim()) throw new Error('请填写数据表名称');
    if (trial.records.some(item => item.tables.some(existing => chartNameKey(existing.name) === chartNameKey(table.name) && !(existing.id === tableId && item.id === recordId)))) throw new Error('本具体试验已有同名数据表，请使用其他名称。');
    const file = record.rawFiles.find(item => item.id === table.rawFileId);
    if (file?.status === 'removed') throw new Error('原始 CSV 已移除，不能用于新数据表');
    if (!file || !table.fields.length || table.fields.some(field => !file.headers.includes(field))) throw new Error('数据表必须引用本记录的原始 CSV 字段');
    if (tableId && !record.tables.some(item => item.id === tableId)) throw new Error('本记录中不存在该数据表');
    const now = new Date().toISOString(), idToSave = tableId ?? id('table');
    set(state => ({ objects: mapRecord(state.objects, trialId, recordId, item => ({ ...item, tables: tableId ? item.tables.map(old => old.id === tableId ? { ...old, ...table, updatedAt: now } : old) : [...item.tables, { ...table, id: idToSave, createdAt: now, updatedAt: now }] })) }));return idToSave;
  },
}), { name: 'protangram-physical-objects-v1', storage: createJSONStorage(() => localStorage), version: 6, migrate: migratePhysicalState }));

// Migration-only input shape. Old fields never remain as a parallel live record system.
type LegacyRecord = Partial<TestRecord> & { id: string; charts?: DerivedChart[]; data?: ValueField[] };
type LegacyTrial = Partial<Omit<ConcreteTrial, 'records'>> & { records?: LegacyRecord[]; record?: LegacyRecord; archivedRecords?: LegacyRecord[] };
type LegacyExperiment = Partial<Omit<ExperimentDefinition, 'trials'>> & { settings?: ValueField[]; record?: LegacyRecord; archivedRecords?: LegacyRecord[]; records?: LegacyRecord[]; trials?: LegacyTrial[]; taskBookId?: string };
function mergeParameters(settings: ValueField[] = [], parameters: ValueField[] = []) {
  const merged = [...parameters];
  for (const field of settings) {
    const existing = merged.find(item => item.id === field.id);
    if (!existing) merged.push(field);
    else if (JSON.stringify(existing) !== JSON.stringify(field)) merged.push({ ...field, id: `legacy-setting-${field.id}` });
  }
  return merged;
}
function migrateExperiment(legacy: LegacyExperiment): ExperimentDefinition {
  const { settings, record, archivedRecords = [], records = [], trials = [], taskBookId, ...metadata } = legacy;
  const oldRecords = [record, ...archivedRecords, ...records].filter((item): item is LegacyRecord => Boolean(item));
  const existingIds = new Set(trials.flatMap(trial => [...(trial.records ?? []), ...(trial.record ? [trial.record] : []), ...(trial.archivedRecords ?? [])]).map(item => item.id));
  const remaining = oldRecords.filter(item => !existingIds.has(item.id));
  const inputTrials = trials.map(trial => ({ ...trial }));
  const legacyTrial = inputTrials.find(trial => trial.id === `trial-${legacy.id}` || record && [...(trial.records ?? []), ...(trial.record ? [trial.record] : [])].some(item => item.id === record.id));
  if (remaining.length && legacyTrial) legacyTrial.records = [...(legacyTrial.records ?? []), ...remaining];
  else if (remaining.length || !inputTrials.length && taskBookId) inputTrials.unshift({ id: `trial-${legacy.id}`, name: legacy.name ?? '历史试验', description: legacy.description, taskBookId, designArtifactRef: legacy.designArtifactRef, records: remaining });
  const normalized = inputTrials.map(trial => {
    const { record: current, archivedRecords: historical = [], records: executions = [], ...trialMetadata } = trial;
    const unique = new Map<string, LegacyRecord>();
    for (const item of [...executions, ...(current ? [current] : []), ...historical]) if (!unique.has(item.id)) unique.set(item.id, item);
    const ordered = [...unique.values()].sort((a, b) => {
      const first = Date.parse(a.createdAt ?? ''), second = Date.parse(b.createdAt ?? '');
      return Number.isFinite(first) && Number.isFinite(second) ? first - second : 0;
    });
    const sharedCharts = [...(trial.charts ?? [])];
    for (const item of ordered) for (const chart of item.charts ?? []) {
      if (!sharedCharts.some(saved => saved.id === chart.id && saved.sourceRecordId === item.id)) sharedCharts.push({ ...chart, sourceRecordId: item.id });
    }
    return { ...trialMetadata, charts: sharedCharts, taskBookId: trialMetadata.taskBookId ?? taskBookId, loadSpectrum: trial.loadSpectrum ?? '', records: ordered.map((item, index) => {
      const { data, charts: _legacyCharts, ...saved } = item;
      void _legacyCharts;
      return { ...saved, executionNumber: item.executionNumber ?? index + 1, actualConditions: item.actualConditions ?? [], measurements: item.measurements ?? data ?? [], rawFiles: item.rawFiles ?? [], tables: item.tables ?? [] } as TestRecord;
    }) } as ConcreteTrial;
  });
  return { ...metadata, id: legacy.id!, name: legacy.name!, parameters: mergeParameters(settings, legacy.parameters), trials: normalized };
}
export function migratePhysicalState(persisted: unknown): Pick<PhysicalObjectState, 'objects'> {
  const old = (persisted as { objects?: Array<Record<string, unknown>> })?.objects ?? [];
  if (!Array.isArray(old)) throw new Error('物理对象存储格式无效，未覆盖原数据');
  const groups = new Map<string, PhysicalObject>();
  for (const item of old) {
    const hasChildren = Array.isArray(item.configurations);
    const declaredType = String(item.type || '').trim();
    const name = declaredType && declaredType !== '自定义对象' ? declaredType : hasChildren ? String(item.name || '未分类对象') : '未分类对象';
    const categoryName = name === '电涵道风扇' ? '涵道风扇' : name;
    const incoming = hasChildren ? item.configurations as PhysicalConfiguration[] : [item as unknown as PhysicalConfiguration];
    // Very old root-level business data is a device too; do not discard it when
    // upgrading a mixed hierarchy that also has child devices.
    const rootHasData = hasChildren && ['parameters', 'materials', 'children', 'designs', 'experiments', 'models'].some(key => Array.isArray(item[key]) && item[key].length);
    const devices = rootHasData ? [item as unknown as PhysicalConfiguration, ...incoming] : incoming;
    let category = groups.get(categoryName);
    if (!category) {
      category = { ...blankFamily(categoryName, categoryName), ...(hasChildren ? item : {}), name: categoryName, type: categoryName, configurations: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [], legacyCategories: [] } as PhysicalObject;
      groups.set(categoryName, category);
    }
    if (hasChildren) {
      const aliases = [...(item.legacyCategories as PhysicalObject['legacyCategories'] ?? [])];
      if (item.id !== category.id || item.name !== categoryName) aliases.push({ id: String(item.id), name: String(item.name || ''), description: String(item.description || '') });
      for (const alias of aliases) if (!category.legacyCategories!.some(saved => saved.id === alias.id)) category.legacyCategories!.push(alias);
    }
    for (const device of devices) {
      const { configurations: _oldChildren, legacyCategories: _oldAliases, ...saved } = device as PhysicalConfiguration & Partial<PhysicalObject>;
      void _oldChildren; void _oldAliases;
      category.configurations.push({ ...blankConfig(device.name || '未命名物理对象'), ...saved, experiments: (device.experiments ?? []).map(migrateExperiment) });
    }
  }
  for (const category of defaultCategories()) if (!groups.has(category.name)) groups.set(category.name, category);
  return { objects: [...groups.values()] };
}
export const flattenObjects = (objects: PhysicalObject[], path = ''): Array<{ object: PhysicalConfiguration & { type: string }; path: string }> => flattenEquipment(objects).map(ref => ({ object: { ...ref.equipment, type:objects.find(category=>category.id===ref.categoryId)?.type ?? '组成对象' }, path:`${path ? `${path} / ` : ''}${ref.path}` }));
export const findPhysicalTrialRecord = (objects: PhysicalObject[], configurationId: string, experimentId: string, recordId: string) => flattenObjects(objects).find(({ object }) => object.id === configurationId)?.object.experiments.find(item => item.id === experimentId)?.trials.flatMap(trial => trial.records).find(record => record.id === recordId);
