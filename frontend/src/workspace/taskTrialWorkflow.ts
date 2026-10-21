import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { resolvePhysicalSource } from './physicalBusinessContext';

export function confirmTaskTrialDraft(taskId: string, draftId: string, values: {
  name: string; loadSpectrum: string; description?: string; loadSpectrumDescription?: string; physicalObjectId: string; experimentId: string;
}) {
  const task = useTaskStore.getState().tasks.find(item => item.id === taskId);
  const draft = task?.trialDrafts?.find(item => item.id === draftId);
  if (!task || !draft) throw new Error('任务或试验草稿已不存在');
  if (!values.name.trim() || !values.loadSpectrum.trim()) throw new Error('请补充试验名称和载荷谱');
  const objects = usePhysicalObjectStore.getState().objects;
  const target = resolvePhysicalSource(objects, { physicalObjectId: values.physicalObjectId, experimentId: values.experimentId });
  if (!target.configuration || !target.experiment || target.missing) throw new Error('物理对象或试验构型已失效');
  let source = draft.source;
  if (source) {
    const existing = resolvePhysicalSource(objects, source);
    if (existing.missing || !existing.trial) throw new Error('已确认试验来源已失效，请先核对原试验');
    if (existing.trial.taskBookId !== taskId) throw new Error('试验的任务书关联已变化，请核对原试验');
    if (source.physicalObjectId !== values.physicalObjectId || source.experimentId !== values.experimentId) throw new Error('试验已确认，请继续原试验');
  } else {
    const trialId = usePhysicalObjectStore.getState().addConcreteTrial(values.experimentId, { name: values.name.trim(), loadSpectrum: values.loadSpectrum.trim(), description: values.description, loadSpectrumDescription: values.loadSpectrumDescription, taskBookId: task.id });
    source = { physicalObjectId: values.physicalObjectId, physicalObjectName: target.configuration.name,
      experimentId: values.experimentId, experimentName: target.experiment.name, trialId, trialName: values.name.trim(), taskBookId: task.id, taskBookName: task.title };
  }
  const project = useProjectStore.getState().projects.find(item => item.id === task.projectId && !item.sessionOwnerId);
  const sessionId = useSessionStore.getState().ensureTaskTrialSession(task.id, draft.id, source, project?.id);
  const confirmed = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, source);
  useTaskStore.getState().bindTrialDraft(task.id, draft.id, source, sessionId, {
    name: confirmed.trial!.name, loadSpectrum: confirmed.trial!.loadSpectrum, description: confirmed.trial!.description,
    categoryId: confirmed.family!.id, physicalObjectId: confirmed.configuration!.id, experimentId: confirmed.experiment!.id,
  });
  if (useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试保存');
  return sessionId;
}

export function completeTaskRequirement(taskId: string, requirementId: string, note: string) {
  const task = useTaskStore.getState().tasks.find(item => item.id === taskId);
  const requirement = task?.requirements.find(item => item.id === requirementId);
  const drafts = task?.trialDrafts?.filter(item => item.requirementIds.includes(requirementId)) ?? [];
  if (!task || !requirement || !drafts.length || drafts.some(draft => !draft.source?.trialId)) throw new Error('请先确认关联试验并开展工作');
  for (const draft of drafts) {
    const source = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, draft.source);
    if (source.missing || source.trial?.taskBookId !== taskId) throw new Error('关联试验已失效或任务书关联已变化');
  }
  if (!note.trim() && !requirement.artifactRefs?.length) throw new Error('请填写完成依据或关联已保存成果');
  useTaskStore.getState().confirmRequirementSatisfied(taskId, requirementId, note.trim());
  for (const draft of drafts) {
    const session = useSessionStore.getState().sessions.find(item => item.id === draft.sessionId);
    if (session) useSessionStore.getState().publishSession(session.id);
  }
  const updated = useTaskStore.getState().tasks.find(item => item.id === taskId)!;
  if (updated.requirements.every(item => item.status === '已满足')) useTaskStore.getState().setTaskStatus(taskId, '已完成');
  if (useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试保存');
}
