import type { Project, ProjectArtifact } from './types';
import type { WorkSession } from './sessionModel';
import type { ConcreteTrial, PhysicalObject, RawDataFile } from './physicalObjectStore';
import type { TrialConfiguration } from './trialConfigurationModel';
import { collectAnalysisResults, type ResultEntry } from './analysisResultModel';
import { flattenEquipment } from './equipmentCompositionModel';
import { resolveArtifactTrialScope } from './artifactTrialContext';
import { getProjectTrialEntries } from './projectTrialModel';

export type ResourceOwner = { kind: 'session'; sessionId: string } | { kind: 'cfg'; cfgId: string };
export interface SessionResourceGroup {
  id: string; name: string; entries: ResultEntry[]; trials: ConcreteTrial[]; files: Array<RawDataFile & {trialId?:string;trialName?:string;loadSpectrum?:string}>; missing?: boolean;
}

export function artifactOwner(artifact: ProjectArtifact, trials: ConcreteTrial[] = []): ResourceOwner | undefined {
  const owner = artifact.payload.resourceOwner as ResourceOwner | undefined;
  if (owner?.kind === 'cfg' && owner.cfgId || owner?.kind === 'session' && owner.sessionId) return owner;
  const scope = artifact.payload.sourceScope as { cfgId?: string; trialId?: string } | undefined;
  const plan = artifact.payload.modelPlan as { cfgId?: string } | undefined;
  const cfgId = scope?.cfgId ?? plan?.cfgId ?? trials.find(trial => trial.id === scope?.trialId)?.cfgId;
  return cfgId ? { kind: 'cfg', cfgId } : undefined;
}

export function collectSessionResourceGroups(
  projects: Project[], sessions: WorkSession[], objects: PhysicalObject[], configurations: TrialConfiguration[], sessionId: string,
): SessionResourceGroup[] {
  const session = sessions.find(item => item.id === sessionId);
  if (!session) return [];
  const allTrials = flattenEquipment(objects).flatMap(item => item.equipment.experiments.flatMap(experiment => experiment.trials));
  const artifacts = projects.flatMap(project => project.artifacts);
  const referenced = new Set(session.resourceRefs?.map(ref => `${ref.projectId}/${ref.artifactId}`));
  const ownArtifacts = artifacts.filter(artifact => {
    if (referenced.has(`${artifact.projectId}/${artifact.id}`) || artifact.payload.sourceSessionId === session.id) return true;
    const legacy = !artifact.payload.resourceOwner && !artifact.payload.sourceSessionId;
    const scope = artifact.payload.sourceScope as { trialId?: string } | undefined;
    if (legacy && (projects.find(project => project.id === artifact.projectId)?.sessionOwnerId === session.id
      || Boolean(scope?.trialId && scope.trialId === session.businessScope?.trialId))) return true;
    const owner = artifactOwner(artifact, allTrials);
    if (owner?.kind === 'session') return owner.sessionId === session.id;
    return false;
  });
  const cfgIds = new Set(session.cfgIds ?? []);
  if (session.businessScope?.cfgId) cfgIds.add(session.businessScope.cfgId);
  for (const artifact of ownArtifacts) {
    const owner = artifactOwner(artifact, allTrials);
    if (owner?.kind === 'cfg') cfgIds.add(owner.cfgId);
  }
  const baseTrial = allTrials.find(trial => trial.id === session.businessScope?.trialId);
  if (baseTrial?.cfgId) cfgIds.add(baseTrial.cfgId);
  const makeGroup = (id: string, name: string, items: ProjectArtifact[], trials: ConcreteTrial[], missing = false): SessionResourceGroup => ({
    id, name, missing, trials,
    entries: [...new Map([...trials.flatMap(trial => collectAnalysisResults(trial, [])), ...collectAnalysisResults(undefined, items)].map(entry => {
      const resolvedScope=entry.artifact && resolveArtifactTrialScope(entry.artifact,sessions,objects,configurations);
      const trial=allTrials.find(item=>item.id===resolvedScope?.trialId);
      return [entry.key,resolvedScope?{...entry,resolvedScope,trialId:trial?.id,loadSpectrum:trial?.loadSpectrum}:entry] as const;
    })).values()],
    files: [...new Map(items.flatMap(artifact => {
      const file = artifact.payload.dataFile as RawDataFile | undefined;
      const resolved=resolveArtifactTrialScope(artifact,sessions,objects,configurations);
      const trial=allTrials.find(item=>item.id===resolved?.trialId);
      return file && file.status !== 'removed' ? [[file.id, trial?{...file,trialId:trial.id,trialName:trial.name,loadSpectrum:trial.loadSpectrum}:file] as const] : [];
    })).values()],
  });
  const genericArtifacts = ownArtifacts.filter(artifact => artifactOwner(artifact, allTrials)?.kind !== 'cfg');
  const groups = [makeGroup('generic', '通用', genericArtifacts, baseTrial && !baseTrial.cfgId ? [baseTrial] : [])];
  for (const id of cfgIds) {
    const cfg = configurations.find(item => item.id === id);
    groups.push(makeGroup(id, cfg?.name ?? '构型来源已失效', artifacts.filter(artifact => {
      const owner = artifactOwner(artifact, allTrials);
      return owner?.kind === 'cfg' && owner.cfgId === id;
    }), allTrials.filter(trial => trial.cfgId === id), !cfg));
  }
  return groups;
}

export function collectTrialResourceGroups(
  projects: Project[], sessions: WorkSession[], objects: PhysicalObject[], configurations: TrialConfiguration[],
  scope: {projectId?:string;trialId:string;sessionId?:string},
): SessionResourceGroup[] {
  const refs=flattenEquipment(objects);
  const trials=refs.flatMap(ref=>ref.equipment.experiments.flatMap(experiment=>experiment.trials));
  const trial=trials.find(item=>item.id===scope.trialId);
  if (!trial) return [];
  if (scope.projectId && !getProjectTrialEntries(scope.projectId,objects,projects,sessions).some(entry=>entry.trial.id===trial.id)) return [];
  if (scope.sessionId && sessions.find(item=>item.id===scope.sessionId)?.businessScope?.trialId!==trial.id) return [];
  const items=projects.flatMap(project=>project.artifacts).filter(artifact=>
    resolveArtifactTrialScope(artifact,sessions,objects,configurations)?.trialId===trial.id);
  const groups=new Map<string,SessionResourceGroup>();
  const ensure=(id:string)=>{
    let group=groups.get(id);
    if(!group) {
      const cfg=configurations.find(item=>item.id===id);
      group={id,name:id==='generic'?'通用':cfg?.name ?? '构型来源已失效',missing:id!=='generic'&&!cfg,entries:[],trials:[],files:[]};groups.set(id,group);
    }
    return group;
  };
  ensure('generic');
  const raw=ensure(trial.cfgId ?? 'generic');raw.trials.push(trial);raw.entries.push(...collectAnalysisResults(trial,[]));
  for(const artifact of items) {
    const owner=artifactOwner(artifact,trials);
    const group=ensure(owner?.kind==='cfg'?owner.cfgId:'generic');
    group.entries.push(...collectAnalysisResults(trial,[artifact]).map(entry=>({...entry,resolvedScope:resolveArtifactTrialScope(artifact,sessions,objects,configurations)})));
    const file=artifact.payload.dataFile as RawDataFile | undefined;
    if(file && file.status!=='removed' && !group.files.some(item=>item.id===file.id)) group.files.push({...file,trialId:trial.id,trialName:trial.name,loadSpectrum:trial.loadSpectrum});
  }
  return [...groups.values()];
}
