import React from 'react';
import { Layout } from 'antd';
import { TrialAIAssistantProvider } from '@/components/TrialAIAssistant';
import SessionShell from '@/workspace/SessionShell';

const MainLayout: React.FC = () => (
  <Layout className="app-shell">
    <TrialAIAssistantProvider>
      <SessionShell />
    </TrialAIAssistantProvider>
  </Layout>
);

export default MainLayout;
