import React, { useState } from 'react';
import { Button, Card, Input, Modal, Space, Typography, message } from 'antd';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSessionStore } from './sessionStore';
import { getSessionPath, type SessionCapability } from './sessionModel';
import { useProjectStore } from './projectStore';

const { Text, Title } = Typography;

type SessionCreateDialogProps = {
  open: boolean;
  projectId?: string;
  purpose?: 'session' | 'trial';
  initialCapability?: SessionCapability;
  onCancel: () => void;
  onCreated?: () => void;
};

export const SessionCreateDialog: React.FC<SessionCreateDialogProps> = ({ open, projectId, purpose = 'session', initialCapability = 'overview', onCancel, onCreated }) => {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);
  const nameLabel = purpose === 'trial' ? '试验名称' : '会话名称';
  const create = () => {
    const name = title.trim();
    if (!name) {
      setNameInvalid(true);
      return;
    }
    if (projectId && !useProjectStore.getState().projects.some(project => project.id === projectId && !project.sessionOwnerId)) {
      message.error('操作失败');
      return;
    }
    const id = useSessionStore.getState().createSession({
      title: name,
      projectId,
      creationSource: projectId ? 'project' : 'standalone',
    });
    setTitle('');
    setNameInvalid(false);
    onCreated?.();
    navigate(getSessionPath(id, initialCapability));
  };
  const cancel = () => {
    setTitle('');
    setNameInvalid(false);
    onCancel();
  };

  return <Modal title={purpose === 'trial' ? '新建试验' : '新建会话'} open={open} onCancel={cancel} onOk={create} okText="创建并进入" cancelText="取消" destroyOnHidden>
    <div className="session-create-field">
      <Text>{nameLabel}</Text>
      <Input autoFocus aria-label={nameLabel} placeholder={`请输入${nameLabel}`} maxLength={100} value={title} status={nameInvalid ? 'error' : undefined}
        onChange={event => { setTitle(event.target.value); setNameInvalid(false); }} onPressEnter={create} />
    </div>
  </Modal>;
};

export const SessionCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [title, setTitle] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);
  const projectId = new URLSearchParams(location.search).get('projectId') || undefined;
  const create = () => {
    const name = title.trim();
    if (!name) {
      setNameInvalid(true);
      return;
    }
    if (projectId && !useProjectStore.getState().projects.some(project => project.id === projectId && !project.sessionOwnerId)) {
      message.error('操作失败');
      return;
    }
    const id = useSessionStore.getState().createSession({
      title: name,
      projectId,
      creationSource: projectId ? 'project' : 'standalone',
    });
    navigate(getSessionPath(id));
  };

  return <div className="session-create-page">
    <Card>
      <Title level={3}>新建会话</Title>
      <Text type="secondary">为这次工作命名，创建后即可进入会话工作台。</Text>
      <div className="session-create-field">
        <Text>会话名称</Text>
        <Input autoFocus aria-label="会话名称" placeholder="请输入会话名称" maxLength={100} value={title} status={nameInvalid ? 'error' : undefined}
          onChange={event => { setTitle(event.target.value); setNameInvalid(false); }} onPressEnter={create} />
      </div>
      <Space>
        <Button type="primary" onClick={create}>创建并进入</Button>
        <Button onClick={() => navigate(projectId ? `/projects?projectId=${encodeURIComponent(projectId)}` : '/')}>取消</Button>
      </Space>
    </Card>
  </div>;
};

export default SessionCreatePage;
