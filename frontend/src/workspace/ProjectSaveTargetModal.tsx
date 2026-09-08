import React, { useMemo, useState } from 'react';
import { Alert, Button, Modal, Select } from 'antd';
import { useProjectStore } from './projectStore';

interface ProjectSaveTargetModalProps {
  open: boolean;
  title: string;
  defaultProjectId?: string;
  skipText?: string;
  onCancel: () => void;
  onConfirm: (projectId: string) => void;
  onSkip?: () => void;
}

const ProjectSaveTargetModal: React.FC<ProjectSaveTargetModalProps> = ({
  open,
  title,
  defaultProjectId,
  skipText,
  onCancel,
  onConfirm,
  onSkip,
}) => {
  const projects = useProjectStore((state) => state.projects);
  const activeProjectId = useProjectStore((state) => state.activeProjectId);
  const [selectedProjectId, setSelectedProjectId] = useState('');

  const orderedProjects = useMemo(() => [...projects].sort((left, right) => {
    if (left.id === activeProjectId) return -1;
    if (right.id === activeProjectId) return 1;
    return Date.parse(right.createdAt) - Date.parse(left.createdAt);
  }), [activeProjectId, projects]);

  const fallbackProjectId = defaultProjectId && projects.some((project) => project.id === defaultProjectId)
    ? defaultProjectId
    : activeProjectId && projects.some((project) => project.id === activeProjectId)
      ? activeProjectId
      : orderedProjects[0]?.id ?? '';
  const projectId = selectedProjectId && projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : fallbackProjectId;

  const close = () => {
    setSelectedProjectId('');
    onCancel();
  };

  return (
    <Modal
      title={title}
      open={open}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !projectId }}
      onOk={() => {
        if (!projectId) return;
        onConfirm(projectId);
        setSelectedProjectId('');
      }}
      onCancel={close}
    >
      {projects.length > 0 ? (
        <Select
          showSearch
          optionFilterProp="label"
          style={{ width: '100%' }}
          placeholder="选择要保存到的项目"
          value={projectId || undefined}
          onChange={setSelectedProjectId}
          options={orderedProjects.map((project) => ({ value: project.id, label: project.name }))}
        />
      ) : (
        <Alert type="warning" showIcon title="当前没有可保存的项目，请先在左侧新建项目。" />
      )}
      {onSkip && (
        <div style={{ marginTop: 12 }}>
          <Button type="link" onClick={() => { setSelectedProjectId(''); onSkip(); }}>{skipText ?? '仅继续，不保存到项目'}</Button>
        </div>
      )}
    </Modal>
  );
};

export default ProjectSaveTargetModal;
