import type { ValueField } from './physicalObjectStore';

export type PredictionService = 'digitalTwin' | 'virtualCondition';
export interface ConfigurationReference {
  physicalObjectId: string;
  experimentId: string;
  physicalObjectName: string;
  experimentName: string;
}
export interface PredictionTarget extends ConfigurationReference {
  testType?: string;
  objectParameters: ValueField[];
  configurationParameters: ValueField[];
}
export type PredictionValue = string | number;
export interface PredictionInputField {
  key: string;
  label: string;
  type: 'number' | 'text';
  unit?: string;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: PredictionValue;
}
export interface ApplicableModel {
  modelId: string;
  modelName: string;
  version: string;
  sourceConfiguration: ConfigurationReference;
  availability: 'available' | 'not_ready' | 'unavailable';
  recommended?: boolean;
  applicability?: string;
  message?: string;
  inputFields: PredictionInputField[];
}
export interface PredictionCatalog {
  serviceReady: boolean;
  persistenceReady: boolean;
  message?: string;
  models: ApplicableModel[];
}
export interface PredictionRequest {
  requestId: string;
  service: PredictionService;
  targetConfiguration: PredictionTarget;
  model: ApplicableModel;
  inputs: Record<string, PredictionValue>;
}
export interface PredictionTask extends PredictionRequest {
  taskId: string;
  status: 'completed';
  resultMode: 'computed';
  saved: boolean;
  completedAt: string;
  result: {
    summary: string;
    columns: Array<{ key: string; label: string; unit?: string }>;
    rows: Array<Record<string, PredictionValue | null>>;
  };
}
export const modelKey = (model: ApplicableModel) => JSON.stringify([model.modelId, model.version, model.sourceConfiguration.physicalObjectId, model.sourceConfiguration.experimentId]);
export const sameConfiguration = (left: ConfigurationReference, right: ConfigurationReference) => left.physicalObjectId === right.physicalObjectId && left.experimentId === right.experimentId;
export const configurationLabel = (reference: ConfigurationReference) => `${reference.physicalObjectName} / ${reference.experimentName}`;
export const preferredModel = (models: ApplicableModel[]) => {
  const available = models.filter(model => model.availability === 'available');
  const recommended = available.filter(model => model.recommended);
  return available.length === 1 ? available[0] : recommended.length === 1 ? recommended[0] : undefined;
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const nonempty = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());
const reference = (value: unknown): value is ConfigurationReference => object(value) && ['physicalObjectId', 'experimentId', 'physicalObjectName', 'experimentName'].every(key => nonempty(value[key]));
const field = (value: unknown): value is PredictionInputField => object(value) && nonempty(value.key) && nonempty(value.label) && ['number', 'text'].includes(String(value.type))
  && (value.unit === undefined || typeof value.unit === 'string')
  && (value.required === undefined || typeof value.required === 'boolean')
  && [value.min, value.max].every(item => item === undefined || typeof item === 'number' && Number.isFinite(item))
  && (value.min === undefined || value.max === undefined || Number(value.min) <= Number(value.max))
  && (value.defaultValue === undefined || (value.type === 'number' ? typeof value.defaultValue === 'number' && Number.isFinite(value.defaultValue) : typeof value.defaultValue === 'string'));
const validModel = (value: unknown): value is ApplicableModel => object(value) && nonempty(value.modelId) && nonempty(value.modelName) && nonempty(value.version)
  && (value.recommended === undefined || typeof value.recommended === 'boolean')
  && [value.applicability, value.message].every(item => item === undefined || typeof item === 'string')
  && reference(value.sourceConfiguration) && ['available', 'not_ready', 'unavailable'].includes(String(value.availability))
  && Array.isArray(value.inputFields) && value.inputFields.every(field) && new Set(value.inputFields.map(item => item.key)).size === value.inputFields.length;
export function parsePredictionCatalog(value: unknown): PredictionCatalog {
  if (!object(value) || typeof value.serviceReady !== 'boolean' || typeof value.persistenceReady !== 'boolean' || (value.message !== undefined && typeof value.message !== 'string') || !Array.isArray(value.models) || !value.models.every(validModel)
    || new Set(value.models.map(modelKey)).size !== value.models.length) throw new Error('模型服务返回的数据不完整，无法确认模型来源或输入要求');
  return value as unknown as PredictionCatalog;
}
const targetSnapshot = (value: unknown): value is PredictionTarget => reference(value) && object(value) && [value.objectParameters, value.configurationParameters].every(items => Array.isArray(items) && items.every(item => object(item) && nonempty(item.id) && nonempty(item.name) && typeof item.value === 'string'))
  && (value.testType === undefined || typeof value.testType === 'string');
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => object(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
export function parsePredictionTask(value: unknown, expected: Pick<PredictionRequest, 'service' | 'targetConfiguration'> & Partial<PredictionRequest>, requireSaved = false): PredictionTask {
  if (!object(value) || !nonempty(value.taskId) || !nonempty(value.requestId) || value.service !== expected.service || value.status !== 'completed' || value.resultMode !== 'computed'
    || typeof value.saved !== 'boolean' || requireSaved && !value.saved || !nonempty(value.completedAt) || !Number.isFinite(Date.parse(value.completedAt))
    || !targetSnapshot(value.targetConfiguration) || !sameConfiguration(value.targetConfiguration, expected.targetConfiguration)
    || !validModel(value.model) || !object(value.inputs) || !Object.values(value.inputs).every(item => typeof item === 'string' || typeof item === 'number' && Number.isFinite(item))
    || !object(value.result) || !nonempty(value.result.summary) || !Array.isArray(value.result.columns) || !value.result.columns.length
    || !value.result.columns.every(column => object(column) && nonempty(column.key) && nonempty(column.label) && (column.unit === undefined || typeof column.unit === 'string'))
    || new Set(value.result.columns.map(column => column.key)).size !== value.result.columns.length
    || !Array.isArray(value.result.rows) || !value.result.rows.length
    || !value.result.rows.every(row => object(row) && Object.values(row).every(item => item === null || typeof item === 'string' || typeof item === 'number' && Number.isFinite(item)))
    || expected.requestId && (value.requestId !== expected.requestId || canonical(value.targetConfiguration) !== canonical(expected.targetConfiguration)) || expected.model && modelKey(value.model as ApplicableModel) !== modelKey(expected.model)
    || expected.inputs && canonical(value.inputs) !== canonical(expected.inputs)) throw new Error('预测结果来源、输入或计算状态不匹配，未保存为预测成果');
  return value as unknown as PredictionTask;
}
