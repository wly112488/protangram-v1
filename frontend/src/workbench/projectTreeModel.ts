export type ProjectTreeView = 'overview' | 'worksheet' | 'summary' | 'extra';

export interface ProjectTreeExperiment {
  id: string;
  name: string;
  designSummary?: unknown | null;
  worksheetData?: Record<string, string>;
  extraItems?: string[];
}

export interface ProjectTreeNode {
  key: string;
  title: string;
  children?: ProjectTreeNode[];
}

export interface ProjectTreeSelection {
  experimentId: string | null;
  view: ProjectTreeView;
  extraIndex?: number;
}

export const buildProjectTree = (experiments: ProjectTreeExperiment[]): ProjectTreeNode[] =>
  experiments.map((experiment) => {
    const children: ProjectTreeNode[] = [
      { key: `${experiment.id}-overview`, title: '项目概览' },
    ];

    if (Object.keys(experiment.worksheetData ?? {}).length > 0) {
      children.push({ key: `${experiment.id}-worksheet`, title: '试验工作表' });
    }

    if (experiment.designSummary) {
      children.push({ key: `${experiment.id}-summary`, title: '设计摘要' });
    }

    (experiment.extraItems ?? []).forEach((item, index) => {
      children.push({ key: `${experiment.id}-extra-${index}`, title: item });
    });

    return {
      key: experiment.id,
      title: experiment.name,
      children,
    };
  });

export const resolveProjectSelection = (
  experiments: ProjectTreeExperiment[],
  selectedKey: string,
): ProjectTreeSelection => {
  const experiment = experiments.find((item) =>
    selectedKey === item.id || selectedKey.startsWith(`${item.id}-`),
  );

  if (!experiment) {
    return { experimentId: null, view: 'overview' };
  }

  if (selectedKey === experiment.id || selectedKey === `${experiment.id}-overview`) {
    return { experimentId: experiment.id, view: 'overview' };
  }

  if (selectedKey === `${experiment.id}-worksheet`) {
    return { experimentId: experiment.id, view: 'worksheet' };
  }

  if (selectedKey === `${experiment.id}-summary`) {
    return { experimentId: experiment.id, view: 'summary' };
  }

  const extraMatch = selectedKey.match(new RegExp(`^${experiment.id}-extra-(\\d+)$`));
  if (extraMatch) {
    return {
      experimentId: experiment.id,
      view: 'extra',
      extraIndex: Number(extraMatch[1]),
    };
  }

  return { experimentId: experiment.id, view: 'overview' };
};
