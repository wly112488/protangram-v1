import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Button, Dropdown, Input, Modal, Space } from 'antd';
import { CloseOutlined, DownOutlined, EditOutlined, FullscreenOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons';
import type { ConcreteTrial } from './physicalObjectStore';
import { useTrialWorksheet, type WorksheetFile } from './trialWorksheetContext';
import { recordLabel } from './physicalBusinessContext';
import CsvWorksheetEditor from './CsvWorksheetEditor';

function WorksheetTabEditor({ load, ...props }: ComponentProps<typeof CsvWorksheetEditor> & { load: boolean }) {
  const [visited, setVisited] = useState(load);
  if (load && !visited) setVisited(true);
  return visited || load ? <CsvWorksheetEditor {...props} /> : null;
}

export default function TrialWorksheetDock({ trial, files, enabled, capability, previewTarget, onDirtyChange, onClose, onRename }: {
  trial: ConcreteTrial; files: WorksheetFile[]; enabled: boolean; capability: string; previewTarget: HTMLElement | null;
  onDirtyChange: (id: string, dirty: boolean) => void; onClose: (id: string) => void; onRename: (id: string, value: string) => void;
}) {
  const workspace = useTrialWorksheet()!;
  const { view, active, aliases, openFile, updateView, dirtyFiles } = workspace;
  const [rename, setRename] = useState<{ id: string; name: string }>();
  const [height, setHeight] = useState(Math.min(580, window.innerHeight * .6));
  const [dragging, setDragging] = useState(false);
  const [geometry, setGeometry] = useState({ left: 0, width: window.innerWidth });
  const root = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; height: number; nextHeight: number } | null>(null);
  const reopenDrag = useRef<number | null>(null);
  useEffect(() => {
    const main = root.current?.closest('.session-main');
    const update = () => {
      const rect = main?.getBoundingClientRect();
      setGeometry({ left: rect?.left ?? 0, width: rect?.width ?? window.innerWidth });
      setHeight(previous => Math.max(220, Math.min(previous, window.innerHeight * .76)));
    };
    update(); window.addEventListener('resize', update);
    const observer = new ResizeObserver(update); if (main) observer.observe(main);
    return () => { observer.disconnect(); window.removeEventListener('resize', update); };
  }, []);
  useEffect(() => {
    const workspace = root.current?.closest<HTMLElement>('.trial-worksheet-workspace');
    workspace?.style.setProperty('--worksheet-space', `${height + 10}px`);
  }, [height]);
  useEffect(() => {
    const tabs = root.current?.querySelector<HTMLElement>('.worksheet-file-tabs');
    const selected = tabs?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!tabs || !selected) return;
    const left = selected.offsetLeft, right = left + selected.offsetWidth;
    if (left < tabs.scrollLeft) tabs.scrollLeft = left;
    else if (right > tabs.scrollLeft + tabs.clientWidth) tabs.scrollLeft = right - tabs.clientWidth;
  }, [active?.file.id, enabled, geometry.width, aliases, view.closed]);
  const expanded = view.expanded && Boolean(active);
  const tabs = workspace.files.filter(item => view.opened.includes(item.file.id));
  const finishResize = (cancelled: boolean) => {
    const current = drag.current;
    drag.current = null;
    setDragging(false);
    if (!current) return;
    if (!cancelled && current.nextHeight < 160) updateView({ closed: true });
    setHeight(cancelled || current.nextHeight < 160 ? current.height : Math.max(220, current.nextHeight));
  };
  const reopen = () => {
    if (!active && workspace.files[0]) openFile(workspace.files[0].file.id, true);
    else updateView({ closed: false, expanded: true });
  };
  return <>
    <button type="button" className="worksheet-reopen-handle" aria-label="打开工作表区" title="上拉或点击展开工作表" hidden={!enabled || !view.closed} style={{ left: geometry.left + geometry.width / 2 }} onClick={reopen}
      onPointerDown={event => { reopenDrag.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerUp={event => {
        const distance = reopenDrag.current === null ? 0 : reopenDrag.current - event.clientY;
        reopenDrag.current = null;
        if (distance > 24) { setHeight(Math.max(220, Math.min(window.innerHeight * .76, distance))); reopen(); }
      }} onPointerCancel={() => { reopenDrag.current = null; }}><UpOutlined /></button>
    <div ref={root} className={`trial-worksheet-dock ${expanded ? 'is-expanded' : 'is-collapsed'}${dragging ? ' is-dragging' : ''}`} hidden={!enabled || view.closed} style={{ left: geometry.left, width: geometry.width, height: expanded ? height : 44 }}>
    <div className="worksheet-resize-handle" role="separator" aria-label="调整工作表高度" aria-orientation="horizontal" aria-valuemin={0} aria-valuemax={Math.round(window.innerHeight * .76)} aria-valuenow={Math.round(height)} title="上下拖动调整高度，下拉到底完全收起" tabIndex={0} hidden={!expanded}
      onKeyDown={event => {
        if (event.key === 'End' || event.key === 'ArrowDown' && height <= 220) { event.preventDefault(); updateView({ closed: true }); }
        else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); setHeight(value => Math.max(220, Math.min(window.innerHeight * .76, value + (event.key === 'ArrowUp' ? 30 : -30)))); }
      }}
      onPointerDown={event => { drag.current = { y: event.clientY, height, nextHeight: height }; setDragging(true); event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => {
        if (!drag.current) return;
        drag.current.nextHeight = Math.max(44, Math.min(window.innerHeight * .76, drag.current.height + drag.current.y - event.clientY));
        setHeight(drag.current.nextHeight);
      }} onPointerUp={() => finishResize(false)} onPointerCancel={() => finishResize(true)}><span /></div>
    <div className="worksheet-dock-heading" hidden={!expanded}><strong>{active ? aliases[active.file.id] ?? active.file.name : '工作表'}</strong><Space><Button size="small" icon={<EditOutlined />} aria-label="重命名工作表" onClick={() => active && setRename({ id: active.file.id, name: aliases[active.file.id] ?? active.file.name })} /><Button size="small" icon={<FullscreenOutlined />} aria-label="最大化工作表" onClick={() => setHeight(window.innerHeight * .76)} /><Button size="small" icon={<DownOutlined />} onClick={() => updateView({ expanded: false })}>收起</Button><Button size="small" icon={<CloseOutlined />} aria-label="关闭工作表区" title="完全关闭工作表区" onClick={() => updateView({ closed: true })} /></Space></div>
    <div className="worksheet-editor-scroll" hidden={!expanded}>
      {files.map(({ file, record }) => <div key={file.id} hidden={!enabled || active?.file.id !== file.id}>
        <WorksheetTabEditor load={enabled && !view.closed && view.expanded && active?.file.id === file.id} file={file} record={record} trial={trial} tabName={aliases[file.id] ?? file.name} capability={capability} previewTarget={previewTarget} active={enabled && active?.file.id === file.id} onSavedCopy={id => openFile(id, true)} onDirtyChange={onDirtyChange} />
      </div>)}

    </div>
    <div className="worksheet-bottom-bar">
      <div className="worksheet-file-tabs" role="tablist" aria-label="CSV 工作表">{tabs.map(({ file, record }) => <div role="tab" aria-selected={file.id === active?.file.id} tabIndex={0} key={file.id} className={file.id === active?.file.id ? 'is-active' : ''} title={`${file.name} · ${recordLabel(record)}`} onClick={() => openFile(file.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openFile(file.id); } }} onDoubleClick={() => setRename({ id: file.id, name: aliases[file.id] ?? file.name })}><span>{aliases[file.id] ?? file.name}{dirtyFiles.has(file.id) ? ' *' : ''}</span><button type="button" aria-label={`关闭工作表 ${aliases[file.id] ?? file.name}`} onClick={event => { event.stopPropagation(); onClose(file.id); }}><CloseOutlined /></button></div>)}</div>
      <Dropdown trigger={['click']} menu={{ style: { maxHeight: 320, overflowY: 'auto' }, items: workspace.files.map(({ file, record }) => ({ key: file.id, label: `${aliases[file.id] ?? file.name} · ${recordLabel(record)}` })), onClick: ({ key }) => openFile(key) }}><Button type="text" disabled={!workspace.files.length} icon={<PlusOutlined />} aria-label="打开已有 CSV" /></Dropdown>
      <Button type="text" className="worksheet-toggle" aria-label={expanded ? '收起表格' : '展开表格'} icon={expanded ? <DownOutlined /> : <UpOutlined />} onClick={() => { if (!active && workspace.files[0]) openFile(workspace.files[0].file.id, true); else updateView({ expanded: !expanded }); }}>{expanded ? '收起表格' : '展开表格'}</Button>
      <Button type="text" icon={<CloseOutlined />} aria-label="关闭工作表区" title="完全关闭工作表区" onClick={() => updateView({ closed: true })} />
    </div>
    <Modal title="重命名工作表标签" open={Boolean(rename)} okText="保存名称" cancelText="取消" onCancel={() => setRename(undefined)} onOk={() => {
      if (!rename?.name.trim()) return;
      if (workspace.files.some(({ file }) => file.id !== rename.id && (aliases[file.id] ?? file.name) === rename.name.trim())) return;
      onRename(rename.id, rename.name.trim()); setRename(undefined);
    }}><Input aria-label="工作表标签名称" status={rename && (!rename.name.trim() || workspace.files.some(({file}) => file.id !== rename.id && (aliases[file.id] ?? file.name) === rename.name.trim())) ? 'error' : undefined} value={rename?.name} onChange={event => rename && setRename({ ...rename, name: event.target.value })} /><p>只修改标签名称，不改变原文件和成果来源。</p></Modal>
  </div></>;
}
