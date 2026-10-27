import { useEffect, useState } from 'react';
import { Alert, Table } from 'antd';
import type { RawDataFile } from './physicalObjectStore';
import { readTrialFile, type ParsedRawFile } from './trialDataFiles';
import { WORKSHEET_PAGE_SIZE } from './csvWorksheetModel';

export default function CsvFilePreview({ file }: { file: RawDataFile }) {
  const [loaded, setLoaded] = useState<{ id: string; data?: ParsedRawFile; error?: string }>();
  useEffect(() => {
    let current = true;
    readTrialFile(file.id).then(data => { if (current) setLoaded({ id: file.id, data }); })
      .catch(error => { console.error(error); if (current) setLoaded({ id: file.id, error: '读取文件失败' }); });
    return () => { current = false; };
  }, [file.id]);
  if (loaded?.id !== file.id) return <div className="physical-chart-loading">正在读取 CSV…</div>;
  if (loaded.error) return <Alert type="error" showIcon message={loaded.error} />;
  return <><Table aria-label={`CSV 预览 ${file.name}`} size="small" rowKey={(_, index) => String(index)}
    columns={loaded.data!.headers.map(field => ({ title: field, dataIndex: field, key: field, width: 150, ellipsis: true }))}
    dataSource={loaded.data!.rows} pagination={{ defaultPageSize: WORKSHEET_PAGE_SIZE, showSizeChanger: true, pageSizeOptions: [15, 30, 50], showTotal: total => `共 ${total} 行` }} scroll={{ x: 'max-content' }} /></>;
}
