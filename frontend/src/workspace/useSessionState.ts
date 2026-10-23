import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import type { BusinessRouteState } from '../types/businessContext';
import { getCapabilityFromPath, getLegacySessionPath, getSessionIdFromLocation, getSessionWorkspaceContext, getSessionDraftKey, readSessionDraft, resolveSessionHandoff } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { useProfessionalScope } from './professionalScopeContext';

// Only serializable work state uses this hook; loading flags and open dialogs
// remain local useState values and never resurrect as unfinished background jobs.
// When the active CFG changes, reload that CFG's draft without remounting the page.
export const useSessionState = <T,>(name: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] => {
  const location = useLocation();
  const routeState = useSessionRouteState();
  const scope = useProfessionalScope();
  const draftName = scope?.cfgId ? `cfg:${scope.cfgId}:${name}` : name;
  const key = getSessionDraftKey(draftName, routeState?.workspaceSession);
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const capability = getCapabilityFromPath(id ? getLegacySessionPath(location.pathname, id) ?? location.pathname : location.pathname);
  const readValue = useCallback(() => {
    const session=useSessionStore.getState().sessions.find(item=>item.id===id);
    const fallback=typeof initial==='function'?(initial as ()=>T)():initial;
    const legacy=scope?.cfgId && session?.businessScope?.cfgId===scope.cfgId
      ? readSessionDraft(session,capability,getSessionDraftKey(name,routeState?.workspaceSession),fallback) : fallback;
    return readSessionDraft(session,capability,key,legacy);
  },[id,initial,scope,capability,name,routeState,key]);
  const [stored,setStored] = useState<{key:string;value:T}>(()=>({key,value:readValue()}));
  const value = stored.key===key?stored.value:readValue();
  const stateRef = useRef({ stored, value, readValue });
  useEffect(() => { stateRef.current = { stored, value, readValue }; }, [stored, value, readValue]);
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const previous = stateRef.current.stored.key === key ? stateRef.current.value : stateRef.current.readValue();
    const next = typeof action === 'function' ? (action as (previous: T) => T)(previous) : action;
    const nextStored = {key,value:next};
    stateRef.current = { stored: nextStored, value: next, readValue: stateRef.current.readValue };
    setStored(nextStored);
    if (id) useSessionStore.getState().updateDraft(id, capability, key, next);
  },[key,id,capability]);

  useEffect(() => {
    if (!id) return;
    const draft = useSessionStore.getState().sessions.find(session => session.id === id)?.drafts[capability];
    if (!draft || !Object.hasOwn(draft, key)) useSessionStore.getState().updateDraft(id, capability, key, value);
  }, [capability, id, key, value]);
  return [value, update];
};

export const useSessionRouteState = (): BusinessRouteState | null => {
  const professionalScope = useProfessionalScope();
  const location = useLocation();
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const session = useSessionStore(state => state.sessions.find(item => item.id === id));
  const capability = getCapabilityFromPath(location.pathname);
  const incoming = location.state as BusinessRouteState | null;
  const handoff = session?.handoffs[capability] as BusinessRouteState | undefined;
  const context = useMemo(() => session ? getSessionWorkspaceContext(session) : undefined,
    // Draft edits must not change the navigation context or assistant callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, session?.storageProjectId, session?.taskId, session?.businessScope]);
  return useMemo(() => {
    const resolved = !context ? incoming : resolveSessionHandoff(context, handoff, incoming);
    return professionalScope && resolved?.workspaceSession
      ? { ...resolved, workspaceSession: { ...resolved.workspaceSession, ...professionalScope } } : resolved;
  }, [context, handoff, incoming, professionalScope]);
};
