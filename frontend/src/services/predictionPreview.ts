import { predictionInputs, type PredictionPreviewTask, type PredictionRequest } from '../workspace/predictionContract';
import { predictionParameterError, predictionPreparation } from '../workspace/predictionParameters';

// Frontend presentation flow. Remote service contracts remain in predictionApi;
// preview results never claim to be service-computed or to use raw CSV values.
export async function runPredictionPreview(input: PredictionRequest, signal: AbortSignal): Promise<PredictionPreviewTask> {
  signal.throwIfAborted();
  if (!input.context) throw new Error('当前试验上下文不可用');
  if(input.modelPlan&&(input.modelPlan.cfgId!==input.context.scope.cfgId||input.modelPlan.trialId!==input.context.scope.trialId||!input.modelPlan.objectIds.includes(input.targetConfiguration.physicalObjectId))) throw new Error('模型方案与当前试验来源不匹配');
  const preparation = predictionPreparation(input.service, input.context);
  const inputs = predictionInputs(preparation, input.inputs);
  const invalid = predictionParameterError(inputs);
  if (invalid) throw new Error(invalid);
  for (const field of preparation.inputFields) {
    const value = inputs[field.key];
    if (typeof value !== 'number' || !Number.isFinite(value) || field.min !== undefined && value < field.min || field.max !== undefined && value > field.max) throw new Error(`请检查${field.label}`);
  }
  const virtual = input.service === 'virtualCondition';
  const count = virtual ? Number(inputs.count) : 1;
  const interpolate = (key: string, ratio: number) => Number(inputs[`${key}Min`]) + (Number(inputs[`${key}Max`]) - Number(inputs[`${key}Min`])) * ratio;
  const round = (value: number) => Number(value.toFixed(2));
  const rows = Array.from({ length: count }, (_, index) => {
    const ratio = count === 1 ? 0 : index / (count - 1);
    const speed = virtual ? interpolate('speed', ratio) : Number(inputs.speed);
    const temperature = virtual ? interpolate('temperature', ratio) : Number(inputs.temperature);
    const pressure = virtual ? interpolate('pressure', ratio) : Number(inputs.pressure);
    // Illustrative values respond to the requested conditions, not a physical model.
    const thrust = 18.2 * (speed / 3500) ** 2 * (virtual ? pressure / 1.5 : pressure / 101.3) * (298.15 / Math.max(1, temperature + 273.15));
    return { condition: index + 1, speed: round(speed), temperature: round(temperature), pressure: round(pressure), thrust: round(thrust) };
  });
  return {
    requestId: input.requestId, taskId: `preview:${input.service}:${input.requestId}`, service: input.service,
    targetConfiguration: structuredClone(input.targetConfiguration), context: structuredClone(input.context), inputs,
    ...(input.modelPlan?{modelPlan:structuredClone(input.modelPlan)}:{}),
    inputFields: preparation.inputFields, status: 'completed', resultMode: 'demo', saved: false, completedAt: new Date().toISOString(),
    result: {
      summary: `${virtual ? '虚拟工况扩展' : '数字孪生'}演示计算完成，共 ${count} 组目标工况。`,
      columns: [{ key: 'condition', label: '工况' }, { key: 'speed', label: '转速', unit: 'rpm' }, { key: 'temperature', label: '温度', unit: '℃' }, { key: 'pressure', label: '压力', unit: virtual ? 'MPa' : 'kPa' }, { key: 'thrust', label: '示例推力', unit: 'N' }],
      rows,
    },
  };
}

// The existing shared artifact store performs the persistent write, using the
// same task identity for retries. No second task/data collection is created.
export async function savePredictionPreview(task: PredictionPreviewTask, signal: AbortSignal): Promise<PredictionPreviewTask> {
  signal.throwIfAborted();
  return { ...task, saved: true };
}
