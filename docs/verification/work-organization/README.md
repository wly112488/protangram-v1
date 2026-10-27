# 工作入口与业务数据组织整改验收

分支：`feat/cfg-model-frontend-flow`。仅修改前端，沿用 Zustand、localStorage 和 IndexedDB；未新增后端接口、未更换数据库、未清空或重置持久化数据。实施基于工作区已有的会话创建、导航和样式改动；原有未跟踪的后端需求文档未修改。

## 已实施的行为

- 用户确认“全部删除”后，移除开发占位、空状态、前置说明、技术解释和程序异常直出。采样要求占位页及三个无实现的 AI 辅助入口已移除，不添加替代占位说明；已有数据与业务校验保留。详见 [文案清理记录](ui-copy-cleanup.md)。
- 按用户最新截图确认，独立会话以名称列表保留在左侧，新建增加独立条目，支持搜索、切换及刷新恢复。移除顶部会话页签。项目内统一提供分析任务书、试验任务、共享数据与成果；正式项目工作继续在项目下组织。
- 项目“新建试验”只先填写名称，创建项目内工作草稿并进入同一个五功能工作台。选择功能、填写输入后，可在当前功能内关联已有试验或通过复用表单明确创建具体试验；保留当前会话 ID、成果存储空间、CFG 选择和输入。关联后草稿进入正式试验目录，重新打开复用原工作会话。
- 关联前的成果与运行保留原归属；输入数据仍能在当前工作中引用，后续新运行明确记录关联试验。旧未关联成果不会因当前会话后来选择试验而被追溯分配到该试验。跨项目关联、已失效任务书与替换已有试验关联会被阻止。
- 统一前端本地 ID 生成，兼容 HTTP 局域网 IP 地址下没有 crypto.randomUUID 的浏览器；不改变任何已有对象 ID 或引用。直接在该环境验证项目、会话、CFG、任务书及演示运行的创建流程。
- 任务书导入必须处于有效项目中。同一页面只保留一个主要导入/更换按钮。解析与保存规划仅产生候选试验；用户复核名称、参数并确认后才创建正式试验。保存后的事项和专业功能仍可复核，原始 PDF 在导入、任务详情和候选确认页可查看。
- 已确认候选与自主试验复用同一具体试验存储及项目列表。新试验通过物理对象建立来源，不将 CFG 固定到试验上，也不强制生成 SET。旧试验的 CFG 字段保留供历史追溯。
- 物理对象存储版本从 6 升至 7，键名不变。演示风扇合入已有涵道风扇类别，旧类别 ID 保留为别名；对象、参数、子装备、历史试验、记录、CSV、图表及外部引用 ID 均保留，重复迁移不生成重复对象。
- CFG 仅按自身分类展示；创建与专业功能内创建复用同一编辑器和校验。成员保存既有装备 ID 及角色，可跨类别、任意组成层级引用，不复制装备资料，不要求陪试件。
- 每次进入专业功能均需重新明确选择 CFG。新增 CFG 后留在原功能，本次输入不丢失。切换 CFG 保留当前参数并清除待保存的旧运行结果，不加载其他 CFG 草稿覆盖本次输入。
- 数字孪生及虚拟工况接入已有通用模型配置表单和模型方案存储。智能设计、根因分析保留各自的输入与演示流程；保存结果记录当次运行快照。智能设计在会话内保存方案，不另造一套正式试验任务。
- 每次运行保留自己的 CFG、试验/执行记录来源、输入与运行标识。共享成果仍保存为单个原始 artifact，通过引用在项目、会话、试验和 CFG 视图检索；项目目录新增会话、CFG、执行记录组合筛选。
- 旧的未归属项目任务书不会自动删除或分配项目。用户可在项目的分析任务书中查看并明确归入当前项目，保留原数据与成果存储；若试验已有其他项目归属，则阻止该操作。

