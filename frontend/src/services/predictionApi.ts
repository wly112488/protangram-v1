import { parsePredictionCatalog, parsePredictionTask, type PredictionRequest, type PredictionService, type PredictionTarget, type PredictionTask } from '../workspace/predictionContract';

// Proposed integration contract. The current backend has no /api/prediction routes.
// Missing routes must remain an unavailable service, never a demo fallback.
async function request(path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const response = await fetch(`/api/prediction${path}`, {
    signal, ...(body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if ([404, 405, 501].includes(response.status)) throw new Error('预测服务尚未接入，暂时无法获取适用模型、执行预测或保存结果');
  let json;
  try { json = await response.json(); } catch {
    throw new Error(response.ok ? '预测服务返回了无效响应，请稍后重试' : `预测服务不可用（HTTP ${response.status}），请确认服务已启动并完成接入`);
  }
  if (!response.ok || json?.success !== true) throw new Error(typeof json?.error === 'string' ? json.error : `预测服务请求失败（${response.status}）`);
  return json.data;
}
const query = (service: PredictionService, target: PredictionTarget) => new URLSearchParams({ service, physicalObjectId: target.physicalObjectId, experimentId: target.experimentId }).toString();
export const fetchApplicableModels = async (service: PredictionService, target: PredictionTarget, signal: AbortSignal) => parsePredictionCatalog(await request(`/models?${query(service, target)}`, signal));
export const runPrediction = async (input: PredictionRequest, signal: AbortSignal) => parsePredictionTask(await request('/tasks', signal, input), input);
export async function savePrediction(task: PredictionTask, signal: AbortSignal) {
  const saved = parsePredictionTask(await request(`/tasks/${encodeURIComponent(task.taskId)}/save`, signal, { requestId: task.requestId }), task, true);
  if (saved.taskId !== task.taskId) throw new Error('保存响应的计算任务不匹配');
  return saved;
}
export async function fetchPredictionTasks(service: PredictionService, target: PredictionTarget, signal: AbortSignal) {
  const data = await request(`/tasks?${query(service, target)}`, signal);
  if (!Array.isArray(data)) throw new Error('计算任务列表格式无效');
  return data.map(task => parsePredictionTask(task, { service, targetConfiguration: target }, true));
}
