import * as echarts from 'echarts';
import type { DerivedChart, RawDataFile } from './physicalObjectStore';
import { buildChartPoints, readTrialFile } from './trialDataFiles';

// The preview, saved result and PNG use the same CSV reader and chart options.
export async function loadTrialChartOption(chart: DerivedChart, rawFile: RawDataFile) {
  if (rawFile.id !== chart.rawFileId || !rawFile.headers.includes(chart.xField) || !rawFile.headers.includes(chart.yField)) throw new Error('图表原始 CSV 字段引用已失效');
  const { rows } = await readTrialFile(rawFile.id);
  const points = buildChartPoints(rows, chart.xField, chart.yField, chart);
  if (!points.length) throw new Error('当前字段范围内没有可绘制的数值');
  return {
    animation: false, tooltip: { trigger: 'axis' }, grid: { left: 56, right: 24, top: 28, bottom: 48 },
    xAxis: { type: 'value', name: chart.xField, scale: true }, yAxis: { type: 'value', name: chart.yField, scale: true },
    series: [{ type: chart.chartType, data: points, smooth: chart.smooth, symbolSize: 6, itemStyle: { color: chart.color }, lineStyle: { color: chart.color } }],
  };
}

export async function downloadTrialChart(chart: DerivedChart, rawFile: RawDataFile, source: string) {
  const option = await loadTrialChartOption(chart, rawFile);
  const container = document.createElement('div');
  container.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:600px';
  document.body.append(container);
  const instance = echarts.init(container, undefined, { renderer: 'canvas', width: 1000, height: 600 });
  try {
    instance.setOption({ ...option, backgroundColor: '#fff', title: { text: chart.name, subtext: `${source} · ${rawFile.name}` }, grid: { ...option.grid, top: 80 } });
    const link = document.createElement('a');
    link.href = instance.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#fff' });
    const filename = [...chart.name].map(character => character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character) ? '_' : character).join('');
    link.download = `${filename}.png`;
    document.body.append(link); link.click(); link.remove();
  } finally { instance.dispose(); container.remove(); }
}
