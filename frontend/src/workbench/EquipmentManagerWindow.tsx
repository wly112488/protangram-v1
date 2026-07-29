import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, Tree, Typography } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import type { DataNode } from 'antd/es/tree';

const { Text } = Typography;

interface LegacyComponent {
  id: string;
  name: string;
  attributes: string[];
}

interface LegacyGroup {
  id: string;
  name: string;
  children: LegacyComponent[];
}

export interface ResearchObject {
  id: string;
  name: string;
  variables?: string[];
  children?: ResearchObject[];
  experimentIds?: string[];
  attributes?: string[];
  components?: LegacyComponent[];
  groups?: LegacyGroup[];
}

interface ExperimentLinkItem {
  id: string;
  name: string;
}

type MenuTarget =
  | { kind: 'node'; nodeId: string }
  | { kind: 'experiment'; experimentId: string };

interface ContextMenuState {
  x: number;
  y: number;
  target: MenuTarget;
}

interface EquipmentManagerWindowProps {
  open: boolean;
  researchObjects: ResearchObject[];
  experiments: ExperimentLinkItem[];
  onResearchObjectsChange: (objects: ResearchObject[]) => void;
  onAssociateObjectToExperiment: (objectId: string, experimentId: string) => void;
  onMergeObjects: (sourceObjectId: string, targetObjectId: string) => void;
  onImportExperiment: (experimentId: string) => void;
  onClose: () => void;
}

const normalizeNode = (node: ResearchObject): ResearchObject => {
  const legacyChildren = node.components?.map((component) => ({
    id: component.id,
    name: component.name,
    variables: component.attributes,
  }));
  const legacyGroupChildren = node.groups?.flatMap((group) =>
    group.children.map((child) => ({
      id: child.id,
      name: child.name || group.name,
      variables: child.attributes,
    })),
  );

  return {
    id: node.id,
    name: node.name,
    variables: node.variables ?? node.attributes ?? [],
    experimentIds: node.experimentIds ?? [],
    children: (node.children ?? legacyChildren ?? legacyGroupChildren ?? []).map(normalizeNode),
  };
};

const findNode = (nodes: ResearchObject[], nodeId: string): ResearchObject | null => {
  for (const node of nodes) {
    if (node.id === nodeId) return node;
    const child = findNode(node.children ?? [], nodeId);
    if (child) return child;
  }
  return null;
};

const updateNode = (
  nodes: ResearchObject[],
  nodeId: string,
  updater: (node: ResearchObject) => ResearchObject,
): ResearchObject[] =>
  nodes.map((node) => {
    if (node.id === nodeId) return updater(node);
    return { ...node, children: updateNode(node.children ?? [], nodeId, updater) };
  });

const deleteNode = (nodes: ResearchObject[], nodeId: string): ResearchObject[] =>
  nodes
    .filter((node) => node.id !== nodeId)
    .map((node) => ({ ...node, children: deleteNode(node.children ?? [], nodeId) }));

const extractNodes = (
  nodes: ResearchObject[],
  nodeIds: Set<string>,
): { remaining: ResearchObject[]; extracted: ResearchObject[] } => {
  const remaining: ResearchObject[] = [];
  const extracted: ResearchObject[] = [];

  nodes.forEach((node) => {
    if (nodeIds.has(node.id)) {
      extracted.push(node);
      return;
    }
    const childResult = extractNodes(node.children ?? [], nodeIds);
    remaining.push({ ...node, children: childResult.remaining });
    extracted.push(...childResult.extracted);
  });

  return { remaining, extracted };
};

