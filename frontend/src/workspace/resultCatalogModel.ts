import { isDemoArtifact } from './physicalBusinessContext';
import type { ResultEntry } from './analysisResultModel';
import type { ConcreteTrial, RawDataFile, TestRecord } from './physicalObjectStore';

export const resultFeatures = [
  { key: 'analysis', label: '数据分析' }, { key: 'doe', label: '智能试验设计' },
  { key: 'digitalTwin', label: '数字孪生' }, { key: 'virtualCondition', label: '虚拟工况' }, { key: 'report', label: '报告' },
] as const;
export interface CatalogResult { entry: ResultEntry; sourceLabel: string }
export interface CatalogFile { key: string; file: RawDataFile; record?: TestRecord; results: CatalogResult[] }
export interface CatalogRecord { key: string; record?: TestRecord; files: CatalogFile[]; results: CatalogResult[] }
export interface CatalogSpectrum { key: string; name: string; trialName?: string; records: CatalogRecord[]; results: CatalogResult[] }

// The directory is a view of the original trial/record/file IDs, never a second store.
export function buildResultCatalog(entries: ResultEntry[], trials: ConcreteTrial[] = [], recordId?: string, looseFiles: Array<RawDataFile & {trialId?:string;trialName?:string;loadSpectrum?:string}> = []): CatalogSpectrum[] {
  const spectra: CatalogSpectrum[] = [];
  const spectrum = (key: string, name: string, trialName?: string) => {
    let node = spectra.find(item => item.key === key);
    if (!node) { node = { key, name, trialName, records: [], results: [] }; spectra.push(node); }
    return node;
  };
  const recordNode = (node: CatalogSpectrum, record?: TestRecord) => {
    const key = `${node.key}/${record?.id ?? 'captured'}`;
    let item = node.records.find(item => item.key === key);
    if (!item) { item = { key, record, files: [], results: [] }; node.records.push(item); }
    return item;
  };
  const fileNode = (node: CatalogRecord, file: RawDataFile) => {
    const key = `${node.key}/${file.id}`;
    let item = node.files.find(item => item.key === key);
    if (!item) { item = { key, file, record: node.record, results: [] }; node.files.push(item); }
    return item;
  };
  for (const trial of trials) {
    const group = spectrum(trial.id, trial.loadSpectrum || '未填写载荷谱', trial.name);
    for (const record of trial.records) {
      if (recordId && record.id !== recordId) continue;
      const run = recordNode(group, record);
      for (const file of record.rawFiles.filter(file => file.status !== 'removed')) fileNode(run, file);
    }
  }
  for (const file of looseFiles) {
    const trial=trials.find(item=>item.id===file.trialId);
    fileNode(recordNode(spectrum(file.trialId ?? 'context',trial?.loadSpectrum ?? file.loadSpectrum ?? '',trial?.name ?? file.trialName)),file);
  }
  const seen = new Set<string>();
  for (const entry of entries) {
    if (seen.has(entry.key)) continue;
    seen.add(entry.key);
    const context = entry.artifact?.payload.sourceContext as { loadSpectrum?: string; trialName?: string; rawFiles?: RawDataFile[] } | undefined;
    const scope = entry.resolvedScope ?? entry.artifact?.payload.sourceScope as { trialId?: string; testRecordId?: string;trialName?:string } | undefined;
    const owner=entry.artifact?.payload.resourceOwner as {kind?:string} | undefined;
    const unboundName=owner?.kind==='cfg'?'构型成果':owner?.kind==='session'?'通用成果':'未关联试验的历史成果';
    const trial = trials.find(trial => trial.id === (entry.trialId ?? scope?.trialId)
      || !scope?.trialId && !entry.trialId && trial.records.some(record => record.id === entry.record?.id));
    const group = spectrum(trial?.id ?? entry.trialId ?? scope?.trialId ?? 'context', trial?.loadSpectrum ?? entry.loadSpectrum ?? context?.loadSpectrum ?? unboundName, trial?.name ?? scope?.trialName ?? context?.trialName);
    const record = entry.record ?? trial?.records.find(record => record.id === scope?.testRecordId);
    if (recordId && record && record.id !== recordId) continue;
    const files = entry.rawFile ? [entry.rawFile] : context?.rawFiles ?? [];
    const explicitCsvSource = Boolean(entry.rawFile) || Boolean(entry.artifact && ['analysis', 'rootCause'].includes(entry.artifact.type) && !isDemoArtifact(entry.artifact));
    if (files.length === 1 && explicitCsvSource) {
      const owner = record ?? trial?.records.find(record => record.rawFiles.some(file => file.id === files[0].id));
      const actual = owner?.rawFiles.find(file => file.id === files[0].id) ?? files[0];
      fileNode(recordNode(group, owner), actual).results.push({ entry, sourceLabel: actual.name });
    } else {
      const target = record ? recordNode(group, record) : group;
      target.results.push({ entry, sourceLabel: files.length ? `${explicitCsvSource ? '多文件来源' : files.length > 1 ? '多文件关联上下文' : '关联上下文'}：${files.map(file => file.name).join('、')}` : '试验成果' });
    }
  }
  return spectra;
}
