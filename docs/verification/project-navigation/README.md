# 项目导航、顶部专业入口与任务成果验收

基于 `feat/cfg-model-frontend-flow` 当前工作区实施；保留开始时已有的未提交修改。没有改动后端，也没有重置持久化数据。

## 实现与修改文件

文件均相对 `frontend/src/workspace/`，另有说明的除外。

| 文件 | 职责与变化 |
| --- | --- |
| `projectNavigationModel.ts`（新增） | 将已有项目、正式试验、工作草稿和任务书映射为真实嵌套节点；项目下仅有试验任务、分析任务书两组。 |
| `BusinessSidebar.tsx` | 使用 Ant Design Tree 展示该层级；试验节点恢复实际关联会话；移除项目成果分类。 |
| `sessionWorkspace.css` | 同级项目使用相同图标、名称、计数网格，固定字体及行高；长名称省略；顶部功能栏布局。 |
| `ProfessionalFeatureNav.tsx`（新增）、`SessionShell.tsx` | 五个专业入口常驻公共顶部；从当前路由会话获取上下文；没有会话时命名创建新工作并进入所选功能。 |
| `SessionCreate.tsx` | 创建后进入用户已选择的专业功能；项目入口建立项目工作草稿。 |
| `SessionWorkbench.tsx` | 移除会话内重复功能栏，保留通用工具、任务工作台等原操作；成果视图在当前会话内打开。 |
| `ProjectResourcesPage.tsx` | 常规项目页仅有试验任务、分析任务书；旧成果 URL 保持可读。 |
| `ProjectTrialsView.tsx`、`sharedResourcesModel.ts` | 具体试验及成果链接进入实际会话；旧链接保留兼容处理。 |
| `ProjectContent.tsx` | 当前会话路由决定任务范围；支持 CFG 和运行筛选；防止旧查询参数覆盖当前任务。 |
| `sessionResourceModel.ts` | 未关联试验的工作仅收集自己的成果或明确引用，关联试验后使用该试验成果范围；全局 CFG 目录保留原有语义。 |
| `professionalContext.ts`、`useWorkspaceBusinessSession.ts` | 专业功能输入复用当前任务成果，避免同 CFG 下其他任务的数据自动混入。 |
| `frontend/src/pages/report/ReportCreate.tsx` | 报告选材采用当前工作/试验成果范围。 |

自动化文件：新增 `frontend/tests/projectNavigation.test.mjs`；更新 `projectCreationEntry.test.mjs`、`trialAnalysisWorkspace.test.mjs`、`workspaceRegression.test.ts` 中与新组织方式冲突的断言；扩展 `frontend/scripts/verify-work-organization.mjs` 的浏览器验收。

## 实际验证

`browser.log` 记录的 Chromium/Playwright 交互已通过，复用 Windows 已有 Playwright 和 Chromium，没有重新下载：

- 首页即有五个专业入口；创建两个独立会话后状态相互独立。
- 项目工作草稿、任务书候选复核、确认创建正式试验、PDF 核对仍可使用。
- 同一试验用两个 CFG 运行数字孪生，再运行虚拟工况；三个成果同时保留并按 CFG 分类。
- 在任务内按 CFG、运行记录筛选并查看实际保存的结果，返回原功能。
- 五个入口分别到达 `doe`、`analysis`、`digital-twin`、`virtual-condition`、`report`，会话 ID 不变。
- 切换另一试验后成果范围切换；附加外部项目/试验查询参数不能突破当前会话范围。
- 长项目名、“111”、“11”的图标、名称起点、计数右边缘、字体和 32px 行高一致；正式试验有实际两级缩进。测量值在日志中。
- 常规导航不再有项目成果分类，历史成果 URL 仍可访问，未复制成果。
- 移动导航、旧数据迁移、输入保留等既有路径通过；无浏览器 `pageerror`。

当次单元测试 238 项通过；随后新增物理对象整改测试后的最终总数为 **241 项通过**，最终构建、静态检查及完整测试结果见 [物理对象整改验收](../equipment-management/README.md)。没有发现变异测试配置、依赖或执行脚本。

## 能力边界

浏览器验收使用前端本地持久化和既有演示计算，测试中对 API 返回空列表以隔离外部服务。没有验证真实后端算法、CFD 或多用户服务端同步。五个入口均验证了路由；实际运行和成果累积验证覆盖数字孪生、虚拟工况，不能将其表述为五项后端计算全链路验收。旧项目级未绑定资料保留兼容读取，不擅自改绑到某个具体试验。
