import { createContext, useContext } from 'react';
import type { ConcreteTrial, RawDataFile, TestRecord } from './physicalObjectStore';
export interface WorksheetFile { file: RawDataFile; record: TestRecord }
export interface WorksheetView { opened: string[]; active?: string; expanded: boolean; closed?: boolean }
export interface TrialWorksheetContextValue {
  trial: ConcreteTrial; files: WorksheetFile[]; active?: WorksheetFile; view: WorksheetView; aliases: Record<string, string>;
  recordId?: string; setRecordId: (id: string) => void; openFile: (id: string, expand?: boolean) => void;
  updateView: (patch: Partial<WorksheetView>) => void; dirtyFiles: Set<string>;
  analysisTab: string; setAnalysisTab: (value: string) => void;
}
export const TrialWorksheetContext = createContext<TrialWorksheetContextValue | null>(null);
export const useTrialWorksheet = () => useContext(TrialWorksheetContext);
