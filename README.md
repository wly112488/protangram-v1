# ProTangram - 工业试验数据数智化分析平台

## 项目概述
一款工业试验数据数智化分析软件，包含试验管理、数据分析、报告生成、系统管理四大模块。

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
