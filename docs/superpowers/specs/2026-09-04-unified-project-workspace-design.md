# ProTangram 统一项目工作台架构设计

## 目标
将当前前端从“旧桌面软件壳 + 分散业务页面状态 + 临时项目树”收敛为统一的项目工作台。视觉以已确认参考图为基准；业务上以统一 `ProjectWorkspace` 前端 Store 作为项目、工作表和正式结果的唯一真源。

## 核心原则
- 顶部表示平台能力；左侧表示项目及项目已存在内容；中央表示当前工作对象；右侧表示 AI 上下文辅助。
- 项目不是所有能力的前置条件。模型校准、数据分析、虚拟工况等仍可独立进入。
- 业务执行先产生 Draft；只有明确确认/保存后才进入 Project。
- Draft 不进入项目树、不计入项目统计、不参与项目最近结果。
- 项目树只显示真实存在的数据和 Artifact，不预造空节点。
- 左侧按“业务内容类别”聚合，不按每次算法执行产生无限节点。
- 后端 API 暂不改，本轮由前端 Zustand + persist/localStorage 统一状态。
- AI 改为固定右侧栏，但复用现有 `TrialAIAssistant` 上下文、快捷问题和 BusinessAction 逻辑。

## 统一数据模型

### ProjectWorkspace
前端 Store 持有：
- `projects: Project[]`
- `activeProjectId: string | null`
- `activeArtifactRef: { projectId: string; artifactId?: string; view: ProjectView } | null`
- 项目 CRUD、Artifact CRUD、工作表更新、选择器和派生统计。

### Project
字段：
- `id`
- `name`
- `description?`
- `status`
- `createdAt`
- `updatedAt`
- `basicInfo`: 试验对象、当前模型等可选业务信息
- `worksheet?`
- `datasets[]`
- `artifacts[]`

### ProjectArtifact
统一正式结果：
- `id`
- `projectId`
- `type`: `design | analysis | rootCause | calibration | virtualCondition | report`
- `title`
- `source`
- `status?`
- `summary`
- `payload`
- `createdAt`
- `updatedAt`

图表不作为左侧独立实例节点。项目“数据图表”视图从 analysis/calibration/virtualCondition 等 Artifact 的 payload 中聚合已有图表。

## 项目树
一级节点：项目。

二级节点：
- `项目概览`：固定存在。
- `试验工作表`：有 worksheet 时出现。
- `数据图表`：存在可视化结果时出现。
- `根因分析`：存在 rootCause Artifact 时出现。
- `模型校准`：存在 calibration Artifact 时出现。
- `智能试验设计`：存在 design Artifact 时出现。
- `虚拟工况`：存在 virtualCondition Artifact 时出现。
- `报告`：存在 report Artifact 时出现。

同类多次执行不扩张左侧节点；点击类别后在中央展示当前有效结果和历史版本。

删除某类最后一条 Artifact 后，对应二级节点自动消失；重新保存后重新出现。

## 业务执行与项目写回

### 试验数字孪生
- `开始校准`：只生成 Calibration Draft。
- `保存到项目`：写入 calibration Artifact。
- 独立模式保存时选择目标项目；项目模式默认当前项目。
- `用于工况扩展` 保留现有业务跳转，并可携带当前校准结果。

### 智能试验设计
- `生成推荐方案`：产生候选 Draft。
- `确认方案`：视为正式保存，写入 design Artifact。
- 后续“生成试验任务”复用现有业务流程；若能生成工作表，则写入 Project worksheet。

### 试验数据分析
- `开始分析`：生成 Analysis Draft。
- `保存分析结果`：写入 analysis Artifact。
- `确认根因`：写入 rootCause Artifact；根因结论与一般分析结果分开。
- 图表作为 Analysis Artifact payload 的组成部分，由项目“数据图表”聚合展示。

### 虚拟工况扩展
- `生成虚拟工况`：只生成输入 Draft。
- `开始预测`：生成 VirtualResult Draft。
- `保存预测结果`：写入 virtualCondition Artifact。
- `生成验证试验`：视为用户接受当前预测，可先保存当前结果再进入试验设计流程。

## BusinessSession
业务页面进入时区分：
- `mode: project` + `targetProjectId`
- `mode: standalone`

禁止仅凭全局 `activeProjectId` 偷偷关联结果。顶部独立进入默认 standalone；从项目内部进入默认 project。

## 页面架构

### Header
移除浏览器地址栏式 `protangram:/...` UI。

