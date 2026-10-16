import type { ProfessionalDataContext } from './professionalContext';
import type { PredictionInputField, PredictionPreparation, PredictionService } from './predictionContract';

// These are the existing business inputs of the two functions. Opening a form
// must not depend on a model catalog or a service-readiness request.
const number = (key: string, label: string, unit: string, defaultValue: number, min?: number): PredictionInputField => ({ key, label, type: 'number', required: true, unit, defaultValue, min });
const parameters: Record<PredictionService, PredictionInputField[]> = {
  digitalTwin: [
    number('speed', '目标转速', 'rpm', 3000, 0),
    number('temperature', '环境温度', '℃', 25),
    number('pressure', '环境压力', 'kPa', 101.3, 0),
  ],
  virtualCondition: [
    number('speedMin', '转速下限', 'rpm', 8000, 0),
    number('speedMax', '转速上限', 'rpm', 10000, 0),
    number('temperatureMin', '温度下限', '℃', 80),
    number('temperatureMax', '温度上限', '℃', 120),
    number('pressureMin', '压力下限', 'MPa', 1.5, 0),
    number('pressureMax', '压力上限', 'MPa', 2.2, 0),
    number('count', '工况数量', '', 36, 1),
  ],
};
const aliases: Record<string, string[]> = {
  speed: ['转速'], temperature: ['温度'], pressure: ['压力'],
};

export function predictionPreparation(service: PredictionService, context: ProfessionalDataContext): PredictionPreparation {
  const inputFields = parameters[service];
  const currentRecord = context.records.find(record => record.id === context.scope.testRecordId);
  const inherited = [...(currentRecord?.actualConditions ?? []), ...context.configurationParameters, ...context.objectParameters];
  const initialValues = Object.fromEntries(inputFields.flatMap(field => {
    for (const value of inherited) {
      if (!value || typeof value !== 'object') continue;
      const parameter = value as { id?: string; name?: string; value?: unknown; unit?: string; form?: string };
      if (parameter.id !== field.key && parameter.name !== field.label && !aliases[field.key]?.includes(parameter.name ?? '')) continue;
      if ((parameter.unit ?? '') !== (field.unit ?? '') || parameter.form && parameter.form !== '单值') continue;
      if (typeof parameter.value !== 'string' && typeof parameter.value !== 'number' || String(parameter.value).trim() === '') continue;
      const numeric = Number(parameter.value);
      if (!Number.isFinite(numeric) || field.min !== undefined && numeric < field.min || field.key === 'count' && !Number.isInteger(numeric)) continue;
      return [[field.key, numeric]];
    }
    return [];
  }));
  for (const key of ['speed', 'temperature', 'pressure']) {
    if (Number(initialValues[`${key}Min`]) > Number(initialValues[`${key}Max`])) {
      delete initialValues[`${key}Min`];
      delete initialValues[`${key}Max`];
    }
  }
  // A measured condition can prefill a target; it must not lock the target.
  // The original configuration and measurements remain in the request context.
  return { inputFields: inputFields.map(field => ({ ...field, defaultValue: initialValues[field.key] ?? field.defaultValue })), inheritedInputs: {} };
}

export function predictionParameterError(inputs: Record<string, string | number>) {
  for (const [key, label] of [['speed', '转速'], ['temperature', '温度'], ['pressure', '压力']]) {
    if (Number(inputs[`${key}Min`]) > Number(inputs[`${key}Max`])) return `${label}上限不能小于下限`;
  }
  if (inputs.count !== undefined && (!Number.isInteger(inputs.count) || Number(inputs.count) < 1)) return '工况数量请输入正整数';
  return '';
}
