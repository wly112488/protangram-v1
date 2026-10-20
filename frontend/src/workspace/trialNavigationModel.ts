import type { PhysicalObject } from './physicalObjectStore';

export function trialCreatePath(context: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const key of ['objectId', 'configurationId', 'experimentId', 'taskBookId']) if (context[key]) params.set(key, context[key]!);
  return `/trials/new${params.size ? `?${params}` : ''}`;
}
export function listWorkspaceTrials(objects: PhysicalObject[], tasks: Array<{ id: string; title: string }>) {
  return objects.flatMap(category => category.configurations.flatMap(object => object.experiments.flatMap(configuration => configuration.trials.map(trial => ({
    category, object, configuration, trial, taskTitle: tasks.find(task => task.id === trial.taskBookId)?.title,
  })))));
}
export type WorkspaceTrialEntry = ReturnType<typeof listWorkspaceTrials>[number];
export function filterWorkspaceTrials(entries: WorkspaceTrialEntry[], search = '', task = 'all') {
  const keyword = search.trim().toLocaleLowerCase();
  return entries.filter(entry => (!keyword || [entry.category.name, entry.object.name, entry.configuration.name, entry.trial.name, entry.trial.loadSpectrum, entry.trial.taskBookId, entry.taskTitle]
    .some(value => value?.toLocaleLowerCase().includes(keyword))) && (task === 'all' || task === 'independent' && !entry.trial.taskBookId || task === `task:${entry.trial.taskBookId}`));
}

export function filterPhysicalTree(objects: PhysicalObject[], search: string): PhysicalObject[] {
  const keyword = search.trim().toLocaleLowerCase();
  if (!keyword) return objects;
  const matches = (name: string) => name.toLocaleLowerCase().includes(keyword);
  return objects.flatMap(category => {
    if (matches(category.name)) return [category];
    const configurations = category.configurations.flatMap(object => {
      if (matches(object.name)) return [object];
      const experiments = object.experiments.flatMap(configuration => {
        if (matches(configuration.name)) return [configuration];
        const trials = configuration.trials.filter(trial => matches(trial.name) || matches(trial.loadSpectrum || ''));
        return trials.length ? [{ ...configuration, trials }] : [];
      });
      return experiments.length ? [{ ...object, experiments }] : [];
    });
    return configurations.length ? [{ ...category, configurations }] : [];
  });
}