const EquipmentManagerWindow: React.FC<EquipmentManagerWindowProps> = ({
  open,
  researchObjects,
  experiments,
  onResearchObjectsChange,
  onImportExperiment,
  onClose,
}) => {
  const [nodeModalOpen, setNodeModalOpen] = useState(false);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [draftNodeName, setDraftNodeName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [associatingNodeId, setAssociatingNodeId] = useState<string | null>(null);
  const [checkedNodeIds, setCheckedNodeIds] = useState<React.Key[]>([]);
  const [mergeModalOpen, setMergeModalOpen] = useState(false);
  const [mergeName, setMergeName] = useState('');
  const [mergeNodeIds, setMergeNodeIds] = useState<string[]>([]);

  const normalizedObjects = researchObjects.map(normalizeNode);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [contextMenu]);

  if (!open) return null;

  const resetNodeModal = () => {
    setNodeModalOpen(false);
    setEditingNodeId(null);
    setDraftNodeName('');
  };

  const openCreatePartModal = () => {
    setEditingNodeId(null);
    setDraftNodeName('');
    setNodeModalOpen(true);
  };

  const openEditModal = (node: ResearchObject) => {
    setEditingNodeId(node.id);
    setDraftNodeName(node.name);
    setNodeModalOpen(true);
  };

  const saveNode = () => {
    const name = draftNodeName.trim() || `部件${normalizedObjects.length + 1}`;
    const nextNode: ResearchObject = {
      id: editingNodeId ?? `node-${Date.now()}`,
      name,
      variables: [],
      experimentIds: editingNodeId ? findNode(normalizedObjects, editingNodeId)?.experimentIds ?? [] : [],
      children: editingNodeId ? findNode(normalizedObjects, editingNodeId)?.children ?? [] : [],
    };
    const nextObjects = editingNodeId
      ? updateNode(normalizedObjects, editingNodeId, (node) => ({ ...node, ...nextNode }))
      : [...normalizedObjects, nextNode];
    onResearchObjectsChange(nextObjects);
    resetNodeModal();
  };

  const deletePartOrGroup = (nodeId: string) => {
    onResearchObjectsChange(deleteNode(normalizedObjects, nodeId));
    if (associatingNodeId === nodeId) setAssociatingNodeId(null);
  };

  const showContextMenu = (event: React.MouseEvent, target: MenuTarget) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({ x: event.clientX, y: event.clientY, target });
  };

  const openMergeModal = (nodeId: string) => {
    const selectedIds = Array.from(new Set([...checkedNodeIds.map(String), nodeId]));
    setMergeNodeIds(selectedIds);
    setMergeName('');
    setMergeModalOpen(true);
  };

  const confirmMerge = () => {
    const mergeIds = new Set(mergeNodeIds);
    const { remaining, extracted } = extractNodes(normalizedObjects, mergeIds);
    if (!extracted.length) return;
    const parentNode: ResearchObject = {
      id: `node-${Date.now()}`,
      name: mergeName.trim() || '新层级',
      variables: [],
      experimentIds: [],
      children: extracted,
    };
    onResearchObjectsChange([...remaining, parentNode]);
    setCheckedNodeIds([]);
    setMergeModalOpen(false);
    setMergeName('');
    setMergeNodeIds([]);
  };

  const handleContextAction = (action: 'associate' | 'edit' | 'delete' | 'merge' | 'import') => {
    if (!contextMenu) return;
    if (contextMenu.target.kind === 'experiment') {
      const experimentId = contextMenu.target.experimentId;
      setContextMenu(null);
      if (action === 'import') onImportExperiment(experimentId);
      return;
    }
    const nodeId = contextMenu.target.nodeId;
    const node = findNode(normalizedObjects, nodeId);
    setContextMenu(null);
    if (!node) return;
    if (action === 'associate') setAssociatingNodeId(nodeId);
    if (action === 'edit') openEditModal(node);
    if (action === 'delete') deletePartOrGroup(nodeId);
    if (action === 'merge') openMergeModal(nodeId);
  };

  const toggleExperimentAssociation = (nodeId: string, experimentId: string) => {
    onResearchObjectsChange(
      updateNode(normalizedObjects, nodeId, (node) => {
        const experimentIds = node.experimentIds ?? [];
        return {
          ...node,
          experimentIds: experimentIds.includes(experimentId)
            ? experimentIds.filter((id) => id !== experimentId)
            : [...experimentIds, experimentId],
        };
      }),
    );
  };

  const buildTreeNode = (node: ResearchObject): DataNode => ({
    key: node.id,
    title: (
      <span className="association-object-node" onContextMenu={(event) => showContextMenu(event, { kind: 'node', nodeId: node.id })}>
        <span>{node.name}</span>
      </span>
    ),
    children: [
      ...(node.children ?? []).map(buildTreeNode),
      ...(node.experimentIds ?? []).map((experimentId) => ({
        key: `${node.id}-experiment-${experimentId}`,
        title: (
          <span
            className="association-object-node"
            onContextMenu={(event) => showContextMenu(event, { kind: 'experiment', experimentId })}
          >
            <span>{experiments.find((experiment) => experiment.id === experimentId)?.name ?? experimentId}</span>
          </span>
        ),
        disableCheckbox: true,
      })),
    ],
  });

  const activeAssociationNode = associatingNodeId ? findNode(normalizedObjects, associatingNodeId) : null;

  return (
    <section className="equipment-manager-window">
      <div className="equipment-manager-titlebar">
        <Text strong>关联对象管理</Text>
        <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
      </div>
      <div className="association-manager-body">
        <section className="association-manager-section">
          <Text strong>部件层级</Text>
          <div className="association-object-form flat">
            <Button icon={<PlusOutlined />} onClick={openCreatePartModal}>新增部件</Button>
          </div>
          <Tree
            blockNode
            checkable
            defaultExpandAll
            checkedKeys={checkedNodeIds}
            treeData={normalizedObjects.map(buildTreeNode)}
            onCheck={(keys) => setCheckedNodeIds(Array.isArray(keys) ? keys : keys.checked)}
          />
        </section>
        <section className="association-manager-section">
          <Text strong>对象操作</Text>
          <div className="association-empty-hint">右键部件或层级进行关联、编辑、删除或合并</div>
        </section>
      </div>
      {contextMenu && (
        <div className="equipment-context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {contextMenu.target.kind === 'experiment' ? (
            <button type="button" onClick={() => handleContextAction('import')}>导入实验</button>
          ) : (
            <>
              <button type="button" onClick={() => handleContextAction('associate')}>关联实验</button>
              <button type="button" onClick={() => handleContextAction('edit')}>编辑</button>
              <button type="button" onClick={() => handleContextAction('delete')}>删除</button>
              <button type="button" onClick={() => handleContextAction('merge')}>合并</button>
            </>
          )}
        </div>
      )}
      <Modal
        title={editingNodeId ? '编辑部件/层级' : '新增部件'}
        open={nodeModalOpen}
        width={680}
        centered
        okText="保存"
        cancelText="取消"
        onOk={saveNode}
        onCancel={resetNodeModal}
      >
        <div className="association-create-modal-body">
          <section className="association-create-section">
            <Text strong>名称</Text>
            <Input
              autoFocus
              value={draftNodeName}
              placeholder="部件名称"
              onChange={(event) => setDraftNodeName(event.target.value)}
              onPressEnter={saveNode}
            />
          </section>
        </div>
      </Modal>
      <Modal
        title="合并为新层级"
        open={mergeModalOpen}
        width={520}
        centered
        okText="确认合并"
        cancelText="取消"
        onOk={confirmMerge}
        onCancel={() => setMergeModalOpen(false)}
      >
        <div className="association-create-modal-body">
          <section className="association-create-section">
            <Text strong>新层级名称</Text>
            <Input
              autoFocus
              value={mergeName}
              placeholder="例如：机身结构"
              onChange={(event) => setMergeName(event.target.value)}
              onPressEnter={confirmMerge}
            />
          </section>
        </div>
      </Modal>
      <Modal
        title={activeAssociationNode ? `关联实验：${activeAssociationNode.name}` : '关联实验'}
        open={Boolean(activeAssociationNode)}
        width={520}
        centered
        footer={<Button onClick={() => setAssociatingNodeId(null)}>关闭</Button>}
        onCancel={() => setAssociatingNodeId(null)}
      >
        <div className="association-experiment-list">
          {activeAssociationNode && experiments.map((experiment) => (
            <Button
              key={experiment.id}
              type={activeAssociationNode.experimentIds?.includes(experiment.id) ? 'primary' : 'default'}
              onClick={() => toggleExperimentAssociation(activeAssociationNode.id, experiment.id)}
            >
              {experiment.name}
            </Button>
          ))}
        </div>
      </Modal>
    </section>
  );
};

export default EquipmentManagerWindow;
