import { Alert, Card, Empty, Space, Table, Tabs, Tag, Typography } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { ReactNode } from 'react';
import { artifactResultLabel, recordLabel } from './physicalBusinessContext';
import { type ResultEntry } from './analysisResultModel';
import TrialChart from './TrialChart';
import TrialDataTable from './TrialDataTable';
import { hasTrialChartNameConflict, type ConcreteTrial } from './physicalObjectStore';

const { Text } = Typography;

export default function AnalysisResults({ entries, actions, extra, shared = false, trial, activeKind, onKindChange }: {
  entries: ResultEntry[]; actions?: (entry: ResultEntry) => ReactNode; extra?: ReactNode; shared?: boolean; trial?: ConcreteTrial; activeKind?: string; onKindChange?: (kind: string) => void;
}) {
  return <Card size="small" className="physical-analysis-results" title={shared ? '分析成果 · 本试验共享' : '分析成果'} extra={extra}>
    <Tabs activeKey={activeKind} defaultActiveKey="chart" onChange={onKindChange} items={(['chart', 'table', 'metric'] as const).map(kind => {
      const items = entries.filter(entry => entry.kind === kind);
      const label = { chart: '图表', table: '数据表', metric: '指标' }[kind];
      return { key: kind, label: `${label} · ${items.length}`, children: items.length ? <div className={kind === 'chart' ? 'physical-charts-grid' : 'physical-results-list'}>{items.map(entry => <Card size="small" key={entry.key} title={entry.name} extra={actions?.(entry)} className="physical-result-object" data-result-key={entry.key}>
        <Space wrap><Tag>{entry.artifact?.source ?? 'CSV 数据处理'}</Tag>{entry.artifact && <Tag>{artifactResultLabel(entry.artifact)}</Tag>}</Space>
        {trial && entry.chart && hasTrialChartNameConflict(trial, entry.name, entry.chart) && <Tag color="orange">历史重名，保存或导出前请改名</Tag>}
        {entry.chart && <TrialChart chart={entry.chart} rawFile={entry.rawFile} />}
        {entry.table && <TrialDataTable table={entry.table} rawFile={entry.rawFile} />}
        {entry.result?.kind === 'chart' && <ReactECharts option={entry.result.option} style={{ height: 300 }} />}
        {entry.result?.kind === 'table' && <Table size="small" rowKey={(_, index) => String(index)} scroll={{ x: true }} pagination={{ pageSize: 10 }} dataSource={entry.result.rows} columns={entry.result.columns.map(column => ({ title: `${column.label}${column.unit ? ` / ${column.unit}` : ''}`, dataIndex: column.key, render: value => value ?? '—' }))} />}
        {entry.result?.kind === 'metric' && <Typography.Paragraph strong>{entry.result.value ?? '—'} {entry.result.unit}</Typography.Paragraph>}
        <div className="physical-result-source">
          <Text type="secondary">来源：{entry.record ? recordLabel(entry.record) : entry.artifact ? artifactSourceLabel(entry) : '来源记录已失效'}{entry.rawFile && ` · ${entry.rawFile.name}`}</Text>
          {(entry.chart || entry.table) && <div><Text type="secondary">依据：{entry.chart ? `${entry.chart.xField} / ${entry.chart.yField}` : entry.table!.fields.join('、')} · 数据行 {(entry.chart ?? entry.table)!.startRow + 1}–{(entry.chart ?? entry.table)!.endRow || '末尾'}</Text></div>}
          {entry.artifact && <ArtifactBasis entry={entry} />}
        </div>
      </Card>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`暂无已保存${label}`} /> };
    })} />
  </Card>;
}

function artifactSourceLabel(entry: ResultEntry) {
  const context = entry.artifact?.payload.sourceContext as { recordName?: string; trialName?: string; experimentName?: string } | undefined;
  const scope = entry.artifact?.payload.sourceScope as { testRecordId?: string } | undefined;
  return context?.recordName ?? (scope?.testRecordId ? `记录 ${scope.testRecordId}` : context?.trialName ?? context?.experimentName ?? '当前试验');
}

function ArtifactBasis({ entry }: { entry: ResultEntry }) {
  const context = entry.artifact?.payload.sourceContext as { experimentName?: string; loadSpectrum?: string; rawFiles?: Array<{ name: string }> } | undefined;
  return <>
    {context && <div><Text type="secondary">依据：{[context.experimentName, context.loadSpectrum, context.rawFiles?.map(file => file.name).join('、')].filter(Boolean).join(' · ')}</Text></div>}
    {entry.result?.basis?.map((text, index) => <div key={index}><Text type="secondary">{text}</Text></div>)}
    {entry.artifact && artifactResultLabel(entry.artifact) === '演示成果' && <Alert type="info" showIcon message="此成果为演示分析，关联的记录和 CSV 仅表示业务上下文。" />}
  </>;
}
