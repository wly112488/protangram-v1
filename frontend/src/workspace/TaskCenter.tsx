import React, { useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Empty, Input, List, Modal, Space, Tag, Typography, message } from 'antd';
import { DeleteOutlined, FolderOpenOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { LEGACY_EXPERIMENT_STORAGE_KEY, useProjectStore } from './projectStore';
import { useTaskStore } from './taskStore';
import type { LegacyGeneratedExperiment } from './projectModel';
import { saveTaskBookFile } from './taskBookStorage';
import WorkspacePageHeader from './WorkspacePageHeader';
import './taskWorkspace.css';

const { Text } = Typography;

const loadLegacyExperiments = (): LegacyGeneratedExperiment[] => {
  try {
    const raw = localStorage.getItem(LEGACY_EXPERIMENT_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed as LegacyGeneratedExperiment[] : [];
  } catch {
    return [];
  }
};

const TaskCenter: React.FC = () => {
  const navigate = useNavigate();
  const tasks = useTaskStore((state) => state.tasks);
  const createDemoTask = useTaskStore((state) => state.createDemoTask);
  const createProject = useProjectStore((state) => state.createProject);
  const importLegacyExperiment = useProjectStore((state) => state.importLegacyExperiment);
  const setActiveProject = useProjectStore((state) => state.setActiveProject);
  const projects = useProjectStore((state) => state.projects);
  const [createOpen, setCreateOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
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

  const handleCreateIndependentProject = () => {
    if (!projectName.trim()) return message.warning('请填写项目名称');
    createProject({ name: projectName.trim(), description: '用户自主开展试验与分析的数据、工作表和成果空间', status: '进行中' });
    setProjectName('');
    setCreateProjectOpen(false);
    message.success('独立项目已创建');
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

  const taskProjectIds = new Set(tasks.map((task) => task.projectId));
  const independentProjects = projects.filter((project) => !project.sessionOwnerId && !taskProjectIds.has(project.id));
  const importCandidates = useMemo(
    () => loadLegacyExperiments().filter((legacy) => !projects.some((project) => project.id === legacy.id)),
    [projects, importOpen],
  );

  return (
    <div className="task-center-page">
      <WorkspacePageHeader
        title="任务中心"
        description="围绕任务书组织业务事项、分析成果与报告"
        level={3}
        actions={(
          <Space wrap>
          <Button icon={<FolderOpenOutlined />} onClick={() => setImportOpen(true)}>导入旧版试验项目</Button>
          <Button icon={<FolderOpenOutlined />} onClick={() => setCreateProjectOpen(true)}>新建独立项目</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>新建任务</Button>
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

      <section className="task-center-section task-center-project-section">
        <div className="task-center-section-heading">
          <div><Text strong>我的独立项目</Text><Text type="secondary">自主试验与分析 · 不包含任务书和 AI 任务拆解</Text></div>
          <Tag>{independentProjects.length} 个</Tag>
        </div>
        {independentProjects.length === 0 ? (
          <Card className="task-center-empty task-center-project-empty">
            <Empty description="还没有独立项目。创建后可保存自己的试验数据、工作表和专业分析成果。" />
          </Card>
        ) : (
          <List
            className="task-center-list"
            grid={{ gutter: 16, xs: 1, sm: 1, md: 2, lg: 2, xl: 3 }}
            dataSource={independentProjects}
            renderItem={(project) => (
              <List.Item>
                <Card
                  className="task-center-card task-center-project-card"
                  title={<span className="task-card-title">{project.name}</span>}
                  extra={<Tag color="cyan">独立项目</Tag>}
                  actions={[
                    <Button type="link" key="open" onClick={() => { setActiveProject(project.id); navigate('/projects'); }}>打开项目空间</Button>,
                    <Text type="secondary" key="updated">更新于 {new Date(project.updatedAt).toLocaleDateString('zh-CN')}</Text>,
                  ]}
                >
                  <Space direction="vertical" size={10}>
                    <Text type="secondary">{project.description || '自主试验与分析的数据、工作表和成果空间'}</Text>
                    <div className="task-card-stats">
                      <span>{project.datasets.length} 个数据集</span>
                      <span>{project.worksheet ? `${Object.keys(project.worksheet.data).length} 条工作表记录` : '暂无工作表'}</span>
                      <span>{project.artifacts.length} 项专业成果</span>
                    </div>
                  </Space>
                </Card>
              </List.Item>
            )}
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

      <Modal
        title="新建独立项目"
        open={createProjectOpen}
        okText="创建项目"
        cancelText="取消"
        onOk={handleCreateIndependentProject}
        onCancel={() => { setCreateProjectOpen(false); setProjectName(''); }}
      >
        <div className="task-create-form">
          <label>项目名称<Input autoFocus value={projectName} onChange={(event) => setProjectName(event.target.value)} placeholder="例如：高转速试验数据探索" /></label>
          <Alert showIcon type="info" message="独立项目不创建正式任务" description="用于自主开展试验和分析，保存数据、工作表与专业成果；不包含任务书或 AI 任务事项拆解。" />
        </div>
      </Modal>

      <Modal
        title="导入旧版试验项目"
        open={importOpen}
        footer={null}
        onCancel={() => setImportOpen(false)}
      >
        {importCandidates.length > 0 ? (
          <List
            dataSource={importCandidates}
            renderItem={(item) => (
              <List.Item
                actions={[
                  <Button
                    key="import"
                    type="link"
                    onClick={() => {
                      const projectId = importLegacyExperiment(item);
                      setActiveProject(projectId);
                      setImportOpen(false);
                      navigate('/projects');
                    }}
                  >导入</Button>,
                ]}
              >
                <List.Item.Meta title={item.name} description={item.designName || '历史项目'} />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有尚未导入的旧版试验项目" />
        )}
      </Modal>
    </div>
  );
};

export default TaskCenter;
