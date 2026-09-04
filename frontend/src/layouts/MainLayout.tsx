import React from 'react';
import { Layout } from 'antd';
import { TrialAIAssistantProvider } from '@/components/TrialAIAssistant';
import WorkspaceShell from '@/workspace/WorkspaceShell';

const MainLayout: React.FC = () => (
  <Layout className="app-shell">
    <TrialAIAssistantProvider>
      <WorkspaceShell />
    </TrialAIAssistantProvider>
  </Layout>
);

export default MainLayout;
