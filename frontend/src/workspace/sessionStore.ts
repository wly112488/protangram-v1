import { create } from 'zustand';
import type { BusinessRouteState, ModelContract, WorkspaceSessionState } from '../types/businessContext';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { getProjectDeletionBlock, getSessionWorkspaceContext, isCompatibleSessionHandoff, getSessionDraftKey, type SessionCapability, type PhysicalBusinessScope, type SessionCreationSource, type WorkSession } from './sessionModel';
import { resolvePhysicalSource, samePhysicalSource } from './physicalBusinessContext';
import { usePhysicalObjectStore } from './physicalObjectStore';

export const SESSION_STORAGE_KEY = 'protangram-work-sessions-v1';
const createSessionId = () => `session-${typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;

const load = (): { sessions: WorkSession[]; activeSessionId: string | null; saveError: string | null } => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data) return { sessions: [], activeSessionId: null, saveError: null };
    if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('invalid session data');
    const sessions = (data.sessions as Array<WorkSession & { creationSource?: SessionCreationSource }>).map(session => ({
      ...session,
      creationSource: session.creationSource ?? (session.taskId ? 'task' : session.projectId ? 'project' : 'standalone'),
    }));
    return { sessions, activeSessionId: data.activeSessionId ?? null, saveError: null };
  } catch {
    return { sessions: [], activeSessionId: null, saveError: '本机会话存储不可用，请检查浏览器存储后重试' };
  }
};

interface SessionStore {
  sessions: WorkSession[];
  activeSessionId: string | null;
  saveError: string | null;
  createSession: (input?: { title?: string; projectId?: string; creationSource?: SessionCreationSource; initialDrafts?: WorkSession['drafts']; businessScope?: PhysicalBusinessScope }) => string;
  ensureTaskSession: (task: { id: string; title: string; projectId: string }, businessScope?: PhysicalBusinessScope) => string;
  ensureProjectSession: (projectId: string, businessScope?: PhysicalBusinessScope) => string;
  ensurePhysicalSession: (scope: PhysicalBusinessScope, title: string) => string;
  getWorkspaceSession: (id: string) => WorkspaceSessionState | undefined;
  openSession: (id: string | null, capability?: SessionCapability) => void;
  renameSession: (id: string, title: string) => void;
  moveSession: (id: string, projectId?: string) => void;
  togglePinned: (id: string) => void;
  archiveSession: (id: string, archived: boolean) => void;
  deleteSession: (id: string) => void;
  deleteProjectGroup: (projectId: string) => boolean;
  updateDraft: (id: string, capability: SessionCapability, key: string, value: unknown) => void;
  setHandoff: (id: string, capability: SessionCapability, value: Record<string, unknown>, resetDraft?: boolean) => void;
  retrySave: () => void;
  reloadFromStorage: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => {
  const commit = (sessions: WorkSession[], activeSessionId = get().activeSessionId) => {
    let saveError: string | null = null;
    try {
      // Artifact writes happen in the original project store. Confirm those writes
      // too before claiming that this work context is saved locally.
      const projects = useProjectStore.getState();
      localStorage.setItem('protangram-project-workspace-v1', JSON.stringify({ version: 1, state: {
        projects: projects.projects, activeProjectId: projects.activeProjectId, activeView: projects.activeView,
      } }));
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ version: 1, sessions, activeSessionId }));
    } catch { saveError = '保存失败：本机存储不可用或空间不足，当前更改尚未保存'; }
    set({ sessions, activeSessionId, saveError });
  };
  const update = (id: string, fn: (session: WorkSession) => WorkSession) => commit(get().sessions.map(session =>
    session.id === id ? { ...fn(session), updatedAt: new Date().toISOString() } : session));
  const create = (input: { title?: string; projectId?: string; taskId?: string; storageProjectId?: string; creationSource?: SessionCreationSource; initialDrafts?: WorkSession['drafts']; businessScope?: PhysicalBusinessScope }) => {
    const id = createSessionId();
    const title = input.title?.trim() || '新会话';
    const storageProjectId = input.storageProjectId ?? useProjectStore.getState().createProject({
      name: title, sessionOwnerId: id, description: '会话数据与成果', status: '进行中',
    });
    const now = new Date().toISOString();
    commit([...get().sessions, { id, title, projectId: input.projectId, taskId: input.taskId, creationSource: input.creationSource ?? (input.taskId ? 'task' : input.projectId ? 'project' : 'standalone'), storageProjectId, businessScope: input.businessScope,
      capability: input.taskId ? 'task' : 'overview', pinned: false, archived: false,
      createdAt: now, updatedAt: now,
      drafts: input.initialDrafts ? JSON.parse(JSON.stringify(input.initialDrafts)) as WorkSession['drafts'] : {},
      handoffs: {},
    }], id);
    return id;
  };
  return {
    ...load(),
    createSession: (input = {}) => create(input),
    ensurePhysicalSession: (scope, title) => {
      if (!scope.physicalObjectId) return create({ title });
      const existing = get().sessions.find(session => !session.taskId && !session.archived && samePhysicalSource(session.businessScope, scope));
      if (existing) update(existing.id, session => ({ ...session, businessScope: { ...session.businessScope, ...scope } }));
      return existing?.id ?? create({ title, businessScope: scope });
    },
    ensureTaskSession: (task, businessScope) => {
      const existing = get().sessions.find(session => session.taskId === task.id);
      if (existing) {
        if (businessScope) update(existing.id, session => ({ ...session, businessScope: { ...session.businessScope, ...businessScope } }));
        return existing.id;
      }
      return create({ title: task.title, projectId: task.projectId, taskId: task.id, storageProjectId: task.projectId, businessScope });
    },
    ensureProjectSession: (projectId, businessScope) => {
      const existing = get().sessions.find(session => !session.taskId && session.storageProjectId === projectId
        && (!businessScope || !session.businessScope || samePhysicalSource(session.businessScope, businessScope)));
      if (existing) {
        if (businessScope) update(existing.id, session => ({ ...session, businessScope: { ...session.businessScope, ...businessScope } }));
        return existing.id;
      }
      const project = useProjectStore.getState().projects.find(item => item.id === projectId);
      return create({ title: businessScope?.trialName ?? project?.name ?? '项目成果', projectId, storageProjectId: projectId, businessScope });
    },
    getWorkspaceSession: (id) => {
      const session = get().sessions.find(item => item.id === id);
      if (!session) return undefined;
      const context = getSessionWorkspaceContext(session);
      const source = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, session.businessScope);
      return source.configuration && !source.missing ? { ...context,
        physicalObjectName: source.configuration.name, experimentName: source.experiment?.name,
        trialName: source.trial?.name, testRecordName: source.record?.name,
        ...(source.trial ? { taskBookId: source.trial.taskBookId, taskBookName: useTaskStore.getState().tasks.find(task => task.id === source.trial?.taskBookId)?.title } : {}),
      } : context;
    },
    openSession: (id, capability) => {
      if (get().activeSessionId === id && (!capability || get().sessions.find(s => s.id === id)?.capability === capability)) return;
      commit(get().sessions.map(session => session.id === id ? { ...session, capability: capability ?? session.capability } : session), id);
    },
    renameSession: (id, title) => { if (title.trim()) update(id, session => ({ ...session, title: title.trim() })); },
    moveSession: (id, projectId) => update(id, session => ({ ...session, projectId })),
    togglePinned: (id) => update(id, session => ({ ...session, pinned: !session.pinned })),
    archiveSession: (id, archived) => update(id, session => ({ ...session, archived })),
    // Keep artifact spaces: existing reports and task evidence may reference them.
    deleteSession: (id) => commit(get().sessions.filter(session => session.id !== id), get().activeSessionId === id ? null : get().activeSessionId),
    deleteProjectGroup: (projectId) => {
      if (getProjectDeletionBlock(projectId, get().sessions, useTaskStore.getState().tasks)) return false;
      const remaining = get().sessions.filter(session => session.projectId !== projectId);
      useProjectStore.getState().deleteProject(projectId);
      commit(remaining, remaining.some(session => session.id === get().activeSessionId) ? get().activeSessionId : null);
      return true;
    },
    updateDraft: (id, capability, key, value) => update(id, session => ({ ...session, drafts: {
      ...session.drafts, [capability]: { ...session.drafts[capability], [key]: value },
    } })),
    setHandoff: (id, capability, value, resetDraft = false) => {
      const current = get().sessions.find(item => item.id === id);
      if (!current || !isCompatibleSessionHandoff(getSessionWorkspaceContext(current), value as unknown as BusinessRouteState)) return;
      update(id, session => {
      const prefix = getSessionDraftKey('', value.workspaceSession as WorkspaceSessionState | undefined);
      const remaining = Object.fromEntries(Object.entries(session.drafts[capability] ?? {}).filter(([key]) =>
        key === 'assistantHistory' || key.endsWith(':assistantHistory') || key.startsWith('report:') || key.includes(':report:')
          || (prefix ? !key.startsWith(prefix) : key.startsWith('item:') || key.startsWith('professional:'))));
      const drafts = resetDraft ? { ...session.drafts, [capability]: remaining } : { ...session.drafts };
      const model = value.model as ModelContract | undefined;
      if (Array.isArray(value.artifactIds) && value.artifactIds.length && model?.modelId) {
        const overview = drafts.overview ?? {};
        const updates = overview.modelUpdates as Record<string, Partial<ModelContract>> | undefined;
        // Explicitly adopting a saved result establishes the model's starting version.
        // Later calibration updates this patch, rather than being masked by the handoff.
        drafts.overview = { ...overview, modelUpdates: { ...updates, [model.modelId]: {
          version: model.version, trustedRange: model.trustedRange, measuredRange: model.measuredRange,
          status: model.status, calibratedAt: model.calibratedAt, calibrationData: model.calibrationData,
        } } };
      }
      return { ...session, handoffs: { ...session.handoffs, [capability]: value }, drafts };
      });
    },
    retrySave: () => commit(get().sessions),
    reloadFromStorage: () => set(load()),
  };
});

// Preserve existing artifact APIs while reflecting their save failures in the
// active workbench. No store mutation occurs inside the storage write itself.
useProjectStore.subscribe((state, previous) => {
  if (state.projects !== previous.projects) useSessionStore.getState().retrySave();
});
