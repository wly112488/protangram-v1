# 自动化测试核查（2026-10-19）

核查基线：main `74f874f4de5cdc9352053f7dae4d3d295c2a19d5`，2026-10-16 15:37:05 +08:00，`feat: unify professional workflows and shared analysis results`。本次仅调整测试入口、开发依赖、浏览器启动环境和 CI，不修改业务实现或现有断言。

## 实测结果

环境：Linux、Node 24.19.0、npm 11.9.0。

- `npm ci --no-audit --no-fund`：成功。
- `npm run test:professional`：80/80 通过，无跳过。
- `npm test`：发现 17 个测试文件，141 项测试，125 通过，16 失败，无跳过。新增入口会正常返回非零状态，不能将当前全量回归称为通过。
- `npm run build`：通过，Vite 提示单个 JS 包较大，未阻断构建。
- `npm run test:browser:install`：失败。当前环境下载的 Chromium 压缩包无效（`End of central directory record signature not found`），本机也没有可用系统 Chromium。因此本次未执行浏览器场景，不能把提交说明中的历史验证结果计为本次通过。

## 运行命令

建议 Node 24 LTS；最低 Node 22.18（TypeScript 测试使用 Node 类型剥离）。从仓库根目录执行：

```sh
cd frontend
npm ci
npm test
npm run test:professional
npm run test:sessions
npm run build
```

`npm test` 递归发现 `tests/` 和 `src/` 内的 `.test.mjs`、`.test.ts`，覆盖现有模型、存储、源码断言和同目录报告测试。使用 Node 子进程和文件列表，不依赖 shell 通配符；任一测试失败则返回非零状态。`test:professional` 是聚焦的 80 项核心回归，不能代替全量测试。原 `test:sessions` 保留原义和兼容性。

浏览器测试另开一个终端启动 Vite：

```sh
cd frontend
npm ci
npm run test:browser:install
# Linux 缺系统库时改用：npx playwright install --with-deps chromium
npm run dev -- --host 127.0.0.1
```

在第二个终端执行：

```sh
cd frontend
npm run test:browser
```

需要开发服务器，因为测试在浏览器中动态导入 `/src/...ts`；不能直接改成对静态 dist 运行。默认地址 `http://127.0.0.1:5173`，可通过 `PROTANGRAM_TEST_URL` 指定。Playwright 固定为 1.61.1，由锁文件安装；默认使用该版本下载的 Chromium。自备浏览器可设置 `PROTANGRAM_CHROMIUM_PATH`，需自行确认兼容性。`PLAYWRIGHT_BROWSERS_PATH` 可按 Playwright 约定指定缓存路径。两个接入脚本不再读取 `PROTANGRAM_PLAYWRIGHT_ROOT`，也不再覆盖 `LD_LIBRARY_PATH` 或硬编码 `/tmp`。其他历史 `verify-*.mjs` 未迁移，仍可能依赖旧环境，未接入此入口或 CI。

`test:browser` 顺序运行成果与预测两个脚本（各 6 组，共 12 组）；第一个失败会停止后续脚本。脚本拦截 API，主要验证本地演示与存储行为，不验证真实后端计算。截图、结果和失败详情输出至 `node_modules/.tmp/analysis-results`、`node_modules/.tmp/professional-interactions`。

## 覆盖清单

| 测试文件 | 项数 | 覆盖重点 | 本次结果 |
|---|---:|---|---|
| analysisResults.test.mjs | 8 | 成果引用、来源隔离、上下文继承、删除会话与刷新后保留、重复保存、旧成果兼容、演示来源标记 | 全通过 |
| crossFunctionSharing.test.mjs | 11 | 跨专业共享、记录精确匹配、历史成果来源、跨来源交接隔离、构型迁移 | 全通过 |
| prediction.test.mjs | 7 | 两类演示计算、参数及范围校验、取消、后端请求契约、错误响应、过期或错来源保存拒绝 | 全通过 |
| physicalObjects.test.mjs | 15 | 独立记录、精确写入、CSV、构型参数、v0/v2/v3/v4及混合历史迁移 | 全通过 |
| trialCharts.test.mjs | 7 | 共享图表、重名校验、编辑隔离、v5迁移、刷新及报告引用 | 全通过 |
| sessionWorkbench.test.mjs | 27 | 会话与草稿隔离、模板兼容、任务归属、保存失败、删除保护及成果保留 | 全通过 |
| taskTrialIntegration.test.mjs | 5 | 任务试验上下文、跨项目成果、报告图表引用、任务转移及只读汇总 | 全通过 |
| physicalNavigation.test.mjs | 5 | 稳定ID路径、失效来源及历史导航解析 | 全通过 |
| autoExecutionLifecycle.test.mjs | 2 | StrictMode计时器重启源码保护 | 全通过 |
| taskBookPreview.test.mjs | 3 | 任务书预览与编辑 | 全通过 |
| taskReportAi.test.mjs | 2 | AI任务报告构建 | 全通过 |
| taskReportEvidence.test.mjs | 6 | 满足项证据、报告来源、草稿及任务完成状态 | 全通过 |
| src/pages/report/reportModel.test.mjs | 6 | 报告成果筛选、引用、空数据与失效绑定 | 全通过 |
| projectCreationEntry.test.mjs | 1 | 旧任务中心新建/导入入口源码断言 | 1失败 |
| projectWorkspaceModel.test.ts | 16 | 项目迁移、统计、工厂及旧页面导航断言 | 12通过、4失败 |
| taskPlanEditing.test.mjs | 6 | 任务编辑、导航及任务项目概览源码断言 | 4通过、2失败 |
| workspaceRegression.test.ts | 14 | 旧页面工作流与文案源码断言 | 5通过、9失败 |

