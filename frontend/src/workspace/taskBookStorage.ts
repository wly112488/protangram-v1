import { flushWorkspacePersistence } from './workspacePersistence';

const fileId = (taskId: string) => `taskbook-${taskId}`;
export const saveTaskBookFile = async (taskId: string, file: Blob): Promise<void> => {
  await flushWorkspacePersistence();
  const current = await fetch(`/api/workspace/files/${encodeURIComponent(fileId(taskId))}`, { method: 'HEAD' });
  if (!current.ok && current.status !== 404) throw new Error('无法确认原任务书附件版本，请重试');
  const revision = current.ok ? Number(current.headers.get('X-Workspace-File-Revision')) : 0;
  if (current.ok && (!Number.isInteger(revision) || revision < 1)) throw new Error('附件版本信息无效，未覆盖原文件');
  const form = new FormData();
  form.set('file', file, file instanceof File ? file.name : '任务书.pdf');
  form.set('taskId', taskId);
  if (revision) form.set('revision', String(revision));
  const response = await fetch(`/api/workspace/files/${encodeURIComponent(fileId(taskId))}`, { method: 'POST', body: form });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) throw new Error(data?.error || '任务书附件未保存');
};
export const loadTaskBookFile = async (taskId: string): Promise<Blob | null> => {
  const response = await fetch(`/api/workspace/files/${encodeURIComponent(fileId(taskId))}`);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('任务书附件读取失败');
  return response.blob();
};
