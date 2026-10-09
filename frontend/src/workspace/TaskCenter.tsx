import React, { useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import { saveTaskBookFile } from './taskBookStorage';
import WorkspacePageHeader from './WorkspacePageHeader';
import './taskWorkspace.css';

const { Text } = Typography;

const TaskCenter: React.FC<{ embedded?: boolean; openCreateOnMount?: boolean }> = ({ embedded = false, openCreateOnMount = false }) => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const createDemoTask = useTaskStore((state) => state.createDemoTask);
  const createProject = useProjectStore((state) => state.createProject);
  const projects = useProjectStore((state) => state.projects);
  const [createOpen, setCreateOpen] = useState(openCreateOnMount);
  const [title, setTitle] = useState('');
  const [taskBookFile, setTaskBookFile] = useState<File | null>(null);
  const [creatingTask, setCreatingTask] = useState(false);
  const taskBookInput = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setTaskBookFile(null);
  };

  const handleCreate = async () => {
    if (!title.trim()) return message.warning('请填写任务名称');
    if (!taskBookFile) return message.warning('请选择任务书 PDF');
    setCreatingTask(true);
    try {
      const projectId = createProject({ name: title.trim(), description: '由任务工作台创建的数据与成果空间', status: '进行中' });
      const taskId = createDemoTask({ title, projectId, sourceName: taskBookFile.name });
      try {
        await saveTaskBookFile(taskId, taskBookFile);
        message.success('任务已创建；任务书已保存在本机，事项使用模拟 AI 拆解结果');
      } catch {
        message.warning('任务已创建，但任务书未能保存在本机；稍后可在原文查看器中重新选择 PDF');
      }
      setCreateOpen(false);
      resetForm();
      navigate(`/tasks/${taskId}`);
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

  const completedCount = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    return task?.requirements.filter((item) => item.status === '已满足').length ?? 0;
  };

  return (
    <div className={`task-center-page${embedded ? ' task-center-embedded' : ''}`}>
      <WorkspacePageHeader
        title={embedded ? '正式任务' : '任务中心'}
        description={embedded ? '任务书驱动的工作、分析成果与报告集中在这里。' : '围绕任务书组织业务事项、分析成果与报告'}
        level={3}
        actions={(
          <Space wrap>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建正式任务</Button>
          </Space>
        )}
      />

      <section className="task-center-section">
        <div className="task-center-section-heading">
          <div><Text strong>正式任务</Text><Text type="secondary">任务书驱动 · AI 拆解与复核 · 专业分析 · 任务报告</Text></div>
          <Tag>{tasks.length} 项</Tag>
        </div>
        {tasks.length === 0 ? (
          <Card className="task-center-empty">
            <Empty description="导入任务书并命名后，正式任务会显示在这里。当前任务拆解和分析结果使用模拟数据。" />
          </Card>
        ) : (
          <List
            className="task-center-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={tasks}
            renderItem={(task) => {
              const project = projects.find((item) => item.id === task.projectId);
              const linkedArtifactIds = new Set([
                ...(task.artifactRefs ?? []),
                ...task.requirements.flatMap((requirement) => requirement.artifactRefs ?? []),
                ...task.reportDraft.sections.flatMap((section) => section.artifactRefs),
                ...(task.professionalProjects ?? []).flatMap((item) => item.artifactRefs),
                ...(task.reportDraft.formalReportArtifact ? [task.reportDraft.formalReportArtifact] : []),
              ].map((reference) => `${reference.projectId}:${reference.artifactId}`));
              const artifactCount = projects.reduce((count, item) => count + item.artifacts.filter((artifact) => linkedArtifactIds.has(`${artifact.projectId}:${artifact.id}`)).length, 0);
              const openRequirements = task.requirements.length - completedCount(task.id);
              return (
                <List.Item>
                  <Card
                    className="task-center-card task-center-task-card"
                    title={<span className="task-card-title">{task.title}</span>}
                    extra={<Tag color={task.status === '进行中' ? 'blue' : task.status === '已完成' ? 'green' : 'default'}>{task.status}</Tag>}
                    actions={[
                      <Button type="link" key="open" onClick={() => navigate(`/tasks/${task.id}`)}>打开任务工作台</Button>,
                      <Text type="secondary" key="updated">更新于 {new Date(task.updatedAt).toLocaleDateString('zh-CN')}</Text>,
                    ]}
                  >
                    <Space direction="vertical" size={10}>
                      <Text type="secondary">任务书：{task.sourceName || '未填写来源'}</Text>
                      {task.demo && <Tag color="purple">AI 模拟拆解与分析结果</Tag>}
                      {project && <Text type="secondary">关联项目空间：{project.name}</Text>}
                      <div className="task-card-stats">
                        <span>{openRequirements} 项事项待处理</span>
                        <span>{task.professionalProjects?.length ?? 0} 个专业工作项目</span>
                        <span>{artifactCount} 项分析成果</span>
                        <span>{task.reportDraft.sections.reduce((count, section) => count + section.artifactRefs.length, 0)} 项已入报告</span>
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
        title="新建任务"
        open={createOpen}
        okText="创建任务并进入工作台"
        cancelText="取消"
        width={720}
        confirmLoading={creatingTask}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); resetForm(); }}
      >
        <div className="task-create-form">
          <label>任务名称<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：发动机高转速性能分析" /></label>
          <div className="task-book-upload">
            <Text strong>任务书 PDF</Text>
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
            message="当前为原型模拟"
            description="PDF 会保存在当前浏览器本机供任务工作台查看，不会上传或解析文件内容；任务事项和专业分析结果仍使用内置模拟数据。"
          />
        </div>
      </Modal>

    </div>
  );
};

export default TaskCenter;
