import { createContext, useContext } from 'react';
import type { PhysicalBusinessScope } from './sessionModel';

export const ProfessionalScopeContext = createContext<PhysicalBusinessScope | undefined>(undefined);
export const useProfessionalScope = () => useContext(ProfessionalScopeContext);
