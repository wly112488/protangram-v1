# 任务书分析与试验工作流验收

日期：2026-10-21。预览入口：`http://localhost:5175/task-book-analysis`。

## 修改

- 新增独立任务书分析页面：导入原文、展示可编辑任务事项、预填试验模板，复核后进入现有试验工作台。
- 复用既有任务事项、状态、完成依据、附件持久化和五个专业功能；不创建第二套试验/记录/CSV/成果。
- 已有对象与构型按明确来源唯一匹配；不确定字段留空。试验模板确认前不创建试验或会话，重复确认不重复创建。
- 任务内显示事项状态和已完成数量，继续工作复用同一会话；用户提供完成依据或已有成果并确认完成后，才将会话显示到最近会话或对应项目下。
- 项目创建只填名称；项目内可直接进入带项目上下文的任务书分析。
- 物理对象移到左侧底部并默认收起；保留右键删除会话及历史成果访问。

## 主要文件

- `TaskBookAnalysisPage.tsx`、`taskAnalysisModel.ts`：导入、规划预览与字段预填。
- `TaskProgressView.tsx`、`taskTrialWorkflow.ts`：任务进度、复核、继续工作和完成发布。
- `TrialCreatePage.tsx`：复用原创建表单，带入草稿并确认关联。
- `TaskBookWorkspace.tsx`、`TaskCenter.tsx`、`SessionHome.tsx`：任务导航与进度入口。
- `BusinessSidebar.tsx`、`WorkbenchHome.tsx`、`ProjectTrialsView.tsx`、路由：独立/项目入口与对象树位置。
- `sessionStore.ts`、`sessionSidebarModel.ts`、`taskStore.ts`、类型：可选的草稿来源、工作会话和可见性元数据，兼容已有数据。

## 验证

- `node --test tests/*.test.mjs`：146 通过，0 失败。
- 变更 TypeScript/TSX 文件 ESLint：通过，无错误或警告。
- `npm run build`：通过；仍有既有的分包体积提示。
- `verify-task-analysis-workflow.mjs`：7 项验收通过，包括导入预填、取消/确认、同次执行多 CSV、进度持久化、完成后侧栏显示、项目上下文、来源缺项及无页面异常。
- `verify-project-entry-consolidation.mjs`：12 项回归通过，覆盖独立/项目创建、五功能上下文、共享成果、旧链接及会话删除保留数据。
- 旧 TypeScript 页面断言：18 通过、12 项既有失败；与基础提交对照没有新增失败。
- `git diff --check`：通过。浏览器测试使用独立 context，没有改动用户浏览器数据。

## 实现范围

本轮为已获授权的前端展示与交互：复用前端规划建议，文本任务书识别显式字段，PDF 保留原文预览；没有伪造后端 AI 响应、原文页码或专业参数。真实 AI 文档解析适配器及服务端持久化未在本轮新增。数据沿用现有浏览器持久化，不宣称数据库写入成功。产品页面展示业务内容与复核操作。