前七个文件构成 `test:professional` 的 80 项测试。文件中的源码正则断言不能等同于浏览器交互覆盖。

## 全量测试遗留失败

以下 16 项在原始 main 上以显式文件列表运行时已经失败，本次新入口重现相同失败，未修改、删除或跳过它们。检查显示其预期仍包含旧导航、旧准备面板、旧文案或旧回调结构；需按当前产品约定逐项判断是测试过期还是功能缺失，不能只换正则让 CI 变绿。

1. `independent project creation lives in Task Center, not the project-data sidebar`
2. `header active key follows the current business route`
3. `primary navigation exposes direct business pages and hides legacy experiment and analysis entries`
4. `core business page transitions keep their route-state handoffs`
5. `the root workspace is the only homepage route and visible management/report groups have routes`
6. `top-level module navigation keeps the task but does not inherit a focused task item`
7. `task-linked project overview identifies project analysis as separate from task-item execution`
8. `virtual-condition page keeps its persistence callback stable to avoid assistant update loops`
9. `core business pages require explicit user confirmation before enabling the primary action`
10. `reset is visually subordinate to preparation and primary actions`
11. `preparation cards own workflow actions instead of duplicating configuration controls below`
12. `joining analysis and virtual results to a report persists Project artifacts and carries their ids`
13. `cross-page workflows explain which task data model or validation context was carried forward`
14. `project artifact content keeps raw payload in a collapsed debug section and offers a continue action`
15. `project overview recommends deterministic next actions from saved artifacts and virtual risk`
16. `project sidebar names the project contents and saved outcomes instead of suggesting feature navigation`

## 持续集成

将 `.github/workflows/de.yml` 的 Hello World 示例替换为 main push、面向 main 的 PR 和手动触发流程，统一使用 Node 24 和 `npm ci`：

- `regression`：执行完整 `npm test`，通过后构建。现有 16 项失败会让该 job 为红，构建步骤不会执行；本次本地单独验证过构建。
- `browser-results`：独立执行，安装 Chromium 及 Linux 系统库，启动 Vite、等待 HTTP 可访问，再运行 12 组场景。无论成功失败均尝试上传截图、结果及服务器日志；不会因为回归 job 失败而跳过。
- 旧重构分支的验证流程及 Pages 发布流程保持不变。新增 CI 不会自动阻断现有 Pages 发布，main 当前也未启用分支保护。待清理遗留断言并获得真实 CI 通过记录后，建议将两个 job 设置为合并必需检查，并让 Pages 构建依赖回归结果。本次不变更仓库治理或部署行为。
- 本文记录的是本地实测；CI 配置完成不代表 GitHub Actions 已通过，浏览器可迁移性仍需在标准 runner 上实际验证。

## 尚未覆盖或证据不足的关键场景

1. 真实后端模型准备、鉴权、任务排队/轮询、取消、超时重试及服务端计算准确性；目前预测 API 主要通过 mock 契约和本地演示验证。
2. 跨标签页同时保存、同一成果并发更新、浏览器意外退出时多存储写入的一致性。
3. 真实大 CSV、编码/异常列、超限容量、IndexedDB 文件损坏及文件缺失恢复的完整交互流程。
4. 多版本真实历史数据快照的端到端升级、回滚及重复迁移；现有迁移测试以构造数据为主。
5. 删除原始记录或构型后，报告及专业成果悬空引用的完整用户处理流程。
6. 报告模板实际渲染、Word/PDF 导出、图表图片与跨页版式正确性。
7. Firefox/WebKit、键盘可访问性、多分辨率完整工作流；现有浏览器脚本只使用 Chromium，包含少量窄屏检查。
8. 从正式任务入口到专业工作区、保存成果、报告引用的完整用户链路；目前主要由分散模型测试与部分 UI 场景支持。
