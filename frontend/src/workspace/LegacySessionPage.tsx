import { Button, Card, Empty, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { WorkSession } from './sessionModel';
import { useProjectStore } from './projectStore';
import { sessionResourcesPath } from './sharedResourcesModel';

// Keep access to older unbound sessions without creating new empty records.
export default function LegacySessionPage({ session }: { session: WorkSession }) {
  const navigate = useNavigate();
  const notes = session.drafts.overview?.notes;
  return <Card><Empty description="此历史会话尚未关联具体试验"><Space>
    <Button type="primary" onClick={() => navigate('/trials/new')}>创建独立试验</Button>
    <Button onClick={() => navigate(sessionResourcesPath(session, useProjectStore.getState().projects))}>查看原有成果</Button>
  </Space></Empty>{typeof notes === 'string' && notes.trim() && <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{notes}</Typography.Paragraph>}</Card>;
}
