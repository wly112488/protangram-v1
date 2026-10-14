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
export interface TestRecord { id: string; name: string; description?: string; createdAt: string; actualConditions: ValueField[]; measurements: ValueField[]; rawFiles: RawDataFile[]; charts: DerivedChart[] }
export interface ConcreteTrial { id: string; name: string; description?: string; taskBookId?: string; designArtifactRef?: { projectId: string; artifactId: string }; designs: DesignField[]; record?: TestRecord; archivedRecords?: TestRecord[] }
export interface ExperimentDefinition { id: string; name: string; category: string; description?: string; taskBookId?: string; designArtifactRef?: { projectId: string; artifactId: string }; settings: ValueField[]; parameters: ValueField[]; trials: ConcreteTrial[]; record?: TestRecord; archivedRecords?: TestRecord[] }
export interface CalculationRecord extends TestRecord { inputs: ValueField[] }
export interface Calculation { id: string; name: string; description?: string; inputs: ValueField[]; records: CalculationRecord[] }
export interface SimulationModel { id: string; name: string; description: string; inputs: ValueField[]; outputs: ValueField[]; defaults: ValueField[]; method: string; calculations: Calculation[] }
export interface PhysicalConfiguration {
  id: string; name: string; description: string; basedOnId?: string; parameters: ValueField[]; materials: ValueField[];
  children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}
export interface PhysicalObject {
  id: string; name: string; type: string; description: string; configurations: PhysicalConfiguration[];
  // Kept for future component-level objects; they do not participate in this workflow.
  basedOnId?: string; parameters: ValueField[]; materials: ValueField[]; children: PhysicalObject[]; designs: DesignCase[]; experiments: ExperimentDefinition[]; models: SimulationModel[];
}

