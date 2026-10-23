import { createContext, useContext } from 'react';
import type { PhysicalBusinessScope } from './sessionModel';

export const ProfessionalScopeContext = createContext<PhysicalBusinessScope | undefined>(undefined);
export const useProfessionalScope = () => useContext(ProfessionalScopeContext);

export interface ProfessionalCfgSelection {
  cfgId?: string;
  error?: string;
  selectCfg: (cfgId: string) => void;
}
export const ProfessionalCfgSelectionContext = createContext<ProfessionalCfgSelection | undefined>(undefined);
export const useProfessionalCfgSelection = () => useContext(ProfessionalCfgSelectionContext);
