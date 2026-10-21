import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal } from 'antd';
import { useBlocker } from 'react-router-dom';
import type { ConcreteTrial } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { sessionCapabilities, type SessionCapability } from './sessionModel';
import { TrialWorksheetContext, type WorksheetView } from './trialWorksheetContext';
import TrialWorksheetDock from './TrialWorksheetDock';
import './trialWorksheet.css';

export default function TrialWorksheetProvider({ trial, sessionId, capability, initialRecordId, children }: {
  trial: ConcreteTrial; sessionId: string; capability: SessionCapability; initialRecordId?: string; children: ReactNode;
}) {
  const files = trial.records.flatMap(record => record.rawFiles.filter(file => file.status !== 'removed').map(file => ({ file, record })));
  const enabled = sessionCapabilities.some(item => item.key === capability);
  const [views, setViews] = useState<Record<string, WorksheetView>>(() => Object.fromEntries(sessionCapabilities.map(item => {
    const draft = useSessionStore.getState().sessions.find(item => item.id === sessionId)?.drafts[item.key];
    const fallback = item.key === 'analysis' ? files.filter(item => !initialRecordId || item.record.id === initialRecordId).map(item => item.file.id) : [];
    const saved = draft?.worksheetView as WorksheetView | undefined;
    return [item.key, saved && Array.isArray(saved.opened) ? saved : { opened: Array.isArray(draft?.csvOpenFiles) ? draft.csvOpenFiles : fallback, active: fallback[0], expanded: true }];
  })));
  const viewsRef = useRef(views);
  const [aliases, setAliases] = useState<Record<string, string>>(() => {
    const drafts = useSessionStore.getState().sessions.find(item => item.id === sessionId)?.drafts;
    return Object.assign({}, ...sessionCapabilities.map(item => drafts?.[item.key]?.csvWorksheetNames ?? {}), drafts?.analysis?.worksheetAliases ?? {});
  });
  const view = views[capability] ?? { opened: [], expanded: false };
  const availableIds = view.opened.filter(id => files.some(item => item.file.id === id));
  const active = files.find(item => item.file.id === (view.active === '' ? undefined : availableIds.includes(view.active ?? '') ? view.active : availableIds[0]));
  const [recordId, setRecordId] = useState(initialRecordId ?? trial.records[0]?.id);
  const [dirtyFiles, setDirtyFiles] = useState<Set<string>>(new Set());
  const [analysisTab, setAnalysisTab] = useState('csv');
  const [previewTarget, setPreviewTarget] = useState<HTMLDivElement | null>(null);
  const onPreviewTarget = useCallback((node: HTMLDivElement | null) => setPreviewTarget(node), []);
  const blocker = useBlocker(({ nextLocation }) => [...dirtyFiles].some(id => files.some(item => item.file.id === id)) && !nextLocation.pathname.startsWith(`/sessions/${sessionId}/`));
  useEffect(() => {
    if (![...dirtyFiles].some(id => files.some(item => item.file.id === id))) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirtyFiles, files]);
  const updateView = (patch: Partial<WorksheetView>) => {
    const next = { ...(viewsRef.current[capability] ?? { opened: [], expanded: false }), ...patch, ...(patch.expanded === true ? { closed: false } : {}) };
    const all = { ...viewsRef.current, [capability]: next };
    viewsRef.current = all; setViews(all);
    useSessionStore.getState().updateDraft(sessionId, capability, 'worksheetView', next);
  };
  const openFile = (id: string, expand?: boolean) => {
    const owner = files.find(item => item.file.id === id);
    const current = viewsRef.current[capability] ?? { opened: [], expanded: false };
    updateView({ opened: current.opened.includes(id) ? current.opened : [...current.opened, id], active: id, closed: false, expanded: expand ?? (capability === 'analysis' && analysisTab === 'diagnosis' ? current.expanded : true) });
    if (owner) setRecordId(owner.record.id);
  };
  const onDirtyChange = useCallback((id: string, dirty: boolean) => setDirtyFiles(previous => {
    const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next;
  }), []);
  const retainedIds = [...new Set(Object.values(views).flatMap(view => view.opened))];
  const closeFile = (id: string) => {
    const proceed = () => {
      updateView({ opened: view.opened.filter(value => value !== id), active: view.active === id ? undefined : view.active });
      const elsewhere = Object.entries(views).some(([key, view]) => key !== capability && view.opened.includes(id));
      if (!elsewhere) onDirtyChange(id, false);
    };
    const elsewhere = Object.entries(views).some(([key, view]) => key !== capability && view.opened.includes(id));
    if (dirtyFiles.has(id) && !elsewhere) Modal.confirm({ title: '关闭工作表？', content: '未保存的编辑将丢弃，原 CSV 和已保存成果保留。', okText: '丢弃并关闭', cancelText: '继续编辑', onOk: proceed });
    else proceed();
  };
  const renameFile = (id: string, value: string) => {
    const next = { ...aliases, [id]: value };
    setAliases(next); useSessionStore.getState().updateDraft(sessionId, 'analysis', 'worksheetAliases', next);
  };
  return <TrialWorksheetContext.Provider value={{ trial, files, active, view, aliases, recordId: recordId && trial.records.some(item => item.id === recordId) ? recordId : trial.records[0]?.id, setRecordId: id => { setRecordId(id); const first = files.find(item => item.record.id === id); updateView({ active: first?.file.id ?? '', opened: first && !view.opened.includes(first.file.id) ? [...view.opened, first.file.id] : view.opened }); }, openFile, updateView, dirtyFiles, analysisTab, setAnalysisTab }}>
    <div className="trial-worksheet-workspace" style={enabled ? { paddingBottom: view.closed ? 0 : view.expanded && active ? 'var(--worksheet-space, 580px)' : 48 } : undefined}>
      <div className="session-professional-content">
      {children}
      <div ref={onPreviewTarget} className="worksheet-preview-target" hidden={!enabled || capability === 'analysis' && analysisTab === 'diagnosis'} /></div>
      <TrialWorksheetDock trial={trial} files={files.filter(item => retainedIds.includes(item.file.id))} enabled={enabled} capability={capability} previewTarget={previewTarget} onDirtyChange={onDirtyChange} onClose={closeFile} onRename={renameFile} />
    </div>
    <Modal open={blocker.state === 'blocked'} title="离开当前试验？" okText="丢弃修改并离开" cancelText="继续编辑" onOk={() => blocker.state === 'blocked' && blocker.proceed()} onCancel={() => blocker.state === 'blocked' && blocker.reset()}>工作表有未保存编辑，请先保存工作副本。已保存的文件和成果不会丢失。</Modal>
  </TrialWorksheetContext.Provider>;
}