## 自动验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `node --test tests/*.test.mjs tests/*.test.ts src/pages/report/reportModel.test.mjs` | 235 项测试通过，0 失败 | [tests-copy-cleanup.log](tests-copy-cleanup.log) |
| `npm run build`（含 `tsc -b`） | 类型检查及生产构建通过 | [build-copy-cleanup.log](build-copy-cleanup.log) |
| ESLint | 未通过；现有 27 个错误、7 个警告，较原基线 36/7 未新增问题 | [清理后基线比较](lint-copy-cleanup.json) |
| `git diff --check` | 通过 | 无空白错误 |

新增回归覆盖 v6 浏览器数据迁移与重复迁移、外部引用可解析、候选确认幂等、正式任务项目约束、同一试验的不同 CFG 运行快照、运行记录关联和旧任务归属恢复。调整了与已确认规则冲突的原断言；未移除原测试文件。

## 实际浏览器验证

复用了本机已有 Playwright 和 Windows Chromium，没有再次下载浏览器或修改项目依赖。采用隔离浏览器上下文、内置演示数据及注入的 v6 旧持久化样本；不操作日常浏览器数据。API 请求在测试上下文中拦截，保存、迁移与检索均验证现有前端持久化。

[HTTP IP 环境完整交互日志](browser-copy-cleanup.log)、[左侧会话列表](conversation-sidebar.png)、[项目创建后的五功能工作台](project-trial-workspace.png)、[项目筛选与运行结果截图](project-resources.png)、[移动端导航截图](mobile-navigation.png)。

已通过的实际交互：

1. 左侧独立会话按名称保留，不展示顶部会话页签；无独立全局正式任务分组。新建独立会话不强制创建具体试验。
2. v6 数据刷新迁移后 A/B 进入现有涵道风扇；电涵道风扇、1223、13131、用户参数与转子保留，项目和任务引用不变，再次刷新无重复。
3. 创建项目、进入分析任务书、单一主要导入操作、复核建议名称；导入及规划保存阶段试验数量不变，用户确认后才新增一项正式试验。
4. CFG 管理创建用户分类，组合风扇与电机，持久化被试和供电角色以及原装备 ID。
5. 专业功能无默认 CFG；已有模型输入填入后在功能内新建 CFG，返回后网格与转速输入保持。
6. 同一试验先后用两组 CFG 运行，第二组还使用不同主被试装备；运行输入分别为 4321 和 5678 rpm，成果保留原试验来源及各自 CFG，不串线、不复制成果。
7. 切换专业功能后 CFG 为空，需要重新选择。
8. 项目成果目录组合按会话、CFG、运行筛选，并实际预览到对应的 4321 rpm 结果。
9. 原始 PDF 在导入、保存后的任务核对及候选确认页均可查看，PDF 复核过程未创建正式试验。
10. 移动端可从左侧列表切换独立会话，切换后侧栏关闭，没有顶部会话页签；整个浏览器验收未出现页面运行时异常。
11. 在 A 会话填写 7654 rpm 约束后创建 B：ID、成果空间分别独立，A 的持久化内容不变；左侧两条会话都可继续工作，离开、搜索和刷新后仍保留。
12. 项目先创建工作草稿并进入五功能总览，此时具体试验数量不增加。进入数字孪生后填写 6543 rpm 及网格，内联创建并关联具体试验，当前 CFG、参数、会话与成果空间均保留；新运行成果具有正确试验与会话来源，项目目录重新打开同一会话。独立会话也可以明确关联同一个已有试验，不重复创建。
13. 直接访问 HTTP IP 地址，浏览器报告 secureContext=false、randomUUID=undefined，上述全流程通过。单元测试另覆盖全局 crypto 不存在的环境。

