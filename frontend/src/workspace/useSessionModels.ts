import { useCallback, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { ModelContract } from '../types/businessContext';
import { useGlobalModelStore } from './globalModelStore';
import { getSessionIdFromLocation } from './sessionModel';
import { useSessionStore } from './sessionStore';

export const useSessionModels = () => {
  const location = useLocation();
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const globalModels = useGlobalModelStore(state => state.models);
  const storedModels = useSessionStore(state => state.sessions.find(session => session.id === id)?.drafts.overview?.modelLibrary) as ModelContract[] | undefined;
  const models = storedModels ?? globalModels;
  useEffect(() => {
    if (id && !storedModels) useSessionStore.getState().updateDraft(id, 'overview', 'modelLibrary', structuredClone(globalModels));
  }, [globalModels, id, storedModels]);
  const updateCurrentModel = useCallback((modelId: string, changes: Omit<Partial<ModelContract>, 'modelId' | 'version'>) => {
    if (!id) return useGlobalModelStore.getState().updateCurrentModel(modelId, changes);
    const library = useSessionStore.getState().sessions.find(session => session.id === id)?.drafts.overview?.modelLibrary as ModelContract[] | undefined;
    const current = (library ?? globalModels).find(model => model.modelId === modelId);
    if (!current) return null;
    const match = current.version.match(/^V?(\d+)\.(\d+)$/i);
    const updated = { ...current, ...changes, version: match ? `V${match[1]}.${Number(match[2]) + 1}` : `${current.version}.1` };
    useSessionStore.getState().updateDraft(id, 'overview', 'modelLibrary', (library ?? globalModels).map(model => model.modelId === modelId ? updated : model));
    return updated;
  }, [globalModels, id]);
  return { models, updateCurrentModel };
};
