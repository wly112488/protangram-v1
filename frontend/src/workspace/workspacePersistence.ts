import { create } from 'zustand';
import type { StateStorage } from 'zustand/middleware';
import { WorkspacePersistence, type PersistenceStatus, type WorkspaceKind } from './workspacePersistenceCore';

export const databasePersistenceEnabled = typeof window !== 'undefined' && typeof document !== 'undefined';
let hydrating = databasePersistenceEnabled;
const kinds: Record<string, WorkspaceKind> = {
  'protangram-physical-objects-v1': 'physical',
  'protangram-project-workspace-v1': 'projects',
  'protangram-task-workspace-v1': 'tasks',
  'protangram-work-sessions-v1': 'sessions',
};
interface WorkspacePersistenceState extends PersistenceStatus {
  legacyDataAvailable: boolean;
  migrationWarnings: string[];
  retry: () => Promise<void>;
}
export const useWorkspacePersistence = create<WorkspacePersistenceState>(() => ({
  ready: !databasePersistenceEnabled, pending: 0, error: null, conflict: false, role: 'experimenter', identityMode: 'unavailable', legacyDataAvailable: false, migrationWarnings: [],
  retry: async () => { await initializeWorkspacePersistence(); await controller.retry(); },
}));
const controller = new WorkspacePersistence(async (url, options) => {
  const response = await fetch(url, options ? { ...options, headers: { 'Content-Type': 'application/json' } } : undefined);
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) throw Object.assign(new Error(body?.error || `数据库请求失败（${response.status}）`), { status: response.status, code: body?.code });
  return body.data;
}, status => useWorkspacePersistence.setState({ ...status, ready: status.ready && !hydrating }));

export const workspaceStorage: StateStorage = {
  getItem: name => {
    if (!databasePersistenceEnabled) return globalThis.localStorage?.getItem(name) ?? null;
    const value = controller.read(kinds[name]);
    return value === null ? null : JSON.stringify(value);
  },
  setItem: (name, value) => {
    if (!databasePersistenceEnabled) { globalThis.localStorage?.setItem(name, value); return; }
    if (hydrating) return;
    controller.write(kinds[name], JSON.parse(value));
  },
  removeItem: name => {
    if (!databasePersistenceEnabled) { globalThis.localStorage?.removeItem(name); return; }
    controller.write(kinds[name], null);
  },
};

let boot: Promise<void> | null = null;
export async function initializeWorkspacePersistence(): Promise<void> {
  if (!databasePersistenceEnabled) return;
  if (boot) return boot;
  boot = (async () => {
    const [{ usePhysicalObjectStore }, { useProjectStore }, { useTaskStore }, { useSessionStore }] = await Promise.all([
      import('./physicalObjectStore'), import('./projectStore'), import('./taskStore'), import('./sessionStore'),
    ]);
    const defaults = {
      physical: usePhysicalObjectStore.getState().objects,
      projects: { projects: [], activeProjectId: null, activeView: 'overview' as const },
      tasks: { tasks: [] },
      sessions: { sessions: [], activeSessionId: null, saveError: null },
    };
    controller.register('physical', value => usePhysicalObjectStore.setState((value?.state as { objects: typeof defaults.physical }) ?? { objects: defaults.physical }));
    controller.register('projects', value => useProjectStore.setState((value?.state as typeof defaults.projects) ?? defaults.projects));
    controller.register('tasks', value => useTaskStore.setState((value?.state as typeof defaults.tasks) ?? defaults.tasks));
    controller.register('sessions', value => useSessionStore.setState(value ? { sessions: value.sessions as ReturnType<typeof useSessionStore.getState>['sessions'], activeSessionId: value.activeSessionId as string | null, saveError: null } : defaults.sessions));
    await controller.initialize();
    // Hydration reads acknowledged server values; it never imports local data implicitly.
    await Promise.all([usePhysicalObjectStore.persist.rehydrate(), useProjectStore.persist.rehydrate(), useTaskStore.persist.rehydrate()]);
    useSessionStore.getState().reloadFromStorage();
    hydrating = false;
    useWorkspacePersistence.setState({ ...controller.status, ready: true });
    const legacyDataAvailable = Object.keys(kinds).some(name => {
      try {
        const raw = localStorage.getItem(name);
        if (!raw) return false;
        const value = JSON.parse(raw);
        return Boolean(value?.state?.objects?.some((item: { configurations?: unknown[] }) => item.configurations?.length) || value?.state?.projects?.length || value?.state?.tasks?.length || value?.sessions?.length);
      } catch { return false; }
    });
    useWorkspacePersistence.setState({ legacyDataAvailable });
  })().catch(error => { boot = null; throw error; });
  return boot;
}

export const flushWorkspacePersistence = () => databasePersistenceEnabled ? controller.flush() : Promise.resolve();
export const commitWorkspaceChange = <T,>(change: () => T | Promise<T>): Promise<T> => databasePersistenceEnabled ? controller.transaction(change) : Promise.resolve().then(change);

export async function importLegacyWorkspace() {
  if (useWorkspacePersistence.getState().role !== 'admin') throw new Error('请由管理员导入原有数据');
  const [{ usePhysicalObjectStore, migratePhysicalState }, { useProjectStore }, { useTaskStore }, { useSessionStore }] = await Promise.all([
    import('./physicalObjectStore'), import('./projectStore'), import('./taskStore'), import('./sessionStore'),
  ]);
  if (usePhysicalObjectStore.getState().objects.some(item => item.configurations.length) || useProjectStore.getState().projects.length || useTaskStore.getState().tasks.length || useSessionStore.getState().sessions.length) throw new Error('数据库已有业务数据，不能直接覆盖导入');
  await controller.transaction(() => {
    for (const [name, kind] of Object.entries(kinds)) {
      const raw = localStorage.getItem(name);
      if (!raw) continue;
      const value = JSON.parse(raw);
      if (kind === 'physical') usePhysicalObjectStore.setState(migratePhysicalState(value.state));
      if (kind === 'projects') useProjectStore.setState(value.state);
      if (kind === 'tasks') useTaskStore.setState(value.state);
      if (kind === 'sessions') { useSessionStore.setState({ sessions: value.sessions, activeSessionId: value.activeSessionId }); workspaceStorage.setItem(name, raw); }
    }
  }, { legacyImport: true });
  const warnings: string[] = [];
  for (const category of usePhysicalObjectStore.getState().objects) for (const object of category.configurations) for (const config of object.experiments) for (const trial of config.trials) {
    const names = new Set<string>();
    for (const result of [...trial.charts, ...trial.records.flatMap(record => record.tables)]) {
      const normalized = result.name.trim().normalize('NFC').toLocaleLowerCase();
      if (names.has(normalized)) warnings.push(`${trial.name}：历史成果“${result.name}”重名，请在来源记录中修改名称`);
      names.add(normalized);
    }
  }
  useWorkspacePersistence.setState({ legacyDataAvailable: false, migrationWarnings: warnings });
}
