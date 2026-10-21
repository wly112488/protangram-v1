import type { DerivedChart } from './physicalObjectStore';
export const plotKinds = [
  { value: 'line', label: '多曲线折线图' }, { value: 'scatter', label: '散点图' }, { value: 'bar', label: '分组柱状图' },
  { value: 'histogram', label: '直方图' }, { value: 'boxplot', label: '箱线图' }, { value: 'bubble', label: '气泡图' },
] as const;
export type PlotKind = typeof plotKinds[number]['value'];
export type PlotConfig = Pick<DerivedChart, 'xField' | 'yField' | 'startRow' | 'endRow' | 'scale' | 'offset' | 'chartType' | 'smooth' | 'color' | 'plotKind' | 'yFields' | 'sizeField' | 'averageEvery'>;
const number = (value: string | undefined) => value?.trim() && Number.isFinite(Number(value)) ? Number(value) : NaN;
const quantile = (values: number[], q: number) => { const p = (values.length - 1) * q, lo = Math.floor(p), f = p - lo; return values[lo] + (values[Math.ceil(p)] - values[lo]) * f; };
export function createWorksheetPlotOption(chart: PlotConfig, input: Record<string, string>[]): Record<string, unknown> {
  const kind = chart.plotKind ?? chart.chartType;
  const rows = input.slice(Math.max(0, chart.startRow), chart.endRow > 0 ? chart.endRow : undefined);
  const fields = chart.yFields?.length ? chart.yFields : [chart.yField];
  const common = { animation: false, tooltip: { trigger: 'axis' }, grid: { left: 62, right: 32, top: 48, bottom: 68 }, dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 12 }] };
  if (kind === 'histogram' || kind === 'boxplot') {
    const chosen = kind === 'histogram' ? [chart.xField] : fields;
    const values = chosen.map(field => rows.map(row => number(row[field])).filter(Number.isFinite).sort((a, b) => a - b));
    if (values.some(data => !data.length)) throw new Error('所选字段没有可绘制的数值');
    if (kind === 'boxplot') return { ...common, xAxis: { type: 'category', data: chosen }, yAxis: { type: 'value' }, series: [{ type: 'boxplot', data: values.map(data => [data[0], quantile(data, .25), quantile(data, .5), quantile(data, .75), data[data.length - 1]]) }] };
    const data = values[0], min = data[0], max = data[data.length - 1];
    const count = min === max ? 1 : Math.max(1, Math.min(30, Math.ceil(Math.sqrt(data.length))));
    const width = (max - min) / count || 1, bins = Array<number>(count).fill(0);
    for (const value of data) bins[Math.min(count - 1, Math.floor((value - min) / width))]++;
    return { ...common, xAxis: { type: 'category', name: chart.xField, data: bins.map((_, i) => `${(min + i * width).toPrecision(4)}–${(min + (i + 1) * width).toPrecision(4)}`) }, yAxis: { type: 'value', name: '频数' }, series: [{ type: 'bar', data: bins, barCategoryGap: '2%' }] };
  }
  if (kind === 'bubble' && !chart.sizeField) throw new Error('气泡图需要第三个大小字段');
  const group = chart.averageEvery ?? 1;
  if (!Number.isInteger(group) || group < 1) throw new Error('平均分组点数应为正整数');
  const series = (kind === 'bubble' ? [chart.yField] : fields).map(field => {
    const points: number[][] = [];
    for (let start = 0; start < rows.length; start += group) {
      const pairs = rows.slice(start, start + group).map(row => [number(row[chart.xField]), number(row[field]) * chart.scale + chart.offset, ...(kind === 'bubble' ? [number(row[chart.sizeField!])] : [])]).filter(pair => pair.every(Number.isFinite));
      if (pairs.length) points.push(pairs[0].map((_, axis) => pairs.reduce((sum, pair) => sum + pair[axis], 0) / pairs.length));
    }
    if (!points.length) throw new Error(`字段 ${field} 没有可配对的数值`);
    const sizes = kind === 'bubble' ? points.map(point => Math.abs(point[2])) : [];
    const maxSize = sizes.reduce((max, size) => Math.max(max, size), 0) || 1;
    return { name: field, type: kind === 'bubble' ? 'scatter' : kind, data: points, smooth: chart.smooth, symbolSize: kind === 'bubble' ? (value: number[]) => 5 + Math.sqrt(Math.abs(value[2]) / maxSize) * 30 : 6 };
  });
  return { ...common, legend: { type: 'scroll', top: 4 }, xAxis: { type: 'value', name: chart.xField, scale: true }, yAxis: { type: 'value', name: fields.length === 1 ? fields[0] : '数值', scale: true }, series };
}
