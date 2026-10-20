import { Button, Card, Empty, Input, Select, Table, Tag, Typography } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { physicalSourcePath } from './physicalBusinessContext';
import { filterWorkspaceTrials, listWorkspaceTrials, type WorkspaceTrialEntry } from './trialNavigationModel';
import './trialWorkspace.css';

export default function TrialListPage() {
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const entries = listWorkspaceTrials(objects, tasks);
  const filtered = filterWorkspaceTrials(entries, params.get('search') || '', params.get('task') || 'all');
  const setFilter = (key: string, value: string) => { const next = new URLSearchParams(params); if (value) next.set(key, value); else next.delete(key); next.delete('page'); setParams(next, { replace: true }); };
  const open = ({ object, configuration, trial }: WorkspaceTrialEntry) => {
    const path = physicalSourcePath(objects, { physicalObjectId: object.id, experimentId: configuration.id, trialId: trial.id });
    if (path) navigate(path);
  };
  const page = Math.min(Math.max(1, Math.floor(Number(params.get('page')) || 1)), Math.max(1, Math.ceil(filtered.length / 10)));
  return <div className="trial-workspace">
    <div className="trial-page-header"><div><div className="workspace-kicker">试验工作台</div><Typography.Title level={3}>具体试验</Typography.Title><Typography.Text type="secondary">从一次具体试验开始，管理执行记录、原始数据与专业成果。</Typography.Text></div><Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/trials/new')}>新建具体试验</Button></div>
    <div className="trial-overview"><span><strong>{entries.length}</strong> 项具体试验</span><span><strong>{entries.reduce((n, e) => n + e.trial.records.length, 0)}</strong> 次执行记录</span><span><strong>{entries.filter(e => !e.trial.taskBookId).length}</strong> 项自主试验</span></div>
    <Card bordered={false} className="trial-list-card"><div className="trial-filter-row"><Input prefix={<SearchOutlined />} aria-label="搜索具体试验" allowClear placeholder="搜索对象、构型、试验、载荷谱或任务书" value={params.get('search') || ''} onChange={event => setFilter('search', event.target.value)} /><Select aria-label="筛选任务书" value={params.get('task') || 'all'} onChange={value => setFilter('task', value)} options={[{ value: 'all', label: '全部试验' }, { value: 'independent', label: '自主试验' }, ...tasks.map(task => ({ value: `task:${task.id}`, label: task.title }))]} /></div>
      <Table<WorkspaceTrialEntry> rowKey={entry => `${entry.object.id}/${entry.configuration.id}/${entry.trial.id}`} dataSource={filtered} scroll={{ x: 880 }} locale={{ emptyText: <Empty description={entries.length ? '没有匹配的具体试验' : '暂无具体试验，请点击右上角新建'} /> }} columns={[
        { title: '具体试验', width: 230, render: (_, entry) => <Button type="link" className="trial-name-link" onClick={() => open(entry)}>{entry.trial.name}</Button> },
        { title: '物理对象 / 试验构型', width: 240, render: (_, entry) => <><div>{entry.object.name}</div><Typography.Text type="secondary">{entry.configuration.name}</Typography.Text></> },
        { title: '载荷谱', width: 180, render: (_, entry) => entry.trial.loadSpectrum || <Tag>待补充</Tag> },
        { title: '任务书', width: 200, render: (_, entry) => entry.trial.taskBookId ? entry.taskTitle || entry.trial.taskBookId : <Tag>自主试验</Tag> },
        { title: '执行 / CSV', width: 110, render: (_, entry) => `${entry.trial.records.length} / ${entry.trial.records.reduce((n, record) => n + record.rawFiles.length, 0)}` },
      ]} pagination={{ current: page, pageSize: 10, showSizeChanger: false, showTotal: total => `共 ${total} 项具体试验`, onChange: nextPage => { const next = new URLSearchParams(params); next.set('page', String(nextPage)); setParams(next); } }} />
    </Card>
  </div>;
}
