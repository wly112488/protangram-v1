import { useMemo, useState, type ReactNode } from 'react';
import { Card, Empty, Input, Select, Space, Tag, Tree, Typography } from 'antd';
import { BarChartOutlined, FileTextOutlined, NumberOutlined, SearchOutlined, TableOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { ResultEntry } from './analysisResultModel';
import type { ConcreteTrial } from './physicalObjectStore';
import { buildResultCatalog, resultFeatures, type CatalogResult } from './resultCatalogModel';
import { recordLabel } from './physicalBusinessContext';
import CsvFilePreview from './CsvFilePreview';
import ResultPreview from './ResultPreview';
import './resultCatalog.css';
import type { SessionResourceGroup } from './sessionResourceModel';

const kindLabels = { chart: '图表', table: '数据表', metric: '指标', document: '文档' };
const kindIcons = { chart: <BarChartOutlined />, table: <TableOutlined />, metric: <NumberOutlined />, document: <FileTextOutlined /> };
export default function AnalysisResults({ entries, actions, extra, shared = false, trial, trials, recordId, activeKind, onKindChange, initialArtifactId, groups, hideTitle = false }: {
  hideTitle?: boolean; groups?: SessionResourceGroup[]; entries: ResultEntry[]; actions?: (entry: ResultEntry) => ReactNode; extra?: ReactNode; shared?: boolean; trial?: ConcreteTrial; trials?: ConcreteTrial[]; recordId?: string; activeKind?: string; onKindChange?: (kind: string) => void; initialArtifactId?: string;
}) {
  const [selection, setSelection] = useState<string>();
  const [query, setQuery] = useState('');
  const [localKind, setLocalKind] = useState('all');
  const kind = activeKind ?? localKind;
  const catalogs = useMemo(() => groups ? groups.map(group=>({...group,catalog:buildResultCatalog(group.entries,group.trials,recordId,group.files)})) : [{id:'',name:'',catalog:buildResultCatalog(entries,trials ?? (trial?[trial]:[]),recordId)}], [groups,entries,trials,trial,recordId]);
  const choices = new Map<string, { title: string; body: ReactNode; entry?: ResultEntry; description?: string }>();
  const matches = (text: string) => text.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const resultNode = ({ entry, sourceLabel }: CatalogResult, parentMatches: boolean): DataNode | null => {
    const capability = entry.chart?.sourceCapability ?? entry.artifact?.payload.sourceCapability;
    const origin = resultFeatures.find(item => item.key === capability)?.label;
    if ((kind !== 'all' && entry.kind !== kind) || (!parentMatches && !matches(`${entry.name} ${origin ?? ''}`))) return null;
    const key = `result:${entry.key}`;
    choices.set(key, { title: entry.name, body: <ResultPreview key={entry.key} entry={entry} />, entry, description: entry.artifact?.summary });
    return { key, isLeaf: true, icon: kindIcons[entry.kind], title: <span className="result-directory-title" title={[sourceLabel, origin, entry.artifact?.summary].filter(Boolean).join(' · ')}><span>{entry.name}</span><small>{kindLabels[entry.kind]}{entry.sourceAvailable === false ? ' · 来源失效' : ''}</small>{sourceLabel.startsWith('多文件') && <small>{sourceLabel}</small>}</span> };
  };
  const renderCatalog = (catalog: ReturnType<typeof buildResultCatalog>, groupKey: string, groupMatches: boolean): DataNode[] => catalog.flatMap(spectrum => {
    const parentMatches = groupMatches || matches(`${spectrum.name} ${spectrum.trialName ?? ''}`);
    const runs: DataNode[] = spectrum.records.flatMap(run => {
      const runMatches = parentMatches || Boolean(run.record && matches(recordLabel(run.record)));
      const children: DataNode[] = run.files.flatMap(file => {
        const fileMatches = runMatches || matches(file.file.name);
        const results = file.results.map(result => resultNode(result, fileMatches)).filter((node): node is DataNode => Boolean(node));
        if (!results.length && ((!fileMatches && query.trim()) || kind !== 'all')) return [];
        const key = `file:${groupKey}:${file.key}`;
        choices.set(key, { title: file.file.name, body: <CsvFilePreview key={file.file.id} file={file.file} /> });
        return [{ key, icon: <FileTextOutlined />, title: <span className="result-directory-title"><span>{file.file.name}</span><small>{file.results.length} 项成果{file.file.status === 'removed' ? ' · 已移除' : ''}</small></span>, children: results }];
      });
      children.push(...run.results.map(result => resultNode(result, runMatches)).filter((node): node is DataNode => Boolean(node)));
      if(groups && !run.record) return children;
      return children.length ? [{ key: `run:${groupKey}:${run.key}`, selectable: false, title: run.record ? recordLabel(run.record) : '保存时的来源', children }] : [];
    });
    runs.push(...spectrum.results.map(result => resultNode(result, parentMatches)).filter((node): node is DataNode => Boolean(node)));
    if (groups && spectrum.key === 'context') return runs;
    return runs.length ? [{ key: `spectrum:${groupKey}:${spectrum.key}`, selectable: false, title: <span className="result-directory-spectrum"><strong>{spectrum.name}</strong><small>{spectrum.trialName}</small></span>, children: runs }] : [];
  });
  const treeData: DataNode[] = groups ? catalogs.flatMap(group=>{
    const children=renderCatalog(group.catalog,group.id,Boolean(query.trim()) && matches(group.name));
    return children.length || !query.trim() ? [{key:`owner:${group.id}`,title:group.name,selectable:false,children}] : [];
  }) : renderCatalog(catalogs[0].catalog,'',false);
  const selectedKey = selection ?? (initialArtifactId ? [...choices].find(([, choice]) => choice.entry?.artifact?.id === initialArtifactId)?.[0] : undefined);
  const selected = selectedKey ? choices.get(selectedKey) : undefined;
  return <Card size="small" className="physical-analysis-results" title={hideTitle ? undefined : shared ? '共享数据与成果' : '已保存成果'} extra={extra}>
    <div className="result-catalog-toolbar"><Input prefix={<SearchOutlined />} placeholder="搜索试验、载荷谱、CSV 或成果" aria-label="搜索成果目录" value={query} onChange={event => setQuery(event.target.value)} allowClear /><Select aria-label="成果类型" value={kind} onChange={value => { setLocalKind(value); onKindChange?.(value); }} options={[{ value: 'all', label: '全部类型' }, ...Object.entries(kindLabels).map(([value, label]) => ({ value, label }))]} /></div>
    <div className="result-catalog-layout">
      <aside className="result-catalog-directory" aria-label="试验、执行、CSV 与成果目录">
        {treeData.length ? <Tree key={`${query}:${kind}`} showIcon blockNode defaultExpandAll selectedKeys={selectedKey ? [selectedKey] : []} treeData={treeData} onSelect={keys => { if (keys.length) setSelection(String(keys[0])); }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={query ? '没有匹配的成果' : '暂无数据或已保存成果'} />}
        {selected?.description && <Typography.Paragraph className="result-directory-description">{selected.description}</Typography.Paragraph>}
      </aside>
      <section className="result-catalog-preview" aria-label="选中内容预览">
        {selected ? <><div className="result-preview-heading"><strong>{selected.title}</strong><Space>{selected.entry && <Tag>{kindLabels[selected.entry.kind]}</Tag>}{selected.entry && actions?.(selected.entry)}</Space></div>{selected.body}</> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="从左侧选择 CSV 查看表格，或选择成果查看预览" />}
      </section>
    </div>
  </Card>;
}