const id = (prefix: string) => `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
const blankConfig = (name: string, description = ''): PhysicalConfiguration => ({ id: id('config'), name, description, parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const blankFamily = (name: string, type = '自定义对象', description = ''): PhysicalObject => ({ id: id('object'), name, type, description, configurations: [], parameters: [], materials: [], children: [], designs: [], experiments: [], models: [] });
const initialObjects: PhysicalObject[] = [];

const mapConfig = (items: PhysicalObject[], configId: string, update: (item: PhysicalConfiguration) => PhysicalConfiguration): PhysicalObject[] => items.map(family => ({
  ...family,
  configurations: family.configurations.map(config => config.id === configId ? update(config) : config),
}));
const mapExperiment = (items: PhysicalObject[], experimentId: string, update: (experiment: ExperimentDefinition) => ExperimentDefinition): PhysicalObject[] => items.map(family => ({
  ...family,
  configurations: family.configurations.map(config => ({
    ...config,
    experiments: config.experiments.map(experiment => experiment.id === experimentId ? update(experiment) : experiment),
  })),
}));
const mapConcreteTrial = (items: PhysicalObject[], trialId: string, update: (trial: ConcreteTrial) => ConcreteTrial): PhysicalObject[] => items.map(family => ({
  ...family,
  configurations: family.configurations.map(config => ({
    ...config,
    experiments: config.experiments.map(experiment => ({ ...experiment, trials: (experiment.trials ?? []).map(trial => trial.id === trialId ? update(trial) : trial) })),
  })),
}));

export interface PhysicalObjectState {
  objects: PhysicalObject[];
  addRoot: (input: { name: string; type: string; description?: string }) => string;
  addConfiguration: (familyId: string, input: { name: string; description?: string }) => string | null;
  addField: (configurationId: string, section: 'parameters' | 'materials', item: Omit<ValueField, 'id'>) => void;
  updateField: (configurationId: string, section: 'parameters' | 'materials', fieldId: string, patch: Omit<ValueField, 'id'>) => void;
  addDesign: (configurationId: string, item: Omit<DesignCase, 'id'>) => void;
  addExperiment: (configurationId: string, item: Omit<ExperimentDefinition, 'id' | 'record' | 'trials'> & { trials?: ConcreteTrial[] }) => string;
  addConcreteTrial: (experimentId: string, item: Omit<ConcreteTrial, 'id' | 'record'>) => string;
  updateConcreteTrial: (trialId: string, patch: Partial<Omit<ConcreteTrial, 'id' | 'record'>>) => void;
  updateExperiment: (experimentId: string, patch: Partial<Omit<ExperimentDefinition, 'id' | 'record'>>) => void;
  ensureTrialRecord: (trialId: string, item: { name: string; description?: string; actualConditions: ValueField[]; measurements: ValueField[] }) => string;
  updateTrialRecord: (trialId: string, patch: Partial<Pick<TestRecord, 'name' | 'description' | 'actualConditions' | 'measurements'>>) => void;
  addRawFile: (trialId: string, file: RawDataFile) => void;
  saveChart: (trialId: string, chart: Omit<DerivedChart, 'id' | 'createdAt' | 'updatedAt'>, chartId?: string) => string;
  addModel: (configurationId: string, item: Omit<SimulationModel, 'id' | 'calculations'>) => void;
}

export const usePhysicalObjectStore = create<PhysicalObjectState>()(persist((set, get) => ({
  objects: initialObjects,
  addRoot: input => { const family = blankFamily(input.name, input.type, input.description); set(state => ({ objects: [...state.objects, family] })); return family.id; },
  addConfiguration: (familyId, input) => {
    const family = get().objects.find(item => item.id === familyId);
    if (!family) return null;
    const config = blankConfig(input.name, input.description);
    set(state => ({ objects: state.objects.map(item => item.id === familyId ? { ...item, configurations: [...item.configurations, config] } : item) }));
    return config.id;
  },
  addField: (configurationId, section, item) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: [...config[section], { ...item, id: id('field') }] })) })),
  updateField: (configurationId, section, fieldId, patch) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, [section]: config[section].map(item => item.id === fieldId ? { ...item, ...patch, id: fieldId } : item) })) })),
  addDesign: (configurationId, item) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, designs: [...config.designs, { ...item, id: id('design') }] })) })),
  addExperiment: (configurationId, item) => {
    const experiment = { ...item, id: id('trial-configuration'), trials: item.trials ?? [] };
    set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, experiments: [...config.experiments, experiment] })) }));
    return experiment.id;
  },
  addConcreteTrial: (experimentId, item) => {
    const trial = { ...item, id: id('trial') };
    set(state => ({ objects: mapExperiment(state.objects, experimentId, experiment => ({ ...experiment, trials: [...(experiment.trials ?? []), trial] })) }));
    return trial.id;
  },
  updateConcreteTrial: (trialId, patch) => set(state => ({ objects: mapConcreteTrial(state.objects, trialId, trial => ({ ...trial, ...patch })) })),
  updateExperiment: (experimentId, patch) => set(state => ({ objects: mapExperiment(state.objects, experimentId, experiment => ({ ...experiment, ...patch })) })),
  ensureTrialRecord: (trialId, input) => {
    const existing = get().objects.flatMap(family => family.configurations).flatMap(config => config.experiments).flatMap(experiment => experiment.trials ?? []).find(trial => trial.id === trialId)?.record;
    if (existing) return existing.id;
    const record: TestRecord = { ...input, id: id('record'), createdAt: new Date().toISOString(), actualConditions: input.actualConditions, measurements: input.measurements, rawFiles: [], charts: [] };
    set(state => ({ objects: mapConcreteTrial(state.objects, trialId, trial => trial.record ? trial : { ...trial, record }) }));
    return get().objects.flatMap(family => family.configurations).flatMap(config => config.experiments).flatMap(experiment => experiment.trials ?? []).find(trial => trial.id === trialId)?.record?.id ?? record.id;
  },
  updateTrialRecord: (trialId, patch) => set(state => ({ objects: mapConcreteTrial(state.objects, trialId, trial => trial.record ? { ...trial, record: { ...trial.record, ...patch } } : trial) })),
  addRawFile: (trialId, file) => set(state => ({ objects: mapConcreteTrial(state.objects, trialId, trial => trial.record ? { ...trial, record: { ...trial.record, rawFiles: trial.record.rawFiles.some(item => item.id === file.id) ? trial.record.rawFiles : [...trial.record.rawFiles, file] } } : trial) })),
  saveChart: (trialId, chart, chartId) => {
    const now = new Date().toISOString();
    const idToSave = chartId ?? id('chart');
    set(state => ({ objects: mapConcreteTrial(state.objects, trialId, trial => trial.record ? {
      ...trial,
      record: { ...trial.record, charts: chartId
        ? trial.record.charts.map(item => item.id === chartId ? { ...chart, id: item.id, createdAt: item.createdAt, updatedAt: now } : item)
        : [...trial.record.charts, { ...chart, id: idToSave, createdAt: now, updatedAt: now }] },
    } : trial) }));
    return idToSave;
  },
  addModel: (configurationId, item) => set(state => ({ objects: mapConfig(state.objects, configurationId, config => ({ ...config, models: [...config.models, { ...item, id: id('model'), calculations: [] }] })) })),
}), {
  name: 'protangram-physical-objects-v1', storage: createJSONStorage(() => localStorage), version: 3,
  migrate: (persisted: unknown) => migrateLegacyState(persisted),
}));

function migrateLegacyState(persisted: unknown): Pick<PhysicalObjectState, 'objects'> {
  const state = persisted as { objects?: Array<Record<string, unknown>> };
  const old = Array.isArray(state?.objects) ? state.objects : [];
  if (old.some(item => Array.isArray(item.configurations))) {
    const objects = old.map(item => {
      const configurations = (item.configurations as PhysicalConfiguration[]).map(config => ({
        ...config,
        experiments: (config.experiments ?? []).map(experiment => {
          const legacyRecord = experiment.record;
          const trials = [...(experiment.trials ?? [])];
          if (legacyRecord && !trials.some(trial => trial.record?.id === legacyRecord.id)) trials.unshift({
            id: `trial-${experiment.id}`, name: experiment.name, description: experiment.description,
            taskBookId: experiment.taskBookId, designArtifactRef: experiment.designArtifactRef, designs: [],
            record: legacyRecord, archivedRecords: experiment.archivedRecords ?? [],
          });
          return { ...experiment, trials, record: undefined, archivedRecords: undefined };
        }),
      }));
      return { ...item, configurations } as PhysicalObject;
    });
    return { objects };
  }
  const groups = new Map<string, PhysicalObject>();
  for (const item of old) {
    const type = String(item.type || '自定义对象');
    const familyName = type === '涵道风扇' ? '电涵道风扇' : type;
    const family = groups.get(familyName) ?? blankFamily(familyName, type, '');
    const config = blankConfig(String(item.name || '默认构型'), String(item.description || ''));
    config.id = typeof item.id === 'string' ? item.id : config.id;
    config.basedOnId = typeof item.basedOnId === 'string' ? item.basedOnId : undefined;
    config.parameters = Array.isArray(item.parameters) ? item.parameters as ValueField[] : [];
    config.materials = Array.isArray(item.materials) ? item.materials as ValueField[] : [];
    config.children = Array.isArray(item.children) ? item.children as PhysicalObject[] : [];
    config.designs = Array.isArray(item.designs) ? item.designs as DesignCase[] : [];
    config.models = Array.isArray(item.models) ? item.models as SimulationModel[] : [];
    config.experiments = (Array.isArray(item.experiments) ? item.experiments as Array<Record<string, unknown>> : []).map(legacy => {
      const records = Array.isArray(legacy.records) ? legacy.records as Array<Record<string, unknown>> : [];
      const migrated = records.map(record => ({ id: String(record.id), name: String(record.name), description: typeof record.description === 'string' ? record.description : undefined, createdAt: String(record.createdAt), actualConditions: [], measurements: Array.isArray(record.data) ? record.data as ValueField[] : [], rawFiles: [], charts: [] }));
      const record = migrated[0];
      const trials: ConcreteTrial[] = Array.isArray(legacy.trials) ? legacy.trials as ConcreteTrial[] : record ? [{
        id: `trial-${String(legacy.id)}`, name: String(legacy.name), description: typeof legacy.description === 'string' ? legacy.description : undefined,
        taskBookId: typeof legacy.taskBookId === 'string' ? legacy.taskBookId : undefined, designs: [], record, archivedRecords: migrated.slice(1),
      }] : [];
      return { ...legacy, id: String(legacy.id), name: String(legacy.name), category: String(legacy.category), settings: Array.isArray(legacy.settings) ? legacy.settings as ValueField[] : [], parameters: Array.isArray(legacy.parameters) ? legacy.parameters as ValueField[] : [], trials, record: undefined, archivedRecords: undefined } as ExperimentDefinition;
    });
    family.configurations.push(config);
    groups.set(familyName, family);
  }
  return { objects: old.length ? [...groups.values()] : initialObjects };
}

export const flattenObjects = (objects: PhysicalObject[], path = ''): Array<{ object: PhysicalConfiguration & { id: string; name: string; type: string; description: string; children: PhysicalObject[] }; path: string }> => objects.flatMap(family => {
  const familyPath = path ? `${path} / ${family.name}` : family.name;
  return family.configurations.map(config => ({ object: { ...config, type: family.type, description: config.description, children: config.children }, path: `${familyPath} / ${config.name}` }));
});

export const findPhysicalTrialRecord = (objects: PhysicalObject[], configurationId: string, experimentId: string, recordId: string): TestRecord | undefined => {
  const experiment = flattenObjects(objects).find(({ object }) => object.id === configurationId)?.object.experiments.find(item => item.id === experimentId);
  return [...(experiment?.trials ?? []).flatMap(trial => [trial.record, ...(trial.archivedRecords ?? [])]), experiment?.record, ...(experiment?.archivedRecords ?? [])].find(record => record?.id === recordId);
};
