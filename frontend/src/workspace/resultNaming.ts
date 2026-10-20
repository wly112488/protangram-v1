import type { ResultEntry } from './analysisResultModel';

/** Check the whole trial, excluding only the artifact being updated. */
export function assertUniqueResultNames(
  results: ReadonlyArray<{ name: string }>,
  existing: ResultEntry[],
  updating?: { projectId: string; artifactId?: string },
) {
  const key = (name: string) => name.trim().normalize('NFC').toLocaleLowerCase();
  const names = new Set(existing.filter(entry => !(updating?.artifactId && entry.artifact?.projectId === updating.projectId && entry.artifact.id === updating.artifactId)).map(entry => key(entry.name)));
  for (const result of results) {
    const name = result.name.trim();
    if (!name) throw new Error('请填写成果名称');
    if (names.has(key(name))) throw new Error(`成果“${name}”重名，请修改名称后保存`);
    names.add(key(name));
  }
}
