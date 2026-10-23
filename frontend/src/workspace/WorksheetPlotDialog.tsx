import { Alert, Collapse, Form, Input, InputNumber, Modal, Select, Space, Typography, message } from 'antd';
import { useState } from 'react';
import type { ChartInput } from './physicalObjectStore';
import { plotKinds, type PlotKind } from './worksheetPlotModel';

export default function WorksheetPlotDialog({ kind, headers, selected, fileId, onCancel, onPreview }: {
  kind: PlotKind; headers: string[]; selected: string[]; fileId: string; onCancel: () => void; onPreview: (chart: ChartInput) => void;
}) {
  const [x, setX] = useState(selected[0]);
  const [ys, setYs] = useState(kind === 'boxplot' ? selected : selected.slice(1));
  const [size, setSize] = useState(selected[2]);
  const [average, setAverage] = useState(1);
  const [name, setName] = useState('');
  const options = headers.map(value => ({ value, label: value }));
  const distribution = kind === 'histogram' || kind === 'boxplot';
  const preview = () => {
    const yFields = kind === 'histogram' ? [x] : ys;
    if ((kind !== 'boxplot' && !x) || !yFields.length || yFields.some(value => !value)) return message.warning('请选择图形需要的数据列');
    if (kind === 'bubble' && !size) return message.warning('请选择气泡大小对应的数据列');
    const fallback = `${plotKinds.find(item => item.value === kind)?.label} · ${kind === 'histogram' ? x : yFields.join('、')}`;
    onPreview({ rawFileId: fileId, name: name.trim() || fallback, plotKind: kind, chartType: kind === 'bar' || kind === 'histogram' ? 'bar' : kind === 'bubble' || kind === 'scatter' ? 'scatter' : 'line', xField: kind === 'boxplot' ? yFields[0] : x, yField: yFields[0], yFields, sizeField: kind === 'bubble' ? size : undefined, averageEvery: distribution ? undefined : average, startRow: 0, endRow: 0, scale: 1, offset: 0, color: '#1677ff', smooth: false });
  };
  return <Modal title={`绘图 · ${plotKinds.find(item => item.value === kind)?.label}`} open onCancel={onCancel} onOk={preview} okText="生成预览" cancelText="取消" width={580}>
    <Form layout="vertical">
      {kind === 'boxplot' && <Typography.Paragraph type="secondary">箱体表示四分位数与中位数，两端表示最小值和最大值。</Typography.Paragraph>}
      {kind !== 'boxplot' && <Form.Item label={kind === 'histogram' ? '数值列' : '横轴 / X'}><Select aria-label="绘图横轴" placeholder="选择数据列" value={x} onChange={setX} options={options} /></Form.Item>}
      {kind !== 'histogram' && <Form.Item label={kind === 'boxplot' ? '比较的数据列' : kind === 'bubble' ? '纵轴 / Y' : '曲线 / 数值列'}><Select aria-label="绘图数值列" mode={kind === 'bubble' ? undefined : 'multiple'} placeholder="选择数据列" value={kind === 'bubble' ? ys[0] : ys} onChange={value => setYs(Array.isArray(value) ? value : [value])} options={options} /></Form.Item>}
      {kind === 'bubble' && <Form.Item label="气泡大小"><Select aria-label="气泡大小字段" placeholder="选择第三列" value={size} onChange={setSize} options={options} /></Form.Item>}
      <Form.Item label="图表名称"><Input aria-label="图表名称" placeholder="可使用自动名称" value={name} onChange={event => setName(event.target.value)} /></Form.Item>
      <Collapse ghost items={[{ key: 'processing', label: '数据处理（可选）', children: <Space orientation="vertical" style={{ width: '100%' }}>
        <Typography.Text type="secondary">数据处理只作用于当前图表，不修改原始数据。</Typography.Text>
        {!distribution && <><Space wrap>每 <InputNumber aria-label="平均分组点数" min={1} precision={0} value={average} onChange={value => setAverage(value ?? 1)} /> 行取平均（1 表示不处理）</Space><Alert type="info" showIcon message="仅作用于当前图表：按 CSV 原始行顺序分组，对同组有效配对的坐标取算术平均；不改变原文件或根因分析输入。" /></>}
      </Space> }]} />
    </Form>
  </Modal>;
}
