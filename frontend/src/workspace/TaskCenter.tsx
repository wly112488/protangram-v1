import React, { useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { FolderOpenOutlined, PlusOutlined, PlayCircleOutlined } from '@ant-design/icons';
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

  const resetForm = () => {
    setTitle('');
  };

  const handleCreate = () => {
    if (!title.trim()) return message.warning('请填写任务名称');
    const projectId = createProject({ name: title.trim(), description: '由任务工作台创建的数据与成果空间', status: '进行中' });
    const taskId = createDemoTask({ title, projectId });
    setCreateOpen(false);
    resetForm();
    message.success('已载入内置模拟任务书和 AI 拆解样例');
    navigate(`/tasks/${taskId}`);
  };

  const handleOpenDemo = () => {
    const existingDemoTask = tasks.find((task) => task.demo);
    if (existingDemoTask) {
      navigate(`/tasks/${existingDemoTask.id}`);
      return;
    }
    const title = '高转速区域模型可信性与补充验证';
    const projectId = createProject({ name: title, description: '内置演示数据与模拟分析成果', status: '进行中' });
    const taskId = createDemoTask({ projectId });
    message.success('已载入演示任务书和模拟 AI 拆解计划');
    navigate(`/tasks/${taskId}`);
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
          <Button icon={<PlayCircleOutlined />} onClick={handleOpenDemo}>打开演示任务</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建任务</Button>
          </Space>
        )}
      />

      {tasks.length === 0 ? (
        <Card className="task-center-empty">
          <Empty description="目前没有真实任务书或分析 AI。先打开内置样例，体验模拟任务书、事项拆解、分析成果回流和报告编制。">
            <Space wrap>
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleOpenDemo}>体验完整演示</Button>
              <Button icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建模拟任务</Button>
            </Space>
          </Empty>
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
                    <Button type="link" key="open" onClick={() => navigate(`/tasks/${task.id}`)}>继续处理</Button>,
                    <Text type="secondary" key="updated">更新于 {new Date(task.updatedAt).toLocaleDateString('zh-CN')}</Text>,
                  ]}
                >
                  <Space direction="vertical" size={10}>
                    <Text type="secondary">{task.sourceName || '未填写任务书来源'}</Text>
                    {task.demo && <Tag color="purple">演示数据 · AI 模拟拆解</Tag>}
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
        okText="创建演示任务并进入工作台"
        cancelText="取消"
        width={720}
        onOk={handleCreate}
        onCancel={() => { setCreateOpen(false); resetForm(); }}
      >
        <div className="task-create-form">
          <label>任务名称<Input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：发动机高转速性能分析" /></label>
          <Alert
            showIcon
            type="info"
            message="当前为演示环境"
            description="暂未接入本地任务书解析或真实 AI。创建后会使用内置模拟任务书和预设拆解计划，便于体验完整业务流程。"
          />
        </div>
      </Modal>
    </div>
  );
};

export default TaskCenter;
