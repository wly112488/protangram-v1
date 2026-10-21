import { useState } from 'react';
import { Button, Card, Typography } from 'antd';
import type { ResultEntry } from './analysisResultModel';
import ResultPreview from './ResultPreview';

// The saved service output determines the list; no frontend anomaly schema or conclusions are invented.
export default function CsvDiagnosisResults({ entries, onViewSource }: { entries: ResultEntry[]; onViewSource: () => void }) {
  const [selected, setSelected] = useState<string>();
  const current = entries.find(entry => entry.key === selected) ?? entries[0];
  if (!current) return null;
  return <div className="csv-diagnosis-layout">
    <aside aria-label="当前 CSV 的分析结果">{entries.map(entry => <button type="button" key={entry.key} className={entry.key === current.key ? 'is-active' : ''} onClick={() => setSelected(entry.key)}>{entry.name}</button>)}</aside>
    <Card size="small" title={current.name} extra={<Button onClick={onViewSource}>查看源 CSV</Button>}>
      <ResultPreview key={current.key} entry={current} />
      {current.result?.basis?.length ? <div className="csv-diagnosis-evidence"><Typography.Text strong>判断依据</Typography.Text>{current.result.basis.map((basis, index) => <Typography.Paragraph key={index}>{basis}</Typography.Paragraph>)}</div> : null}
    </Card>
  </div>;
}
