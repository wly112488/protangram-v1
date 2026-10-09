import { create } from 'zustand';
import type { WorkspaceSessionState } from '../types/businessContext';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { getProjectDeletionBlock, getSessionWorkspaceContext, getSessionDraftKey, type SessionCapability, type WorkSession } from './sessionModel';

export const SESSION_STORAGE_KEY = 'protangram-work-sessions-v1';

const load = (): { sessions: WorkSession[]; activeSessionId: string | null; saveError: string | null } => {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    const data = raw ? JSON.parse(raw) : null;
    if (!data) return { sessions: [], activeSessionId: null, saveError: null };
    if (data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('invalid session data');
    return { sessions: data.sessions, activeSessionId: data.activeSessionId ?? null, saveError: null };
  } catch {
    return { sessions: [], activeSessionId: null, saveError: '本机会话存储不可用，请检查浏览器存储后重试' };
  }
};

interface SessionStore {
  sessions: WorkSession[];
  activeSessionId: string | null;
  saveError: string | null;
  createSession: (input?: { title?: string; projectId?: string }) => string;
  ensureTaskSession: (task: { id: string; title: string; projectId: string }) => string;
  ensureProjectSession: (projectId: string) => string;
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
  const create = (input: { title?: string; projectId?: string; taskId?: string; storageProjectId?: string }) => {
    const id = `session-${crypto.randomUUID()}`;
    const title = input.title?.trim() || '新会话';
    const storageProjectId = input.storageProjectId ?? useProjectStore.getState().createProject({
      name: title, sessionOwnerId: id, description: '会话数据与成果', status: '进行中',
    });
    const now = new Date().toISOString();
    commit([...get().sessions, { id, title, projectId: input.projectId, taskId: input.taskId, storageProjectId,
      capability: input.taskId ? 'task' : 'overview', pinned: false, archived: false,
      createdAt: now, updatedAt: now, drafts: {}, handoffs: {},
    }], id);
    return id;
  };
  return {
    ...load(),
    createSession: (input = {}) => create(input),
    ensureTaskSession: (task) => get().sessions.find(session => session.taskId === task.id)?.id
      ?? create({ title: task.title, projectId: task.projectId, taskId: task.id, storageProjectId: task.projectId }),
    ensureProjectSession: (projectId) => {
      const existing = get().sessions.find(session => !session.taskId && session.storageProjectId === projectId);
      if (existing) return existing.id;
      const project = useProjectStore.getState().projects.find(item => item.id === projectId);
      return create({ title: project?.name ?? '项目成果', projectId, storageProjectId: projectId });
    },
    getWorkspaceSession: (id) => {
      const session = get().sessions.find(item => item.id === id);
      return session ? getSessionWorkspaceContext(session) : undefined;
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
    setHandoff: (id, capability, value, resetDraft = false) => update(id, session => {
      const prefix = getSessionDraftKey('', value.workspaceSession as WorkspaceSessionState | undefined);
      const remaining = Object.fromEntries(Object.entries(session.drafts[capability] ?? {}).filter(([key]) =>
        key === 'assistantHistory' || key.endsWith(':assistantHistory') || key.startsWith('report:') || key.includes(':report:')
          || (prefix ? !key.startsWith(prefix) : key.startsWith('item:') || key.startsWith('professional:'))));
      return { ...session, handoffs: { ...session.handoffs, [capability]: value },
        drafts: resetDraft ? { ...session.drafts, [capability]: remaining } : session.drafts };
    }),
    retrySave: () => commit(get().sessions),
    reloadFromStorage: () => set(load()),
  };
});

// Preserve existing artifact APIs while reflecting their save failures in the
// active workbench. No store mutation occurs inside the storage write itself.
useProjectStore.subscribe((state, previous) => {
  if (state.projects !== previous.projects) useSessionStore.getState().retrySave();
});
