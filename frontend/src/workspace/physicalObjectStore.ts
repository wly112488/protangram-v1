import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

export type DataForm = '单值' | '分组' | '表格' | '序列' | '文件';
export interface ValueField { id: string; name: string; description?: string; unit?: string; form: DataForm; value: string; source?: string }
export interface DesignField extends ValueField { usage: '条件' | '参考' | '要求'; comparison?: '目标' | '下限' | '上限' | '区间' }
export interface DesignCase { id: string; name: string; description?: string; fields: DesignField[] }
export interface RawDataFile { id: string; name: string; mimeType: string; size: number; addedAt: string; headers: string[]; rowCount: number }
export interface DerivedChart {
  id: string; name: string; rawFileId: string; xField: string; yField: string; chartType: 'line' | 'scatter' | 'bar';
  startRow: number; endRow: number; scale: number; offset: number; color: string; smooth: boolean;
  modelId?: string; modelInputs?: ValueField[]; createdAt: string; updatedAt: string;
}
export interface DerivedTable { id: string; name: string; rawFileId: string; fields: string[]; startRow: number; endRow: number; createdAt: string; updatedAt: string }
export interface TestRecord { id: string; name: string; executionNumber: number; description?: string; createdAt: string; actualConditions: ValueField[]; measurements: ValueField[]; rawFiles: RawDataFile[]; charts: DerivedChart[]; tables: DerivedTable[] }
export interface ConcreteTrial { id: string; name: string; description?: string; taskBookId?: string; loadSpectrum: string; loadSpectrumDescription?: string; designArtifactRef?: { projectId: string; artifactId: string }; designs?: DesignField[]; records: TestRecord[] }
export interface ExperimentDefinition { id: string; name: string; category?: string; description?: string; designArtifactRef?: { projectId: string; artifactId: string }; parameters: ValueField[]; trials: ConcreteTrial[] }
export const isExperimentSetupLocked = (experiment: ExperimentDefinition) => experiment.trials.some(trial => trial.records.length > 0);
export interface CalculationRecord extends TestRecord { inputs: ValueField[] }
export interface Calculation { id: string; name: string; description?: string; inputs: ValueField[]; records: CalculationRecord[] }
// Existing definitions remain readable by professional model selection. They are no longer created in the object workbench.
export interface SimulationModel { id: string; name: string; description: string; inputs: ValueField[]; outputs: ValueField[]; defaults: ValueField[]; method: string; calculations: Calculation[] }
export interface PhysicalConfiguration {
  id: string; name: string; description: string; basedOnId?: string; parameters: ValueField[]; materials: ValueField[];
  children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}
