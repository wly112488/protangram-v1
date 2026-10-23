import { Button, Card, Space, Typography } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { getSessionPath } from './sessionModel';
import ProjectContent from './ProjectContent';

export default function SessionOverview() {
  const {sessionId}=useParams();
  const navigate=useNavigate();
  return <div className="workspace-content-stack">
    <Card size="small"><Space wrap><Typography.Text>从专业功能或通用工具开始工作。</Typography.Text><Button onClick={()=>navigate(getSessionPath(sessionId!,'tools'))}>打开通用工具</Button></Space></Card>
    <ProjectContent sessionViewId={sessionId} />
  </div>;
}
