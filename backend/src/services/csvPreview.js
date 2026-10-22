'use strict';

const fs = require('node:fs');
const { TextDecoder } = require('node:util');

function parseEncoding(value) {
  const raw = String(value || 'utf-8').trim().toLowerCase();
  if (raw.includes('18030')) return 'gb18030';
  if (raw === 'gbk' || raw.includes('gb2312')) return 'gbk';
  if (raw.includes('utf-8') || raw.includes('utf8')) return 'utf-8';
  return raw || 'utf-8';
}

async function previewCsv(filePath, { encoding = 'utf-8', delimiter = ',', skipRows = 0, limit = 50 } = {}) {
  const decoder = new TextDecoder(parseEncoding(encoding), { fatal: false });
  const stream = fs.createReadStream(filePath);
  const rows = [];
  let row = [], field = '', inQuotes = false, pendingQuote = false, skipLf = false;
  let physicalRows = 0, headers = null, reachedLimit = false;
  const maxRows = Math.min(500, Math.max(1, Number.isInteger(limit) ? limit : 50));
  const emitRow = () => {
    row.push(field);
    field = '';
    physicalRows += 1;
    const current = row;
    row = [];
    if (physicalRows <= Math.max(0, skipRows)) return;
    if (headers === null) {
      headers = current.map((value, index) => value.trim() || '列' + (index + 1));
      return;
    }
    if (rows.length < maxRows) rows.push(current);
    if (rows.length >= maxRows) reachedLimit = true;
  };
  function consume(text) {
    for (let i = 0; i < text.length; i += 1) {
      let ch = text[i];
      if (skipLf) {
        skipLf = false;
        if (ch === '\n') continue;
      }
      if (pendingQuote) {
        if (ch === '"') { field += '"'; pendingQuote = false; continue; }
        inQuotes = false;
        pendingQuote = false;
      }
      if (inQuotes) {
        if (ch === '"') pendingQuote = true;
        else field += ch;
        continue;
      }
      if (ch === '"' && field.length === 0) { inQuotes = true; continue; }
      if (ch === delimiter) { row.push(field); field = ''; continue; }
      if (ch === '\n' || ch === '\r') {
        emitRow();
        if (ch === '\r') skipLf = true;
        if (reachedLimit) return;
        continue;
      }
      field += ch;
    }
  }
  for await (const chunk of stream) {
    consume(decoder.decode(chunk, { stream: true }));
    if (reachedLimit) { stream.destroy(); break; }
  }
  if (!reachedLimit) {
    consume(decoder.decode());
    if (pendingQuote) { inQuotes = false; pendingQuote = false; }
    if (field.length || row.length) emitRow();
  }
  return {
    encoding: parseEncoding(encoding),
    headers: headers || [],
    rows,
    rowsReturned: rows.length,
    skippedRows: Math.max(0, skipRows),
    truncated: reachedLimit
  };
}

module.exports = { previewCsv, parseEncoding };
