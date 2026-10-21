import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnType } from 'antd/es/table';
import { Alert, Button, Card, Dropdown, Input, Modal, Space, Table, Tag, Typography, message } from 'antd';
import { EditOutlined, SaveOutlined, LineChartOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { createPortal } from 'react-dom';
import WorksheetPlotDialog from './WorksheetPlotDialog';
import { plotKinds, type PlotKind } from './worksheetPlotModel';
import { v4 as uuid } from 'uuid';
import { usePhysicalObjectStore, type ConcreteTrial, type ChartInput, type RawDataFile, type TestRecord } from './physicalObjectStore';
import { readTrialFile, saveTrialFile, type ParsedRawFile } from './trialDataFiles';
import { createTrialChartOption } from './trialChartOutput';
import { editWorksheetCell, renameWorksheetField, selectWorksheetColumn, serializeWorksheet, WORKSHEET_PAGE_SIZE } from './csvWorksheetModel';

export default function CsvWorksheetEditor({ file, trial, record, tabName, onSavedCopy, onDirtyChange, capability, previewTarget, active }: {
  file: RawDataFile; trial: ConcreteTrial; record: TestRecord; tabName: string;
  capability: string; previewTarget: HTMLElement | null; active: boolean;
  onSavedCopy: (fileId: string) => void; onDirtyChange: (id: string, dirty: boolean) => void;
}) {
  const [data, setData] = useState<ParsedRawFile>();
  const originalData = useRef<ParsedRawFile | undefined>(undefined);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [dialog, setDialog] = useState<{ kind: PlotKind; key: number }>();
  const [previews, setPreviews] = useState<Record<string, { config: ChartInput; option: Record<string, unknown> }>>({});
  const [tableName, setTableName] = useState<string>();
  const [cell, setCell] = useState<{ row: number; field: string }>();
  const currentPreview = previews[capability];
  const [editing, setEditing] = useState<{ row: number; field: string; value: string }>();
  const [renaming, setRenaming] = useState<{ field: string; name: string }>();
  const [copyName, setCopyName] = useState<string>();
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let current = true;
    readTrialFile(file.id).then(value => { if (current) { originalData.current = value; setData(value); } }).catch(reason => { if (current) setError(reason instanceof Error ? reason.message : '读取 CSV 失败'); });
    return () => { current = false; };
  }, [file.id]);
  const rows = useMemo(() => data?.rows.map((values, rowIndex) => ({ values, rowIndex })) ?? [], [data]);
  const selectedFields = selected.length ? selected : data?.headers ?? [];
  const modify = (next: ParsedRawFile) => { setData(next); setDirty(true); onDirtyChange(file.id, true); setPreviews({}); };
  const commitCell = () => {
    if (!editing || !data) return;
    if (data.rows[editing.row][editing.field] !== editing.value) modify(editWorksheetCell(data, editing.row, editing.field, editing.value));
    setEditing(undefined);
  };
  const preview = (config: ChartInput) => {
    if (!data) return;
    try {
      const option = createTrialChartOption(config, data.rows) as Record<string, unknown>;
      setPreviews(previous => ({ ...previous, [capability]: { config: { ...config, sourceCapability: capability }, option } })); setDialog(undefined);
      requestAnimationFrame(() => previewTarget?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (reason) { message.error(reason instanceof Error ? reason.message : '无法绘图'); }
  };
  const saveChart = () => {
    if (dirty) return message.warning('请先保存编辑后的 CSV 工作副本，再保存成果');
    if (!currentPreview) return;
    try {
      usePhysicalObjectStore.getState().saveChart(trial.id, record.id, currentPreview.config);
      message.success('图表已保存到本机，可在左侧共享数据与成果中查看');
    } catch (reason) { message.error(reason instanceof Error ? reason.message : '保存失败'); }
  };
  const saveTable = () => {
    if (dirty) return message.warning('请先保存编辑后的 CSV 工作副本，再保存成果');
    try {
      usePhysicalObjectStore.getState().saveTable(trial.id, record.id, { name: tableName?.trim() || `${tabName} · 数据表`, rawFileId: file.id, fields: selectedFields, startRow: 0, endRow: 0 });
      setTableName(undefined); message.success('数据表已保存到本机，可在左侧共享数据与成果中查看');
    } catch (reason) { message.error(reason instanceof Error ? reason.message : '保存失败'); }
  };
  const saveCopy = async () => {
    if (!data) return;
    if (!copyName?.trim()) return message.warning('请填写工作副本文件名');
    const filename = copyName.trim().toLowerCase().endsWith('.csv') ? copyName.trim() : `${copyName.trim()}.csv`;
    if (record.rawFiles.some(item => item.status !== 'removed' && item.name.toLocaleLowerCase() === filename.toLocaleLowerCase())) return message.warning('当前执行记录已有同名 CSV，请修改名称');
    setSaving(true);
    try {
      const id = `raw-${uuid()}`, contents = serializeWorksheet(data);
      const blob = new File([contents], filename, { type: 'text/csv' });
      await saveTrialFile(id, blob);
      usePhysicalObjectStore.getState().addRawFile(trial.id, record.id, { id, name: filename, sourceRawFileId: file.id, headers: data.headers, rowCount: data.rows.length, mimeType: 'text/csv', size: blob.size, addedAt: new Date().toISOString(), status: 'available' });
      // Editing helpers are immutable. Restore the already loaded original snapshot
      // before unlocking; no delayed read may overwrite edits made after saving.
      setData(originalData.current); setSelected([]); setPreviews({});
      setDirty(false); onDirtyChange(file.id, false); setCopyName(undefined); onSavedCopy(id);
      message.success('工作副本已保存到本机；原始 CSV 和既有成果保持原来源');
    } catch (reason) { message.error(reason instanceof Error ? reason.message : '保存工作副本失败'); }
    finally { setSaving(false); }
  };
  if (error) return <Alert type="error" showIcon message={error} />;
  if (!data) return <div className="physical-chart-loading">正在读取 CSV…</div>;
  return <div className="csv-worksheet-editor">
    <div className="csv-worksheet-status"><Typography.Text type="secondary">{file.name} · {data.rows.length} 行 · {data.headers.length} 列</Typography.Text>{dirty && <Tag color="orange">有未保存修改</Tag>}<Button icon={<SaveOutlined />} disabled={!dirty} onClick={() => setCopyName(`${tabName.replace(/\.csv$/i, '')}（编辑副本）.csv`)}>保存工作副本</Button></div>
    <Space className="csv-worksheet-actions" wrap>
      <Dropdown trigger={['click']} menu={{ items: plotKinds.map(item => ({ key: item.value, label: item.label })), onClick: ({ key }) => setDialog({ kind: key as PlotKind, key: Date.now() }) }}><Button aria-label="绘图" icon={<LineChartOutlined />}>绘图</Button></Dropdown>
      <Button disabled={dirty} onClick={() => setTableName(`${tabName} · 数据表`)}>保存数据表</Button>
      <Typography.Text type="secondary">选列后右键绘图 · Ctrl 多选 / Shift 连选 · 双击或直接输入编辑</Typography.Text>
    </Space>
    {active && currentPreview && previewTarget && createPortal(<Card className="worksheet-chart-preview" size="small" title={currentPreview.config.name} extra={<Space>{dirty && <Tag color="orange">未保存数据预览</Tag>}<Button type="primary" disabled={dirty} onClick={saveChart}>保存图表</Button><Button onClick={() => setDialog({ kind: currentPreview.config.plotKind ?? 'line', key: Date.now() })}>重新绘图</Button></Space>}>
      <Typography.Text type="secondary">{file.name} · {currentPreview.config.averageEvery && currentPreview.config.averageEvery > 1 ? `每 ${currentPreview.config.averageEvery} 行取平均` : '原始数值'}</Typography.Text>
      <ReactECharts option={currentPreview.option} style={{ height: 320 }} notMerge />
    </Card>, previewTarget)}
    <Dropdown trigger={['contextMenu']} menu={{ items: [{ key: 'plot', label: '绘图', children: plotKinds.map(item => ({ key: item.value, label: item.label })) }], onClick: ({ key }) => setDialog({ kind: key as PlotKind, key: Date.now() }) }}>
    <div className="worksheet-context-surface"><Table className="csv-worksheet-grid" aria-label={`工作表 ${tabName}`} size="small" rowKey="rowIndex" dataSource={rows}
      pagination={{ defaultPageSize: WORKSHEET_PAGE_SIZE, pageSizeOptions: [15, 30, 50], showSizeChanger: true, showTotal: total => `共 ${total} 行` }} scroll={{ x: 'max-content' }}
      columns={[{ key: '__row_number__', width: 60, fixed: 'left', title: '#', render: (_value, row) => row.rowIndex + 1 }, ...data.headers.map((field): ColumnType<{ values: Record<string, string>; rowIndex: number }> => ({ key: field, width: 160, title: <span className="csv-column-title">{field}<Button type="text" size="small" icon={<EditOutlined />} aria-label={`重命名字段 ${field}`} onClick={event => { event.stopPropagation(); setRenaming({ field, name: field }); }} /></span>,
        onHeaderCell: () => ({ onContextMenu: () => { if (!selected.includes(field)) setSelected([field]); }, className: selected.includes(field) ? 'csv-column-selected' : '', onClick: (event: React.MouseEvent) => {
          const next = selectWorksheetColumn(data.headers, selected, field, { additive: event.ctrlKey || event.metaKey, range: event.shiftKey });
          setSelected(next);
        } }),
        onCell: row => ({ tabIndex: 0, className: `${selected.includes(field) ? 'csv-column-selected' : ''} ${cell?.row === row.rowIndex && cell?.field === field ? 'csv-cell-selected' : ''}`, onClick: () => setCell({ row: row.rowIndex, field }), onDoubleClick: () => setEditing({ row: row.rowIndex, field, value: row.values[field] ?? '' }), onKeyDown: (event: React.KeyboardEvent) => { if (event.target !== event.currentTarget) return; if (event.key === 'Enter' || (event.key.length === 1 && !event.ctrlKey && !event.metaKey)) { event.preventDefault(); setEditing({ row: row.rowIndex, field, value: event.key === 'Enter' ? row.values[field] ?? '' : event.key }); } } }),
        render: (_value, row) => editing && editing.row === row.rowIndex && editing.field === field ? <Input aria-label={`编辑第${row.rowIndex + 1}行 ${field}`} autoFocus size="small" value={editing.value} onChange={event => setEditing(current => current ? { ...current, value: event.target.value } : current)} onBlur={commitCell} onPressEnter={commitCell} onKeyDown={event => { if (event.key === 'Escape') setEditing(undefined); if (event.key === 'Tab') { event.preventDefault(); commitCell(); const index = data.headers.indexOf(field) + (event.shiftKey ? -1 : 1); const nextField = data.headers[index]; if (nextField) setEditing({ row: row.rowIndex, field: nextField, value: row.values[nextField] ?? '' }); } }} /> : row.values[field],
      }))]} /></div>
    </Dropdown>
    {dialog && <WorksheetPlotDialog key={dialog.key} kind={dialog.kind} headers={data.headers} selected={selected} fileId={file.id} onCancel={() => setDialog(undefined)} onPreview={preview} />}
    <Modal title="保存数据表" open={tableName !== undefined} onCancel={() => setTableName(undefined)} onOk={saveTable} okText="保存到本机" cancelText="取消"><Input aria-label="数据表名称" value={tableName} onChange={event => setTableName(event.target.value)} /></Modal>
    <Modal title="重命名字段" open={Boolean(renaming)} onCancel={() => setRenaming(undefined)} okText="确定" cancelText="取消" onOk={() => {
      if (!renaming) return;
      if (renaming.name.trim() === renaming.field) { setRenaming(undefined); return; }
      try { modify(renameWorksheetField(data, renaming.field, renaming.name)); setSelected(selected.map(field => field === renaming.field ? renaming.name.trim() : field)); setRenaming(undefined); }
      catch (reason) { message.error(reason instanceof Error ? reason.message : '重命名失败'); }
    }}><Input aria-label="新字段名称" value={renaming?.name} onChange={event => renaming && setRenaming({ ...renaming, name: event.target.value })} /></Modal>
    <Modal title="保存 CSV 工作副本" open={copyName !== undefined} confirmLoading={saving} closable={!saving} maskClosable={!saving} keyboard={!saving} cancelButtonProps={{ disabled: saving }} okText="保存到本机" cancelText="取消" onCancel={() => { if (!saving) setCopyName(undefined); }} onOk={() => { if (!saving) void saveCopy(); }}><Typography.Paragraph>原始文件保留，修改后的 CSV 会保存为同一执行记录下的新文件。</Typography.Paragraph><Input aria-label="工作副本文件名" value={copyName} onChange={event => setCopyName(event.target.value)} /></Modal>
  </div>;
}
