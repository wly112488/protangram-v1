import type { TaskRecord, TaskRequirement } from './taskTypes';

export const addTaskRequirement = (task: TaskRecord, requirement: TaskRequirement): TaskRecord => ({
  ...task,
  planConfirmed: false,
  requirements: [...task.requirements, requirement],
});

export const updateTaskRequirement = (
  task: TaskRecord,
  requirementId: string,
  patch: Pick<TaskRequirement, 'text' | 'capability'>,
): TaskRecord => ({
  ...task,
  planConfirmed: false,
  requirements: task.requirements.map((requirement) => requirement.id === requirementId
    ? {
      ...requirement,
      ...patch,
      text: patch.text.trim(),
      ...(patch.text.trim() !== requirement.text.trim()
        ? { status: '待完成' as const, artifactRefs: [], satisfactionNote: undefined }
        : {}),
    }
    : requirement),
});

export const satisfyTaskRequirement = (
  task: TaskRecord,
  requirementId: string,
  satisfactionNote: string,
): TaskRecord => ({
  ...task,
  requirements: task.requirements.map((requirement) => {
    if (requirement.id !== requirementId) return requirement;
    const note = satisfactionNote.trim();
    if (!note && !requirement.artifactRefs?.length) return requirement;
    return { ...requirement, status: '已满足', satisfactionNote: note || undefined };
  }),
});

export const reopenTaskRequirement = (task: TaskRecord, requirementId: string): TaskRecord => ({
  ...task,
  requirements: task.requirements.map((requirement) => requirement.id === requirementId
    ? { ...requirement, status: '待完成', satisfactionNote: undefined }
    : requirement),
});

export const removeTaskRequirement = (task: TaskRecord, requirementId: string): TaskRecord => ({
  ...task,
  planConfirmed: false,
  requirements: task.requirements
    .filter((requirement) => requirement.id !== requirementId)
    .map((requirement) => ({
      ...requirement,
      dependsOnIds: requirement.dependsOnIds?.filter((dependencyId) => dependencyId !== requirementId),
    })),
});
