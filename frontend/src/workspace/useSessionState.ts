import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { useLocation } from 'react-router-dom';
import type { BusinessRouteState } from '../types/businessContext';
import { getCapabilityFromPath, getLegacySessionPath, getSessionIdFromLocation, getSessionWorkspaceContext, getSessionDraftKey, readSessionDraft, resolveSessionHandoff } from './sessionModel';
import { useSessionStore } from './sessionStore';

// The shell remounts professional pages when the session or capability changes.
// Only serializable work state uses this hook; loading flags and open dialogs
// remain local useState values and never resurrect as unfinished background jobs.
export const useSessionState = <T,>(name: string, initial: T | (() => T)): [T, Dispatch<SetStateAction<T>>] => {
  const location = useLocation();
  const routeState = useSessionRouteState();
  const key = getSessionDraftKey(name, routeState?.workspaceSession);
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const capability = getCapabilityFromPath(id ? getLegacySessionPath(location.pathname, id) ?? location.pathname : location.pathname);
  const [value, setValue] = useState<T>(() => readSessionDraft(
    useSessionStore.getState().sessions.find(session => session.id === id), capability, key,
    typeof initial === 'function' ? (initial as () => T)() : initial,
  ));
  const valueRef = useRef(value);
  const update = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    const next = typeof action === 'function' ? (action as (previous: T) => T)(valueRef.current) : action;
    valueRef.current = next;
    setValue(next);
    if (id) useSessionStore.getState().updateDraft(id, capability, key, next);
  }, [capability, id, key]);

  useEffect(() => {
    if (!id) return;
    const draft = useSessionStore.getState().sessions.find(session => session.id === id)?.drafts[capability];
    if (!draft || !Object.hasOwn(draft, key)) useSessionStore.getState().updateDraft(id, capability, key, valueRef.current);
  }, [capability, id, key]);
  return [value, update];
};

export const useSessionRouteState = (): BusinessRouteState | null => {
  const location = useLocation();
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const session = useSessionStore(state => state.sessions.find(item => item.id === id));
  const capability = getCapabilityFromPath(location.pathname);
  const incoming = location.state as BusinessRouteState | null;
  const handoff = session?.handoffs[capability] as BusinessRouteState | undefined;
  const context = useMemo(() => session ? getSessionWorkspaceContext(session) : undefined,
    // Draft edits must not change the navigation context or assistant callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session?.id, session?.storageProjectId, session?.taskId]);
  return useMemo(() => !context ? incoming : resolveSessionHandoff(context, handoff, incoming), [context, handoff, incoming]);
};
