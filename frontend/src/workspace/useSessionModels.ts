import { useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import type { ModelContract } from '../types/businessContext';
import { useGlobalModelStore } from './globalModelStore';
import { getSessionIdFromLocation } from './sessionModel';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { resolvePhysicalSource } from './physicalBusinessContext';

export const useSessionModels = () => {
  const location = useLocation();
  const id = getSessionIdFromLocation(location.pathname, location.search);
  const globalModels = useGlobalModelStore(state => state.models);
  const session = useSessionStore(state => state.sessions.find(item => item.id === id));
  const objects = usePhysicalObjectStore(state => state.objects);
  const source = resolvePhysicalSource(objects, session?.businessScope);
  // Preserve legacy libraries; new sessions keep only calibration changes, not a copied catalog.
  const legacyModels = session?.drafts.overview?.modelLibrary as ModelContract[] | undefined;
  const updates = session?.drafts.overview?.modelUpdates as Record<string, Partial<ModelContract>> | undefined;
  const definitions: ModelContract[] = useMemo(() => source.configuration?.models.map(model => ({
    modelId: model.id, modelName: model.name, version: '定义', trustedRange: '由用户确认', status: '构型模型定义（计算未接入）', definitionOnly: true,
  })) ?? [], [source.configuration?.models]);
  const models = useMemo(() => [...definitions, ...(legacyModels ?? globalModels)].map(model => ({ ...model, ...(updates?.[model.modelId] ?? {}) })), [definitions, legacyModels, globalModels, updates]);
  const updateCurrentModel = useCallback((modelId: string, changes: Omit<Partial<ModelContract>, 'modelId' | 'version'>) => {
    if (definitions.some(model => model.modelId === modelId)) return null;
    if (!id) return useGlobalModelStore.getState().updateCurrentModel(modelId, changes);
    const draft = useSessionStore.getState().sessions.find(item => item.id === id)?.drafts.overview;
    const library = draft?.modelLibrary as ModelContract[] | undefined;
    const savedUpdates = draft?.modelUpdates as Record<string, Partial<ModelContract>> | undefined;
    const base = (library ?? globalModels).find(model => model.modelId === modelId);
    if (!base) return null;
    const current = { ...base, ...(savedUpdates?.[modelId] ?? {}) };
    const match = current.version.match(/^V?(\d+)\.(\d+)$/i);
    const version = match ? `V${match[1]}.${Number(match[2]) + 1}` : `${current.version}.1`;
    const patch = { ...(savedUpdates?.[modelId] ?? {}), ...changes, version };
    useSessionStore.getState().updateDraft(id, 'overview', 'modelUpdates', { ...savedUpdates, [modelId]: patch });
    return { ...current, ...patch };
  }, [definitions, globalModels, id]);
  return { models, updateCurrentModel };
};
