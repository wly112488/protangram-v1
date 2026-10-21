import { useState } from 'react';
import { Alert, Button, Card, Modal, Popconfirm, Select, Space, Tag, Typography, Upload, message } from 'antd';
import { FileAddOutlined, PlusOutlined } from '@ant-design/icons';
import type { RcFile } from 'antd/es/upload/interface';
import { v4 as uuid } from 'uuid';
import { usePhysicalObjectStore, type RawDataFile } from './physicalObjectStore';
import type { ProjectArtifact } from './types';
import { parseTrialCsv, saveTrialFile } from './trialDataFiles';
import { useTrialWorksheet } from './trialWorksheetContext';
import './physicalObjects.css';

export default function TrialCsvAnalysis({ trialId, artifacts = [] }: { trialId: string; initialRecordId?: string; artifacts?: ProjectArtifact[] }) {
  const workspace = useTrialWorksheet();
  const [imports, setImports] = useState(0);
  const [manage, setManage] = useState(false);
  if (!workspace || workspace.trial.id !== trialId) return <Alert type="info" showIcon message="请在当前具体试验会话中打开数据分析。" />;
  const { trial, recordId, setRecordId, openFile, dirtyFiles } = workspace;
  const record = trial.records.find(item => item.id === recordId);
  const dependentResultCount = (rawFileId: string) => trial.charts.filter(chart => chart.rawFileId === rawFileId).length
    + trial.records.flatMap(record => record.tables).filter(table => table.rawFileId === rawFileId).length
    + artifacts.filter(artifact => (artifact.payload.sourceContext as { rawFiles?: RawDataFile[] } | undefined)?.rawFiles?.some(file => file.id === rawFileId)).length;
  const createRecord = () => {
    try { setRecordId(usePhysicalObjectStore.getState().addTrialRecord(trial.id, {})); }
    catch (error) { message.error(error instanceof Error ? error.message : '创建执行记录失败'); }
  };
  const importCsv = async (file: RcFile) => {
    if (!record) { message.error('请先建立执行记录'); return; }
    if (!file.name.toLowerCase().endsWith('.csv')) { message.error('这里只接受 CSV 文件'); return; }
    setImports(count => count + 1);
    try {
      const parsed = parseTrialCsv(await file.text());
      if (!parsed.headers.length || !parsed.rows.length) throw new Error('CSV 没有可用的字段或数据行');
      const id = `raw-${uuid()}`;
      await saveTrialFile(id, file);
      usePhysicalObjectStore.getState().addRawFile(trial.id, record.id, { id, name: file.name, mimeType: file.type || 'text/csv', size: file.size, addedAt: new Date().toISOString(), headers: parsed.headers, rowCount: parsed.rows.length, status: 'available' });
      openFile(id);
      message.success(`“${file.name}”已保存到本机的${record.name}；诊断服务尚未接入`);
    } catch (error) { message.error(error instanceof Error ? error.message : 'CSV 导入失败'); }
    finally { setImports(count => count - 1); }
  };
  return <div className="trial-csv-analysis">
    <Alert type="info" showIcon message="CSV、编辑副本及成果保存在本机浏览器，服务端文件存储尚未接入。" />
    <Card size="small"><Space wrap>
      <Select aria-label="执行记录" placeholder="选择执行记录" disabled={imports > 0} value={recordId} onChange={setRecordId} options={trial.records.map(item => ({ value: item.id, label: `${item.name} · ${item.rawFiles.filter(file => file.status !== 'removed').length} 个 CSV` }))} />
      <Button icon={<PlusOutlined />} disabled={imports > 0} onClick={createRecord}>新建执行记录</Button>
      <Upload accept=".csv,text/csv" multiple showUploadList={false} disabled={imports > 0 || !record} beforeUpload={file => { void importCsv(file); return false; }}><Button type="primary" disabled={!record} loading={imports > 0} icon={<FileAddOutlined />}>导入 CSV</Button></Upload>
      <Button onClick={() => setManage(true)}>管理数据文件</Button>
    </Space>{!record && <Typography.Paragraph type="secondary">先建立执行记录。一次执行可以导入多个 CSV，每个 CSV 分别分析。</Typography.Paragraph>}</Card>
    <Modal title="当前执行的数据文件" open={manage} width={760} onCancel={() => setManage(false)} footer={<Button onClick={() => setManage(false)}>关闭</Button>}>
      <div className="trial-csv-file-list">{record?.rawFiles.map(rawFile => <div className="trial-csv-file-row" key={rawFile.id}><Space wrap><strong>{rawFile.name}</strong><Typography.Text type="secondary">{rawFile.rowCount} 行 · {rawFile.headers.length} 列</Typography.Text>{rawFile.sourceRawFileId && <Tag>工作副本</Tag>}{rawFile.status === 'removed' && <Tag color="orange">已移除</Tag>}</Space>{rawFile.status !== 'removed' && <Space><Button type="link" onClick={() => { openFile(rawFile.id, true); setManage(false); }}>打开工作表</Button><Popconfirm title="移除此 CSV？" description={`此文件被 ${dependentResultCount(rawFile.id)} 项成果引用。移除后成果保留并标记来源失效。${dirtyFiles.has(rawFile.id) ? '此工作表未保存修改将丢弃。' : ''}`} okText="移除" cancelText="取消" okButtonProps={{ danger: true }} onConfirm={() => {
        try { usePhysicalObjectStore.getState().removeRawFile(trial.id, record!.id, rawFile.id); message.success('已移除，原成果保留并标记来源失效'); }
        catch (error) { message.error(error instanceof Error ? error.message : '移除失败'); }
      }}><Button type="link" danger>移除</Button></Popconfirm></Space>}</div>)}</div>
    </Modal>
  </div>;
}
