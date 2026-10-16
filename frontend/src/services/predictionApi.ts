import { parsePredictionTask, type PredictionRequest, type PredictionTask } from '../workspace/predictionContract';

// Model matching and service selection stay on the backend.
async function request(path: string, signal: AbortSignal, body: unknown, failureMessage: string): Promise<unknown> {
  try {
    const response = await fetch(`/api/prediction${path}`, { signal, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!response.ok) throw new Error(failureMessage);
    const json = await response.json();
    if (json?.success !== true) throw new Error(failureMessage);
    return json.data;
  } catch (error) {
    if (signal.aborted) throw error;
    throw new Error(failureMessage);
  }
}
export const runPrediction = async (input: PredictionRequest, signal: AbortSignal) => parsePredictionTask(await request('/tasks', signal, input, '本次计算未完成，请重试'), input);
export async function savePrediction(task: PredictionTask, signal: AbortSignal) {
  const saved = parsePredictionTask(await request(`/tasks/${encodeURIComponent(task.taskId)}/save`, signal, { requestId: task.requestId }, '本次成果未保存，请重试'), task, true);
  if (saved.taskId !== task.taskId) throw new Error('保存结果不匹配，请重试');
  return saved;
}
