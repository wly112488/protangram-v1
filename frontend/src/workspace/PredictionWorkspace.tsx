import { Alert, Card, Descriptions, Empty, Space, Tag, Typography } from 'antd';
import { useSessionRouteState } from './useSessionState';
import { useWorkspaceBusinessSession } from './useWorkspaceBusinessSession';
import type { PredictionService } from './predictionContract';
import WorkspacePageHeader from './WorkspacePageHeader';
import AnalysisResults from './AnalysisResults';

/** The backend has no prediction protocol yet. Existing evidence remains available. */
export default function PredictionWorkspace({ service }: { service: PredictionService }) {
  const { physicalSource, dataContext, sources } = useWorkspaceBusinessSession(useSessionRouteState());
  const name = service === 'virtualCondition' ? '虚拟工况扩展' : '实验数字孪生';
  if (!physicalSource.trial || physicalSource.missing || !dataContext) return <Card title={name} size="small"><Empty description="请从具体试验或执行记录进入此功能" /></Card>;
  return <div className="workspace-business-page">
    <WorkspacePageHeader title={name} />
    <Alert type="info" showIcon title="该功能尚未接入实际计算，当前不会生成预测结果" />
    <Card title="当前试验来源" size="small" className="workspace-business-card">
      <Descriptions size="small" column={1} items={[
        { key: 'trial', label: '具体试验', children: physicalSource.trial.name },
        { key: 'spectrum', label: '载荷谱', children: physicalSource.trial.loadSpectrum || '未填写' },
        { key: 'record', label: '当前数据来源', children: physicalSource.record?.name ?? '本试验全部执行记录' },
        { key: 'files', label: '原始数据', children: sources.rawFiles.length ? <Space wrap>{sources.rawFiles.map(file => <Tag key={`${file.sourceRecordId}/${file.id}`}>{file.name}</Tag>)}</Space> : <Typography.Text type="secondary">尚未导入原始数据</Typography.Text> },
      ]} />
    </Card>
    <AnalysisResults entries={sources.results} shared trial={physicalSource.trial} />
  </div>;
}
