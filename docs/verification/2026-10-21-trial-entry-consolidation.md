# 试验创建、成果入口与会话删除验收

日期：2026-10-21。工作区：`/home/jiaxing/projects/protangram-v1-preview`。预览：`http://localhost:5175/`。基础提交：`fe4f36d`。

## 实际行为

- 最近会话加号、工作台独立试验入口与旧 `/sessions/new` 地址均打开具体试验表单。独立创建不要求 Project 或任务书；不会创建组织项目。内部成果空间仍沿用原有实现，不在项目列表展示。
- 从项目创建自动带入项目；从任务书创建自动关联任务书。任务书不改变原数据归属，也不会让关联项目从侧栏消失。
- 填写不完整、取消或仅打开表单都不产生试验/会话；上级对象明确“保存并选择”后独立保留。
- 项目页默认具体试验列表。共享数据与成果只提供目录、搜索、筛选和点击预览；取消旧项目概览、重复资源抽屉和共享页面上的创建入口。
- 项目/会话/任务书的成果链接使用同一目录与预览组件，继承当前试验并可返回原工作界面。所有已保存结果按稳定 ID 汇总，保留多版本；CSV 按执行记录归属。
- 五个专业功能保持同一具体试验和工作会话上下文。打开项目试验、执行记录时直接进入专业工作台。
- 左侧最近会话及项目内会话支持右键删除、确认和取消。删除会话及草稿，保留原试验、执行记录、CSV、已保存成果。删除当前会话返回工作台。
- 删除最后一条项目会话时，仅在前端项目元数据保存原来源 ID 引用，避免项目试验入口丢失；不复制试验、文件或成果，不修改后端模型。

## 主要文件

- `frontend/src/workspace/BusinessSidebar.tsx`：独立/项目入口、右键删除。
- `frontend/src/workspace/TrialCreatePage.tsx`、`trialCreationModel.ts`：同一创建流程、上下文选择及有效提交后创建会话。
- `frontend/src/workspace/ProjectResourcesPage.tsx`、`ProjectTrialsView.tsx`：项目试验列表与共享页面分工。
- `frontend/src/workspace/ProjectContent.tsx`、`sharedResourcesModel.ts`、`AnalysisResults.tsx`：统一成果视图、来源筛选、旧链接兼容与成果定位。
- `frontend/src/workspace/SessionWorkbench.tsx`、`SessionShell.tsx`、`sessionModel.ts`：专业上下文、返回流程及移除空会话自动创建。
- `frontend/src/workspace/TaskBookWorkspace.tsx`、`ResultPreview.tsx`：任务书和报告的统一成果跳转。
- `frontend/src/workspace/sessionStore.ts`、`projectStore.ts`、`projectTrialModel.ts`、`types.ts`：会话隔离、删除和来源关系保留。
- `frontend/src/workspace/LegacySessionPage.tsx`：保留旧未绑定会话的原成果和已有文本访问；不提供新的工作笔记创建流程。
- 删除未使用的 `frontend/src/workspace/ProjectOverview.tsx`。

## 验证结果

- `node --test tests/*.test.mjs`：141 项通过，0 失败。
- `npm run build`：通过。Vite 仍有既有的 500 kB 分包体积提示。
- 对本次变更 TypeScript/TSX 文件运行 ESLint：0 错误、0 警告。
- `git diff --check`：通过。
- `scripts/verify-project-entry-consolidation.mjs`：12 项浏览器验收通过，0 页面运行时异常。使用独立 Chromium context，覆盖独立/项目/任务书创建、未提交无副作用、即时新建构型、五功能上下文、共享目录/预览/返回、历史链接、会话删除及原数据保留。
- `node --experimental-strip-types --test tests/*.test.ts`：18 项通过、12 项失败。这些失败均属于改前已失败的旧页面结构断言；使用基础提交源码快照对照，改前 16 通过、14 失败，新增失败为 0。本轮替换了两项与已删除概览/调试页面有关的过期断言；其余历史断言未扩展修改。

## 持久化边界

沿用现有前端 localStorage/Zustand 和 CSV 的 IndexedDB 存储。本轮没有新增后端接口、数据库表或迁移；试验和对象创建仍未接入真实后端数据库。新增保存提示明确表示“本机保存”，不宣称数据库写入成功。未删除用户真实浏览器数据。
