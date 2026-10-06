import React from 'react';
import { Typography } from 'antd';

const { Title, Text } = Typography;

interface WorkspacePageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  context?: React.ReactNode;
  actions?: React.ReactNode;
  level?: 3 | 4;
}

const WorkspacePageHeader: React.FC<WorkspacePageHeaderProps> = ({
  title,
  description,
  context,
  actions,
  level = 4,
}) => (
  <div className="workspace-page-heading">
    <div className="workspace-page-heading-copy">
      <Title level={level} className="workspace-page-title">{title}</Title>
      {description && <Text type="secondary">{description}</Text>}
      {context && <div className="workspace-page-context">{context}</div>}
    </div>
    {actions && <div className="workspace-page-actions">{actions}</div>}
  </div>
);

export default WorkspacePageHeader;