统一为一条 Header：
- Logo
- `实验敏捷迭代智能管理平台`
- `试验管理`
- `试验设计（DOE）`
- `数据分析`
- `报告生成`
- 主题和用户入口

现有 FunctionBar 的 Popover、Modal、路由和业务处理保留，但视觉并入 Header，不再额外占用第二条独立功能栏。

### 左侧 Project Sidebar
固定约 250px，白色圆角卡片：
- 标题“项目”
- 新建/导入入口
- 项目搜索
- 折叠项目树

搜索仅过滤一级项目。

### 中央工作区
项目概览展示：
- 项目标题/状态/更新时间
- 项目基础信息
- 资产统计（datasets / worksheet 或试验记录 / charts / business artifacts）
- 最近结果
- 工作表摘要入口

不使用大面积网格背景。

项目工作表作为独立内容视图，不永久贴在页面底部。

业务子路由继续通过现有 Router 页面渲染，但外层统一处于 Project Sidebar + Center + AI Shell 中。

### 右侧 AI
固定约 320px。

保留现有 TrialAIAssistant Provider/context、快捷问题、Mock 回复、BusinessAction 回调；将 Drawer 展示改为嵌入式 Panel。

AI 上下文自动随当前业务页/项目/Artifact 更新，但不要求切换页面时清空会话。

低于约 1440px 时允许退化为可展开 AI 面板，中央业务区优先级最高。

## 视觉规范
- 页面背景：`#F4F7FB` / `#EEF3F9`
- 主卡片：`#FFFFFF`
- 边框：`#DDE6F2`
- 主文字：`#0D2043`
- 辅助文字：`#74829C`
- 主色：`#2F80FF`
- 辅助强调：`#57C9D7`
- 主容器圆角：20–24px
- 普通卡片圆角：14–18px
- 轻阴影：`0 8px 24px rgba(27,55,92,.06)`
- 间距主要使用 8 / 12 / 16 / 24px

移除：
- 地址栏式 UI
- 大面积网格背景
- 永久底部工作表
- 重复第二层横向导航
- 固定 Drawer 作为 AI 主交互
- 大量直角灰边框和桌面软件视觉

## 兼容与迁移
已有 `protangram-generated-experiments` localStorage 数据在 Store 初始化时迁移为 Project：
- name/id 沿用
- worksheetData -> worksheet
- designSummary -> design Artifact
- extraItems 仅作为兼容内容转为 legacy Artifact 或在首次迁移时按名称尽量分类；不继续作为主业务数据结构

迁移成功后新逻辑只写统一 Project Store key，避免两套状态继续增长。

## 组件边界
建议新增：
- `src/workspace/types.ts`
- `src/workspace/projectStore.ts`
- `src/workspace/projectSelectors.ts`
- `src/workspace/ProjectSidebar.tsx`
- `src/workspace/ProjectOverview.tsx`
- `src/workspace/ProjectArtifactView.tsx`
- `src/workspace/WorkspaceShell.tsx`
- `src/components/TrialAIAssistantPanel.tsx` 或改造 TrialAIAssistant 支持 embedded mode

重点修改：
- `layouts/MainLayout.tsx`
- `workbench/FunctionBar.tsx`
- `workbench/ProjectWorkbench.tsx`（逐步缩减或替换为 WorkspaceShell）
- `pages/analysis/DigitalTwin.tsx`
- `pages/experiment/design/IntelligentExperimentDesign.tsx`
- 数据分析执行页
- `pages/analysis/VirtualConditionExtension.tsx`
- `index.css`

不修改后端 API。

## 验收
1. Header 与参考图视觉结构一致，不再出现地址栏式壳层和独立第二功能栏。
2. 左侧 Project Sidebar 始终存在，能搜索/展开/切换项目和真实内容类别。
3. 项目概览、工作表、Artifact 类别都从统一 Store 读取，不再依赖 GeneratedExperiment/extraItems 作为主模型。
4. 四个核心业务功能明确区分 Draft 与正式保存；保存后项目树/概览立即同步。
5. standalone 模式不会因 activeProjectId 偷偷写入项目。
6. AI 为固定右侧 Panel，现有业务上下文和动作逻辑保持可用。
7. 删除最后一条某类 Artifact 后其项目树类别节点消失。
8. 旧 localStorage 数据可迁移，不丢失已生成实验和工作表。
9. `npm run build`、lint 和新增 Store/selector 测试通过后才可合并。