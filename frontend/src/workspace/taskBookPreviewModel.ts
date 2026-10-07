export interface TaskBookPageRange {
  startPage: number;
  endPage: number;
}

export const parseTaskBookPageRange = (sourceRef?: string): TaskBookPageRange | null => {
  if (!sourceRef) return null;
  const match = sourceRef.match(/第\s*(\d+)\s*页(?:\s*(?:到|至|[-–—])\s*第?\s*(\d+)\s*页?)?/);
  if (!match) return null;
  const startPage = Number(match[1]);
  const endPage = Number(match[2] ?? match[1]);
  if (!Number.isInteger(startPage) || !Number.isInteger(endPage) || startPage < 1 || endPage < startPage) return null;
  return { startPage, endPage };
};
