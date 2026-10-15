# 试验构型与预测流程增量重构

## 当前后端能力核对

检查了 `backend/src/index.js` 全部路由及 `frontend/src/services/api.ts`：

- 已有试验设计、分析模板、分析项目、报告的 JSON 文件读写，以及 `/api/compute/:moduleId/:algId` 通用数据处理。
- 通用计算接口没有模型标识、来源构型、目标构型、适用性或预测任务语义，不能直接当作模型预测接口。
- 尚无跨构型适用模型查询、模型训练/校准回流、预测计算任务或预测任务持久化接口。
- 物理对象和试验构型仍由现有本机 store 管理；项目无可执行的管理员鉴权体系。本次只把试验类型放在构型创建/编辑界面，不新增角色系统或类型管理模块。正式管理员权限必须由后端鉴权实现。

## 已完成

- `ExperimentDefinition.testType` 是独立于名称、说明和旧 `category` 的结构化代码，创建/编辑时选择；旧构型不推断类型，编辑时补充。参数已有执行记录的锁定规则不变。
- 试验构型页面直接打开数字孪生或虚拟工况扩展，专业会话只使用目标物理对象和试验构型 ID。即使从某次真实执行进入，也不把预测归属绑定到该执行。
- 两页使用一个 `PredictionWorkspace`。移除旧定时器、固定公式、硬编码可信度/风险/实测覆盖、虚假文件名和演示校准自动回写。
- 继承物理对象参数与试验构型参数快照。模型输入由服务的输入字段定义驱动，独立保存在专业草稿里，不覆盖原构型参数。
- 适用模型只读取预测服务响应，不合并全局演示模型、旧物理对象级模型定义，也不按试验类型、参数或 CSV 在前端筛选。
- 来源构型与版本始终可见；单个可用模型直接选中，多个模型可选择；推荐由服务提供。未就绪模型附原因且不可选择。
- 无真实试验、执行记录或 CSV 的目标构型可以预测；是否需要更多条件由服务返回。
- 结果保留目标、参数快照、所用模型及来源构型、版本、目标状态输入、服务类型、请求和任务 ID、完成时间、结果。仅接受后端明确完成且为 `computed` 的结果；响应归属/输入不匹配则拒绝展示为成功成果。
- 保存只调用任务保存接口，并检查保存确认；不写真实试验、执行记录、CSV、模型副本或项目演示成果。失败保留结果供重试，修改模型/输入后清除当前旧结果。切换页面或继承参数变化时取消过期请求。
- 已保存任务按目标构型和专业服务查询，页面刷新后可查看结果和来源。未接入服务时不声称已计算或已保存。
- 原有具体试验共享图表集合、跨执行记录重名检查、原始 CSV、任务书和报告引用规则未修改。

## 待接入接口契约（提议，后端尚未实现）

前端适配层：`frontend/src/services/predictionApi.ts`；类型与响应校验：`frontend/src/workspace/predictionContract.ts`。
全部响应采用现有 `{ success: true, data: ... }` / `{ success: false, error: "..." }` 包装。HTTP 404/405/501 表示尚未接入；其他 HTTP 错误、网络错误、不完整响应显示失败。

1. `GET /api/prediction/models?service=virtualCondition|digitalTwin&physicalObjectId=...&experimentId=...`
   返回 `PredictionCatalog`：`serviceReady`、`persistenceReady`、可选 `message`、`models`。
   每个模型必须有 `modelId`、`modelName`、`version`、`sourceConfiguration`、后端确定的 `availability`（`available|not_ready|unavailable`）、`inputFields`，可选 `recommended`、`applicability`、`message`。
   `sourceConfiguration` 包含 `physicalObjectId`、`physicalObjectName`、`experimentId`、`experimentName`。
   `inputFields` 每项含 `key`、`label`、`type`（`number|text`），可选单位、必填、数值上下限、默认值。范围扩展可通过服务定义的范围、数量等字段表达；前端不自行生成预测输出。字段只表达用户需要输入的目标状态，已有构型参数由目标快照继承。
   后端需要可定位相同 ID 的构型及其试验类型。当前构型仅在本机，因此真实接入还需要确认构型同步/注册方案，不能假设后端已拥有这些 ID。
