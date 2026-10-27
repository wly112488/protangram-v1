import { Button, Card, Space, Tabs, Tag, Typography } from 'antd';
import { useParams } from 'react-router-dom';
import TrialCsvAnalysis from './TrialCsvAnalysis';
import { useTrialWorksheet } from './trialWorksheetContext';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { collectCsvDiagnosisResults, getTrialArtifacts } from './analysisResultModel';
import CsvDiagnosisResults from './CsvDiagnosisResults';

export default function TrialDataAnalysisWorkspace({ onShowDemo }: { onShowDemo: () => void }) {
  const workspace = useTrialWorksheet()!;
  const { sessionId } = useParams();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const session = sessions.find(item => item.id === sessionId);
  const artifacts = session?.businessScope ? getTrialArtifacts(projects, sessions, { ...session.businessScope, testRecordId: undefined }, workspace.trial) : [];
  const file = workspace.active?.file;
  const results = collectCsvDiagnosisResults(workspace.trial, artifacts, file?.id);
  const tabs = [
      { key: 'csv', label: '数据浏览与可视化', children: <Card size="small"><Space wrap><Typography.Text>{file ? `当前数据：${file.name}` : ""}</Typography.Text><Typography.Text type="secondary">在底部工作表中选择数据列，右键绘图；也可以先选图形再指定列。</Typography.Text><Button disabled={!workspace.files.length} onClick={() => { if (workspace.active) workspace.updateView({ expanded: true }); else if (workspace.files[0]) workspace.openFile(workspace.files[0].file.id, true); }}>查看工作表</Button></Space></Card> },
        { key: 'diagnosis', label: '异常与根因分析', children: <>
        <div className="csv-diagnosis-source"><strong>{file ? `当前 CSV：${file.name}` : ""}</strong>{file && <Tag>{results.length ? '已有分析结果' : ""}</Tag>}<Button type="link" onClick={onShowDemo}>查看分析示例</Button></div>
        {file ? <>

          {results.length ? <CsvDiagnosisResults entries={results} onViewSource={() => workspace.updateView({ expanded: true })} /> : null}
        </> : null}
      </> },
    ];
  return <div className="workspace-business-page worksheet-analysis-page">
    <Tabs className="workspace-subfunction-tabs worksheet-analysis-nav" activeKey={workspace.analysisTab} onChange={value => { workspace.setAnalysisTab(value); workspace.updateView({ expanded: value === 'csv' }); }} items={tabs.map(({ key, label }) => ({ key, label }))} />
    <TrialCsvAnalysis trialId={workspace.trial.id} artifacts={artifacts} />
    {tabs.find(item => item.key === workspace.analysisTab)?.children}
  </div>;
}
