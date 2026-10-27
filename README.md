# ProTangram - 工业试验数据数智化分析平台

## 项目概述
一款工业试验数据数智化分析软件，包含试验管理、数据分析、报告生成、系统管理四大模块。

## 当前开发阶段与协作约束

项目现处于**真实工业试验场景驱动开发、准备并逐步接入后端**的阶段。现有浏览器本地存储、演示数据和模拟服务为过渡实现，不能自动作为正式业务身份或后端数据模型的设计依据。

开发、测试与 AI Agent 的统一规则见根目录 **[AGENTS.md](./AGENTS.md)**，包括业务规则与 Demo 实现的优先级、完成状态标记、历史兼容，以及 CFG 的 RBAC/关键变更审批目标。**开发测试环境的开发人员具有最高应用业务权限；协作权限、审批和并发机制仍须由团队通过不同角色场景验证。** 该开发期账号约定不等于正式上线权限策略。

下文部分架构与实现说明记录了早期 Demo/前端阶段的现状；若与已确认的新业务规则冲突，以 `AGENTS.md` 中的阶段约束与最新确认的业务规则为准。

## 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite 7 |
| UI组件库 | Ant Design 6 |
| 样式 | TailwindCSS |
| 状态管理 | Zustand |
| 画布/流程图 | React Flow |
| 图表 | ECharts |
| 后端 | Node.js + Express |
| 数据库 | sql.js (SQLite) |
| CSV解析 | PapaParse |

## 项目结构
```
ProTangramV1/
├── frontend/                # 前端项目
│   └── src/
│       ├── layouts/         # 布局组件
│       ├── pages/           # 页面组件
│       │   ├── experiment/  # 试验管理
│       │   ├── analysis/    # 数据分析
│       │   └── report/      # 报告生成
│       ├── router/          # 路由配置
│       ├── stores/          # Zustand状态管理
│       ├── types/           # TypeScript类型定义
│       └── utils/           # 工具函数
├── backend/                 # 后端服务
│   └── src/
│       └── index.js         # Express服务入口
├── data/                    # 运行时数据存储
├── wordreporttemplate/      # Word报告模板
├── BOM.csv                  # 装备BOM数据
├── test.csv                 # 试验科目数据
├── testmethod.csv           # 试验设计方法数据
└── data-processing.json     # 计算模块配置
```

## 快速启动

### 前端
```bash
cd frontend
npm install
npm run dev
# 访问 http://localhost:5173
```

### 后端
```bash
cd backend
npm install
node src/index.js
# 服务运行在 http://localhost:3001
```

## 功能模块

### 当前试验工作区

- 从工作台、项目或正式任务创建具体试验，在同一流程中选择或新建物理对象和试验构型；从任务书创建时自动关联当前任务书。
- 左侧物理对象树保留对象、构型和参数的浏览维护。已有试验和执行记录可通过“进入试验工作台”继续工作；未绑定具体试验的历史会话仍可查看原有成果。
- 具体试验内提供智能试验设计、数据分析、数字孪生、虚拟工况和报告。最近独立会话与项目内会话按创建来源区分。
- CSV 只在数据分析中导入和移除。一次执行可以包含多个 CSV；五个专业功能都可使用底部工作表查看、选列、编辑和绘图。默认展示全部列、每页 15 行；下拉到底可完全隐藏工作表和标签栏，再从底部把手恢复。
- 编辑另存为同一次执行的工作副本，原始文件不覆盖。共享数据与成果按具体试验、载荷谱、执行记录和 CSV 组织，点击名称预览；保存图表可导出 PNG。移除来源 CSV 后保留历史成果并提示来源失效。

当前上述试验对象、会话及成果沿用浏览器存储，CSV 和工作副本使用 IndexedDB。服务端文件上传、编辑版本、分页、领域换算公式及真实单 CSV 自动诊断尚未接入；界面会标明本机保存和服务缺口。演示结果不能代替当前文件的真实诊断。

前端检查：

```bash
cd frontend
node --test tests/*.test.mjs
npm run build
```

工作区浏览器回归脚本位于 `frontend/scripts/`：`verify-bottom-worksheet.mjs`、`verify-worksheet-close.mjs`、`verify-historical-trial-access.mjs` 和 `verify-worksheet-save-snapshot.mjs`。运行时需准备 Playwright/Chromium，并通过 `PROTANGRAM_TEST_URL` 指定独立测试服务，通过 `PROTANGRAM_PLAYWRIGHT_ROOT` 指向已安装 Playwright 的 `package.json`。脚本使用隔离浏览器上下文与合成数据。

### 1. 试验管理
- **信息管理**: 装备管理(BOM树)、试验科目、试验设计方法、采样要求(占位)
- **试验设计**: 卡片式项目管理、五步大纲设计(方法→参数→因子→响应→方案)

### 2. 数据分析
- **模块管理**: 数据模块(10种)、计算模块(24种算法)、对比分析、绘图模块(10种图表)
- **模板管理**: React Flow拖拽画布构建分析模板
- **数据分析**: 项目执行、画布高亮引导、CSV数据导入与对比

### 3. 报告生成
- **报告模板**: 8种内置Word报告模板
- **报告管理**: 流程顺延/主动新建
- **报告生成**: 标签解析、拖拽绑定、一键生成

### 4. 系统管理
- 当前版本暂未实现，已预留导航入口

## 架构约束
- 计算模块通过WebService接口统一调用，完全解耦
- 大文件支持分块读取(Chunking)，不修改原文件
- 过程数据写入本地JSON存储管理
