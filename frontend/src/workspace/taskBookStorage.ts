const DATABASE_NAME = 'protangram-task-book-files';
const DATABASE_VERSION = 1;
const STORE_NAME = 'task-books';

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new Error('当前浏览器不支持本地文件存储'));
    return;
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('无法打开任务书本地存储'));
});

export const saveTaskBookFile = async (taskId: string, file: Blob): Promise<void> => {
  const database = await openDatabase();
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite');
      transaction.objectStore(STORE_NAME).put(file, taskId);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error('任务书保存失败'));
      transaction.onabort = () => reject(transaction.error ?? new Error('任务书保存已取消'));
    });
  } finally {
    database.close();
  }
};

export const loadTaskBookFile = async (taskId: string): Promise<Blob | null> => {
  const database = await openDatabase();
  try {
    return await new Promise<Blob | null>((resolve, reject) => {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(taskId);
      request.onsuccess = () => resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => reject(request.error ?? new Error('任务书读取失败'));
    });
  } finally {
    database.close();
  }
};
