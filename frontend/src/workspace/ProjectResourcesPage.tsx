import { useState } from 'react';
import { Button, List, Modal, Select, Space, Tabs, Typography } from 'antd';
import { FolderOpenOutlined } from '@ant-design/icons';
import { useLocation, useSearchParams } from 'react-router-dom';
import ProjectContent from './ProjectContent';
import TaskBookAnalysisPage from './TaskBookAnalysisPage';
import ProjectTrialsView from './ProjectTrialsView';
import { LEGACY_EXPERIMENT_STORAGE_KEY, useProjectStore } from './projectStore';
import type { LegacyGeneratedExperiment } from './projectModel';

const loadLegacyExperiments = (): LegacyGeneratedExperiment[] => {
  try { const parsed = JSON.parse(localStorage.getItem(LEGACY_EXPERIMENT_STORAGE_KEY) ?? '[]'); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};

export default function ProjectResourcesPage() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [importOpen, setImportOpen] = useState(false);
  const activeId = useProjectStore(state => state.activeProjectId);
  const projects = useProjectStore(state => state.projects);
  const visible = projects.filter(item => !item.sessionOwnerId);
  const projectId = params.get('projectId') ?? (visible.some(item => item.id === activeId) ? activeId : null);
  const project = visible.find(item => item.id === projectId);
  const view = params.get('view') === 'analysis' ? 'analysis' : 'trials';
  const legacyResources = params.get('view') === 'resources';
  const importCandidates = loadLegacyExperiments().filter(legacy => !projects.some(item => item.id === legacy.id));
  const selectProject = (id: string) => { useProjectStore.getState().setActiveProject(id); setParams({ projectId: id, view: 'trials' }); };
  return <div className="session-shared-resources">
    <div className="workspace-content-heading"><Typography.Title level={3}>{project?.name ?? '项目'}</Typography.Title><Space wrap>
      <Select aria-label="选择项目" placeholder="选择项目" style={{ minWidth: 200 }} value={project?.id} options={visible.map(item => ({ value: item.id, label: item.name }))} onChange={selectProject} />
      <Button icon={<FolderOpenOutlined />} onClick={() => setImportOpen(true)}>导入旧版项目</Button>
    </Space></div>
    {project && legacyResources ? <ProjectContent /> : project ? <Tabs activeKey={view} onChange={value => { const next = new URLSearchParams({ projectId: project.id, view: value }); setParams(next, { state: location.state }); }} items={[
      { key: 'trials', label: '试验任务', children: <ProjectTrialsView projectId={project.id} /> },
      { key: 'analysis', label: '分析任务书', children: <TaskBookAnalysisPage key={project.id} /> },
    ]} /> : null}
    <Modal title="导入旧版试验项目" open={importOpen} footer={null} onCancel={() => setImportOpen(false)}>
      {importCandidates.length ? <List dataSource={importCandidates} renderItem={item => <List.Item actions={[<Button key="import" type="link" onClick={() => { const id = useProjectStore.getState().importLegacyExperiment(item); setImportOpen(false); selectProject(id); }}>导入</Button>]}><List.Item.Meta title={item.name} description={item.designName || '历史项目'} /></List.Item>} /> : null}
    </Modal>
  </div>;
}
