import { Select } from 'antd';
import { useLocation, useParams } from 'react-router-dom';
import { getCapabilityFromPath } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { useTaskStore } from './taskStore';
import { useSessionRouteState } from './useSessionState';

export default function TaskArtifactScope() {
  const { sessionId } = useParams();
  const location = useLocation();
  const capability = getCapabilityFromPath(location.pathname);
  const context = useSessionRouteState()?.workspaceSession;
  const task = useTaskStore(state => state.tasks.find(item => context?.mode === 'task' && item.id === context.taskId));
  const chosen = useSessionStore(state => state.sessions.find(item => item.id === sessionId)?.drafts[capability]?.artifactTaskItemId);
  if (!task || !context || context.mode !== 'task' || !['doe', 'analysis', 'digitalTwin', 'virtualCondition'].includes(capability)) return null;
  const professional = task.professionalProjects?.find(item => item.id === context.professionalProjectId);
  const focused = task.requirements.find(item => item.id === context.taskItemId);
  const selected = task.requirements.some(item => item.id === chosen) ? chosen as string : undefined;
  return <div className="task-artifact-scope">
    {professional || focused ? <strong>成果将关联：{professional?.name ?? focused?.text}</strong> : <>
      <label htmlFor="task-artifact-scope">成果归属</label>
      <Select id="task-artifact-scope" aria-label="成果归属" value={selected ?? ''}
        onChange={value => useSessionStore.getState().updateDraft(sessionId!, capability, 'artifactTaskItemId', value || null)}
        options={[{ value: '', label: '作为任务独立成果（不关联事项）' }, ...task.requirements.filter(item => item.capability !== 'report').map(item => ({ value: item.id, label: item.text }))]} />
    </>}
    <span>关联事项的成果保存后，该事项进入待确认；已满足事项保持原状态。任务完成仍需人工确认。</span>
  </div>;
}