可复现脚本：[verify-work-organization.mjs](../../../frontend/scripts/verify-work-organization.mjs)。默认连接 `http://127.0.0.1:5173`，支持既有验证脚本使用的 `PROTANGRAM_TEST_URL`、`PROTANGRAM_PLAYWRIGHT_ROOT`、`PROTANGRAM_CHROMIUM_PATH`；`PROTANGRAM_UPSTREAM_URL` 可选，用于已有浏览器与 WSL 预览之间的 localhost 测试转发。

## 限制及未解决问题

- 原有 ESLint 问题未作无关清理；生产构建仍有大文件体积提示。
- Ant Design 控件存在既有弃用提示，交互验证未出现运行时异常。
- 任务解析、模型运行、智能推荐与根因结论仍为前端演示，界面及成果保留演示标识；没有实现真实 PDF 自动解析、CFD 或其他后端计算。这里验证的是前端工作流与数据关联。
- 验证使用隔离样本及代表性浏览器流程；没有读取用户日常浏览器中的实际存储，因此不等同于对所有历史浏览器数据和真实业务计算完成全量验收。
- 文案已按用户确认清理。字段与引用约束继续执行，实际操作失败只显示状态，异常详情写入控制台。演示数据的持久化标记继续保留。

## 实际修改文件

前端业务源码 95 个文件（含删除 1 个占位文件）、测试 10 个文件、浏览器脚本 1 个文件。以下清单包含在工作区原有未提交变更上继续完成的文件。

### 业务源码

