import { Button, Input, Select, Table, Tag } from 'antd';
import type { ConcreteTrial } from './physicalObjectStore';

interface Props {
  trials: ConcreteTrial[];
  tasks: Array<{ id: string; title: string }>;
  params: URLSearchParams;
  onQueryChange: (patch: Record<string, string>) => void;
  onOpen: (trialId: string) => void;
}

export default function PhysicalTrialsTable({ trials, tasks, params, onQueryChange, onOpen }: Props) {
  const taskNames = new Map(tasks.map(task => [task.id, task.title]));
  const search = params.get('trialSearch') || '';
  const taskFilter = params.get('trialTask') || 'all';
  const keyword = search.trim().toLocaleLowerCase();
  const filtered = trials.filter(trial => (!keyword || [trial.name, trial.loadSpectrum, trial.taskBookId, taskNames.get(trial.taskBookId || '')]
    .some(value => value?.toLocaleLowerCase().includes(keyword)))
    && (taskFilter === 'all' || taskFilter === 'independent' && !trial.taskBookId || taskFilter === `task:${trial.taskBookId}`));
  const pageSize = [10, 20, 50, 100].find(size => size === Number(params.get('trialPageSize'))) ?? 10;
  const page = Math.min(Math.max(1, Math.floor(Number(params.get('trialPage')) || 1)), Math.max(1, Math.ceil(filtered.length / pageSize)));
  const linkedTasks = [...new Set(trials.flatMap(trial => trial.taskBookId ? [trial.taskBookId] : []))];

  return <div className="physical-trials-table">
    <div className="physical-trial-filters">
      <Input aria-label="搜索具体试验" placeholder="搜索试验名称、载荷谱、任务书名称或 ID" allowClear value={search}
        onChange={event => onQueryChange({ trialSearch: event.target.value, trialPage: '1' })} />
      <Select aria-label="筛选关联任务书" value={taskFilter} showSearch optionFilterProp="label"
        onChange={value => onQueryChange({ trialTask: value, trialPage: '1' })}
        options={[{ value: 'all', label: '全部任务书 / 自主试验' }, { value: 'independent', label: '自主试验' },
          ...linkedTasks.map(id => ({ value: `task:${id}`, label: taskNames.get(id) || `任务书 ${id}` }))]} />
      {(search || taskFilter !== 'all') && <Button onClick={() => onQueryChange({ trialSearch: '', trialTask: '', trialPage: '1' })}>重置筛选</Button>}
    </div>
    <Table<ConcreteTrial> size="middle" rowKey="id" dataSource={filtered} scroll={{ x: 780 }}
      locale={{ emptyText: null }}
      columns={[
        { title: '试验名称', dataIndex: 'name', width: 240, render: (name: string, trial) => <Button className="physical-trial-name" type="link" onClick={() => onOpen(trial.id)}>{name}</Button> },
        { title: '载荷谱', dataIndex: 'loadSpectrum', width: 180, render: (value: string) => value || null },
        { title: '关联任务书', dataIndex: 'taskBookId', width: 210, render: (id?: string) => id ? <span title={`任务书 ID：${id}`}>{taskNames.get(id) || id}</span> : <Tag>自主试验</Tag> },
        { title: '执行次数', width: 90, render: (_, trial) => trial.records.length },
        { title: 'CSV 文件', width: 90, render: (_, trial) => trial.records.reduce((count, record) => count + record.rawFiles.length, 0) },
      ]}
      pagination={{ current: page, pageSize, total: filtered.length, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100],
        showTotal: total => `共 ${total} 项${filtered.length !== trials.length ? ` / 全部 ${trials.length} 项` : ''}`,
        onChange: (current, size) => onQueryChange({ trialPage: String(size === pageSize ? current : 1), trialPageSize: String(size) }) }} />
  </div>;
}
