import React, { useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { saveTaskBookFile } from './taskBookStorage';
import { flattenObjects, usePhysicalObjectStore } from './physicalObjectStore';
import { useSessionStore } from './sessionStore';
import { getTaskTrials, getTaskTrialSources, taskBookPath } from './taskTrialModel';
import { commitWorkspaceChange } from './workspacePersistence';
import './taskWorkspace.css';

const { Text } = Typography;

const TaskCenter: React.FC<{ openCreateOnMount?: boolean }> = ({ openCreateOnMount = false }) => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const createTask = useTaskStore((state) => state.createTask);
  const objects = usePhysicalObjectStore(state => state.objects);
  const createProject = useProjectStore((state) => state.createProject);
  const projects = useProjectStore((state) => state.projects);
  const sessions = useSessionStore(state => state.sessions);
  const [createOpen, setCreateOpen] = useState(openCreateOnMount);
  const [title, setTitle] = useState('');
  const [taskBookFile, setTaskBookFile] = useState<File | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const taskBookInput = useRef<HTMLInputElement>(null);
  const objectId = new URLSearchParams(window.location.search).get('objectId');
  const objectContext = objectId ? (() => {
    const objects = usePhysicalObjectStore.getState().objects;
    return objects.find(object => object.id === objectId)?.name
      ?? flattenObjects(objects).find(({ object }) => object.id === objectId)?.object.name;
  })() : undefined;

  const resetForm = () => {
    setTitle('');
    setTaskBookFile(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) return message.warning('请填写任务名称');
    setCreatingTask(true);
    try {
      const taskId = await commitWorkspaceChange(() => {
        const projectId = createProject({ name: title.trim(), description: '任务书关联信息', status: '进行中' });
        return createTask({ title, projectId, requirementTexts: [] });
      });
      try {
        if (taskBookFile) {
          await saveTaskBookFile(taskId, taskBookFile);
          await commitWorkspaceChange(() => useTaskStore.getState().updateTask(taskId, { sourceName: taskBookFile.name }));
        }
        message.success('任务书已创建');
      } catch {
        message.warning('任务书已创建，但 PDF 附件上传失败，可在任务书原文中重新上传');
      }
      setCreateOpen(false);
      resetForm();
      navigate(taskBookPath(taskId));
    } catch (error) {
      message.error(error instanceof Error ? error.message : '任务书未保存，请重试');
    } finally {
      setCreatingTask(false);
    }
  };

  const handleTaskBookChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      message.error('请导入 PDF 格式的任务书');
      return;
    }
    setTaskBookFile(file);
  };


  return (
    <div className="task-center-page task-center-embedded">
      <section className="task-center-section">
        <div className="session-home-section-heading"><h2>任务书工作台</h2><Space><Text type="secondary">{tasks.length} 项</Text><Button icon={<UploadOutlined />} onClick={() => setCreateOpen(true)}>新建任务书</Button></Space></div>
        {tasks.length === 0 ? (
          <Card className="task-center-empty">
            <Empty description="新建任务书后，集中管理关联试验、资料和任务报告。" />
          </Card>
        ) : (
          <List
            className="task-center-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={tasks}
            renderItem={(task) => {
              const entries = getTaskTrials(objects, projects, sessions, task.id);
              const sources = getTaskTrialSources(entries);
              return (
                <List.Item>
                  <Card
                    className="task-center-card task-center-task-card"
                    title={<span className="task-card-title">{task.title}</span>}
                    extra={<Tag color={task.status === '进行中' ? 'blue' : task.status === '已完成' ? 'green' : 'default'}>{task.status}</Tag>}
                    actions={[
                      <Button type="link" key="open" onClick={() => navigate(taskBookPath(task.id))}>打开任务书</Button>,
                      <Text type="secondary" key="updated">更新于 {new Date(task.updatedAt).toLocaleDateString('zh-CN')}</Text>,
                    ]}
                  >
                    <Space direction="vertical" size={10}>
                      <Text type="secondary">任务书 ID：{task.id}</Text><Text type="secondary">附件：{task.sourceName || '无附件'}</Text>
                      {task.demo && <Tag color="purple">历史演示任务</Tag>}

                      <div className="task-card-stats">
                        <span>{new Set(entries.map(entry => entry.object.id)).size} 个物理对象</span>
                        <span>{entries.length} 个关联试验</span>
                        <span>{sources.records} 次执行</span>
                        <span>{sources.files} 个 CSV</span>
                        <span>{sources.charts.length} 张图表</span>
                        <span>{sources.artifacts.length} 项专业成果</span>
                      </div>
                    </Space>
                  </Card>
                </List.Item>
              );
            }}
          />
        )}
      </section>

      <Modal
        title="新建任务书"
        open={createOpen}
        okText="创建任务书"
        cancelText="取消"
        width={720}
        confirmLoading={creatingTask}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); resetForm(); }}
      >
        <div className="task-create-form">
          {objectContext && <Alert type="info" showIcon message={`从物理对象“${objectContext}”创建`} style={{ marginBottom: 16 }} />}
          <label>任务书名称<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：发动机高转速性能分析" /></label>
          <div className="task-book-upload">
            <Text strong>任务书 PDF（可选）</Text>
            <input ref={taskBookInput} type="file" accept="application/pdf,.pdf" onChange={handleTaskBookChange} hidden />
            <Space wrap>
              <Button icon={<UploadOutlined />} onClick={() => taskBookInput.current?.click()}>
                {taskBookFile ? '更换任务书 PDF' : '选择本地 PDF'}
              </Button>
              {taskBookFile && <Space size={4}><Text>{taskBookFile.name}</Text><Button type="text" size="small" aria-label="移除任务书 PDF" icon={<DeleteOutlined />} onClick={() => setTaskBookFile(null)} /></Space>}
            </Space>
          </div>
          <Alert
            showIcon
            type="info"
            message="任务书管理"
            description="集中查看关联试验、资料和任务报告。原始 PDF 可选。"
          />
        </div>
      </Modal>

    </div>
  );
};

export default TaskCenter;