- [frontend/src/App.tsx](../../../frontend/src/App.tsx)
- [frontend/src/components/FullscreenPanel.tsx](../../../frontend/src/components/FullscreenPanel.tsx)
- [frontend/src/components/TrialAIAssistant.tsx](../../../frontend/src/components/TrialAIAssistant.tsx)
- [frontend/src/pages/analysis/DigitalTwin.tsx](../../../frontend/src/pages/analysis/DigitalTwin.tsx)
- [frontend/src/pages/analysis/VirtualConditionExtension.tsx](../../../frontend/src/pages/analysis/VirtualConditionExtension.tsx)
- [frontend/src/pages/analysis/modules/ModuleManagement.tsx](../../../frontend/src/pages/analysis/modules/ModuleManagement.tsx)
- [frontend/src/pages/analysis/projects/AnalysisExecution.tsx](../../../frontend/src/pages/analysis/projects/AnalysisExecution.tsx)
- [frontend/src/pages/analysis/projects/AnalysisProjectCreate.tsx](../../../frontend/src/pages/analysis/projects/AnalysisProjectCreate.tsx)
- [frontend/src/pages/analysis/projects/AnalysisProjects.tsx](../../../frontend/src/pages/analysis/projects/AnalysisProjects.tsx)
- [frontend/src/pages/analysis/templates/TemplateCreate.tsx](../../../frontend/src/pages/analysis/templates/TemplateCreate.tsx)
- [frontend/src/pages/analysis/templates/TemplateList.tsx](../../../frontend/src/pages/analysis/templates/TemplateList.tsx)
- [frontend/src/pages/experiment/design/ExperimentCreate.tsx](../../../frontend/src/pages/experiment/design/ExperimentCreate.tsx)
- [frontend/src/pages/experiment/design/ExperimentDesign.tsx](../../../frontend/src/pages/experiment/design/ExperimentDesign.tsx)
- [frontend/src/pages/experiment/design/IntelligentExperimentDesign.tsx](../../../frontend/src/pages/experiment/design/IntelligentExperimentDesign.tsx)
- [frontend/src/pages/experiment/design/OutlineDesign.tsx](../../../frontend/src/pages/experiment/design/OutlineDesign.tsx)
- 删除：frontend/src/pages/experiment/info/SamplingRequirements.tsx
- [frontend/src/pages/experiment/info/TestMethods.tsx](../../../frontend/src/pages/experiment/info/TestMethods.tsx)
- [frontend/src/pages/report/ReportCreate.tsx](../../../frontend/src/pages/report/ReportCreate.tsx)
- [frontend/src/pages/report/ReportGenerate.tsx](../../../frontend/src/pages/report/ReportGenerate.tsx)
- [frontend/src/pages/report/ReportList.tsx](../../../frontend/src/pages/report/ReportList.tsx)
- [frontend/src/router/index.tsx](../../../frontend/src/router/index.tsx)
- [frontend/src/utils/createLocalId.ts](../../../frontend/src/utils/createLocalId.ts)
- [frontend/src/workbench/ExperimentNavigator.tsx](../../../frontend/src/workbench/ExperimentNavigator.tsx)
- [frontend/src/workbench/FunctionBar.tsx](../../../frontend/src/workbench/FunctionBar.tsx)
- [frontend/src/workspace/AnalysisResults.tsx](../../../frontend/src/workspace/AnalysisResults.tsx)
- [frontend/src/workspace/BusinessSidebar.tsx](../../../frontend/src/workspace/BusinessSidebar.tsx)
- [frontend/src/workspace/CfgPredictionForm.tsx](../../../frontend/src/workspace/CfgPredictionForm.tsx)
- [frontend/src/workspace/CsvFilePreview.tsx](../../../frontend/src/workspace/CsvFilePreview.tsx)
- [frontend/src/workspace/CsvWorksheetEditor.tsx](../../../frontend/src/workspace/CsvWorksheetEditor.tsx)
- [frontend/src/workspace/FeatureCfgPicker.tsx](../../../frontend/src/workspace/FeatureCfgPicker.tsx)
- [frontend/src/workspace/LegacySessionPage.tsx](../../../frontend/src/workspace/LegacySessionPage.tsx)
- [frontend/src/workspace/PhysicalObjectsPage.tsx](../../../frontend/src/workspace/PhysicalObjectsPage.tsx)
- [frontend/src/workspace/PhysicalTrialsTable.tsx](../../../frontend/src/workspace/PhysicalTrialsTable.tsx)
- [frontend/src/workspace/PredictionWorkspace.tsx](../../../frontend/src/workspace/PredictionWorkspace.tsx)
- [frontend/src/workspace/PreparationChecklist.tsx](../../../frontend/src/workspace/PreparationChecklist.tsx)
- [frontend/src/workspace/ProfessionalCfgField.tsx](../../../frontend/src/workspace/ProfessionalCfgField.tsx)
- [frontend/src/workspace/ProjectContent.tsx](../../../frontend/src/workspace/ProjectContent.tsx)
- [frontend/src/workspace/ProjectResourcesPage.tsx](../../../frontend/src/workspace/ProjectResourcesPage.tsx)
- [frontend/src/workspace/ProjectSaveTargetModal.tsx](../../../frontend/src/workspace/ProjectSaveTargetModal.tsx)
- [frontend/src/workspace/ProjectSidebar.tsx](../../../frontend/src/workspace/ProjectSidebar.tsx)
- [frontend/src/workspace/ProjectTrialsView.tsx](../../../frontend/src/workspace/ProjectTrialsView.tsx)
- [frontend/src/workspace/ResultPreview.tsx](../../../frontend/src/workspace/ResultPreview.tsx)
- [frontend/src/workspace/SessionCreate.tsx](../../../frontend/src/workspace/SessionCreate.tsx)
- [frontend/src/workspace/SessionDataWorkspace.tsx](../../../frontend/src/workspace/SessionDataWorkspace.tsx)
- [frontend/src/workspace/SessionHome.tsx](../../../frontend/src/workspace/SessionHome.tsx)
- [frontend/src/workspace/SessionOverview.tsx](../../../frontend/src/workspace/SessionOverview.tsx)
- [frontend/src/workspace/SessionProfessionalBoundary.tsx](../../../frontend/src/workspace/SessionProfessionalBoundary.tsx)
- [frontend/src/workspace/SessionRootCauseAnalysis.tsx](../../../frontend/src/workspace/SessionRootCauseAnalysis.tsx)
- [frontend/src/workspace/SessionSidebar.tsx](../../../frontend/src/workspace/SessionSidebar.tsx)
- [frontend/src/workspace/SessionTrialAssociation.tsx](../../../frontend/src/workspace/SessionTrialAssociation.tsx)
- [frontend/src/workspace/SessionWorkbench.tsx](../../../frontend/src/workspace/SessionWorkbench.tsx)
- [frontend/src/workspace/TaskBookAnalysisPage.tsx](../../../frontend/src/workspace/TaskBookAnalysisPage.tsx)
- [frontend/src/workspace/TaskBookSource.tsx](../../../frontend/src/workspace/TaskBookSource.tsx)
- [frontend/src/workspace/TaskBookWorkspace.tsx](../../../frontend/src/workspace/TaskBookWorkspace.tsx)
- [frontend/src/workspace/TaskCenter.tsx](../../../frontend/src/workspace/TaskCenter.tsx)
- [frontend/src/workspace/TaskProgressView.tsx](../../../frontend/src/workspace/TaskProgressView.tsx)
- [frontend/src/workspace/TaskWorkbench.tsx](../../../frontend/src/workspace/TaskWorkbench.tsx)
- [frontend/src/workspace/TrialChart.tsx](../../../frontend/src/workspace/TrialChart.tsx)
- [frontend/src/workspace/TrialConfigurationEditor.tsx](../../../frontend/src/workspace/TrialConfigurationEditor.tsx)
- [frontend/src/workspace/TrialConfigurationLibrary.tsx](../../../frontend/src/workspace/TrialConfigurationLibrary.tsx)
- [frontend/src/workspace/TrialCreatePage.tsx](../../../frontend/src/workspace/TrialCreatePage.tsx)
- [frontend/src/workspace/TrialCsvAnalysis.tsx](../../../frontend/src/workspace/TrialCsvAnalysis.tsx)
- [frontend/src/workspace/TrialDataAnalysisWorkspace.tsx](../../../frontend/src/workspace/TrialDataAnalysisWorkspace.tsx)
- [frontend/src/workspace/TrialDataTable.tsx](../../../frontend/src/workspace/TrialDataTable.tsx)
- [frontend/src/workspace/TrialSettingsPanel.tsx](../../../frontend/src/workspace/TrialSettingsPanel.tsx)
- [frontend/src/workspace/TrialWorksheetDock.tsx](../../../frontend/src/workspace/TrialWorksheetDock.tsx)
- [frontend/src/workspace/TrialWorksheetProvider.tsx](../../../frontend/src/workspace/TrialWorksheetProvider.tsx)
- [frontend/src/workspace/WorkbenchHome.tsx](../../../frontend/src/workspace/WorkbenchHome.tsx)
- [frontend/src/workspace/WorksheetPlotDialog.tsx](../../../frontend/src/workspace/WorksheetPlotDialog.tsx)
- [frontend/src/workspace/analysisResultModel.ts](../../../frontend/src/workspace/analysisResultModel.ts)
- [frontend/src/workspace/artifactTrialContext.ts](../../../frontend/src/workspace/artifactTrialContext.ts)
- [frontend/src/workspace/cfgTrialBridge.ts](../../../frontend/src/workspace/cfgTrialBridge.ts)
- [frontend/src/workspace/demoData.ts](../../../frontend/src/workspace/demoData.ts)
- [frontend/src/workspace/modelSchemeStore.ts](../../../frontend/src/workspace/modelSchemeStore.ts)
- [frontend/src/workspace/physicalObjectStore.ts](../../../frontend/src/workspace/physicalObjectStore.ts)
- [frontend/src/workspace/preparationChecklist.css](../../../frontend/src/workspace/preparationChecklist.css)
- [frontend/src/workspace/professionalContext.ts](../../../frontend/src/workspace/professionalContext.ts)
- [frontend/src/workspace/professionalScopeModel.ts](../../../frontend/src/workspace/professionalScopeModel.ts)
- [frontend/src/workspace/projectStore.ts](../../../frontend/src/workspace/projectStore.ts)
- [frontend/src/workspace/projectTrialModel.ts](../../../frontend/src/workspace/projectTrialModel.ts)
- [frontend/src/workspace/sessionModel.ts](../../../frontend/src/workspace/sessionModel.ts)
- [frontend/src/workspace/sessionResourceModel.ts](../../../frontend/src/workspace/sessionResourceModel.ts)
- [frontend/src/workspace/sessionResourceStore.ts](../../../frontend/src/workspace/sessionResourceStore.ts)
- [frontend/src/workspace/sessionStore.ts](../../../frontend/src/workspace/sessionStore.ts)
- [frontend/src/workspace/sessionTrialAssociationModel.ts](../../../frontend/src/workspace/sessionTrialAssociationModel.ts)
- [frontend/src/workspace/sessionWorkspace.css](../../../frontend/src/workspace/sessionWorkspace.css)
- [frontend/src/workspace/sharedResourcesModel.ts](../../../frontend/src/workspace/sharedResourcesModel.ts)
- [frontend/src/workspace/taskAnalysis.css](../../../frontend/src/workspace/taskAnalysis.css)
- [frontend/src/workspace/taskAnalysisModel.ts](../../../frontend/src/workspace/taskAnalysisModel.ts)
- [frontend/src/workspace/taskStore.ts](../../../frontend/src/workspace/taskStore.ts)
- [frontend/src/workspace/taskTrialWorkflow.ts](../../../frontend/src/workspace/taskTrialWorkflow.ts)
- [frontend/src/workspace/trialConfigurationStore.ts](../../../frontend/src/workspace/trialConfigurationStore.ts)
- [frontend/src/workspace/trialCreationModel.ts](../../../frontend/src/workspace/trialCreationModel.ts)
- [frontend/src/workspace/useSessionState.ts](../../../frontend/src/workspace/useSessionState.ts)
- [frontend/src/workspace/useWorkspaceBusinessSession.ts](../../../frontend/src/workspace/useWorkspaceBusinessSession.ts)

