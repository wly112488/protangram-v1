import SessionDataWorkspace from './SessionDataWorkspace';
import RootCauseAnalysis from './SessionRootCauseAnalysis';

export default function SessionAnalysisWorkspace() {
  return <SessionDataWorkspace professional rootCauseContent={<RootCauseAnalysis />} />;
}
