import React, { useEffect, useState } from 'react';
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
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    if (!open) return;
    const preferred = defaultProjectId && projects.some((project) => project.id === defaultProjectId)
      ? defaultProjectId
      : projects[0]?.id ?? '';
    setProjectId(preferred);
  }, [defaultProjectId, open, projects]);

  return (
    <Modal
      title={title}
      open={open}
      okText="保存"
      cancelText="取消"
      okButtonProps={{ disabled: !projectId }}
      onOk={() => projectId && onConfirm(projectId)}
      onCancel={onCancel}
    >
      {projects.length > 0 ? (
        <Select
          style={{ width: '100%' }}
          placeholder="选择要保存到的项目"
          value={projectId || undefined}
          onChange={setProjectId}
          options={projects.map((project) => ({ value: project.id, label: project.name }))}
        />
      ) : (
        <Alert type="warning" showIcon title="当前没有可保存的项目，请先在左侧新建项目。" />
      )}
      {onSkip && (
        <div style={{ marginTop: 12 }}>
          <Button type="link" onClick={onSkip}>{skipText ?? '仅继续，不保存到项目'}</Button>
        </div>
      )}
    </Modal>
  );
};

export default ProjectSaveTargetModal;