2. `POST /api/prediction/tasks`
   请求为 `PredictionRequest`：`requestId`、`service`、`targetConfiguration`（上述引用及 `testType`、`objectParameters`、`configurationParameters` 快照）、选定 `model` 快照、`inputs`。
   后端必须按模型 ID/版本重新获取权威模型、核验来源和目标适用性，不能信任前端传来的适用声明。
   当前前端支持同步完成响应 `PredictionTask`：原请求追溯字段加 `taskId`、`status: completed`、`resultMode: computed`、`saved`、ISO `completedAt`、`result: { summary, columns: [{ key, label, unit? }], rows: [...] }`。
   请求响应的目标参数、模型来源/版本、输入和请求 ID必须一致。异步排队/训练轮询尚未接入，不能把 `running` 或 `pending` 显示为完成。
3. `POST /api/prediction/tasks/:taskId/save`，请求 `{ requestId }`。
   返回相同任务的完整 `PredictionTask`，必须 `saved: true`。服务端应以任务 ID 幂等保存到目标构型，禁止接受客户端重传的计算输出作为真实结果。
4. `GET /api/prediction/tasks?service=...&physicalObjectId=...&experimentId=...`
   返回属于目标构型的已保存 `PredictionTask[]`；前端复核目标归属。不把任务挂到模型来源构型或真实执行记录。

模型生成/校准和回流仍待后端提供独立契约；此次没有伪造模型回流接口、复制现有模型、编造适用性算法或创建真实执行记录。历史演示成果保留原标识和原存储，不提升为真实预测成果。

## 验证

浏览器脚本 `frontend/scripts/verify-prediction.mjs` 默认访问 `http://localhost:5190`，使用独立浏览器上下文，拦截写入，所有数据均在测试上下文中。服务缺失场景访问实际后端（当前代理因后端未启动返回 HTTP 500）；其他模型和计算场景使用明确的接口夹具验证前端行为，不代表后端已实现或实际模型准确性已验证。

自动验证范围：构型类型维护、直接入口、单模型、多来源模型、无 CSV 跨构型预测、模型未就绪/无适用模型/服务不可用、计算失败、拒绝演示/错误归属响应、保存与失败重试、刷新查看任务、修改输入失效旧结果、切换页面取消旧请求、两个功能复用，以及真实数据和构型参数不被改写。

验证结果：

- `npm run build`：通过（保留项目原有的构建包体积提示）。
- 新增文件及两个专业页面的 ESLint：通过。
- `node --test tests/*.test.mjs`：95 项，92 通过，3 项现有断言失败，见下。
- `node scripts/verify-prediction.mjs`：10 组浏览器场景通过；无页面异常、无真实业务写入。成功计算/保存场景仅为接口夹具。
- `PROTANGRAM_TEST_URL=http://localhost:5190 node scripts/verify-shared-trial-charts.mjs`：7 组通过，含真实 PNG 导出、跨记录重名检查、任务书/报告原引用、历史 v5 迁移。
- `PROTANGRAM_TEST_URL=http://localhost:5190 node scripts/verify-physical-navigation.mjs`：10 组通过，含试验类型创建选择、原物理对象/试验/记录/数据入口、大列表查询分页、失效引用和窄屏导航。

全量测试中的 3 项失败涉及本次未修改的既有实现：2 项旧界面文案断言不一致，1 项对象字段形式不一致，未为迁就断言改动既有业务：

- `projectCreationEntry.test.mjs:14`：断言 `TaskCenter` 源码含“新建独立项目”（随后还要求“导入旧版试验项目”），当前界面已使用“新建任务书”。
- `taskPlanEditing.test.mjs:72`：顶层导航实际返回对象含 `taskItemId: undefined`，预期对象完全省略该字段。`deepStrictEqual` 将两者判为不同；两者读取 `taskItemId` 都是 `undefined`，该测试未显示仍携带旧事项 ID。
- `taskPlanEditing.test.mjs`：项目概览旧文案“独立于任务事项”的断言。

删除了已经失效的模拟校准定时器测试；预测页的模拟模型选择源码断言改为仅覆盖仍使用该实现的 DOE 页面。预测行为由新增契约测试与浏览器测试验证。

浏览器报告与截图位于 `frontend/node_modules/.tmp/prediction/`；共享图表报告位于 `frontend/node_modules/.tmp/shared-trial-charts/`。这些是本机验证产物，不是业务成果，不进入真实预测数据。
