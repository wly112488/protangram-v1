# 功能内显式选择 CFG 与成果回流验收（2026-10-23）

已完成当前前端范围。基础计划 `2026-10-23-trial-cfg-model-frontend-flow.md` 原已实现；本轮按后续计划覆盖每次显式确认、共享成果回流与独立分类导航。实施与提交按整体变更合并完成，未声称逐条执行原计划中的每一次 RED 录制或逐 Task 提交。

## 行为与边界

- 进入数字孪生/虚拟工况时，旧 `trial.cfgId` 和上次使用的 CFG 只作提示，初始无选择且确认按钮禁用。取消不执行模型，新建 CFG 保存后仍需确认。
- 更换选择时保留原模型表单；取消更换保持本次手动输入。每个功能、每个 CFG 独立保存草稿；旧版草稿仍可恢复。退出、切换功能或重开浏览器都要求重新确认。
- SET 通过试验工作台头部“试验设置”按钮打开；CSV 分析不要求 CFG 确认，也不要求 SET。
- 保存失败时保留结果并停留原页；重试成功后返回同一 session 的试验工作台。共享目录内实测打开了已保存的 5400 rpm 结果。
- A/B 两次结果的 `modelPlan.cfgId`、`sourceScope.cfgId`、`sourceContext.scope.cfgId` 均对应本次选择。换 CFG 不改变旧结果与试验原始 CFG。
- CFG 删除后阻止规划/运行。演示标记、旧数据与真实计算边界继续保留；跨 CFG 模型等价性判定按计划留待后续契约明确。

## 本次验收身份

| 来源 | 实际 ID |
| --- | --- |
| Session | `session-07efcdda-3aef-4e12-bbbc-52de49ef9f5f` |
| Trial | `trial-32581fa8-0182-4622-810f-e19ca86378f0` |
| 首次 CFG A | `cfg-44cf73fa-337f-4e19-8f6d-7541db421603` |
| 再次 CFG B | `cfg-849716ee-51db-472c-8b60-147974b7b2ea` |
| A 成果 | `prediction:digitalTwin:preview:digitalTwin:2deb3a59-a4a9-4f7e-a031-84930fcee615` |
| B 成果 | `prediction:digitalTwin:preview:digitalTwin:e09c58ac-f4f2-4ddf-aa94-404e5cc14bcd` |

修改前隔离浏览器记录：`picker=0, run=1`，即旧行为自动打开模型表单；修改后综合脚本断言未确认无执行按钮。保存失败通过临时令归档函数返回 null 注入，随后恢复原函数并重试；并非生产后端故障模拟。

[重开后等待确认截图](explicit-cfg-and-categories/reopened-requires-confirmation.png)、[CFG B 成果截图](explicit-cfg-and-categories/selected-cfg-b-result.png)、[确认后恢复输入截图](explicit-cfg-and-categories/restored-model-inputs.png)。

## 实际执行环境与结果

基线提交：`aaf71f2`。实现只使用既有前端存储、演示计算和共享成果链路。

| 命令/检查 | 实际结果 | 退出码 |
| --- | --- | --- |
| `cd frontend && node --test tests/*.test.mjs` | 30 个测试文件通过 | 0 |
| 对每个测试文件执行 `node --test --test-isolation=none "$trial_test_file"` | 173 个测试用例通过，详见 [原始输出](explicit-cfg-and-categories/unit-tests.txt) | 0 |
| `cd frontend && npm run build` | TypeScript 与 Vite 构建通过；仍有包体积提示 | 0 |
| `cd frontend && npm run lint -- --format json` | 原有 13 errors / 2 warnings；新增 0，详见 [基线差异](2026-10-23-explicit-cfg-lint.json) | 1 |
| `git diff --check` | 通过 | 0 |
| `node scripts/verify-explicit-cfg-and-categories.mjs` | 4 组业务验收通过，page errors=0，远端写请求=0 | 0 |
| `node scripts/verify-cfg-model-flow.mjs` | 既有 CFG / SET / MODEL / TASK / 项目 / CSV 全流程通过 | 0 |
| `node scripts/verify-object-categories.mjs` | 3 组分类与旧链接回归通过 | 0 |

浏览器脚本均使用独立 profile，不访问用户日常浏览器资料。实际环境变量：

```bash
PROTANGRAM_TEST_URL=http://127.0.0.1:5193
PROTANGRAM_PLAYWRIGHT_ROOT=/tmp/protangram-cfg-browser-V6aviC/package.json
PROTANGRAM_CHROMIUM_PATH=/home/jiaxing/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell
LD_LIBRARY_PATH=/tmp/protangram-cfg-browser-V6aviC/runtime/usr/lib/x86_64-linux-gnu
```

每条 `node scripts/...` 命令均从 `frontend` 执行，并传入上述环境变量。Vite 由 `npm run dev -- --host 127.0.0.1 --port 5193 --strictPort` 启动。依赖目录链接到工作区外，构建缓存与 Chromium 进程需要环境授权；已取得授权后执行。历史 `verify-physical-navigation.mjs`、`verify-session-workflows.mjs` 仍描述前轮已替换的界面，本轮相关业务验收由新增综合脚本和适配后的 CFG / 对象分类脚本承担，不将旧脚本列为通过。

[综合浏览器原始证据](explicit-cfg-and-categories/acceptance.json)、[CFG 全流程原始证据](explicit-cfg-and-categories/cfg-model-regression.json)、[对象分类原始证据](explicit-cfg-and-categories/object-category-regression.json)。
