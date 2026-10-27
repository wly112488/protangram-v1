import { flattenEquipment } from './equipmentCompositionModel';
import { getProjectTrialEntries } from './projectTrialModel';
import type { PhysicalObject } from './physicalObjectStore';
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { TaskRecord } from './taskTypes';
import type { Project } from './types';

export interface SessionTrialCandidate {
  scope: PhysicalBusinessScope;
  projectId?: string;
  label: string;
}

export function getSessionTrialCandidates(session: WorkSession, objects: PhysicalObject[], projects: Project[], sessions: WorkSession[], tasks: TaskRecord[]): SessionTrialCandidate[] {
  const organizational = projects.filter(project => !project.sessionOwnerId);
  const ownership = new Map<string, Set<string>>();
  for (const project of organizational) {
    for (const entry of getProjectTrialEntries(project.id, objects, projects, sessions)) {
      const owners = ownership.get(entry.trial.id) ?? new Set<string>();
      owners.add(project.id); ownership.set(entry.trial.id, owners);
    }
  }
  return flattenEquipment(objects).flatMap(object => object.equipment.experiments.flatMap(experiment => experiment.trials.flatMap(trial => {
    const owners = new Set(ownership.get(trial.id));
    const task = tasks.find(item => item.id === trial.taskBookId);
    if (trial.taskBookId) {
      if (!task || !organizational.some(project => project.id === task.projectId)) return [];
      owners.add(task.projectId);
    }
    if (owners.size > 1) return [];
    const projectId = [...owners][0];
    if (session.projectId && projectId && session.projectId !== projectId) return [];
    return [{ projectId, label: `${trial.name} · ${object.path} · ${organizational.find(project => project.id === projectId)?.name ?? '独立试验'}`,
      scope: { physicalObjectId: object.id, physicalObjectName: object.name, experimentId: experiment.id, experimentName: experiment.name,
        trialId: trial.id, trialName: trial.name, taskBookId: trial.taskBookId, taskBookName: task?.title } }];
  })));
}
