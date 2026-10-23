# 项目具体试验的成果关联修复（2026-10-23）

用户提供的复现地址：`http://127.0.0.1:5193/sessions/demo-session-1/doe`。

## 原因

`demo-session-1` 指向旧版 `demo-trial-1`，原试验没有独立 `cfgId`。先前 `cfgOperationScope` 仅在 `trial.cfgId === 本次 CFG` 时保留试验来源，导致从旧试验执行的专业操作丢失 trialId。目录随后将这些新成果显示到“未关联试验的历史成果”。此外，项目与会话的共享目录未始终使用具体试验筛选；一个 CFG 被多个试验使用时，不能靠 CFG ID 代替试验身份。

## 修复

```text
项目
----- 具体试验 1
      ----- 共享数据与成果
            ----- 通用
            ----- CFG A
            ----- CFG B
----- 具体试验 2
      ----- 自己的共享数据与成果
```

- 旧试验选中主被试装备相匹配的 CFG 后，保留原 experimentId / trialId / recordId。未匹配的 CFG 明确拒绝，不再静默脱离当前试验。
- 新成果保存试验上下文快照 `trialContext`；通用成果依然归会话，专业成果依然归 CFG，同时可按具体试验查看。
- 旧成果仅在其确切 sourceSessionId 指向稳定的试验会话、装备和构型来源均可验证时，只读恢复试验关联。显式失效 ID、不匹配装备、可能更换试验的任务会话均不猜测归属。
- 项目共享目录按具体试验分面板；具体试验表格展开行内也有该试验自己的目录。试验会话中的共享目录和数据工具同样限制到当前试验。
- 同一 CFG 下的其他试验成果不会混入；源文件按 ID 归组，新增文件不因试验关联重复列出。
- 既有成果不能通过更新转移到另一次试验。新建的 CFG / 通用成果不再被错误标成历史成果。
- 保留物理对象、原始试验与旧成果内容；旧成果恢复使用视图解析，不改写已有结果快照。

## 实际验证

| 检查 | 结果 | 退出码 |
| --- | --- | --- |
| 35 个测试文件逐一 `node --test --test-isolation=none` | 190 个用例通过 | 0 |
| `npm run build` | TypeScript / Vite 通过，既有包体积提示保留 | 0 |
| `npm run lint -- --format json` | 36 错误、4 警告，与本轮前基线逐条一致，无新增 | 1 |
| `git diff --check` | 通过 | 0 |
| `node scripts/verify-project-trial-resources.mjs` | 四组专项场景通过，页面错误和远端写请求均为 0 | 0 |
| `node scripts/verify-session-generic-cfg.mjs` | 六组会话 / CFG / 通用工具回归通过 | 0 |

专项场景在隔离 profile 中执行：

1. 访问用户提供的地址，选择匹配 CFG，实际生成并保存智能推荐方案，断言 sourceScope.trialId 与 trialContext.trialId 均为 `demo-trial-1`。
2. 同一试验执行并保存虚拟工况，断言模型运行快照与成果来源均记录 `demo-trial-1`。
3. 通用工具导入文件，保留会话归属并记录试验上下文；只读恢复一个模拟的丢失关联旧方案；指定试验目录不显示另一试验成果。
4. 两次试验复用同一 CFG，分别查看目录；项目总览按试验分面板；展开具体试验行也可查看该目录。比对原始物理对象和试验数据未被修改。

专项实际成果：

- 推荐方案：`design-49258f2f-50dd-4b8c-9291-69e45b46c6ec`。
- 虚拟工况：`prediction:virtualCondition:preview:virtualCondition:7f2616fa-19fa-4de9-aacf-93df8d45a40b`。
- 通用 CSV：`data-file:raw-96f1cc3c-3e2f-41c2-95d4-ba249a8d4506`。
- 试验：`demo-trial-1`。
- CFG：`cfg-1e0e8020-734c-4bec-8308-d4616e0bf01b`。

[试验专属目录截图](project-trial-resources/trial-specific-resources.png)、[项目按试验分组截图](project-trial-resources/project-trial-panels.png)、[展开试验行中的目录截图](project-trial-resources/trial-row-directory.png)。

[原始浏览器证据](project-trial-resources/acceptance.json)、[专项输出](project-trial-resources/browser.txt)、[单元测试](project-trial-resources/unit-tests.txt)、[构建输出](project-trial-resources/build.txt)、[Lint 比对](project-trial-resources/lint-comparison.json)、[会话回归](project-trial-resources/session-regression.txt)。

浏览器运行参数沿用安装的 Playwright `/tmp/protangram-cfg-browser-V6aviC/package.json`、Chromium headless shell 与该目录的 runtime 动态库；端口 5193。测试夹具使用页面实际模块 URL（包括 Vite HMR 时间戳），避免动态导入旧 URL 时创建另一份 store。
