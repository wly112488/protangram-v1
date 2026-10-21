# CSV 工作表与成果目录实施计划

> 历史实施记录。后续讨论已确认底部上拉工作表、通用绘图和按来源组织成果，最新方案与实施见 [底部工作表计划](2026-10-20-bottom-worksheet.md)。本文件中的旧布局和功能分类不再作为当前要求。

**Goal:** 将已讨论的 CSV 工作表交互和双栏成果预览接入真实的现有前端存储。

**Architecture:** 复用执行记录中的 rawFiles、trial.charts、record.tables 和专业 artifact。目录仅引用原对象；仅选择后读取 CSV 或渲染图表。CSV 编辑保留原文件，保存新工作副本并保留来源 ID。

**Tech Stack:** React、Ant Design、Zustand、IndexedDB、PapaParse、ECharts；现有 Node 测试和 Vite 构建。

## 已确认的交互

- CSV 只在数据分析导入；设计、虚拟工况等可通过文件卡片打开查看。
- 工作表以文件 Tab 切换，可修改显示名称；表格默认全部列、每页 15 行，宽表横向滚动。
- 支持鼠标选择字段作为绘图输入，数据分析支持编辑字段名和单元格。编辑后保存工作副本，既有文件和成果不被覆盖。
- 共享成果先按专业功能，再按载荷谱和 CSV 来源组织；左侧显示名称，点击后右侧预览。
- CSV 名称打开表格；成果名称打开图表、数据表或指标。未选择时不预加载所有图形。
- 右侧去除重复来源/字段说明，保留来源失效、演示结果等必要业务状态。专业成果的说明仍保存在数据中。
- 不实现底部上拉工作区；采用最后确认的双栏布局。
- 当前试验仅有一个载荷谱；聚合项目可展示多个实际试验的载荷谱；同名载荷谱仍按试验 ID 区分。
- 不更改后端模型或伪造服务端保存。浏览器存储限制明确说明。

## Task 1：成果目录模型及双栏查看

- [x] 测试目录按功能、试验和执行 CSV 分组，同名文件不合并；多来源成果不伪造单 CSV 来源。
- [x] 新建 resultCatalogModel.ts，返回持有 ResultEntry 原对象的目录，包含无成果 CSV。
- [x] 重构 AnalysisResults，增加 ResultPreview 和 CsvFilePreview，仅选中后加载，默认 15 行。
- [x] ProjectContent 接入当前试验与项目聚合，保持任务、会话和结果身份不变。
- [x] 运行目录、来源和原有成果测试。

## Task 2：数据分析多工作表与编辑

- [x] 测试字段重命名/单元格修改不改变输入、同名字段拒绝、列选择顺序和 CSV round-trip。
- [x] 新建 csvWorksheetModel.ts；TrialCsvAnalysis 复用多文件 Tab、全列表格、分页、鼠标列选择、重命名和编辑。
- [x] 保存编辑为新 CSV 文件，现有记录只增加文件，不增加执行；成果保存引用已落盘文件。
- [x] 用现有 useSessionState 持久化 Tab 显示名，保持源文件名称。
- [x] 原始 CSV 导入/删除唯一入口仍为数据分析；工作副本保留源文件 ID。

## Task 3：其他专业页查看、验证

- [x] 设计与预测页新增已有 CSV 文件卡片，点击用相同表格查看，禁止重复导入。
- [x] 专业成果保存记录来源功能，历史成果按现有 type 兼容分类。
- [x] 运行相关 Node 测试、TypeScript/Vite 构建；在浏览器验证导入、15 行分页、编辑副本、列选择绘图和目录按需预览。
- [x] 检查改动并记录实际结果；保留既有未提交工作，不执行发布或推送。

## 验证边界

引用不变、按来源归属、未选择不加载、原文件不可被编辑覆盖、一个 CSV 不产生新执行记录；通过行为测试、浏览器交互和生产构建共同验证。


## 实际修改与验证记录

- 目录与预览：`AnalysisResults.tsx`、`resultCatalogModel.ts`、`resultCatalog.css`、`ResultPreview.tsx`、`CsvFilePreview.tsx`；项目聚合接入 `ProjectContent.tsx`。
- CSV 工作表：`TrialCsvAnalysis.tsx`、`CsvWorksheetEditor.tsx`、`csvWorksheetModel.ts`；复用既有 IndexedDB 和原有图表/数据表保存接口。`RawDataFile.sourceRawFileId` 为前端可选的工作副本来源元数据，旧数据兼容。
- 跨功能查看：`TrialCsvReferences.tsx`、`SessionWorkbench.tsx`；各功能的标签别名保存在既有会话草稿内。
- 来源与兼容：`analysisResultModel.ts`、`useWorkspaceBusinessSession.ts`、`sessionStore.ts`、`physicalObjectStore.ts`、`trialChartOutput.ts`、`TrialDataTable.tsx`。修正项目内不同具体试验误复用同一会话、无明确来源的旧成果误归属多个试验的问题。
- 既有三条过时断言按已经确认的界面和业务语义更新：保留左侧对象树、清除任务事项焦点的语义校验、任务项目概览的当前文案。

验证环境：当前工作区 `/tmp/protangram-v1-main-redesign/frontend`，Node v24，当前工作区的 Vite 服务 `http://127.0.0.1:5175`。浏览器使用独立 Playwright context 与合成文件，未读写用户的浏览器数据。

验证结果：
- `node --test tests/*.test.mjs`：122 项，0 失败。
- `npm run build`：通过；保留现有的大包体积提示。
- 新增/重构的 8 个工作表与目录模块定向 ESLint：0 错误/警告；`git diff --check` 通过。
- `scripts/verify-csv-result-workspace.mjs`：8 组浏览器流程通过，包括全部列/15行、跨页编辑、原文件不变、工作副本、鼠标选列绘图、标签刷新保留、多文件导入不增加执行、设计/数字孪生/虚拟工况查看、目录按需加载、手机宽度、多载荷谱项目聚合、移除源文件后的成果状态。
- 截图：`frontend/node_modules/.tmp/csv-result-workspace/catalog-desktop.png`、`catalog-mobile.png`。

后端缺口：CSV 文件、编辑工作副本和会话成果仍使用当前浏览器持久化；尚无服务端文件存储、编辑版本和数据分页接口。大 CSV 目前在本机解析，15 行分页限制渲染量，不代表已经实现服务端流式读取。界面明确显示本机保存，未虚构后端调用。
