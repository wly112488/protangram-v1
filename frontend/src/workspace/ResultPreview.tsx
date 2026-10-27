import { useState } from 'react';
import { Button, Table, Typography, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useNavigate, useParams } from 'react-router-dom';
import { loadAnalysisReports } from '../utils/storage';
import type { ResultEntry } from './analysisResultModel';
import TrialChart from './TrialChart';
import TrialDataTable from './TrialDataTable';
import { recordLabel } from './physicalBusinessContext';
import { downloadTrialChart } from './trialChartOutput';
import { WORKSHEET_PAGE_SIZE } from './csvWorksheetModel';
import type { PhysicalBusinessScope } from './sessionModel';

export default function ResultPreview({ entry }: { entry: ResultEntry }) {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const [exporting, setExporting] = useState(false);
  const reportId = entry.artifact?.payload.reportId;
  const report = entry.kind === 'document' && typeof reportId === 'string' ? loadAnalysisReports().find(item => item.id === reportId) : undefined;
  const sourceScope = entry.artifact?.payload.sourceScope as PhysicalBusinessScope | undefined;
  return <div className="result-preview" data-result-key={entry.key}>


    {entry.chart && <Button icon={<DownloadOutlined />} loading={exporting} disabled={entry.sourceAvailable === false || !entry.rawFile} onClick={async () => {
      if (!entry.chart || !entry.rawFile || entry.sourceAvailable === false) return;
      setExporting(true);
      try { await downloadTrialChart(entry.chart, entry.rawFile, [entry.loadSpectrum, entry.record && recordLabel(entry.record)].filter(Boolean).join(' / ')); }
      catch (error) { console.error(error); message.error('PNG 导出失败'); }
      finally { setExporting(false); }
    }}>导出 PNG</Button>}
    {entry.chart && entry.sourceAvailable !== false && <TrialChart chart={entry.chart} rawFile={entry.rawFile} />}
    {entry.table && <TrialDataTable table={entry.table} rawFile={entry.rawFile} />}
    {entry.result?.kind === 'chart' && <ReactECharts option={entry.result.option} style={{ height: 390 }} notMerge />}
    {entry.result?.kind === 'table' && <Table size="small" rowKey={(_, index) => String(index)} scroll={{ x: 'max-content' }} pagination={{ defaultPageSize: WORKSHEET_PAGE_SIZE, showSizeChanger: false }} dataSource={entry.result.rows} columns={entry.result.columns.map(column => ({ title: `${column.label}${column.unit ? ` / ${column.unit}` : ''}`, dataIndex: column.key, width: 150, render: value => value ?? '—' }))} />}
    {entry.kind === 'document' && <><Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{report?.reportContent || entry.artifact?.summary}</Typography.Paragraph>{report && <Button onClick={() => navigate(`${sessionId ? `/sessions/${sessionId}` : ''}/report/generate/${encodeURIComponent(report.id)}`, { state: entry.artifact ? { workspaceSession: { mode: 'project', targetProjectId: entry.artifact.projectId, ...sourceScope } } : undefined })}>打开报告</Button>}</>}
    {entry.result?.kind === 'metric' && <Typography.Paragraph className="result-metric-value">{entry.result.value ?? '—'} {entry.result.unit}</Typography.Paragraph>}
  </div>;
}
