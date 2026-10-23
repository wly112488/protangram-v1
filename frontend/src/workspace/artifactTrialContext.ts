import type { ProjectArtifact } from './types';
import type { WorkSession, PhysicalBusinessScope } from './sessionModel';
import type { PhysicalObject } from './physicalObjectStore';
import type { TrialConfiguration } from './trialConfigurationModel';
import { flattenEquipment } from './equipmentCompositionModel';
import { cfgOperationScope } from './professionalScopeModel';

function resolveTrial(scope: PhysicalBusinessScope | undefined, objects: PhysicalObject[]): PhysicalBusinessScope | undefined {
  if (!scope || scope.trialId == null && scope.testRecordId == null) return undefined;
  const matches = flattenEquipment(objects).flatMap(ref => ref.equipment.experiments.flatMap(experiment => experiment.trials.flatMap(trial => {
    if (scope.physicalObjectId != null && scope.physicalObjectId !== ref.id || scope.experimentId != null && scope.experimentId !== experiment.id
      || scope.trialId != null && scope.trialId !== trial.id
      || scope.testRecordId != null && !trial.records.some(record => record.id === scope.testRecordId)) return [];
    return [{...scope,physicalObjectId:ref.id,physicalObjectName:ref.name,experimentId:experiment.id,experimentName:experiment.name,
      trialId:trial.id,trialName:trial.name,cfgId:scope.cfgId ?? trial.cfgId}];
  })));
  return matches.length === 1 ? matches[0] : undefined;
}

// Resolve old lost links only from an exact originating trial session and its
// equipment IDs. Never infer a trial from a title or a shared project alone.
export function resolveArtifactTrialScope(
  artifact: Pick<ProjectArtifact,'payload'>, sessions: WorkSession[], objects: PhysicalObject[], configurations: TrialConfiguration[],
): PhysicalBusinessScope | undefined {
  const payload=artifact.payload;
  const trialContext=payload.trialContext as PhysicalBusinessScope | undefined;
  if (trialContext) return resolveTrial(trialContext,objects);
  const source=payload.sourceScope as PhysicalBusinessScope | undefined;
  if (source && (source.trialId != null || source.testRecordId != null)) return resolveTrial(source,objects);
  const captured=(payload.sourceContext as {scope?:PhysicalBusinessScope} | undefined)?.scope;
  if (captured && (captured.trialId != null || captured.testRecordId != null)) return resolveTrial(captured,objects);
  const session=sessions.find(item=>item.id===payload.sourceSessionId);
  if (!session || session.taskId) return undefined;
  const base=resolveTrial(session.businessScope,objects);
  if (!base || source?.physicalObjectId && source.physicalObjectId!==base.physicalObjectId) return undefined;
  const owner=payload.resourceOwner as {kind?:string;sessionId?:string;cfgId?:string} | undefined;
  if (owner?.kind==='session') return owner.sessionId===session.id?base:undefined;
  const cfgId=owner?.cfgId ?? source?.cfgId ?? (payload.modelPlan as {cfgId?:string}|undefined)?.cfgId;
  const cfg=configurations.find(item=>item.id===cfgId);
  if (!cfg) return undefined;
  try {
    const operation=cfgOperationScope(cfg,objects,base);
    return operation.trialId===base.trialId?operation:undefined;
  } catch {return undefined;}
}
