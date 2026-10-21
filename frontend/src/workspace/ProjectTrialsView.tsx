import React, { useMemo } from 'react';
import { Alert, Button, Card, Empty, List, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useSessionStore } from './sessionStore';
import { usePhysicalObjectStore } from './physicalObjectStore';
import { useTaskStore } from './taskStore';
import { getProjectTrialEntries } from './projectTrialModel';
import { collectAnalysisResults, getTrialArtifacts } from './analysisResultModel';
import AnalysisResults from './AnalysisResults';
import { physicalSourcePath } from './physicalBusinessContext';
import { taskBookPath } from './taskTrialModel';

const { Text, Title } = Typography;

const ProjectTrialsView: React.FC<{ projectId: string }> = ({ projectId }) => {
  const navigate = useNavigate();
  const projects = useProjectStore(state => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const objects = usePhysicalObjectStore(state => state.objects);
  const tasks = useTaskStore(state => state.tasks);
  const project = projects.find(item => item.id === projectId);
  const entries = useMemo(
    () => getProjectTrialEntries(projectId, objects, projects, sessions),
    [projectId, objects, projects, sessions],
  );

  if (!project) return <Empty description="当前项目不存在或已不可用" />;

  const taskBookIds = [...new Set(entries.map(entry => entry.trial.taskBookId).filter((id): id is string => Boolean(id)))];
  const taskBooks = taskBookIds.map(id => ({ id, task: tasks.find(item => item.id === id) }));

  return (
    <div className="workspace-content-stack">
      <div className="workspace-content-heading">
        <div>
          <div className="workspace-kicker">{project.name}</div>
          <Title level={3}>工作内容与试验</Title>
          <Text type="secondary">具体试验保留自己的执行记录；CSV、图表和专业成果按真实来源查看。</Text>
        </div>
        <Button type="primary" onClick={() => navigate('/trials/new?projectId=' + encodeURIComponent(projectId))}>
          在此项目中新建具体试验
        </Button>
      </div>

      {entries.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前项目尚无已关联的具体试验" />
      ) : entries.map(entry => {
        const scope = {
          physicalObjectId: entry.object.id,
          experimentId: entry.experiment.id,
          trialId: entry.trial.id,
        };
        const artifacts = getTrialArtifacts(projects, sessions, scope, entry.trial);
        const results = collectAnalysisResults(entry.trial, artifacts);
        const trialPath = physicalSourcePath(objects, scope);
        const taskBookId = entry.trial.taskBookId;
        const task = taskBookId ? tasks.find(item => item.id === taskBookId) : undefined;

        return (
          <Card
            key={entry.object.id + ':' + entry.experiment.id + ':' + entry.trial.id}
            className="workspace-card project-trial-card"
            title={<div><Title level={4}>{entry.trial.name}</Title><Text type="secondary">{entry.category.name} · {entry.object.name} · {entry.experiment.name}</Text></div>}
            extra={<Button onClick={() => { if (trialPath) navigate(trialPath); }}>打开具体试验</Button>}
          >
            <Space wrap>
              <Tag>{entry.trial.loadSpectrum || '未填写载荷谱'}</Tag>
              <Tag>{entry.trial.records.length} 次执行记录</Tag>
              {task && <Tag color="blue">已关联任务书：{task.title}</Tag>}
              {taskBookId && !task && <Tag color="warning">任务书关联失效：{taskBookId}</Tag>}
            </Space>

            <div className="project-trial-records">
              <Title level={5}>执行记录</Title>
              <List
                dataSource={entry.trial.records}
                locale={{ emptyText: '暂无执行记录' }}
                renderItem={record => {
                  const recordPath = physicalSourcePath(objects, { ...scope, testRecordId: record.id });
                  const files = record.rawFiles.filter(file => file.status !== 'removed');
                  return (
                    <List.Item actions={[
                      <Button key="open-record" type="link" onClick={() => { if (recordPath) navigate(recordPath); }}>
                        查看执行记录
                      </Button>,
                    ]}>
                      <List.Item.Meta
                        title={'第 ' + record.executionNumber + ' 次执行记录 · ' + record.name}
                        description={
                          <Space wrap>
                            <Tag>{files.length} 个有效 CSV</Tag>
                            <Tag>{record.tables.length} 个派生数据表</Tag>
                            {files.map(file => <Tag key={file.id}>{file.name}</Tag>)}
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            </div>

            <div className="project-trial-results">
              <Title level={5}>专业功能及成果</Title>
              {results.length
                ? <AnalysisResults entries={results} trial={entry.trial} shared />
                : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无已保存的专业成果" />}
            </div>

            {taskBookId && !task && (
              <Alert type="warning" showIcon message="任务书关联已失效" description="当前任务书 ID 不存在；试验及执行记录仍保留原归属。" />
            )}
          </Card>
        );
      })}

      {taskBooks.length > 0 && (
        <Card className="workspace-card" title="附录：任务书与关联信息（可选）">
          <List
            dataSource={taskBooks}
            renderItem={({ id, task }) => (
              <List.Item actions={task ? [
                <Button key="open-task" type="link" onClick={() => navigate(taskBookPath(id))}>查看任务书原文及关联信息</Button>,
              ] : []}>
                <List.Item.Meta
                  title={task?.title || '失效的任务书关联'}
                  description={task ? '任务书通过具体试验的 taskBookId 关联；不改变试验、执行记录和成果的原有归属。' : '任务书 ID：' + id}
                />
              </List.Item>
            )}
          />
          <Text type="secondary">本计划不自动拆解任务书，也不生成 AI 任务项。</Text>
        </Card>
      )}
    </div>
  );
};

export default ProjectTrialsView;
