import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { ConcreteTrial, ExperimentDefinition, PhysicalConfiguration, PhysicalObject } from './physicalObjectStore';
import type { Project, ProjectArtifact } from './types';
import { resolvePhysicalSource } from './physicalBusinessContext';

export interface ProjectTrialEntry {
  category: PhysicalObject;
  object: PhysicalConfiguration;
  experiment: ExperimentDefinition;
  trial: ConcreteTrial;
  sessions: WorkSession[];
}

const artifactScope = (artifact: ProjectArtifact): PhysicalBusinessScope | undefined =>
  artifact.payload.sourceScope as PhysicalBusinessScope | undefined;

export function getProjectTrialEntries(
  projectId: string,
  objects: PhysicalObject[],
  projects: Project[],
  sessions: WorkSession[],
): ProjectTrialEntry[] {
  const project = projects.find(item => item.id === projectId);
  if (!project) return [];

  const projectSessions = sessions.filter(session =>
    session.projectId === projectId || session.storageProjectId === projectId,
  );
  const scopes = [
    ...projectSessions.map(session => session.businessScope),
    ...project.artifacts.map(artifactScope),
  ].filter((scope): scope is PhysicalBusinessScope =>
    Boolean(scope?.physicalObjectId && scope.experimentId && (scope.trialId || scope.testRecordId)),
  );

  const entries = new Map<string, ProjectTrialEntry>();
  for (const scope of scopes) {
    const source = resolvePhysicalSource(objects, scope);
    if (source.missing || !source.family || !source.configuration || !source.experiment || !source.trial) continue;

    const key = [source.configuration.id, source.experiment.id, source.trial.id].join(':');
    const linkedSessions = projectSessions.filter(session => {
      const candidate = session.businessScope;
      return candidate?.physicalObjectId === source.configuration!.id
        && candidate.experimentId === source.experiment!.id
        && (candidate.trialId === source.trial!.id
          || Boolean(candidate.testRecordId && source.trial!.records.some(record => record.id === candidate.testRecordId)));
    });
    const existing = entries.get(key);
    if (existing) {
      existing.sessions = [...new Map([...existing.sessions, ...linkedSessions].map(session => [session.id, session])).values()];
    } else {
      entries.set(key, {
        category: source.family,
        object: source.configuration,
        experiment: source.experiment,
        trial: source.trial,
        sessions: linkedSessions,
      });
    }
  }

  return [...entries.values()].sort((left, right) =>
    left.object.name.localeCompare(right.object.name, 'zh-CN')
      || left.experiment.name.localeCompare(right.experiment.name, 'zh-CN')
      || left.trial.name.localeCompare(right.trial.name, 'zh-CN'),
  );
}
