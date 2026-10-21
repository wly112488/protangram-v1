import Papa from 'papaparse';
import { parseTrialCsv, type ParsedRawFile } from './trialDataFiles';

export const WORKSHEET_PAGE_SIZE = 15;
export const parseWorksheetCsv = parseTrialCsv;
export const serializeWorksheet = (data: ParsedRawFile) => Papa.unparse({ fields: data.headers, data: data.rows.map(row => data.headers.map(field => row[field] ?? '')) });

export function renameWorksheetField(data: ParsedRawFile, oldName: string, value: string): ParsedRawFile {
  const name = value.trim();
  if (!name) throw new Error('请填写字段名称');
  if (!data.headers.includes(oldName)) throw new Error('此字段不存在');
  if (name !== oldName && data.headers.includes(name)) throw new Error('已有同名字段，请使用其他名称');
  return { headers: data.headers.map(field => field === oldName ? name : field), rows: data.rows.map(row => Object.fromEntries(data.headers.map(field => [field === oldName ? name : field, row[field] ?? '']))) };
}

export function editWorksheetCell(data: ParsedRawFile, rowIndex: number, field: string, value: string): ParsedRawFile {
  if (!data.headers.includes(field) || !data.rows[rowIndex]) throw new Error('单元格已不存在');
  return { ...data, rows: data.rows.map((row, index) => index === rowIndex ? { ...row, [field]: value } : row) };
}

export function selectWorksheetColumn(headers: string[], selected: string[], field: string, modifiers: { additive?: boolean; range?: boolean }) {
  if (modifiers.range && selected.length) {
    const a = headers.indexOf(selected[0]), b = headers.indexOf(field);
    return headers.slice(Math.min(a, b), Math.max(a, b) + 1);
  }
  if (modifiers.additive) return selected.includes(field) ? selected.filter(item => item !== field) : [...selected, field];
  return [field];
}
