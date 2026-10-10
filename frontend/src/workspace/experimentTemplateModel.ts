export type DoeFactorType = '连续' | '类别' | '混料';

export interface DoeTemplateFactor {
  name: string;
  type: DoeFactorType;
  lowLevel: string;
  highLevel: string;
  levels: string[];
  changeType?: string;
}

export interface DoeTemplate {
  id: string;
  name: string;
  designMethod: string;
  factorCount: number;
  factors: string[];
  responses: string[];
  factorSettings?: DoeTemplateFactor[];
  levelCount?: number;
  replicateCount?: number;
  hardReplicateCount?: number;
  easyReplicateCount?: string;
}

export const DOE_TEMPLATE_STORAGE_KEY = 'protangram-doe-templates';

const normalizeDoeTemplate = (value: unknown): DoeTemplate | null => {
  if (!value || typeof value !== 'object') return null;
  const template = value as Partial<DoeTemplate>;
  if (typeof template.id !== 'string' || typeof template.name !== 'string' || typeof template.designMethod !== 'string') return null;
  const factors = Array.isArray(template.factors) ? template.factors.filter((factor): factor is string => typeof factor === 'string') : [];
  const responses = Array.isArray(template.responses) ? template.responses.filter((response): response is string => typeof response === 'string') : [];
  const factorSettings = Array.isArray(template.factorSettings)
    ? template.factorSettings.filter((factor): factor is DoeTemplateFactor => Boolean(factor && typeof factor.name === 'string'))
      .map((factor) => ({ ...factor, levels: Array.isArray(factor.levels) ? [...factor.levels] : [] }))
    : undefined;
  return {
    id: template.id,
    name: template.name,
    designMethod: template.designMethod,
    factorCount: Number.isFinite(template.factorCount) ? Number(template.factorCount) : factors.length,
    factors,
    responses,
    ...(factorSettings ? { factorSettings } : {}),
    ...(Number.isFinite(template.levelCount) ? { levelCount: Number(template.levelCount) } : {}),
    ...(Number.isFinite(template.replicateCount) ? { replicateCount: Number(template.replicateCount) } : {}),
    ...(Number.isFinite(template.hardReplicateCount) ? { hardReplicateCount: Number(template.hardReplicateCount) } : {}),
    ...(typeof template.easyReplicateCount === 'string' ? { easyReplicateCount: template.easyReplicateCount } : {}),
  };
};

export const loadDoeTemplates = (): DoeTemplate[] => {
  try {
    const raw = window.localStorage.getItem(DOE_TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.map(normalizeDoeTemplate).filter((template): template is DoeTemplate => template !== null)
      : [];
  } catch {
    return [];
  }
};

export const saveDoeTemplates = (templates: DoeTemplate[]): void => {
  window.localStorage.setItem(DOE_TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
};

export const cloneDoeTemplate = (template: DoeTemplate): DoeTemplate => JSON.parse(JSON.stringify(template)) as DoeTemplate;

export const createDoeTemplateSessionDraft = (template: DoeTemplate) => ({
  doe: { startingTemplate: cloneDoeTemplate(template) },
});
