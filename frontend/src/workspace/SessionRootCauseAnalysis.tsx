import { useMemo, useState } from 'react';
import { Alert, Card, Form, Select, Space, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import { LegacyAnalysisProjects } from '../pages/analysis/projects/AnalysisProjects';
import { useProfessionalCfgSelection } from './professionalScopeContext';
import { collectSessionResourceGroups } from './sessionResourceModel';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';

export default function SessionRootCauseAnalysis() {
  const { sessionId } = useParams();
  const selection = useProfessionalCfgSelection();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const configurations = useTrialConfigurationStore(state => state.configurations);
  const selectedCfgId = selection?.cfgId;
  const groups = useMemo(() => sessionId
    ? collectSessionResourceGroups(projects, sessions, objects, configurations, sessionId)
    : [], [sessionId, projects, sessions, objects, configurations]);
  const candidates = useMemo(() => [
    ...(groups.find(group => group.id === 'generic')?.files ?? []).map(file => ({ file, ownerLabel: '通用' })),
    ...(selectedCfgId ? (groups.find(group => group.id === selectedCfgId)?.files ?? []).map(file => ({ file, ownerLabel: configurations.find(cfg => cfg.id === selectedCfgId)?.name ?? '当前 CFG' })) : []),
  ], [groups, selectedCfgId, configurations]);
  const [selectedFileId, setSelectedFileId] = useState<string>();
  const selected = candidates.find(item => item.file.id === selectedFileId)?.file;
  const selectedOptions = useMemo(() => candidates.map(({ file, ownerLabel }) => ({ value: file.id, label: `${ownerLabel} · ${file.name}` })), [candidates]);

  return <>
    <Card size="small" style={{ marginBottom: 16 }}>
      <Form layout="vertical" style={{ maxWidth: 900 }}>
        <Space align="start" size={16} wrap>
          <Form.Item label="试验构型 CFG" required style={{ width: 360 }}>
            <Select aria-label="根因分析使用的试验构型 CFG" showSearch optionFilterProp="label" placeholder="选择 CFG" value={selectedCfgId} onChange={value => { selection?.selectCfg(value); setSelectedFileId(undefined); }} options={configurations.map(item => ({ value: item.id, label: `${item.name} · ${item.id}` }))} />
          </Form.Item>
          <Form.Item label="分析数据" required style={{ width: 420 }}>
            <Select aria-label="根因分析数据" showSearch optionFilterProp="label" allowClear placeholder={selectedCfgId ? '选择通用数据或该 CFG 下的数据' : '请先选择 CFG'} value={selectedFileId} disabled={!selectedCfgId} onChange={setSelectedFileId} options={selectedOptions} />
          </Form.Item>
        </Space>
        {selected && <Typography.Text type="secondary">本次根因分析输入：{selected.name}</Typography.Text>}
        {selection?.error && <Alert type="error" showIcon title={selection.error} />}
      </Form>
    </Card>
    <LegacyAnalysisProjects rootCauseOnly selectedDataFile={selected} />
  </>;
}
