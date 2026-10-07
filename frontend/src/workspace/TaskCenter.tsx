import React, { useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import WorkspacePageHeader from './WorkspacePageHeader';
import './taskWorkspace.css';

const { Text } = Typography;

const TaskCenter: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const createDemoTask = useTaskStore((state) => state.createDemoTask);
  const createProject = useProjectStore((state) => state.createProject);
  const projects = useProjectStore((state) => state.projects);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [taskBookFile, setTaskBookFile] = useState<File | null>(null);
  const taskBookInput = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitle('');
    setTaskBookFile(null);
  };

  const handleCreate = () => {
    if (!title.trim()) return message.warning('请填写任务名称');
    if (!taskBookFile) return message.warning('请选择任务书 PDF');
    const projectId = createProject({ name: title.trim(), description: '由任务工作台创建的数据与成果空间', status: '进行中' });
    const taskId = createDemoTask({ title, projectId, sourceName: taskBookFile.name });
    setCreateOpen(false);
    resetForm();
    message.success('任务已创建，任务事项将使用模拟 AI 拆解结果');
    navigate(`/tasks/${taskId}`);
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

  const openStandaloneCapability = (path: string) => navigate(path, { state: { workspaceSession: { mode: 'standalone' } } });

  const completedCount = (taskId: string) => {
    const task = tasks.find((item) => item.id === taskId);
    return task?.requirements.filter((item) => item.status === '已满足').length ?? 0;
  };

  return (
    <div className="task-center-page">
      <WorkspacePageHeader
        title="任务中心"
        description="围绕任务书组织业务事项、分析成果与报告"
        level={3}
        actions={(
          <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={() => navigate('/projects')}>独立项目与成果</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建任务</Button>
          </Space>
        )}
      />

      {tasks.length === 0 ? (
        <Card className="task-center-empty">
          <Empty description="导入任务书 PDF 并命名任务后，即可在任务工作台体验事项拆解、专业分析和报告编制。当前事项拆解与分析结果使用模拟数据。" />
        </Card>
      ) : (
        <List
          className="task-center-list"
          grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
          dataSource={tasks}
          renderItem={(task) => {
            const project = projects.find((item) => item.id === task.projectId);
            const artifactCount = project?.artifacts.length ?? 0;
            const openRequirements = task.requirements.length - completedCount(task.id);
            return (
              <List.Item>
                <Card
                  className="task-center-card"
                  title={<span className="task-card-title">{task.title}</span>}
                  extra={<Tag color={task.status === '进行中' ? 'blue' : task.status === '已完成' ? 'green' : 'default'}>{task.status}</Tag>}
                  actions={[
                    <Button type="link" key="open" onClick={() => navigate(`/tasks/${task.id}`)}>打开任务工作台</Button>,
                    <Text type="secondary" key="updated">更新于 {new Date(task.updatedAt).toLocaleDateString('zh-CN')}</Text>,
                  ]}
                >
                  <Space direction="vertical" size={10}>
                    <Text type="secondary">{task.sourceName || '未填写任务书来源'}</Text>
                    {task.demo && <Tag color="purple">AI 模拟拆解与分析结果</Tag>}
                    <div className="task-card-stats">
                      <span>{openRequirements} 项要求待确认</span>
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

      <Card className="task-center-standalone" size="small">
        <div>
          <Text strong>独立使用专业能力</Text>
          <Text type="secondary">无需创建任务，也可以直接使用试验设计、数据分析、数字孪生或虚拟工况扩展。</Text>
        </div>
        <Space wrap>
          <Button onClick={() => openStandaloneCapability('/experiment/design/intelligent')}>试验设计</Button>
          <Button onClick={() => openStandaloneCapability('/analysis/projects')}>试验数据分析</Button>
          <Button onClick={() => openStandaloneCapability('/analysis/digital-twin')}>试验数字孪生</Button>
          <Button onClick={() => openStandaloneCapability('/analysis/virtual-condition')}>虚拟工况扩展</Button>
        </Space>
      </Card>

      <Modal
        title="新建任务"
        open={createOpen}
        okText="创建任务并进入工作台"
        cancelText="取消"
        width={720}
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
            description="本地 PDF 目前只记录文件名，不会上传或解析文件内容；创建后使用内置模拟 AI 拆解和专业分析结果。"
          />
        </div>
      </Modal>
    </div>
  );
};

export default TaskCenter;
