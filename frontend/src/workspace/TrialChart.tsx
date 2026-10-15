import { useEffect, useState } from 'react';
import { Alert } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { DerivedChart, RawDataFile } from './physicalObjectStore';
import { loadTrialChartOption } from './trialChartOutput';

export default function TrialChart({ chart, rawFile }: { chart: DerivedChart; rawFile?: RawDataFile }) {
  const cacheKey = JSON.stringify(chart);
  const [result, setResult] = useState<{ key: string; option?: Record<string, unknown>; error?: string }>({ key: '' });
  useEffect(() => {
    let current = true;
    if (!rawFile) return;
    loadTrialChartOption(chart, rawFile).then(option => {
      if (!current) return;
      setResult({ key: cacheKey, option });
    }).catch(reason => current && setResult({ key: cacheKey, error: reason instanceof Error ? reason.message : '读取原始文件失败' }));
    return () => { current = false; };
  }, [cacheKey, chart, rawFile]);
  if (!rawFile) return <Alert type="warning" showIcon message="原始文件引用不存在" />;
  if (result.key !== cacheKey) return <div className="physical-chart-loading">读取数据…</div>;
  if (result.error) return <Alert type="warning" showIcon message={result.error} />;
  return <ReactECharts option={result.option} style={{ height: 300, width: '100%' }} notMerge />;
}
