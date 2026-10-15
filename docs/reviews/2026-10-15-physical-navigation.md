# 物理对象导航与试验工作区整改

业务层级沿用当前源码：对象类别 → 具体物理对象 → 试验构型 → 具体试验 → 第 N 次试验记录 → CSV 与成果。本轮没有改动 Store 的业务结构、持久化版本、业务 ID、文件存储或成果引用，也没有增加后端和专业算法。

## 界面与操作

- 左侧树只展示类别、物理对象、试验构型。类别点击只展开收起，类别旁的加号负责创建物理对象；不再打开重复的类别对象列表。
- 物理对象详情保留技术参数新增与编辑、通用要求、新建试验构型，删除右侧重复的试验构型定位列表。已有构型从左侧直接定位。
- 试验构型详情保留参数与编辑操作，具体试验改为表格。支持按名称、载荷谱、任务书名称或 ID 搜索，以及任务书／自主试验筛选；默认每页 10 项，可选择 20、50、100 项。
- 列表搜索、筛选、页码和每页数量写入 URL。打开具体试验后返回原构型可恢复原列表位置，刷新保留设置；切换到其他构型不携带上一构型的筛选。
- 具体试验详情管理载荷谱、可选任务书及执行记录。执行记录使用分页表格；显式打开某次记录后管理其 CSV、独立图表、数据表及专业成果，返回按钮回到所属具体试验。不再隐式代选第一份记录。
- 各详情页使用同一业务路径面包屑，保留上一级返回。进入试验、执行记录或专业功能时，树选中对应试验构型，并展开所属类别与对象。展开状态保存在当前浏览器会话，导航或刷新会恢复当前来源的祖先节点。
- 树和右侧通过同一个解析函数匹配 URL 中的父子 ID。失效或冲突 ID 显示错误并停止展示可编辑业务内容，不会按名称或其他 ID 改选无关数据。保留旧类别别名、旧物理对象链接和缺少试验 ID 的明确记录链接。
- 树的内部 key 包含层级和所属路径，兼容历史类别与设备复用 ID 的情况；业务 ID 保持不变。
- 修复连续清空搜索后立即切换筛选时可能沿用旧查询的问题。

## 主要源码

- `frontend/src/workspace/BusinessSidebar.tsx`：树、创建入口、定位和展开恢复。
- `frontend/src/workspace/PhysicalObjectsPage.tsx`：各层详情、面包屑、记录列表、返回与异常来源处理。
- `frontend/src/workspace/physicalNavigation.ts`：共用的严格父子来源解析。
- `frontend/src/workspace/PhysicalTrialsTable.tsx`：具体试验搜索、筛选、分页表格。
- `frontend/src/workspace/physicalObjects.css`：沿用现有风格的布局和窄屏适配。

既有类别、试验流程及任务书浏览器脚本只适配变更后的入口和记录列表；保留原数据归属、迁移、CSV、图表及专业成果断言。新增 `verify-physical-navigation.mjs` 和 `physicalNavigation.test.mjs`。

## 验证结果

构建及上述 4 个 TypeScript 文件的 ESLint 通过。构建仍有项目既有的大 bundle 提示。

直接运行 Node 测试文件：

| 测试 | 通过项 |
| --- | ---: |
| physicalNavigation | 5 |
| physicalObjects | 15 |
| crossFunctionSharing | 11 |
| taskTrialIntegration | 5 |

真实 Chromium 使用独立的 `http://127.0.0.1:5175` 测试服务和隔离浏览器上下文，不使用用户现有浏览器数据：

| 浏览器脚本 | 通过场景 |
| --- | ---: |
| verify-physical-navigation | 10 |
| verify-object-categories | 3 |
| verify-physical-source-interactions | 13 |
| verify-task-trial-integration | 7 |

包含：手工创建对象／构型／试验、技术参数编辑、多 CSV、同记录两张图表及独立配置、数据表、两次执行隔离、专业来源继承和返回、任务书关联与调整、旧数据迁移、冲突 ID、旧链接、1001 项具体试验查找与真实分页操作、返回和刷新恢复、390px 窄屏导航与表格。页面运行时错误均为 0。服务端写请求被测试拦截；未修改服务端业务数据。

可复核结果位于 `frontend/node_modules/.tmp/{physical-navigation,object-categories,physical-source-interactions,task-trial-integration}/results.json`，导航与表格截图在 `physical-navigation` 目录。另补查了移动导航动画结束后的完整展开截图。

本轮界面整改无未解决项。浏览器验收使用 Chromium 和前端本地持久化；后端未启动，既有接口读取使用前端本地回退，未做后端联调。专业算法和其他浏览器兼容性未在本轮验证。