### 测试

- [frontend/tests/sessionWorkbench.test.mjs](../../../frontend/tests/sessionWorkbench.test.mjs)
- [frontend/tests/cfgTrialBridge.test.mjs](../../../frontend/tests/cfgTrialBridge.test.mjs)
- [frontend/tests/physicalObjects.test.mjs](../../../frontend/tests/physicalObjects.test.mjs)
- [frontend/tests/professionalScope.test.mjs](../../../frontend/tests/professionalScope.test.mjs)
- [frontend/tests/projectCreationEntry.test.mjs](../../../frontend/tests/projectCreationEntry.test.mjs)
- [frontend/tests/taskAnalysisWorkflow.test.mjs](../../../frontend/tests/taskAnalysisWorkflow.test.mjs)
- [frontend/tests/trialCharts.test.mjs](../../../frontend/tests/trialCharts.test.mjs)
- [frontend/tests/trialCreationModel.test.mjs](../../../frontend/tests/trialCreationModel.test.mjs)
- [frontend/tests/workOrganization.test.mjs](../../../frontend/tests/workOrganization.test.mjs)
- [frontend/tests/workspaceRegression.test.ts](../../../frontend/tests/workspaceRegression.test.ts)

### 浏览器脚本

- [frontend/scripts/verify-work-organization.mjs](../../../frontend/scripts/verify-work-organization.mjs)

### 验收资料

- `docs/verification/work-organization/README.md`
- `docs/verification/work-organization/tests.log`
- `docs/verification/work-organization/build.log`
- `docs/verification/work-organization/browser.log`
- `docs/verification/work-organization/lint-comparison.txt`
- `docs/verification/work-organization/project-resources.png`
- `docs/verification/work-organization/mobile-navigation.png`
