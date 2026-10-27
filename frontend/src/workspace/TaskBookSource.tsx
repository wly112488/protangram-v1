import { useEffect, useState } from 'react';
import { Alert, Card, Spin, Typography } from 'antd';
import { useTaskStore } from './taskStore';
import { loadTaskBookFile } from './taskBookStorage';

/** Read the original attachment without creating another task book. */
export default function TaskBookSource({taskId}:{taskId:string}) {
  const task = useTaskStore(state => state.tasks.find(item => item.id === taskId));
  const [source,setSource] = useState<{loading:boolean;url?:string;error?:string}>({loading:true});
  useEffect(() => {
    let active = true, url:string | undefined;
    loadTaskBookFile(taskId).then(file => {
      if (!active) return;
      if (file && (/\.pdf$/i.test(task?.sourceName ?? '') || file.type === 'application/pdf')) url = URL.createObjectURL(file);
      setSource({loading:false,url,error:!file && task?.sourceName?.toLowerCase().endsWith('.pdf') ? '本机未找到原始 PDF，已有解析与试验数据仍保留。' : undefined});
    }).catch(() => active && setSource({loading:false,error:'原始附件读取失败，已有数据仍保留。'}));
    return () => {active=false;if(url) URL.revokeObjectURL(url);};
  },[taskId,task?.sourceName]);
  return <Card title="原始任务书核对" className="task-analysis-source">
    {source.loading ? <Spin /> : source.url ? <iframe title="候选试验原始 PDF" src={source.url} /> : <>
      {source.error && <Alert type="warning" title={source.error} />}
      <Typography.Paragraph style={{whiteSpace:'pre-wrap'}}>{task?.sourceText || task?.sourceName || ""}</Typography.Paragraph>
    </>}
  </Card>;
}
