import React, { useMemo, useState } from 'react';
import { Button, Empty, Input, Space, Tag, Tooltip, Tree, Typography } from 'antd';
import {
  BarChartOutlined,
  CloseOutlined,
  DatabaseOutlined,
  EditOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';
import type { ExperimentWorkspace, WorkbenchResource } from './workbenchModel';
import { getStatusLabel } from './workbenchModel';

const { Text } = Typography;

const iconByCategory: Record<string, React.ReactNode> = {
  试验设计: <FileTextOutlined />,
  表格数据: <DatabaseOutlined />,
  分析图表: <BarChartOutlined />,
  分析任务: <FolderOpenOutlined />,
  报告资源: <FileTextOutlined />,
};

const statusColor: Record<ExperimentWorkspace['status'], string> = {
  idle: 'default',
  running: 'processing',
  done: 'success',
  warning: 'warning',
};

const toTreeData = (resources: WorkbenchResource[]): DataNode[] => {
  const groups = resources.reduce<Record<string, WorkbenchResource[]>>((acc, resource) => {
    acc[resource.category] = [...(acc[resource.category] ?? []), resource];
    return acc;
  }, {});

  return Object.entries(groups).map(([category, items]) => ({
    key: category,
    title: (
      <span className="resource-tree-group">
        {iconByCategory[category]}
        {category}
      </span>
    ),
    children: items.map((item) => ({
      key: item.id,
      title: (
        <span className="resource-tree-item">
          <span>{item.title}</span>
          <Text type="secondary">{item.description}</Text>
        </span>
      ),
    })),
  }));
};

interface ExperimentNavigatorProps {
  experiments: ExperimentWorkspace[];
  activeExperiment: ExperimentWorkspace;
  onAddExperiment: () => void;
  onCloseExperiment: (id: string) => void;
  onRenameExperiment: (id: string, name: string) => void;
  onSwitchExperiment: (id: string) => void;
  onOpenResource: (resourceId: string) => void;
}

const ExperimentNavigator: React.FC<ExperimentNavigatorProps> = ({
  experiments,
  activeExperiment,
  onAddExperiment,
  onCloseExperiment,
  onRenameExperiment,
  onSwitchExperiment,
  onOpenResource,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const treeData = useMemo(() => toTreeData(activeExperiment.resources), [activeExperiment.resources]);

  const beginRename = (experiment: ExperimentWorkspace) => {
    setEditingId(experiment.id);
    setDraftName(experiment.name);
  };

  const finishRename = () => {
    if (editingId && draftName.trim()) {
      onRenameExperiment(editingId, draftName.trim());
    }
    setEditingId(null);
    setDraftName('');
  };

  return (
    <aside className="experiment-navigator">
      <div className="experiment-tabs-header">
        <Text strong>实验</Text>
        <Tooltip title="新建实验">
          <Button size="small" type="text" icon={<PlusOutlined />} onClick={onAddExperiment} />
        </Tooltip>
      </div>

      <div className="experiment-tabs">
        {experiments.map((experiment) => (
          <div
            key={experiment.id}
            className={`experiment-tab ${experiment.id === activeExperiment.id ? 'active' : ''}`}
            onClick={() => onSwitchExperiment(experiment.id)}
          >
            <div className="experiment-tab-title">
              {editingId === experiment.id ? (
                <Input
                  size="small"
                  value={draftName}
                  autoFocus
                  onChange={(event) => setDraftName(event.target.value)}
                  onPressEnter={finishRename}
                  onBlur={finishRename}
                />
              ) : (
                <Text ellipsis>{experiment.name}</Text>
              )}
              <Space size={2} onClick={(event) => event.stopPropagation()}>
                <Tooltip title="重命名">
                  <Button size="small" type="text" icon={<EditOutlined />} onClick={() => beginRename(experiment)} />
                </Tooltip>
                {experiments.length > 1 && (
                  <Tooltip title="关闭">
                    <Button
                      size="small"
                      type="text"
                      icon={<CloseOutlined />}
                      onClick={() => onCloseExperiment(experiment.id)}
                    />
                  </Tooltip>
                )}
              </Space>
            </div>
            <Tag color={statusColor[experiment.status]}>{getStatusLabel(experiment.status)}</Tag>
          </div>
        ))}
      </div>

      <div className="resource-tree-shell">
        <div className="resource-tree-title">
          <Text strong>资源目录</Text>
          <Text type="secondary">{activeExperiment.resources.length} 项</Text>
        </div>
        {treeData.length ? (
          <Tree
            blockNode
            defaultExpandAll
            selectedKeys={[activeExperiment.activeResourceId]}
            treeData={treeData}
            onSelect={(keys) => {
              const key = keys[0];
              if (typeof key === 'string' && activeExperiment.resources.some((resource) => resource.id === key)) {
                onOpenResource(key);
              }
            }}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无资源" />
        )}
      </div>
    </aside>
  );
};

export default ExperimentNavigator;
