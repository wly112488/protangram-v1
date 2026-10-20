export type WorkspaceKind = 'physical' | 'projects' | 'tasks' | 'sessions';
export type WorkspaceRole = 'admin' | 'experimenter';
type Snapshot = Record<string, unknown> | null;
interface WorkspaceResponse {
  states?: Partial<Record<WorkspaceKind, Snapshot>>;
  revisions: Partial<Record<WorkspaceKind, number>>;
  access?: { role: WorkspaceRole; identityMode?: string };
}
type Request = (url: string, options?: { method: string; body: string }) => Promise<WorkspaceResponse>;
export interface PersistenceStatus {
  ready: boolean;
  pending: number;
  error: string | null;
  conflict: boolean;
  role: WorkspaceRole;
  identityMode: string;
}

// Acknowledged database values are the rollback boundary, never optimistic UI state.
export class WorkspacePersistence {
  status: PersistenceStatus = { ready: false, pending: 0, error: null, conflict: false, role: 'experimenter', identityMode: 'unavailable' };
  private values = new Map<WorkspaceKind, Snapshot>();
  private revisions: Partial<Record<WorkspaceKind, number>> = {};
  private dirty = new Map<WorkspaceKind, Snapshot>();
  private restorers = new Map<WorkspaceKind, (value: Snapshot) => void>();
  private inFlight: Promise<void> | null = null;
  private initialization: Promise<void> | null = null;
  private transactionQueue: Promise<unknown> = Promise.resolve();
  private batch = 0;
  private restoring = false;
  private sending = 0;
  private sendingValues = new Map<WorkspaceKind, Snapshot>();
  private request: Request;
  private onStatus: (status: PersistenceStatus) => void;
  constructor(request: Request, onStatus: (status: PersistenceStatus) => void = () => {}) { this.request = request; this.onStatus = onStatus; }
  private notify(patch: Partial<PersistenceStatus> = {}) {
    this.status = { ...this.status, ...patch, pending: this.dirty.size + this.sending };
    this.onStatus(this.status);
  }
  register(kind: WorkspaceKind, restore: (value: Snapshot) => void) { this.restorers.set(kind, restore); }
  read(kind: WorkspaceKind): Snapshot { return structuredClone(this.values.get(kind) ?? null); }
  initialize(): Promise<void> {
    if (this.status.ready) return Promise.resolve();
    if (this.initialization) return this.initialization;
    this.initialization = (async () => {
      try {
        const response = await this.request('/api/workspace');
        if (!response.states || !response.access || !response.revisions) throw new Error('工作台接口返回了无效数据');
        this.revisions = response.revisions;
        for (const kind of ['physical', 'projects', 'tasks', 'sessions'] as const) this.values.set(kind, response.states[kind] ?? null);
        this.notify({ ready: true, error: null, role: response.access.role === 'admin' ? 'admin' : 'experimenter', identityMode: response.access.identityMode ?? 'unavailable' });
      } catch (error) {
        this.notify({ error: error instanceof Error ? error.message : '无法读取工作台数据库' });
        throw error;
      } finally { this.initialization = null; }
    })();
    return this.initialization;
  }
  write(kind: WorkspaceKind, value: Snapshot) {
    if (this.restoring) return;
    if (!this.status.ready) throw new Error('数据库尚未加载，未保存本次更改');
    const latest = this.dirty.has(kind) ? this.dirty.get(kind) : this.sendingValues.has(kind) ? this.sendingValues.get(kind) : this.values.get(kind);
    if (JSON.stringify(value) === JSON.stringify(latest)) return;
    this.dirty.set(kind, structuredClone(value));
    this.notify();
    queueMicrotask(() => { if (!this.batch && !this.status.error) void this.flush().catch(() => {}); });
  }
  async flush(legacyImport = false): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!this.dirty.size) return;
    if (this.status.error) throw new Error(this.status.error);
    this.inFlight = Promise.resolve().then(async () => {
      while (this.dirty.size) {
        const changes = new Map(this.dirty);
        this.dirty.clear(); this.sendingValues = changes; this.sending = changes.size; this.notify();
        try {
          const response = await this.request('/api/workspace/commit', {
            method: 'POST', body: JSON.stringify({ changes: Object.fromEntries([...changes].map(([kind, value]) => [kind, { value, revision: this.revisions[kind] ?? 0 }])), ...(legacyImport ? { legacyImport: true } : {}) }),
          });
          for (const [kind, value] of changes) {
            this.values.set(kind, value);
            this.revisions[kind] = response.revisions[kind];
          }
          this.sendingValues.clear(); this.sending = 0; this.notify({ error: null, conflict: false });
        } catch (error) {
          for (const [kind, value] of changes) if (!this.dirty.has(kind)) this.dirty.set(kind, value);
          this.sendingValues.clear(); this.sending = 0;
          this.notify({ error: error instanceof Error ? error.message : '数据库保存失败', conflict: (error as { code?: string })?.code === 'REVISION_CONFLICT' });
          throw error;
        }
      }
    }).finally(() => { this.inFlight = null; });
    return this.inFlight;
  }
  async retry() {
    if (this.status.conflict) throw new Error(this.status.error ?? '数据已被修改，请重新加载');
    if (!this.status.ready) return this.initialize();
    this.notify({ error: null });
    await this.flush();
  }
  transaction<T>(change: () => T | Promise<T>, options: { legacyImport?: boolean } = {}): Promise<T> {
    const run = async () => {
      await this.flush();
      this.notify({ error: null });
      this.batch++;
      try {
        const result = await change();
        this.batch--;
        await this.flush(Boolean(options.legacyImport));
        return result;
      } catch (error) {
        if (this.batch) this.batch--;
        this.dirty.clear();
        this.restoring = true;
        try { for (const [kind, restore] of this.restorers) restore(this.read(kind)); }
        finally { this.restoring = false; }
        this.notify({ error: error instanceof Error ? error.message : '更改未保存', conflict: (error as { code?: string })?.code === 'REVISION_CONFLICT' });
        throw error;
      }
    };
    const next = this.transactionQueue.then(run, run);
    this.transactionQueue = next.catch(() => {});
    return next;
  }
}
