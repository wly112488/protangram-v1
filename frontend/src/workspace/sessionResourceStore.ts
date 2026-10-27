import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { artifactOwner, type ResourceOwner } from './sessionResourceModel';
import { resolveArtifactTrialScope } from './artifactTrialContext';
import { usePhysicalObjectStore } from './physicalObjectStore';

type ArtifactInput = Parameters<ReturnType<typeof useProjectStore.getState>['addArtifact']>[1];

// Resource bodies remain in the existing artifact store. Sessions hold stable
// references, including when several sessions use the same CFG.
export function saveOwnedArtifact(sessionId: string, owner: ResourceOwner, input: ArtifactInput) {
  const sessions = useSessionStore.getState();
  const session = sessions.sessions.find(item => item.id === sessionId);
  if (!session) throw new Error('当前会话不存在');
  if (owner.kind === 'session' && owner.sessionId !== sessionId) throw new Error('不能保存到其他会话');
  if (owner.kind === 'cfg' && !useTrialConfigurationStore.getState().getConfiguration(owner.cfgId)) throw new Error('所选 CFG 已失效，请重新选择');
  const previousProjects = useProjectStore.getState().projects;
  const previousSessions = sessions.sessions;
  const existing = input.id ? previousProjects.flatMap(project=>project.artifacts).find(artifact=>artifact.id===input.id) : undefined;
  const previousOwner = existing && artifactOwner(existing);
  const capturedScope = input.payload.sourceScope as { trialId?: string; testRecordId?: string } | undefined;
  const execution = input.payload.execution as { trialId?: string } | undefined;
  const capturedUnbound = capturedScope && Object.hasOwn(capturedScope, 'trialId') && !capturedScope.trialId && !capturedScope.testRecordId
    || execution && !execution.trialId && !capturedScope?.trialId && !capturedScope?.testRecordId;
  const trialContext = capturedUnbound ? undefined : resolveArtifactTrialScope({payload:{...input.payload,resourceOwner:owner,sourceSessionId:sessionId}},previousSessions,usePhysicalObjectStore.getState().objects,useTrialConfigurationStore.getState().configurations);
  const previousTrial=existing && resolveArtifactTrialScope(existing,previousSessions,usePhysicalObjectStore.getState().objects,useTrialConfigurationStore.getState().configurations);
  if(previousTrial?.trialId && trialContext?.trialId && previousTrial.trialId!==trialContext.trialId) throw new Error('此成果已关联其他具体试验，请新建成果后保存');
  if (previousOwner && (previousOwner.kind !== owner.kind
    || previousOwner.kind === 'cfg' && owner.kind === 'cfg' && previousOwner.cfgId !== owner.cfgId
    || previousOwner.kind === 'session' && owner.kind === 'session' && previousOwner.sessionId !== owner.sessionId)) {
    throw new Error('此成果已有归属，请新建成果后保存');
  }
  try {
    const artifact = useProjectStore.getState().addArtifact(existing?.projectId ?? session.storageProjectId, {
      ...input, payload: { ...input.payload, execution: input.payload.execution ? structuredClone(input.payload.execution) : undefined, sourceScope: input.payload.sourceScope ? structuredClone(input.payload.sourceScope) : undefined, trialContext:existing && Object.hasOwn(existing.payload, 'trialContext') ? existing.payload.trialContext : trialContext ?? null, resourceOwner: { ...owner }, sourceSessionId: existing?.payload.sourceSessionId ?? sessionId },
    });
    if (!artifact) throw new Error('成果未保存，请重试');
    if (owner.kind === 'cfg') sessions.linkConfiguration(sessionId, owner.cfgId);
    sessions.linkResource(sessionId, { projectId: artifact.projectId, artifactId: artifact.id });
    sessions.retrySave();
    if (useSessionStore.getState().saveError) throw new Error(useSessionStore.getState().saveError!);
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('protangram:session-artifact-saved', { detail: { sessionId, artifactId: artifact.id } }));
    return artifact;
  } catch (cause) {
    const saveError = useSessionStore.getState().saveError;
    try { useProjectStore.setState({ projects: previousProjects }); } catch { /* State rolls back even if storage remains unavailable. */ }
    useSessionStore.setState({ sessions: previousSessions });
    sessions.retrySave();
    if (saveError) useSessionStore.setState({ saveError });
    throw cause;
  }
}
