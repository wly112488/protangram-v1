import { useParams } from 'react-router-dom';
import ProjectContent from './ProjectContent';
import { useSessionStore } from './sessionStore';
import { useProjectStore } from './projectStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import { collectWorkspaceResourceGroups } from './sessionResourceModel';

export default function SessionOverview() {
  const {sessionId}=useParams();
  const sessions = useSessionStore(state => state.sessions);
  const projects = useProjectStore(state => state.projects);
  const objects = usePhysicalObjectStore(state => state.objects);
  const configurations = useTrialConfigurationStore(state => state.configurations);
  const groups = collectWorkspaceResourceGroups(projects, sessions, objects, configurations, sessionId ?? '');
  return groups.some(group => group.entries.length || group.files.length) ? <ProjectContent sessionViewId={sessionId} /> : null;
}
