# 会话内通用工具、专业功能与 CFG 成果验收（2026-10-23）

本轮按用户后续确认的规则实现，覆盖早先“必须创建具体试验”和“虚拟工况先单独确认 CFG”的交互。

```text
当前会话
----- 专业功能（关联 CFG）
----- 通用工具
----- 共享数据与成果
      ----- 通用
      ----- CFG A
      ----- CFG B
```

## 已实现

- 新建会话可直接使用通用工具，不创建具体试验。通用工具复用既有 CSV 编辑、绘图、保存图表/数据表及工作副本功能，并提供手工建表。
- 专业功能统一要求用户选择 CFG；具体试验为可选上下文。选择不同 CFG 不会继承另一构型的试验/执行记录，也不会创建伪造的试验或历史布置。
- 数字孪生和虚拟工况先浏览通用模型库，再在模型配置表单中选择 CFG。可执行的现有模型保留演示标记；旧模型目录中尚未具备配置的条目显示暂不可用。
- 通用成果归会话，专业成果归 CFG。会话通过构型关联和成果引用展示两类数据；目录直接显示“通用”及构型名称。
- CFG 下可有独立导入的 CSV、图表、数据表与报告，不要求绑定 MODEL。报告可引用当前会话的通用图表和 CFG 图表。
- 另一会话可以引用相同 CFG 数据；通用数据不会因共享项目空间而混入另一个会话。已有资源更新保留原资源位置与 ID，不能通过改选 CFG 覆写归属。
- 原试验、CSV、历史成果和 IndexedDB 数据保留；旧成果通过只读来源解析归组，不批量改写旧数据。

## 验证结果

| 检查 | 实际结果 | 退出码 |
| --- | --- | --- |
| 逐文件 `node --test --test-isolation=none "$trial_test_file"` | 34 文件、184 用例通过 | 0 |
| `npm run build` | TypeScript / Vite 通过；保留既有包体积提示 | 0 |
| `npm run lint -- --format json` | 36 错误、4 警告；与同环境基线逐条一致，新增 0 | 1 |
| `git diff --check` | 通过 | 0 |
| `node scripts/verify-session-generic-cfg.mjs` | 六组隔离浏览器场景通过；页面错误 0、远端写请求 0 | 0 |

Lint 基线在独立临时目录中用 `git archive 858e508 frontend` 还原，使用当前相同依赖执行。此处记录本轮实际环境的统计，不沿用之前环境中的数量。

单元覆盖新增：会话/CFG 归属、共享项目下的通用成果隔离、无 MODEL 的 CFG 图表、无具体试验的模型输入、过期 CFG、旧成果关联、稳定引用、存储失败回滚及重试、禁止修改已有成果归属、会话报告不写入旧后端接口。

浏览器场景：

1. 新建会话 → 导入 CSV → 绘图 → 编辑工作副本 → 手工建表，均无需 CFG / 具体试验。
2. 设计、分析、报告进入时等待 CFG；分析导入数据和保存图表后归 CFG，未生成 MODEL 引用。
3. 专业报告引用通用与构型图表，生成后归同一 CFG，并进入当前会话目录。
4. 虚拟工况先选 MODEL，再在配置内选 CFG；失败保留结果，重试成功返回会话统一目录。
5. 数字孪生保存结果；第二会话使用同一 CFG，查看同一资源 ID，但看不到第一会话的通用曲线；CFG 库可独立打开构型成果。
6. 关闭重开浏览器，资源、引用和原始试验数据不变，原始 CSV 内容可读；模型 CFG 必须重新选择，选择后恢复该 CFG 的运行参数。

## 实际来源与证据

- 会话 A：`session-0d0610bb-5adf-485e-b035-57da7d4b9a82`。
- 会话 B：`session-3dda8190-5b23-4ef6-af48-fc0e1a646326`。
- CFG A：`cfg-84acffdc-a9a8-4a0b-9bce-0496990fe71f`。
- CFG B：`cfg-f2548c71-9933-43b8-8239-f672be799b95`。
- 通用图表：`analysis-284dbb0f-cfe4-487c-b558-8bd6672b2b70`。
- CFG 图表：`analysis-f3ed6a12-c5a0-4872-b999-ed215a3bb76a`。
- 虚拟工况成果：`prediction:virtualCondition:preview:virtualCondition:1d8afd4c-3ad9-46d4-acb5-903ee43b20df`。

[通用工具截图](session-generic-cfg/generic-tools.png)、[通用模型库截图](session-generic-cfg/virtual-model-library.png)、[模型内 CFG 配置截图](session-generic-cfg/model-cfg-configuration.png)、[统一共享目录截图](session-generic-cfg/session-shared-groups.png)。

[浏览器原始记录](session-generic-cfg/acceptance.json)、[浏览器输出](session-generic-cfg/browser.txt)、[单元测试输出](session-generic-cfg/unit-tests.txt)、[构建输出](session-generic-cfg/build.txt)、[Lint 基线对比](session-generic-cfg/lint-comparison.json)。

浏览器实际命令从 `frontend` 执行：

```bash
PROTANGRAM_PLAYWRIGHT_ROOT=/tmp/protangram-cfg-browser-V6aviC/package.json \
PROTANGRAM_CHROMIUM_PATH=/home/jiaxing/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell \
LD_LIBRARY_PATH=/tmp/protangram-cfg-browser-V6aviC/runtime/usr/lib/x86_64-linux-gnu \
node scripts/verify-session-generic-cfg.mjs
```

预览地址：`http://127.0.0.1:5193`。脚本使用独立 profile，并拦截所有远端写请求。

## 当前边界

继续使用现有本地 artifact/localStorage 与 IndexedDB 文件存储。新增的是明确归属和稳定引用，尚未替换生产后端。会话内报告保存使用本地模式，避免向旧的、没有会话/CFG 归属契约的 `/api/reports` 写入。真实模型算法仍未接入；先前浏览器脚本描述的旧版流程保留为历史验收记录，本轮以新增综合脚本验证最新业务契约。
