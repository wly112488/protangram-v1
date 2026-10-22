# ProTangram 后端数据模型与流转契约

## 依据与边界

本设计依据《电涵道风扇试验数据结构.html》中的 VFS 数据表、当前前端业务数据定义及仓库现有后端接口。HTML 的结构表包含 38 个类定义、291 个字段字典项、228 条类字段映射、31 条类组成规则、19 条类关联规则和 18 种关系类型；实例表包含 730 条实例、7,427 条字段值和 916 条实例关联。计数不包含 CSV 表头。

HTML 的模型是“元数据定义 + 实例数据”，不是每个业务类一张表。OBJ 表示有编号的实际实物；技术状态改变时创建新对象并通过“演变自”关联。MODEL 表示通用模型，OM 表示针对对象的模型应用。CFG 是“被试对象 + 供电对象 + 陪试件”组成的试验构型，不等同于前端物理对象下的具体构型。

## 数据模型

\`\`\`mermaid
flowchart TD
  subgraph META[元数据定义]
    C[类与类继承]
    F[字段字典]
    CF[类字段映射]
    CC[类组成规则]
    RT[关系类型]
    CR[类关联规则]
  end
  subgraph INSTANCE[业务实例]
    E[实例 entries]
    FV[实例字段值]
    ER[实例关联]
    REV[实例历史快照]
  end
  subgraph DATA[数据资产与成果]
    A[原始/派生文件 assets]
    AD[资产派生关系]
    AR[图表/分析成果 artifacts]
    ARS[成果来源与依赖]
  end
  subgraph MODEL[模型注册与运行]
    MR[模型版本快照]
    RUN[模型运行记录]
    RS[运行输入来源与版本]
  end
  META --> E
  F --> FV
  C --> CF
  C --> CC
  RT --> CR
  E --> FV
  E --> ER
  E --> REV
  FV --> A
  A --> AD
  E --> AR
  A --> AR
  AR --> ARS
  E --> MR
  MR --> RUN
  E --> RS
  A --> RS
  RUN --> AR
\`\`\`

| 表 / 数据集 | 保存内容 | 约束与用途 |
|---|---|---|
| classes | 类 ID、名称、分组、父类、说明、是否仅用于归类 | 字段继承、实例分类；归类用抽象类不可直接创建实例 |
| field_dictionary、class_fields | 字段含义、类型、单位、别名及字段适用类 | 文本/数值/文件/表格/选项；字段适用范围可沿类继承 |
| class_compositions、relationship_types、class_relation_rules | 允许的组成类型、关系名称、端点类和数量约束 | 创建关联时检查端点类和最大数量；实例激活时检查最小数量 |
| entries | 所有类的业务实例、上级实例、状态和修订号 | 以稳定业务 ID 为主键；parent_entry_id 表示层级归属，不替代显式关系 |
| entry_field_values | 实例字段值、单位、分组、上下限、来源实例、文件引用和说明 | 同一实例可以有多个同名字段值；保留空值与原始文本 |
| entry_relations | 起点、关系类型、终点 | 端点由外键约束；关系合法性按元数据规则校验 |
| entry_revisions | 实例每次修订时的字段和关系快照 | 为模型运行、分析成果和历史审计提供可复查版本 |
| assets、asset_derivations | 文件原始字节、SHA-256、格式引用、派生关系 | 原始文件不被解析流程覆盖；派生文件明确指向来源 |
| artifacts 及来源表 | 图表配置、分析结果、报告等 JSON 载荷及其来源 | 可以同时引用实例、资产和上游成果；编辑成果时保留修订历史 |
| model_revisions | MODEL 实例对应的不可变版本、方法文件、输入输出约束和适用范围 | 版本号唯一；已注册版本不能原地修改 |
| model_runs 及来源表 | OM、模型版本、输入快照、参数快照、输出、状态、源实例修订号和源文件校验值 | 支持复查某次运行当时使用的模型、对象、记录和文件 |

## 业务关系与前端映射

HTML 中的试验层级主要通过实例上级关系表示：TASK → SUBJ → SET → REC。SUBJ 通过“试验对象”关联实物；SET 通过“程序”和“试验构型”关联共享库条目；REC 通过“试验件”“被测部件”“使用设备”关联对象。COND、REQ、PROG、CFG、FMT、DOC 都是可复用的实例类型，不应被硬编码成固定树层级。

当前前端的 PhysicalObject / PhysicalConfiguration / ExperimentDefinition / ConcreteTrial / TestRecord 是另一套 UI 侧数据结构，核心试验数据目前仍由 Zustand 持久化存储维护。它们与 HTML 的类 ID 不能按名称直接一一映射；特别是前端“物理对象下的具体构型”不等于 HTML 的 CFG。前端接入需要单独的映射层，保留原始 ID 和所有权关系，不复制试验记录、文件或图表。

## 文件、数据表与分析成果

1. 文件上传到 assets，保留原始字节、原始文件名、大小、SHA-256 和可选 FMT 引用；可同时将资产 ID 写入实例的“文件”或“表格”字段。
2. FMT 中的文件编码、表头行数用于 CSV 预览。预览按文件独立解析，不会修改原始文件，也不会自动对多个文件进行时间对齐。
3. 经过清洗、换算或其他处理得到的新文件应注册为新资产，并通过 asset_derivations 记录输入资产和转换信息。
4. 图表、数据表、分析结果等配置/结果以 artifacts 保存；通过来源表关联执行记录、原始/派生文件及上游成果。成果载荷变更会创建新的修订快照。
5. 模型运行必须引用已注册的模型版本和 OM；记录运行输入、参数、目标对象、标定记录、输入文件校验值和输出。当前只提供注册与运行留痕，不执行真实训练或求解器。

## 当前后端结构

- src/app.js：应用组合、中间件和路由注册。
- src/server.js：服务启动与优雅关闭；src/index.js 保留兼容入口。
- src/db/migrations/：按版本升级的 SQLite 表结构。
- src/domain/：实例、字段、关系、资产、成果、模型版本和模型运行服务及路由。
- src/routes/：保留旧 API 契约的兼容路由和计算路由。
- src/scripts/import-structure-html.js：从 HTML 的 vfs 导入元数据与实例。
- src/services/csvPreview.js：按 FMT 编码和表头配置流式预览 CSV。

新领域 API 统一挂载在 /api/domain：/schema、/entries、/entries/:id/field-values、/entries/:id/relations、/assets、/artifacts、/models/revisions、/models/runs。

旧 /api/experiments、/api/templates、/api/projects、/api/reports 接口保留原有响应结构，但其 JSON 文件在首次启动时会迁移到同一 SQLite 数据库；源 JSON 文件保留为备份，迁移标记阻止删除记录在重启时被重新导入。计算历史也迁移并写入 SQLite。新的业务实例不再写入第二套 JSON 文件。

## 导入与验证

将 HTML 结构文件放在可访问路径后，首次导入使用：

    cd backend
    npm run import:structure -- --input "/path/to/电涵道风扇试验数据结构.html"

导入器仅在领域元数据和实例库为空时执行，重复导入同一文件会跳过；不会覆盖已有业务数据。它导入结构定义、实例、字段值和显式关系，并保留来源文件路径。HTML 中嵌入的 Excel 内容是工作簿预览结构，不是原始 XLSX 字节，因此不会伪装成原始文件导入；实际原始文件应通过资产上传接口另行导入。

导入器会统计不在当前类字段清单中的来源字段，并以 schema_override 保留；此类数据不被静默删除，但新增扩展字段必须显式确认。关系端点及字段来源仍由外键校验。

## 尚未完成

- 前端核心 Zustand / IndexedDB 数据向领域 API 的适配和迁移。
- 真实 XLSX 解析、完整 CSV 数据集生成、分析算法结果自动登记为成果。
- 生产级用户认证、授权和多租户隔离。
- 具体类与关系规则的业务发布流程，以及对全部导入实例执行的完整一致性报告。

这些事项不影响先独立开发和验证后端元数据、实例、资产、成果与模型注册基础，但在前端切换到后端前必须单独完成相应验收。
