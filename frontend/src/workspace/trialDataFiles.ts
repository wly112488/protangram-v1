import Papa from 'papaparse';

const DB_NAME = 'protangram-trial-files';
const STORE_NAME = 'files';
const openDatabase = () => new Promise<IDBDatabase>((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1);
  request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('无法打开本地文件存储'));
});

export interface ParsedRawFile { headers: string[]; rows: Record<string, string>[] }

export const parseTrialCsv = (contents: string): ParsedRawFile => {
  const normalized = contents.replace(/(?:\r?\n)+$/, '');
  const parsed = Papa.parse<Record<string, string>>(normalized, { header: true, skipEmptyLines: false, dynamicTyping: false });
  if (parsed.errors.length) throw new Error(parsed.errors[0].message);
  return { headers: parsed.meta.fields ?? Object.keys(parsed.data[0] ?? {}), rows: parsed.data };
};

export const buildChartPoints = (rows: Record<string, string>[], xField: string, yField: string, range: { startRow: number; endRow: number; scale: number; offset: number }) => rows
  .slice(Math.max(0, range.startRow), range.endRow > 0 ? range.endRow : undefined)
  .filter(row => String(row[xField] ?? '').trim() !== '' && String(row[yField] ?? '').trim() !== '')
  .map(row => [Number(row[xField]), Number(row[yField]) * range.scale + range.offset])
  .filter(point => point.every(Number.isFinite));

export const saveTrialFile = async (id: string, file: File) => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put({ id, name: file.name, mimeType: file.type, blob: file });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('文件保存失败'));
      transaction.onabort = () => reject(transaction.error ?? new Error('文件保存已中止'));
    });
  } finally { database.close(); }
};

export const readTrialFile = async (id: string): Promise<ParsedRawFile> => {
  const database = await openDatabase();
  try {
    const entry = await new Promise<{ blob: Blob }>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly');
      const request = transaction.objectStore(STORE_NAME).get(id);
      request.onsuccess = () => request.result ? resolve(request.result) : reject(new Error('找不到原始文件'));
      request.onerror = () => reject(request.error ?? new Error('文件读取失败'));
      transaction.onabort = () => reject(transaction.error ?? new Error('文件读取已中止'));
    });
    return parseTrialCsv(await entry.blob.text());
  } finally { database.close(); }
};
