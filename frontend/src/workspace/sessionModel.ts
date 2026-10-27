import type { BusinessRouteState, WorkspaceSessionState } from '../types/businessContext';
import type { TaskRecord } from './taskTypes';
import { samePhysicalSource } from './physicalBusinessContext';

export type SessionCapability = 'overview' | 'doe' | 'doeMethods' | 'analysis' | 'digitalTwin' | 'virtualCondition' | 'report' | 'resources' | 'task' | 'tools';
export type SessionCreationSource = 'standalone' | 'project' | 'task';
export interface PhysicalBusinessScope { physicalObjectId?: string; physicalObjectName?: string; experimentId?: string; experimentName?: string; cfgId?: string; trialId?: string; trialName?: string; testRecordId?: string; testRecordName?: string; modelId?: string; modelName?: string; taskBookId?: string; taskBookName?: string }
export interface WorkSession {
  id: string;
  title: string;
  projectId?: string;
  taskId?: string;
  taskWork?: { taskId: string; trialDraftId: string };
  sidebarVisible?: boolean;
  creationSource: SessionCreationSource;
  storageProjectId: string;
  capability: SessionCapability;
  businessScope?: PhysicalBusinessScope;
  cfgIds?: string[];
  resourceRefs?: Array<{ projectId: string; artifactId: string }>;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  drafts: Partial<Record<SessionCapability, Record<string, unknown>>>;
  handoffs: Partial<Record<SessionCapability, Record<string, unknown>>>;
}

export const sessionCapabilities = [
  { key: 'doe', path: 'doe', label: '智能实验设计', description: '确认试验目标与约束，生成试验方案' },
  { key: 'analysis', path: 'analysis', label: '数据分析', description: '分析趋势、异常与根因' },
  { key: 'digitalTwin', path: 'digital-twin', label: '数字孪生', description: '继承试验数据，形成数字孪生成果' },
  { key: 'virtualCondition', path: 'virtual-condition', label: '虚拟工况', description: '扩展工况范围，查看预测与风险' },
  { key: 'report', path: 'report', label: '报告', description: '引用当前成果，生成专业报告' },
] as const;

export const getSessionPath = (id: string, capability: SessionCapability = 'overview') => {
  const canonicalCapability = capability === 'doeMethods' ? 'doe' : capability;
  return `/sessions/${encodeURIComponent(id)}${canonicalCapability === 'overview' ? '' : `/${sessionCapabilities.find(item => item.key === canonicalCapability)?.path ?? canonicalCapability}`}`;
};

export const getSessionResourcesPath = (id: string) => getSessionPath(id, 'resources');

export const getSessionIdFromLocation = (pathname: string, search = '') => {
  const segment = pathname.match(/^\/sessions\/([^/]+)/)?.[1];
  if (segment) { try { return decodeURIComponent(segment); } catch { return null; } }
  return new URLSearchParams(search).get('sessionId');
};

export const getCapabilityFromPath = (pathname: string): SessionCapability => {
  const path = pathname.replace(/^\/sessions\/[^/]+\/?/, '').split('/')[0];
  return sessionCapabilities.find(item => item.path === path)?.key
    ?? (path === 'doe-design' ? 'doe' : path === 'resources' ? 'resources' : path === 'tools' ? 'tools' : path === 'tasks' ? 'task' : 'overview');
};

export const getLegacySessionPath = (pathname: string, id: string): string | null => {
  const base = getSessionPath(id);
  if (pathname === '/projects') return getSessionResourcesPath(id);
  if (pathname === '/experiment/design/intelligent') return `${base}/doe`;
  if (pathname === '/experiment/tasks') return `${base}/doe/result`;
  if (pathname === '/analysis/projects') return `${base}/analysis`;
  if (pathname === '/analysis/digital-twin') return `${base}/digital-twin`;
  if (pathname === '/analysis/virtual-condition') return `${base}/virtual-condition`;
  if (pathname.startsWith('/report/')) return `${base}${pathname}`;
  if (['/experiment/info/bom', '/experiment/info/subjects', '/experiment/info/methods'].includes(pathname)) return `${base}${pathname}`;
  return null;
};

export const getSessionWorkspaceContext = (session: Pick<WorkSession, 'id' | 'taskId' | 'storageProjectId' | 'businessScope'>): WorkspaceSessionState => ({
  ...(session.taskId
    ? { mode: 'task' as const, taskId: session.taskId, targetProjectId: session.storageProjectId }
    : { mode: 'project' as const, targetProjectId: session.storageProjectId }),
  sessionId: session.id,
  ...(session.businessScope ?? {}),
});

export const readSessionDraft = <T,>(session: WorkSession | undefined, capability: SessionCapability, key: string, initial: T): T => {
  const draft = session?.drafts[capability];
  return draft && Object.hasOwn(draft, key) ? draft[key] as T : initial;
};

export const getSessionResumePath = (session: WorkSession) => session.capability === 'task' && session.taskId
  ? `${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId)}` : getSessionPath(session.id, session.capability);

export const getSessionEntryPath = (session: WorkSession) => session.businessScope?.trialId
  ? getSessionPath(session.id, 'doe')
  : session.taskId ? `${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId)}`
    : getSessionPath(session.id);

export const isCompatibleSessionHandoff = (context: WorkspaceSessionState, state?: BusinessRouteState | null) => !state?.workspaceSession
    || (!state.workspaceSession.sessionId || state.workspaceSession.sessionId === context.sessionId)
      && (!context.physicalObjectId || samePhysicalSource(context, state.workspaceSession));

export const resolveSessionHandoff = (context: WorkspaceSessionState, saved?: BusinessRouteState, incoming?: BusinessRouteState | null): BusinessRouteState => {
  if (!isCompatibleSessionHandoff(context, saved)) saved = undefined;
  if (!isCompatibleSessionHandoff(context, incoming)) incoming = undefined;
  const workspaceSession = { ...context, ...(incoming?.workspaceSession ?? saved?.workspaceSession) };
  if (incoming?.workspaceSession && !incoming.source && workspaceSession.mode === 'task') {
    workspaceSession.taskItemId = incoming.workspaceSession.mode === 'task' ? incoming.workspaceSession.taskItemId : undefined;
    workspaceSession.professionalProjectId = incoming.workspaceSession.mode === 'task' ? incoming.workspaceSession.professionalProjectId : undefined;
  }
  return { ...saved, ...incoming, autoExecute: incoming?.source ? incoming.autoExecute : false, workspaceSession } as BusinessRouteState;
};

export const getSessionDraftKey = (key: string, context?: WorkspaceSessionState) => context?.mode === 'task'
  && (context.professionalProjectId || context.taskItemId)
  ? `${context.professionalProjectId ? `professional:${context.professionalProjectId}` : `item:${context.taskItemId}`}:${key}` : key;

export const getProjectDeletionBlock = (projectId: string, sessions: WorkSession[], tasks: TaskRecord[]): string | null => {
  if (tasks.some(task => task.projectId === projectId || [
    ...(task.artifactRefs ?? []),
    ...task.requirements.flatMap(item => item.artifactRefs ?? []),
    ...task.reportDraft.sections.flatMap(section => section.artifactRefs),
    ...(task.professionalProjects ?? []).flatMap(item => item.artifactRefs),
    ...(task.reportDraft.formalReportArtifact ? [task.reportDraft.formalReportArtifact] : []),
  ].some(reference => reference.projectId === projectId))) return '正式任务正在使用该项目的数据或成果，不能删除';
  if (sessions.some(session => session.projectId !== projectId && session.storageProjectId === projectId)) return '其他会话正在使用该项目的成果，不能删除';
  return null;
};
