# 物理对象树与 CFG 分类浏览验收（2026-10-23）

已完成本轮展示与分类管理。物理对象原始存储未迁移；演示风扇按精确 demo ID 合并到官方类别的只读视图。实施与最终验收合并执行，原计划保留为设计依据。

## 已核对行为

- 左树“涵道风扇”同时显示用户风扇、demo A/B；转子与三级叶片仍按组成关系嵌套。用户自建同名演示类别不会被合并，演示不存在或类别顺序改变均通过纯逻辑测试。
- demo A/B 点击后仍分别使用 `objectId=demo-category-fan` 与 `configurationId=demo-fan-A/B`，面包屑显示统一类别名。
- 物理对象树只含 category/object 节点。历史“静推力构型 A”等布置从对象详情访问，旧试验/记录链接及 IndexedDB CSV 可读。
- 已修复历史记录页面再次点击已选物理对象不能返回详情的问题；分类/对象复用旧 ID 时，树 key 与来源身份仍正确。
- 左侧“试验构型”仅列人工分类及“未分类”；中央完成类别创建、重命名、筛选和归属调整。失效查询提供恢复入口。
- 新建 CFG 复用同一编辑器，支持三级叶片与一级试验台组合、无陪试件；同名转子按显示的对象 ID 单独选择。取消不增加 CFG，分类调整不复制 CFG、不改变成员。
- 浏览器重开前后比对：原类别元数据、所有原始装备与旧试验数据、CSV 内容均相同；新建的分类与 CFG 保留。

## 实际身份

| 来源 | 实际 ID |
| --- | --- |
| 用户风扇 | `config-b186e617-c752-42c3-880d-6d16159b591d` |
| 三级叶片 | `object-bf2357b2-154e-4821-9c23-91c29a3ef0e4` |
| 第二个同名转子 | `object-3df73fda-401a-4298-ad2c-2b6886ec99bb` |
| 一级试验台 | `config-41ac629f-fb44-4105-8d40-47d92c7a26a4` |
| 分类“气动验证” | `cfg-category-cce85e3e-2461-477e-8e11-22205063c112` |
| 跨层级 CFG | `cfg-4963ffe5-f784-4b26-a33c-70713e795910` |

跨层级 CFG 初始保存到上述类别，之后在 UI 清除类别归属并确认它进入“未分类”，成员 ID 不变。

旧链接实测：`/physical-objects?objectId=demo-category-fan&configurationId=demo-fan-A&experimentId=demo-configuration-0&trialId=demo-trial-0&recordId=demo-record-0-0`。

[物理对象树截图](explicit-cfg-and-categories/equipment-tree.png)、[旧记录来源截图](explicit-cfg-and-categories/equipment-tree-legacy.png)、[CFG 分类库截图](explicit-cfg-and-categories/cfg-categories.png)。

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
