import { useTaskStore } from './taskStore';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { flattenEquipment } from './equipmentCompositionModel';
import { getProjectTrialEntries } from './projectTrialModel';
import { resolvePhysicalSource } from './physicalBusinessContext';
import { createTrialFromCfg, createTrialForEquipment, resolveCfgTrialTarget } from './cfgTrialBridge';

export function confirmTaskTrialDraft(taskId: string, draftId: string, values: {
  name: string; cfgId?: string; loadSpectrum?: string; description?: string; loadSpectrumDescription?: string; physicalObjectId?: string; experimentId?: string;
}) {
  const task = useTaskStore.getState().tasks.find(item => item.id === taskId);
  const draft = task?.trialDrafts?.find(item => item.id === draftId);
  if (!task || !draft) throw new Error('任务或试验草稿已不存在');
  if (!values.name.trim()) throw new Error('请补充试验名称');
  const project = useProjectStore.getState().projects.find(item => item.id === task.projectId && !item.sessionOwnerId);
  if (!project) throw new Error('正式任务书必须归属有效项目，请先核对项目归属');
  const objects = usePhysicalObjectStore.getState().objects;
  if (values.cfgId) resolveCfgTrialTarget(values.cfgId);
  let source = draft.source;
  if (source) {
    const existing = resolvePhysicalSource(objects, source);
    if (existing.missing || !existing.trial) throw new Error('已确认试验来源已失效，请先核对原试验');
    if (existing.trial.taskBookId !== taskId) throw new Error('试验的任务书关联已变化，请核对原试验');
    if (values.physicalObjectId && source.physicalObjectId !== values.physicalObjectId || values.experimentId && source.experimentId !== values.experimentId) throw new Error('试验已确认，请继续原试验');
  } else if (values.cfgId) {
    source = { ...createTrialFromCfg(values.cfgId,{...values,taskBookId:task.id}), taskBookName:task.title };
  } else if (values.physicalObjectId && !values.experimentId) {
    source = {...createTrialForEquipment(values.physicalObjectId,{...values,taskBookId:task.id}),taskBookName:task.title};
  } else {
    // Older task links may still carry an explicit legacy experiment source.
    const target = resolvePhysicalSource(objects, { physicalObjectId: values.physicalObjectId, experimentId: values.experimentId });
    if (!target.configuration || !target.experiment || target.missing) throw new Error('物理对象或试验构型已失效');
    const trialId = usePhysicalObjectStore.getState().addConcreteTrial(target.experiment.id, { name: values.name.trim(), loadSpectrum: values.loadSpectrum?.trim() ?? '', description: values.description, loadSpectrumDescription: values.loadSpectrumDescription, taskBookId: task.id });
    source = { physicalObjectId: values.physicalObjectId, physicalObjectName: target.configuration.name,
      experimentId: values.experimentId, experimentName: target.experiment.name, trialId, trialName: values.name.trim(), taskBookId: task.id, taskBookName: task.title };
  }
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

/** Explicit recovery of old unassigned task books; retain original artifact storage. */
export function assignLegacyTaskProject(taskId:string,projectId:string) {
  const task = useTaskStore.getState().tasks.find(item => item.id === taskId);
  const projects = useProjectStore.getState().projects;
  const project = projects.find(item => item.id === projectId && !item.sessionOwnerId);
  if (!task || !project) throw new Error('任务书或项目不存在');
  if (projects.some(item => item.id === task.projectId && !item.sessionOwnerId)) throw new Error('任务书已有项目归属');
  const objects = usePhysicalObjectStore.getState().objects;
  const sessions = useSessionStore.getState().sessions;
  for (const other of projects.filter(item => !item.sessionOwnerId && item.id !== projectId)) {
    if (getProjectTrialEntries(other.id,objects,projects,sessions).some(entry => entry.trial.taskBookId === taskId)) throw new Error('关联试验已有其他项目归属，请先核对原项目');
  }
  useTaskStore.getState().updateTask(taskId,{projectId});
  for (const ref of flattenEquipment(objects)) for (const experiment of ref.equipment.experiments) for (const trial of experiment.trials) {
    if (trial.taskBookId === taskId) useProjectStore.getState().retainTrialSource(projectId,{physicalObjectId:ref.id,experimentId:experiment.id,trialId:trial.id});
  }
  const trialIds = new Set(flattenEquipment(objects).flatMap(ref => ref.equipment.experiments.flatMap(experiment => experiment.trials.filter(trial => trial.taskBookId===taskId).map(trial => trial.id))));
  for (const session of sessions.filter(item => item.taskId === taskId || item.taskWork?.taskId === taskId || item.businessScope?.taskBookId === taskId || trialIds.has(item.businessScope?.trialId ?? ''))) {
    useSessionStore.getState().moveSession(session.id,projectId);
  }
}
