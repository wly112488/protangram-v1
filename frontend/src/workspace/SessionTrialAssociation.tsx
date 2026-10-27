import { useState } from 'react';
import { Button, Modal, Radio, Select, Space, message } from 'antd';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { getSessionTrialCandidates } from './sessionTrialAssociationModel';
import { TrialCreateForm } from './TrialCreatePage';

export default function SessionTrialAssociation({ sessionId, onClose }: { sessionId: string; onClose: () => void }) {
  const sessions = useSessionStore(state => state.sessions);
  const projects = useProjectStore(state => state.projects);
  const tasks = useTaskStore(state => state.tasks);
  const objects = usePhysicalObjectStore(state => state.objects);
  const session = sessions.find(item => item.id === sessionId);
  const [mode, setMode] = useState('existing');
  const [trialId, setTrialId] = useState<string>();
  const [error, setError] = useState('');
  const candidates = session ? getSessionTrialCandidates(session, objects, projects, sessions, tasks) : [];
  const associate = () => {
    const candidate = candidates.find(item => item.scope.trialId === trialId);
    if (!candidate) { setError(""); return; }
    try {
      useSessionStore.getState().bindTrialToSession(sessionId, candidate.scope, candidate.projectId);
      if (useSessionStore.getState().saveError) throw new Error('本机保存失败，请重试保存');
      message.success('已关联当前工作，后续运行将记录该试验来源');
      onClose();
    } catch (cause) { console.error(cause); setError('试验关联失败'); }
  };
  return <Modal title="关联具体试验" open onCancel={onClose} footer={null} destroyOnHidden width={820}>
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Radio.Group aria-label="具体试验关联方式" value={mode} onChange={event => { setMode(event.target.value); setError(''); }} options={[
        { value: 'existing', label: '关联已有试验' }, { value: 'create', label: '创建具体试验' },
      ]} />
      {mode === 'create' ? <TrialCreateForm sourceSessionId={sessionId} onCreated={onClose} /> : <>
        <Select aria-label="关联已有具体试验" placeholder="选择具体试验" showSearch optionFilterProp="label" style={{ width: '100%' }}
          value={trialId} status={error ? 'error' : undefined} onChange={setTrialId} options={candidates.map(item => ({ value: item.scope.trialId!, label: item.label }))} />
        <Button type="primary" disabled={!trialId} onClick={associate}>确认关联当前工作</Button>
      </>}
    </Space>
  </Modal>;
}
