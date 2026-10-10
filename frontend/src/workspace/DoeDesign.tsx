import React, { useCallback } from 'react';
import { message } from 'antd';
import FunctionBar from '@/workbench/FunctionBar';
import { createDoeArtifactInput } from './projectModel';
import { useProjectStore } from './projectStore';
import { useSessionRouteState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';

const DoeDesign: React.FC = () => {
  const incoming = useSessionRouteState();
  const { targetProject, recordArtifactForTaskItem } = useWorkspaceBusinessSession(incoming);
  const addArtifact = useProjectStore(state => state.addArtifact);

  const saveDesign = useCallback((design: { method: string; response: string; factors: Array<{ name: string; type: string; lowLevel: string; highLevel: string; levels: string[]; changeType: string }> }) => {
    if (!targetProject) {
      message.error('当前会话没有可保存成果的项目空间');
      return;
    }
    const artifact = addArtifact(targetProject.id, createDoeArtifactInput({
      title: design.method,
      summary: `${design.method} · ${design.factors.length} 个因子 · 响应：${design.response}`,
      payload: { designMethod: design.method, response: design.response, factors: design.factors },
    }));
    if (!artifact) {
      message.error('DOE 设计保存失败');
      return;
    }
    recordArtifactForTaskItem({ projectId: targetProject.id, artifactId: artifact.id });
    message.success('DOE 设计方案已保存到当前会话');
  }, [addArtifact, recordArtifactForTaskItem, targetProject]);

  return <FunctionBar
    displayMode="doe-design"
    researchObjects={[]}
    onResearchObjectsChange={() => undefined}
    experiments={[]}
    activeProjectId={targetProject?.id}
    workspaceSession={incoming?.workspaceSession}
    onAssociateObjectToExperiment={() => undefined}
    onMergeObjects={() => undefined}
    onImportExperiment={() => undefined}
    onDoeDesignConfirmed={saveDesign}
  />;
};

export default DoeDesign;