export interface PhysicalObject {
  id: string; name: string; type: string; description: string; configurations: PhysicalConfiguration[];
  basedOnId?: string; parameters: ValueField[]; materials: ValueField[]; children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const blankConfig = (name: string, description = ''): PhysicalConfiguration => ({ id: id('config'), name, description, parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const blankFamily = (name: string, type = '自定义对象', description = ''): PhysicalObject => ({ id: id('object'), name, type, description, configurations: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const mapConfig = (items: PhysicalObject[], configId: string, update: (item: PhysicalConfiguration) => PhysicalConfiguration) => items.map(family => ({ ...family, configurations: family.configurations.map(config => config.id === configId ? update(config) : config) }));
const mapExperiment = (items: PhysicalObject[], experimentId: string, update: (item: ExperimentDefinition) => ExperimentDefinition) => items.map(family => ({ ...family, configurations: family.configurations.map(config => ({ ...config, experiments: config.experiments.map(item => item.id === experimentId ? update(item) : item) })) }));
const mapTrial = (items: PhysicalObject[], trialId: string, update: (item: ConcreteTrial) => ConcreteTrial) => items.map(family => ({ ...family, configurations: family.configurations.map(config => ({ ...config, experiments: config.experiments.map(experiment => ({ ...experiment, trials: experiment.trials.map(item => item.id === trialId ? update(item) : item) })) })) }));
const findTrial = (items: PhysicalObject[], trialId: string) => items.flatMap(family => family.configurations).flatMap(config => config.experiments).flatMap(experiment => experiment.trials).find(trial => trial.id === trialId);
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
  addConfiguration: (familyId: string, input: { name: string; description?: string }) => string | null;
  addField: (configurationId: string, section: 'parameters' | 'materials', item: Omit<ValueField, 'id'>) => void;
  updateField: (configurationId: string, section: 'parameters' | 'materials', fieldId: string, patch: Omit<ValueField, 'id'>) => void;
  addExperiment: (configurationId: string, item: Omit<ExperimentDefinition, 'id' | 'trials'>) => string;
  addConcreteTrial: (experimentId: string, item: Omit<ConcreteTrial, 'id' | 'records'>) => string;
  updateConcreteTrial: (trialId: string, patch: Partial<Pick<ConcreteTrial, 'name' | 'description' | 'taskBookId' | 'loadSpectrum' | 'loadSpectrumDescription' | 'designArtifactRef'>>) => void;
  updateExperiment: (experimentId: string, patch: Partial<Pick<ExperimentDefinition, 'name' | 'description' | 'parameters'>>) => void;
  addTrialRecord: (trialId: string, item: { name?: string; description?: string }) => string;
  updateTrialRecord: (trialId: string, recordId: string, patch: Partial<Pick<TestRecord, 'name' | 'description'>>) => void;
  addRawFile: (trialId: string, recordId: string, file: RawDataFile) => void;
  saveChart: (trialId: string, recordId: string, chart: Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>, chartId?: string) => string;
  saveTable: (trialId: string, recordId: string, table: Omit<DerivedTable, 'id' | 'createdAt' | 'updatedAt'>, tableId?: string) => string;
}

export const usePhysicalObjectStore = create<PhysicalObjectState>()(persist((set, get) => ({
  objects: [],
  addRoot: input => { const family = blankFamily(input.name, input.type, input.description); set(state => ({ objects: [...state.objects, family] })); return family.id; },
  addConfiguration: (familyId, input) => {
    if (!get().objects.some(item => item.id === familyId)) return null;
    const config = blankConfig(input.name, input.description);
    set(state => ({ objects: state.objects.map(item => item.id === familyId ? { ...item, configurations: [...item.configurations, config] } : item) }));
    return config.id;
  },
  addField: (configurationId, section, item) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: [...config[section], { ...item, id: id('field') }] })) })),
  updateField: (configurationId, section, fieldId, patch) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: config[section].map(item => item.id === fieldId ? { ...item, ...patch, id: fieldId } : item) })) })),
  addExperiment: (configurationId, item) => {
    if (!get().objects.some(family => family.configurations.some(config => config.id === configurationId))) throw new Error('所属具体构型不存在');
    const experiment = { ...item, id: id('trial-configuration'), trials: [] };
    set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, experiments: [...config.experiments, experiment] })) }));return experiment.id;
  },
  addConcreteTrial: (experimentId, item) => {
    if (!item.loadSpectrum.trim()) throw new Error('请填写载荷谱名称或编号');
    if (!get().objects.some(family => family.configurations.some(config => config.experiments.some(experiment => experiment.id === experimentId)))) throw new Error('所属试验构型不存在');
    const trial = { ...item, id: id('trial'), records: [] };
    set(state => ({ objects: mapExperiment(state.objects, experimentId, experiment => ({ ...experiment, trials: [...experiment.trials, trial] })) }));return trial.id;
  },
  updateConcreteTrial: (trialId, patch) => set(state => ({ objects: mapTrial(state.objects, trialId, trial => {
    if (patch.loadSpectrum !== undefined && !patch.loadSpectrum.trim()) throw new Error('请填写载荷谱名称或编号');
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
    if (!trial.loadSpectrum.trim()) throw new Error('请先补充本试验的载荷谱名称或编号');
    const executionNumber = Math.max(0, ...trial.records.map(item => item.executionNumber)) + 1;
    const record: TestRecord = { ...input, id: id('record'), name: input.name?.trim() || `第 ${executionNumber} 次试验记录`, executionNumber, createdAt: new Date().toISOString(), actualConditions: [], measurements: [], rawFiles: [], charts: [], tables: [] };
    set(state => ({ objects: mapTrial(state.objects, trialId, item => ({ ...item, records: [...item.records, record] })) }));return record.id;
  },
  updateTrialRecord: (trialId, recordId, patch) => set(state => ({ objects: mapRecord(state.objects, trialId, recordId, record => ({ ...record, ...patch })) })),
  addRawFile: (trialId, recordId, file) => set(state => ({ objects: mapRecord(state.objects, trialId, recordId, record => ({ ...record, rawFiles: record.rawFiles.some(item => item.id === file.id) ? record.rawFiles : [...record.rawFiles, file] })) })),
  saveChart: (trialId, recordId, chart, chartId) => {
    const record = requireRecord(get().objects, trialId, recordId);
    if (!record.rawFiles.some(file => file.id === chart.rawFileId && file.headers.includes(chart.xField) && file.headers.includes(chart.yField))) throw new Error('图表必须引用本记录的原始 CSV 字段');
    if (chartId && !record.charts.some(item => item.id === chartId)) throw new Error('本记录中不存在该图表');
    const now = new Date().toISOString(), idToSave = chartId ?? id('chart');
    set(state => ({ objects: mapRecord(state.objects, trialId, recordId, item => ({ ...item, charts: chartId ? item.charts.map(old => old.id === chartId ? { ...old, ...chart, updatedAt: now } : old) : [...item.charts, { ...chart, id: idToSave, createdAt: now, updatedAt: now }] })) }));return idToSave;
  },
  saveTable: (trialId, recordId, table, tableId) => {
    const record = requireRecord(get().objects, trialId, recordId);
    const file = record.rawFiles.find(item => item.id === table.rawFileId);
    if (!file || !table.fields.length || table.fields.some(field => !file.headers.includes(field))) throw new Error('数据表必须引用本记录的原始 CSV 字段');
    if (tableId && !record.tables.some(item => item.id === tableId)) throw new Error('本记录中不存在该数据表');
    const now = new Date().toISOString(), idToSave = tableId ?? id('table');
    set(state => ({ objects: mapRecord(state.objects, trialId, recordId, item => ({ ...item, tables: tableId ? item.tables.map(old => old.id === tableId ? { ...old, ...table, updatedAt: now } : old) : [...item.tables, { ...table, id: idToSave, createdAt: now, updatedAt: now }] })) }));return idToSave;
  },
}), { name: 'protangram-physical-objects-v1', storage: createJSONStorage(() => localStorage), version: 4, migrate: migratePhysicalState }));

