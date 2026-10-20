# 具体试验驱动工作台实施计划

基线：origin/main 74f874f。用户已授权直接实施，保留未跟踪的 docs/workflows 和已有工作数据。直接在 WSL 仓库的新分支实施，不推送 GitHub。

## 设计与全局约束

以 `/trials` 管理具体试验，以 `/trials/new` 完成选择对象、构型、填写载荷谱及可选任务书。管理员可在同一表单中即时维护对象与构型。保留原有 nested PhysicalObject → PhysicalConfiguration → ExperimentDefinition → ConcreteTrial → TestRecord 的 ID 和迁移逻辑，不复制业务实体。

SQL.js/SQLite 后端保存现有工作台快照与文件；前端持久化适配器等待服务器确认，失败时明确显示未保存，创建动作失败回滚，不宣称浏览器状态已入库。所有写入有版本冲突检查。管理员权限由服务器配置提供，默认普通实验人员；现有项目缺乏用户认证，明确记录这一接入缺口，不把客户端角色或请求头当作可信身份。

五个专业功能共享具体试验上下文；执行记录只决定本次处理的 CSV 来源，切换功能不另建业务数据或成果。复用项目成果及来源引用，保存同名成果须拒绝。任务书只关联 trial ID，并通过原始数据聚合成果。预测页面取消模型选择和演示预测，真实预测接口未接入时明确不可执行，不固化业务字段。

## Task 1：数据库接口

- 文件：backend/src/workspaceApi.js，backend/src/index.js，backend/tests/workspaceApi.test.cjs。
- GET `/api/workspace` → `{success:true,data:{states:{physical,projects,tasks,sessions},revisions:{physical,projects,tasks,sessions},access:{role,identityMode}}}`。state 为 Zustand 现有持久化对象或 null；revision 初始 0。
- PUT `/api/workspace/:kind` body `{value,revision}`，成功 data `{revision}`。409 冲突；400 结构/来源错误；403 非管理员修改类别、对象或构型 metadata。默认 role experimenter，服务器 `PROTANGRAM_WORKSPACE_ROLE=admin` 仅为部署级角色配置。
- POST `/api/workspace/files/:id` multipart `file`, `trialId`, `recordId`，校验记录存在，文件保存 SQLite。GET 同路径读文件，保留文件名和内容。任务书文件通过同端点 `taskId` 保存。
- 数据库文件默认 `data/workspace.sqlite`，环境 `PROTANGRAM_WORKSPACE_DB` 可覆写供隔离测试。事务和文件原子落盘失败不确认成功。
- 直接验证：重启后读回、403 绕过拒绝、409 并发、跨记录来源拒绝、同名成果冲突、CSV/PDF 读回、API 出错不写脏状态。

## Task 2：试验入口与导航

- 文件：新 TrialListPage.tsx、TrialCreatePage.tsx，router/index.tsx、BusinessSidebar.tsx、SessionShell.tsx、PhysicalObjectsPage.tsx、TaskBookWorkspace.tsx，关联 CSS。
- 使用 `useWorkspacePersistence` 的 `{ready,error,role,pending,retry}`；普通人员仅选择，管理员即时新建（调用原 physical store action 后 `await commitWorkspaceChange(fn)`）。失败停留当前表单并保留输入，成功后才更新选项、导航和显示成功。
- `/trials` 可搜索对象/构型/载荷谱/任务书，进入原 physicalSourcePath 对应具体试验。首页直接呈现列表，新建入口统一指向 `/trials/new`，可带 objectId/configurationId/experimentId/taskBookId 预填。
- 保留原对象树浏览维护，旧 `create=trial` 重定向新流程；任务书创建试验直接打开统一表单。任务书关联操作等待数据库确认，不复制成果。
- 五个专业入口必须从具体试验进入；数字孪生和虚拟工况不再从构型直接开启。物理对象和构型编辑按钮仅管理员，所有页面保存消息在 flush 完成后显示。
- 直接验证：无任务书创建、管理员连续新建对象构型、普通人员无新建按钮、失败不导航、任务书预填、单记录多文件、移动视口、失效来源。

## Task 3：前端持久化、上下文和成果整合

- 新 workspacePersistence.ts 提供 `workspaceStorage`（Zustand StateStorage）、`initializeWorkspacePersistence()`、`flushWorkspacePersistence()`、`commitWorkspaceChange(fn)`、`useWorkspacePersistence`。
- 浏览器生产路径不再以 localStorage 保存 physical/projects/tasks/sessions 的业务正文。初始化 GET 后 rehydrate 现有 stores；版本和所有 ID 保留。测试默认旧本地适配以验证既有迁移，启用 backend 模式后只能调用真实 API。
- SessionShell 在 ready 前显示加载或重试；保存条明确 pending/error/已保存数据库。会话状态通过同一适配保存。
- trialDataFiles.ts/taskBookStorage.ts 改为真实文件接口，先确认执行记录/任务书已入库，再上传，失败不得出现成功提示。
- useWorkspaceBusinessSession 的成果保存变 async，检查所有当前 trial 的统一结果名称，调用方 await；专业工作共享 trial scope 的 session，记录可切换但不改写别的记录。保留原迁移数据和兼容入口。
- PredictionWorkspace 根据后台返回字段呈现输入；缺少实际协议时仅保留来源和成果视图，明确未接入，不提供伪预测。
- 直接验证：适配器故障、写入队列、冲突、失败回滚、来源继承、重复名称、跨功能引用一致。

## 验证与交付

- 各任务先编写有意义的失败测试，再实施并执行针对性测试。
- `node --test tests/*.test.mjs`（frontend）、`node --test tests/*.test.cjs`（backend）、`npm run build`（frontend）。
- 使用实际 API 与临时 SQLite 的浏览器端到端验证，不写入用户原数据。确认创建→入库→刷新→打开具体试验→五功能→执行记录及文件→任务书汇总。
- 最后独立代码审查，修复范围内缺陷，更新 README 与实现证据；报告身份与预测后端未接入项。
