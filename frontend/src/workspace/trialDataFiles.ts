import { flushWorkspacePersistence } from './workspacePersistence';
import Papa from 'papaparse';

export interface ParsedRawFile { headers: string[]; rows: Record<string, string>[] }

export const parseTrialCsv = (contents: string): ParsedRawFile => {
  const parsed = Papa.parse<Record<string, string>>(contents, { header: true, skipEmptyLines: 'greedy', dynamicTyping: false });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  const rows = parsed.data.filter(row => Object.values(row).some(value => String(value ?? '').trim()));
  return { headers: parsed.meta.fields ?? Object.keys(rows[0] ?? {}), rows };
};

export const buildChartPoints = (rows: Record<string, string>[], xField: string, yField: string, range: { startRow: number; endRow: number; scale: number; offset: number }) => rows
  .slice(Math.max(0, range.startRow), range.endRow > 0 ? range.endRow : undefined)
  .filter(row => String(row[xField] ?? '').trim() !== '' && String(row[yField] ?? '').trim() !== '')
  .map(row => [Number(row[xField]), Number(row[yField]) * range.scale + range.offset])
  .filter(point => point.every(Number.isFinite));

export const saveTrialFile = async (id: string, file: File, scope?: { trialId: string; recordId: string }) => {
  if (!scope) throw new Error('请选择本次执行记录后上传原始文件');
  await flushWorkspacePersistence();
  const form = new FormData();
  form.set('file', file); form.set('trialId', scope.trialId); form.set('recordId', scope.recordId);
  const response = await fetch(`/api/workspace/files/${encodeURIComponent(id)}`, { method: 'POST', body: form });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) throw new Error(result?.error || '原始文件未保存，请重试');
};

export const readTrialFile = async (id: string): Promise<ParsedRawFile> => {
  const response = await fetch(`/api/workspace/files/${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(response.status === 404 ? '数据库中找不到原始文件；历史本机附件需重新上传' : '原始文件读取失败');
  return parseTrialCsv(await response.text());
};
