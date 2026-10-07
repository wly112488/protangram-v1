export const resolveTaskReportProjectId = (
  task: { projectId: string } | undefined,
  availableProjectIds: string[],
): string | null => {
  if (!task || !availableProjectIds.includes(task.projectId)) return null;
  return task.projectId;
};

export const countUnmetTaskItems = (
  requirements: Array<{ id: string; status: string }>,
  currentReportItemId?: string,
): number => requirements.filter((requirement) =>
  requirement.status !== '已满足' && requirement.id !== currentReportItemId).length;
