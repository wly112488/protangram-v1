import { useEffect, useState } from 'react';
import { Alert, Table } from 'antd';
import type { DerivedTable, RawDataFile } from './physicalObjectStore';
import { readTrialFile } from './trialDataFiles';

export default function TrialDataTable({ table, rawFile }: { table: DerivedTable; rawFile?: RawDataFile }) {
  const key = JSON.stringify(table);
  const [result, setResult] = useState<{ key: string; rows?: Record<string, string>[]; error?: string }>({ key: '' });
  useEffect(() => {
    let current = true;
    if (rawFile) readTrialFile(rawFile.id).then(({ rows }) => {
      if (current) setResult({ key, rows: rows.slice(table.startRow, table.endRow > 0 ? table.endRow : undefined) });
    }).catch(error => { console.error(error); if (current) setResult({ key, error: '读取数据失败' }); });
    return () => { current = false; };
  }, [key, table, rawFile]);
  if (!rawFile) return null;
  if (result.key !== key) return <div>读取数据…</div>;
  if (result.error) return <Alert type="warning" message={result.error} />;
  return <Table size="small" columns={table.fields.map(field => ({ title: field, dataIndex: field, key: field, width: 150 }))} dataSource={result.rows} rowKey={(row, index) => `${table.id}-${index}-${row[table.fields[0]] ?? ''}`} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 'max-content' }} />;
}
