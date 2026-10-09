import type { BusinessRouteState, WorkspaceSessionState } from '../types/businessContext';
import type { TaskRecord } from './taskTypes';

export type SessionCapability = 'overview' | 'doe' | 'analysis' | 'digitalTwin' | 'virtualCondition' | 'report' | 'resources' | 'task';
export interface WorkSession {
  id: string;
  title: string;
  projectId?: string;
  taskId?: string;
  storageProjectId: string;
  capability: SessionCapability;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  drafts: Partial<Record<SessionCapability, Record<string, unknown>>>;
  handoffs: Partial<Record<SessionCapability, Record<string, unknown>>>;
}

export const sessionCapabilities = [
  { key: 'doe', path: 'doe', label: '试验设计', description: '配置因子与约束，生成试验方案' },
  { key: 'analysis', path: 'analysis', label: '数据分析', description: '分析趋势、异常与根因' },
  { key: 'digitalTwin', path: 'digital-twin', label: '数字孪生', description: '导入数据，校准并验证模型' },
  { key: 'virtualCondition', path: 'virtual-condition', label: '虚拟工况', description: '扩展工况范围，查看预测与风险' },
  { key: 'report', path: 'report', label: '报告', description: '引用当前成果，生成专业报告' },
] as const;

export const getSessionPath = (id: string, capability: SessionCapability = 'overview') =>
  `/sessions/${encodeURIComponent(id)}${capability === 'overview' ? '' : `/${sessionCapabilities.find(item => item.key === capability)?.path ?? capability}`}`;

export const getSessionResourcesPath = (id: string) => getSessionPath(id, 'resources');

export const getSessionIdFromLocation = (pathname: string, search = '') => {
  const segment = pathname.match(/^\/sessions\/([^/]+)/)?.[1];
  if (segment) { try { return decodeURIComponent(segment); } catch { return null; } }
  return new URLSearchParams(search).get('sessionId');
};

export const getCapabilityFromPath = (pathname: string): SessionCapability => {
  const path = pathname.replace(/^\/sessions\/[^/]+\/?/, '').split('/')[0];
  return sessionCapabilities.find(item => item.path === path)?.key
    ?? (path === 'resources' ? 'resources' : path === 'tasks' ? 'task' : 'overview');
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
  if (pathname.startsWith('/experiment/info/')) return `${base}${pathname}`;
  return null;
};

export const getSessionWorkspaceContext = (session: WorkSession): WorkspaceSessionState => session.taskId
  ? { mode: 'task', taskId: session.taskId, targetProjectId: session.storageProjectId, sessionId: session.id }
  : { mode: 'project', targetProjectId: session.storageProjectId, sessionId: session.id };

export const readSessionDraft = <T,>(session: WorkSession | undefined, capability: SessionCapability, key: string, initial: T): T => {
  const draft = session?.drafts[capability];
  return draft && Object.hasOwn(draft, key) ? draft[key] as T : initial;
};

export const getSessionResumePath = (session: WorkSession) => session.capability === 'task' && session.taskId
  ? `${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId)}` : getSessionPath(session.id, session.capability);

export const getSessionEntryPath = (session: WorkSession) => session.taskId
  ? `${getSessionPath(session.id)}/tasks/${encodeURIComponent(session.taskId)}`
  : getSessionPath(session.id, 'doe');

export const resolveSessionHandoff = (context: WorkspaceSessionState, saved?: BusinessRouteState, incoming?: BusinessRouteState | null): BusinessRouteState => {
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
