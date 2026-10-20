# ProTangram - 工业试验数据数智化分析平台

## 项目概述
一款工业试验数据数智化分析软件，包含试验管理、数据分析、报告生成、系统管理四大模块。

## 具体试验工作台（2026-10-19）

首页 `/trials` 列出具体试验，`/trials/new` 是统一创建入口。选择物理对象与试验构型，填写名称和载荷谱；任务书可选。所有实验人员都能在当前表单即时新建类别、对象和构型。左侧保留可搜索的对象、构型、具体试验树。五项专业功能共享当前试验与执行记录来源，任务书通过关联关系汇总原数据和成果。

业务数据通过 `/api/workspace` 保存到 SQL.js/SQLite 数据库 `data/workspace.sqlite`，CSV 和任务书 PDF 也保存到数据库。服务器确认写入后才显示已保存，版本冲突要求重新加载。业务正文不再依赖浏览器 localStorage 配额。原 JSON 目录作为历史资料保留。

```bash
# 终端 1，WSL 后端
cd backend
PORT=3001 npm start

# 终端 2，前端（选择未被 Windows 占用的端口）
cd frontend
npm run dev -- --host 0.0.0.0 --port 5175 --strictPort
```

`PROTANGRAM_WORKSPACE_DB` 可指定后端数据库文件，`PROTANGRAM_API_URL` 可指定前端开发代理的后端地址。默认数据库与锁文件已忽略，不进入 Git。

**权限接入边界：** 当前项目没有登录和身份接口。所有实验人员都可以通过对象树入口或创建试验流程新增类别、物理对象和试验构型；后端拒绝普通角色改写或删除已有定义。管理员仍可编辑已有对象和维护专业参数。`PROTANGRAM_WORKSPACE_ROLE=admin` 是部署级维护角色，不是用户账号；企业身份认证和同一部署的多用户角色仍需接入。

**计算接入边界：** 数字孪生和虚拟工况缺少真实后台模型匹配、输入协议和计算接口。页面保留来源与共享成果，明确不生成预测结果，不展示模型选择、服务状态或预先固化的专业输入。现有智能设计/数据分析的演示算法保留并标明性质，实际计算仍需接入。报告配置、引用和正文可持久化，外部 Word/PDF 渲染沿用原接入边界。

旧浏览器数据可由管理员在数据库为空时显式导入，保留 ID 和成果引用，历史重名提示用户处理。原 IndexedDB 中的 CSV/PDF 附件需在对应执行记录或任务书重新上传，原浏览器数据不会自动清空。

```bash
cd backend
node --test tests/*.test.cjs
cd ../frontend
node --test tests/*.test.mjs
npm run build
```

端到端脚本 `frontend/scripts/verify-trial-first.mjs` 使用已安装的 Puppeteer 与浏览器，需设置 `PROTANGRAM_PUPPETEER_MODULE`、`PROTANGRAM_BROWSER_PATH`、`PROTANGRAM_TEST_URL`，可用 `PROTANGRAM_EXPERIMENTER_URL` 验证普通角色。请对临时数据库执行，脚本会创建真实测试数据。复用已有 sql.js、multer，未增加生产依赖。

## 技术栈
| 层级 | 技术 |
|------|------|
| 前端框架 | React 19 + TypeScript + Vite 7 |
| UI组件库 | Ant Design 5 |
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