// Migration-only input shape. Old fields never remain as a parallel live record system.
type LegacyTrial = Partial<ConcreteTrial> & { record?: TestRecord; archivedRecords?: TestRecord[] };
type LegacyExperiment = Partial<Omit<ExperimentDefinition, 'trials'>> & { settings?: ValueField[]; record?: TestRecord; archivedRecords?: TestRecord[]; records?: Array<Partial<TestRecord> & { data?: ValueField[] }>; trials?: LegacyTrial[]; taskBookId?: string };
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
  const oldRecords = [record, ...archivedRecords, ...records].filter((item): item is TestRecord => Boolean(item));
  const existingIds = new Set(trials.flatMap(trial => [...(trial.records ?? []), ...(trial.record ? [trial.record] : []), ...(trial.archivedRecords ?? [])]).map(item => item.id));
  const remaining = oldRecords.filter(item => !existingIds.has(item.id));
  const inputTrials = trials.map(trial => ({ ...trial }));
  const legacyTrial = inputTrials.find(trial => trial.id === `trial-${legacy.id}` || record && [...(trial.records ?? []), ...(trial.record ? [trial.record] : [])].some(item => item.id === record.id));
  if (remaining.length && legacyTrial) legacyTrial.records = [...(legacyTrial.records ?? []), ...remaining];
  else if (remaining.length || !inputTrials.length && taskBookId) inputTrials.unshift({ id: `trial-${legacy.id}`, name: legacy.name ?? '历史试验', description: legacy.description, taskBookId, designArtifactRef: legacy.designArtifactRef, records: remaining });
  const normalized = inputTrials.map(trial => {
    const { record: current, archivedRecords: historical = [], records: executions = [], ...trialMetadata } = trial;
    const unique = new Map<string, Partial<TestRecord> & { data?: ValueField[] }>();
    for (const item of [...executions, ...(current ? [current] : []), ...historical]) if (!unique.has(item.id)) unique.set(item.id, item);
    const ordered = [...unique.values()].sort((a, b) => {
      const first = Date.parse(a.createdAt ?? ''), second = Date.parse(b.createdAt ?? '');
      return Number.isFinite(first) && Number.isFinite(second) ? first - second : 0;
    });
    return { ...trialMetadata, taskBookId: trialMetadata.taskBookId ?? taskBookId, loadSpectrum: trial.loadSpectrum ?? '', records: ordered.map((item, index) => {
      const { data, ...saved } = item;
      return { ...saved, executionNumber: item.executionNumber ?? index + 1, actualConditions: item.actualConditions ?? [], measurements: item.measurements ?? data ?? [], rawFiles: item.rawFiles ?? [], charts: item.charts ?? [], tables: item.tables ?? [] } as TestRecord;
    }) } as ConcreteTrial;
  });
  return { ...metadata, id: legacy.id!, name: legacy.name!, parameters: mergeParameters(settings, legacy.parameters), trials: normalized };
}
export function migratePhysicalState(persisted: unknown): Pick<PhysicalObjectState, 'objects'> {
  const old = (persisted as { objects?: Array<Record<string, unknown>> })?.objects ?? [];
  if (!Array.isArray(old)) throw new Error('物理对象存储格式无效，未覆盖原数据');
  if (old.some(item => Array.isArray(item.configurations))) return { objects: old.map(item => ({ ...item, configurations: (item.configurations as PhysicalConfiguration[]).map(config => ({ ...config, experiments: (config.experiments ?? []).map(migrateExperiment) })) } as PhysicalObject)) };
  const groups = new Map<string, PhysicalObject>();
  for (const item of old) {
    const type = String(item.type || '自定义对象'), familyName = type === '涵道风扇' ? '电涵道风扇' : type;
    const family = groups.get(familyName) ?? blankFamily(familyName, type);
    const config = { ...blankConfig(String(item.name || '默认构型'), String(item.description || '')), ...item, experiments: (Array.isArray(item.experiments) ? item.experiments as LegacyExperiment[] : []).map(migrateExperiment) } as PhysicalConfiguration;
    family.configurations.push(config);groups.set(familyName, family);
  }
  return { objects: [...groups.values()] };
}
export const flattenObjects = (objects: PhysicalObject[], path = ''): Array<{ object: PhysicalConfiguration & { type: string }; path: string }> => objects.flatMap(family => family.configurations.map(config => ({ object: { ...config, type: family.type }, path: `${path ? `${path} / ` : ''}${family.name} / ${config.name}` })));
export const findPhysicalTrialRecord = (objects: PhysicalObject[], configurationId: string, experimentId: string, recordId: string) => flattenObjects(objects).find(({ object }) => object.id === configurationId)?.object.experiments.find(item => item.id === experimentId)?.trials.flatMap(trial => trial.records).find(record => record.id === recordId);
