# ProTangram 试验构型与模型分析前端流程 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不调整后端和既有持久化机制的前提下，把 ProTangram 前端组织成可供用户验证的“试验任务 → 具体试验 → 选择/就地新建 CFG → 实测或分析/预测 → 成果”连续流程，减少重复选择，保持 XMind 中的业务对象归属。

**Architecture:** 明确将独立的试验构型 CFG 与现有源码中挂在物理对象下的 `ExperimentDefinition` 区分。首先通过统一的 CFG 表单及兼容适配层改造试验创建，再保持试验和功能会话的稳定来源 ID，最后在分析/预测入口同时呈现通用模型与本次人工填写的计算输入，由系统复用或规划特定模型方案。现有 localStorage、IndexedDB、项目/会话/记录/成果机制暂时保留；模型计算仍属于后端函数职责，前端阶段只做明确标识的演示与交互验证。

**Tech Stack:** React 19、TypeScript 5.9、Ant Design 6、React Router 7、Zustand 5、Vite 7、Node.js `node:test`、esbuild；已有前端浏览器验证脚本。

**Spec:** 无单独 Spec 文件；本文件“已确定的业务规则”即当前实现依据，来源为 2026-10-23 本轮对话及用户提供的《电涵道风扇业务关系树_通用模型增加仿真对象.xmind》和《电涵道风扇试验数据结构(1)(1).html》。遇到同名概念冲突，以用户较新的明确纠正为准；此计划不要求创建 `docs/superpowers/specs/` 文件。

## Global Constraints

- 本次仅规划、实施和验证前端操作流程；不改变后端 API、数据库、服务器文件存储或现有浏览器持久化策略，不执行数据删除/迁移。
- XMind 负责业务层级与数据归属；HTML 解释 MODEL、OM、CFG、SET、OBJ 等类及字段；不得把 HTML 的示例 CFG-01～07 当成封闭枚举。
- 试验创建时**选择 CFG**，不是先选择单台风扇再把它当 CFG。CFG 是跨装备组合，成员具有“被试装备/供电装备/试验台/测量设备/陪试件/其他”等角色，角色按需，陪试件非必填。
- 没有合适的 CFG 时，在试验创建界面打开与 CFG 管理页面**同一组件、同一校验和保存动作**的弹窗，成功后返回并自动选中；取消不应创建 CFG 或具体试验。
- 物理对象可在风扇下创建转子/静子/机匣并按结构显示；每一成员保留独立稳定 ID、参数和可跨层级引用能力。展示父子位置不限制其被其他 CFG 使用。
- TASK 是试验管理的主要入口；SUBJ、具体试验、SET 是任务/试验内部的数据结构，不分别增加左侧一级菜单。工作台/最近会话是继续工作的入口，项目用于组织和筛选而非必需前置条件。
- 一项具体试验可以包含多个由用户手动填写的 SET，例如 0D、0.25D、0.5D、0.75D。CFG 与 SET 是独立概念；**模型运行不要求先创建 SET**。
- 在预测/虚拟工况中，用户提供所需通用模型 MODEL 与本次分析参数；系统依据当前试验 CFG、仿真对象 OBJ、MODEL 与配置参数复用已有方案或自动规划新方案。用户不被迫手动“挑选方案1 OM”，也不重复选择已继承的 CFG。
- OM（对象模型）是 MODEL 作用于具体仿真对象形成的模型方案。CFG 是试验装备组合及角色；模型是否需要试验台/供电设备参数由其输入定义决定，不能仅由 CFG 或 OM 名称推断。
- 前端可分别组织“模型配置所需输入”和“本次运行参数”，但在同一次操作中完成填写/确认；不能把每次转速变化当成新建 OM。模型的后端执行算法与拆分方式不由本计划决定。
- 工作台顶部只显示 CFG 名称/编号等摘要，不展开叶尖直径、轮毂直径、叶片数等 CFG 内部参数清单；专业功能需要人工输入的字段仍须可见。
- 试验记录、CSV、图表、成果继续归属原具体试验/执行记录；项目/任务书和会话通过来源引用，绝不靠名称相同猜测归属或复制历史记录。
- 现有本地数据必须保留，旧地址与旧试验能继续查看；计算演示不能被标成真实后端结果。
- 每个任务采用测试先行，完成后运行相关现有测试；每个任务通过覆盖检查后再提交。界面验收在隔离浏览器用户数据环境进行。

---

## Scope Check / Plan Decomposition

| 计划单元 | 独立可交付结果 | 覆盖范围 | 前置条件 |
| --- | --- | --- | --- |
| **本计划：前端流程验证** | 从试验创建直接复用/新建 CFG；具体试验可有多组 SET；分析入口继承 CFG，并根据 MODEL+OBJ+配置规划/复用模型方案，参数由用户手填；原有 CSV/结果链接继续可用 | 当前对话全部“先看前端流程”需求 | 当前前端源码和浏览器本地存储机制，已满足 |
| 后续：前后端统一数据源 | 后端以稳定 ID 保存 OBJ/CFG/试验/SET/OM/记录；前端不再把 localStorage 作为权威业务存储 | 数据库、文件存储、API、旧数据迁移 | 前端流程验收完成，实际后端实体/API 定义明确 |
| 后续：专业模型计算 | 对应 MODEL/OM、计算函数、输入映射、真实执行及预测记录 | 计算服务及模型版本、结果追溯 | 模型函数契约及后端数据接口可用 |

后两项仅列路线图，不在这次实施中预先设计或调用不存在的生产 API，也不新建独立 Spec。

## Current Source Findings（实施前必须复核）

| 现有文件 | 实际含义与冲突 |
| --- | --- |
| `frontend/src/workspace/physicalObjectStore.ts` | `PhysicalObject.configurations` 实际存具体物理对象；每个 `PhysicalConfiguration.experiments` 存 `ExperimentDefinition`，而 `ConcreteTrial` 又嵌在此数组下。当前界面称 `ExperimentDefinition` 为“试验构型”，但它只能挂在一个对象下面，不能表示独立多装备 CFG。`ConcreteTrial` 目前强制 `loadSpectrum`，与 XMind 中“无载荷谱也可有记录”不一致。 |
| `frontend/src/workspace/physicalNavigation.ts`、`BusinessSidebar.tsx` | 左侧对象树固定“类别 → 具体对象 → ExperimentDefinition”，没有适合对象下机匣/转子等组成对象的独立浏览层，也没有 TASK 内部的具体试验/SET 层。 |
| `frontend/src/workspace/TrialCreatePage.tsx`、`taskTrialWorkflow.ts` | 创建流程强制“类别 → 具体对象 → ExperimentDefinition”，且每次填写载荷谱；“新建试验构型”当前调用 `addExperiment`，不是跨装备 CFG 编辑。 |
| `frontend/src/workspace/PhysicalObjectsPage.tsx` | CFG/试验编辑与执行记录、图表访问混用一组对话框。改造时保留已有旧试验和来源页，避免失效。 |
| `frontend/src/workspace/SessionWorkbench.tsx`、`sessionModel.ts`、`professionalContext.ts` | 功能工作台沿用 `PhysicalBusinessScope` 中的 `physicalObjectId / experimentId / trialId / testRecordId`；模型方案匹配时需要在保持现有字段语义的同时附加独立 `cfgId`，不能拿 `experimentId` 冒充 CFG ID。 |
| `frontend/src/workspace/PredictionWorkspace.tsx`、`predictionParameters.ts`、`predictionContract.ts`、`services/predictionPreview.ts` | 现有预测界面是目标条件输入及明确标记的演示结果。当前 `globalModelStore.ts` 保存的是旧版示例模型，不是 HTML 的 MODEL/OM 正式目录；演示入口不可冒充真实模型计算结果。 |
| `frontend/src/workspace/taskTrialModel.ts`、`projectTrialModel.ts`、`TrialWorksheetProvider.tsx` | 任务、项目、底部工作表从已有来源 ID 查找试验/记录/CSV/成果；迁移界面不可打断这些查找，也不能靠同名替换失效来源。 |
| `frontend/tests/physicalObjects.test.mjs`、`physicalNavigation.test.mjs`、`trialCreationModel.test.mjs`、`prediction.test.mjs`、`taskTrialIntegration.test.mjs` | 已采用 `node:test` + esbuild 加载 TypeScript 的习惯；计划中的模型测试应沿用该模式。 |
| `frontend/package.json` | `npm run build` = `tsc -b && vite build`；`npm run lint` = `eslint .`；可通过 `node --test tests/*.test.mjs` 运行 Node 测试。 |

## Authoritative Business Rules（Plan 内置需求依据）

1. **物理对象 OBJ：** 涵道风扇方案1及其转子、机匣、静子等是不同的、可独立维护参数的对象。用户按组成层级浏览；对象可以被其它 CFG 跨层引用。“装备”与“陪试件”是可选的浏览/用途分类，不是每项试验的必需两栏。
2. **试验构型 CFG：** 独立实体，按角色关联多个 OBJ。例如现有 CFG-07 为“涵道风扇 + 气动试验台”；CFG-05/06 在动力组合中增加陪试翼段。CFG 保存成员身份、角色和构型定义，允许多次试验复用。
3. **试验管理：** 左侧“试验”以 TASK 为主，TASK 内组织 SUBJ 与具体试验，具体试验内维护手工输入的多个 SET；不能把 SUBJ/SET 设计成和 TASK 平级的独立主入口。任务书关联不改变数据归属；自主试验可独立存在。
4. **设置 SET：** 一次具体试验可包含 0D/0.25D/0.5D/0.75D 等多个 SET；这些是人工填写的试验变量/程序信息，不等于 CFG，也不是计算模型的自动输入表单。
5. **模型 MODEL / OM：** MODEL 定义通用算法所需字段和函数；OM 是关联 OBJ 的特定方案。XMind 另明确“MODEL + CFG → 可复用的特定构型模型配置”。用户最新版要求：预测入口继承试验 CFG，系统优先匹配可复用模型方案，若无匹配，则基于用户同时提供的 MODEL 和模型/运行参数自动规划“方案1 气动模型”这类方案；用户不先手选已有 OM，也不重复填写 CFG。
6. **预测依赖：** 不能假设气动模型已经包含整个试验台，亦不能强制每个 MODEL 读取 CFG 全部成员。模型输入声明决定选哪些 OBJ、工况、边界条件；允许用户补充运行参数，**不要求先保存 SET**。预测记录需要可回溯到具体试验、CFG、模型和当次输入。
7. **实测与成果：** 多次执行记录、多个 CSV、图表和数据表继续使用已有功能及稳定来源 ID。程序/载荷谱可选；没有载荷谱时，记录直接在具体试验下查看。保留演示与真实结果的区分。
8. **当前里程碑：** 只验证前端用户使用流程及状态流转；本地持久化保留，待交互验收后才规划替换后端的权威数据管理。

## Implementation Roadmap

- **本计划：** 先让 CFG 跨装备定义、单一编辑器、试验创建、任务内 SET、模型自动匹配及用户输入形成可演示、可测试的前端闭环。允许将新业务概念放在清晰的临时前端适配层，但不能覆写/删除旧持久化数据或把演示当正式计算。
- **后续 Plan：后端业务数据统一与迁移。** 在本计划验收后重新读取代码与已确定的实体/来源 ID，再规划数据库、文件存储、迁移、幂等、事务及接口。禁止提前清空 localStorage/IndexedDB。
- **后续 Plan：正式模型执行。** 在函数输入/输出协议明确后重新规划 MODEL/OM 与 CFG 输入映射、函数调用、输入快照及预测记录；不以当前演示公式替代正式计算。

## File Structure（本计划）

| 职责 | 路径与操作 |
| --- | --- |
| 组成装备检索、可复用身份 | Create: `frontend/src/workspace/equipmentCompositionModel.ts`；Modify: `physicalObjectStore.ts` 与 `PhysicalObjectsPage.tsx`；Test: `frontend/tests/equipmentComposition.test.mjs` |
| 独立 CFG 及验证 | Create: `frontend/src/workspace/trialConfigurationModel.ts`、`trialConfigurationStore.ts`；Test: `frontend/tests/trialConfiguration.test.mjs` |
| 一套 CFG 编辑器、两处入口 | Create: `frontend/src/workspace/TrialConfigurationEditor.tsx`、`TrialConfigurationLibrary.tsx`；Modify: `TrialCreatePage.tsx`、`router/index.tsx`；Test: `frontend/tests/trialConfiguration.test.mjs` 及浏览器验收 |
| 旧试验数据兼容/CFG 来源连接 | Create: `frontend/src/workspace/cfgTrialBridge.ts`；Modify: `physicalObjectStore.ts`、`sessionModel.ts`、`TrialCreatePage.tsx`、`taskTrialWorkflow.ts`；Test: `frontend/tests/cfgTrialBridge.test.mjs`、既有 `physicalObjects.test.mjs`、`taskTrialIntegration.test.mjs` |
| 试验任务导航和多组 SET | Create: `frontend/src/workspace/trialSettingsModel.ts`、`TrialSettingsPanel.tsx`；Modify: `BusinessSidebar.tsx`、`PhysicalObjectsPage.tsx`、`physicalObjectStore.ts`；Test: `frontend/tests/trialSettings.test.mjs`、`physicalNavigation.test.mjs` |
| MODEL/OM 匹配与模型输入 | Create: `frontend/src/workspace/modelPlanModel.ts`、`modelSchemeStore.ts`、`modelFlowFixtures.ts`；Modify: `PredictionWorkspace.tsx`、`predictionContract.ts`、`predictionParameters.ts`；Test: `frontend/tests/modelPlanModel.test.mjs`、`prediction.test.mjs` |
| 验收 | Existing: `frontend/scripts/verify-session-workflows.mjs`、`verify-physical-source-interactions.mjs`、`verify-prediction.mjs`；按需增加不覆盖用户数据的 `frontend/scripts/verify-cfg-model-flow.mjs` |

所有新建模型文件采用可替换的数据访问边界；不要再以 `ExperimentDefinition` 命名为 CFG，也不要更改已有 `experimentId` 的实际含义。

---

### Task 1: Independent Equipment Identity and CFG Validation

**Files:**
- Create: `frontend/src/workspace/equipmentCompositionModel.ts`
- Create: `frontend/src/workspace/trialConfigurationModel.ts`
- Create: `frontend/src/workspace/trialConfigurationStore.ts`
- Modify: `frontend/src/workspace/physicalObjectStore.ts`
- Test: `frontend/tests/equipmentComposition.test.mjs`
- Test: `frontend/tests/trialConfiguration.test.mjs`

**Interfaces:**
- Produces: `EquipmentRef = { id: string; name: string }`；`CfgMember = { objectId: string; role: CfgRole }`；`TrialConfiguration = { id: string; name: string; members: CfgMember[] }`。
- Produces: `flattenEquipment(objects: PhysicalObject[]): EquipmentRef[]`；`validateTrialConfiguration(input, availableIds): string[]`；`useTrialConfigurationStore`，提供 `createConfiguration` 和 `getConfiguration`。
- Consumes: `PhysicalObject`、`PhysicalConfiguration` 及现有本机持久化机制。

**Acceptance:**
- 风扇下的转子、机匣、静子在装备选择器中保持唯一对象 ID，跨树层级可被 CFG 按 ID 选中；展示父子关系不限制角色。
- CFG 独立于任一具体物理对象，可关联至少一项被试装备及任意数量的其他角色；陪试件可为空；缺失的成员 ID 必须明确报错，不能按名称自动补齐。
- 新增 CFG 不写进旧 `PhysicalConfiguration.experiments`，旧试验不被删除或迁移。

- [ ] **Step 1: Write the failing model tests.**

在 `frontend/tests/trialConfiguration.test.mjs` 中写入以下测试，并复用 `physicalObjects.test.mjs` 的 esbuild 动态加载模式：

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({
  stdin: { contents: "export * from './src/workspace/trialConfigurationModel';" , resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent'
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('CFG accepts cross-equipment members and optional supporting roles', () => {
  const input = { id:'cfg-1', name:'气动试验构型', members:[
    { objectId:'fan-1', role:'tested' }, { objectId:'rig-1', role:'rig' }
  ] };
  assert.deepEqual(api.validateTrialConfiguration(input, new Set(['fan-1','rig-1','rotor-1'])), []);
  assert.deepEqual(api.validateTrialConfiguration(
    { ...input, members:[{ objectId:'missing', role:'tested' }] }, new Set(['fan-1'])
  ), ['装备引用已失效：missing']);
  assert.equal(api.validateTrialConfiguration(
    { ...input, members:[{ objectId:'fan-1', role:'power' }] }, new Set(['fan-1'])
  ).includes('至少选择一项被试装备'), true);
});
~~~

- [ ] **Step 2: Verify the test fails.**

Run: `cd frontend && node --test tests/trialConfiguration.test.mjs`。Expected: FAIL，因为 `trialConfigurationModel.ts` 尚不存在。

- [ ] **Step 3: Implement pure CFG model and nested-equipment lookup.**

在 `trialConfigurationModel.ts` 中建立完整类型与验证函数：

~~~ts
export type CfgRole = 'tested' | 'power' | 'support' | 'rig' | 'measurement' | 'other';
export interface CfgMember { objectId: string; role: CfgRole; }
export interface TrialConfiguration { id: string; name: string; members: CfgMember[]; description?: string; }
export function validateTrialConfiguration(input: TrialConfiguration, availableIds: Set<string>): string[] {
  const errors: string[] = [];
  if (!input.name.trim()) errors.push('填写试验构型名称');
  for (const member of input.members) {
    if (!availableIds.has(member.objectId)) errors.push('装备引用已失效：' + member.objectId);
  }
  if (!input.members.some(member => member.role === 'tested')) errors.push('至少选择一项被试装备');
  if (new Set(input.members.map(member => member.objectId + ':' + member.role)).size !== input.members.length)
    errors.push('同一装备不可重复添加相同角色');
  return errors;
}
~~~

在 `equipmentCompositionModel.ts` 中实现 `flattenEquipment`，遍历 `PhysicalObject.configurations` 与每个对象的 `children`；按 ID 去重，区分实际组成对象与名称相同的其它对象。为它写测试：风扇-转子-叶片三级都能选中；两个同名转子仍是两个 ID；空数组安全。只读取现有树，不创建并行的“全局转子副本”。

- [ ] **Step 4: Add one CFG catalog store and preserve existing physical data.**

`trialConfigurationStore.ts` 使用现有 Zustand + persist，单独保存新的 CFG 实体，不重写已有 `protangram-physical-objects-v1`；导出以下接口（实现时和测试一致）：

~~~ts
interface TrialConfigurationState {
  configurations: TrialConfiguration[];
  createConfiguration(input: Omit<TrialConfiguration,'id'>): string;
  getConfiguration(id: string): TrialConfiguration | undefined;
}
~~~

`createConfiguration` 必须先使用 `flattenEquipment` 的 ID 集执行 `validateTrialConfiguration`，校验失败不写入；成功生成唯一 `cfg-*` ID。新增本地键使用 `protangram-trial-configurations-v1`，这是**仅用于前端原型的独立 CFG 状态**，不与 `ExperimentDefinition` 双写，也不清理旧数据。为它补充新建、复用、来源失效及 reload 测试。

- [ ] **Step 5: Verify and commit.**

Run: `cd frontend && node --test tests/equipmentComposition.test.mjs tests/trialConfiguration.test.mjs tests/physicalObjects.test.mjs && npm run build`。Expected: all tests PASS，TypeScript build PASS；既有存储快照和历史试验不变。Commit: `git add frontend/src/workspace/equipmentCompositionModel.ts frontend/src/workspace/trialConfigurationModel.ts frontend/src/workspace/trialConfigurationStore.ts frontend/src/workspace/physicalObjectStore.ts frontend/tests/equipmentComposition.test.mjs frontend/tests/trialConfiguration.test.mjs && git commit -m "feat: model reusable cross-equipment trial configurations"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，对应跨层级身份测试、CFG 正反例及旧存储快照测试；实现前必须补齐此任务声明的三级对象/重复名称/重载测试。

### Task 2: One CFG Editor, Two UI Containers

**Files:**
- Create: `frontend/src/workspace/TrialConfigurationEditor.tsx`
- Create: `frontend/src/workspace/TrialConfigurationLibrary.tsx`
- Modify: `frontend/src/workspace/TrialCreatePage.tsx`
- Modify: `frontend/src/router/index.tsx`
- Test: `frontend/tests/trialConfiguration.test.mjs`（扩展表单校验逻辑的纯函数测试）

**Interfaces:**
- Consumes: `useTrialConfigurationStore`、`flattenEquipment`、`TrialConfiguration`。
- Produces: `TrialConfigurationEditor` with props `{ initial?: TrialConfiguration; onSaved(id: string): void; onCancel(): void }`。
- Produces: `TrialConfigurationLibrary`，独立管理路由展示同一个编辑器；`TrialCreatePage` 使用相同编辑器的弹窗版本。

**Acceptance:**
- 创建具体试验主表单只有一个“试验构型 CFG”选择字段，可先选已有，也可就地创建；用户不必须先选择“类别 → 风扇 → 旧 ExperimentDefinition”。
- CFG 管理页与试验创建弹窗的字段/角色选择/校验/保存逻辑一致；成功返回当前表单并自动选中；取消无写入且已填试验草稿仍保留。
- 试验构型可组合多个角色；没有陪试件时允许完成。对象来源失效时不能静默替换。

- [ ] **Step 1: Add failing selector/validation tests.**

在 `trialConfiguration.test.mjs` 中添加对 `validateTrialConfiguration` 的无陪试件、同一对象两种不同角色、重复同角色、无被试装备、来源失效五组断言。Run: `cd frontend && node --test tests/trialConfiguration.test.mjs`；Expected: 旧界面尚不能满足业务验收（保留手动验收作为 UI 红灯）。

- [ ] **Step 2: Create one reusable editor.**

在 `TrialConfigurationEditor.tsx` 中使用 Ant Design `Form`、`Form.List`、`Select`、`Button`：字段为“名称、说明、装备成员列表（对象、角色）”；成员选择来自 `flattenEquipment`，对象按组成路径显示但保存稳定 ID。点击保存时调用同一个 `createConfiguration` 并把新 ID 交给 `onSaved`；错误保留表单，不清空。组件不自行创建 Modal 或 Page。

示例完整提交回调：

~~~tsx
const submit = (value: { name: string; description?: string; members: CfgMember[] }) => {
  try {
    const id = useTrialConfigurationStore.getState().createConfiguration({
      name: value.name, description: value.description, members: value.members
    });
    onSaved(id);
  } catch (error) {
    message.error(error instanceof Error ? error.message : '构型保存失败');
  }
};
~~~

- [ ] **Step 3: Mount the same editor in both places.**

`TrialConfigurationLibrary.tsx` 包裹编辑器作为独立 CFG 管理页面；`TrialCreatePage.tsx` 则用同一编辑器作为 `Modal` 的内容，`onSaved` 关闭弹窗并更新 `selectedCfgId`，`onCancel` 仅关闭弹窗。将管理页加到 `router/index.tsx`，例如 `/trial-configurations`；入口应出现在试验业务范围内，不单独再创建第二份表单。

- [ ] **Step 4: Manual interaction gate and commit.**

在隔离浏览器中执行：从已有 CFG 直接新建试验；从试验创建弹窗新建“风扇+台架”并自动带回；从管理页创建相同内容（字段一致）；取消后重新打开确认试验草稿仍在；缺失对象和无被试装备被阻断。Run: `cd frontend && node --test tests/trialConfiguration.test.mjs && npm run build && npm run lint`。Expected: PASS。Commit: `git add frontend/src/workspace/TrialConfigurationEditor.tsx frontend/src/workspace/TrialConfigurationLibrary.tsx frontend/src/workspace/TrialCreatePage.tsx frontend/src/router/index.tsx frontend/tests/trialConfiguration.test.mjs && git commit -m "feat: reuse CFG editor for management and trial creation"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，纯函数覆盖有效/无效角色与引用，浏览器同时覆盖两个入口、取消、自动带回与保持草稿。

### Task 3: Connect CFG to Concrete Trial Without Reinterpreting Legacy experimentId

**Files:**
- Create: `frontend/src/workspace/cfgTrialBridge.ts`
- Modify: `frontend/src/workspace/physicalObjectStore.ts`
- Modify: `frontend/src/workspace/TrialCreatePage.tsx`
- Modify: `frontend/src/workspace/taskTrialWorkflow.ts`
- Modify: `frontend/src/workspace/sessionModel.ts`
- Test: `frontend/tests/cfgTrialBridge.test.mjs`
- Test: `frontend/tests/physicalObjects.test.mjs`、`taskTrialIntegration.test.mjs`

**Interfaces:**
- Consumes: `TrialConfiguration`、`PhysicalObjectState.addExperiment`、`addConcreteTrial`、已有 `PhysicalBusinessScope`。
- Produces: `createTrialFromCfg(cfgId: string, input: { name: string; description?: string; taskBookId?: string; loadSpectrum?: string }): { trialId: string; physicalObjectId: string; experimentId: string; cfgId: string }`。
- Adds optional `cfgId?: string` to `ConcreteTrial` and `PhysicalBusinessScope`; existing `experimentId` remains existing `ExperimentDefinition.id`，不得改用 CFG ID。

**Acceptance:**
- 单一 CFG 可创建多项具体试验，具体试验保存 `cfgId`；CFG 不因创建试验而复制，也不把成员参数整体拷贝到试验。
- 兼容旧试验嵌套容器以及已有项目/任务/会话/CSV 查找；旧 `experimentId` 链路继续有效，界面不要求用户再选择这个兼容容器。
- 没有载荷谱也可创建具体试验及执行记录（XMind 明确支持）。已有试验如果有载荷谱，现有程序/记录仍可使用。
- 无法从 CFG 唯一确定被试主对象时明确阻断并要求在 CFG 编辑中标明主被试对象；不得猜测选取第一个数组成员。

- [ ] **Step 1: Write failing bridge tests.**

`frontend/tests/cfgTrialBridge.test.mjs` 模仿 `physicalObjects.test.mjs` 的 esbuild/内存 localStorage 测试方式，至少覆盖：重复创建试验指向同一 cfgId；不同试验有各自 trialId；遗留 trial 不新增虚假的 cfgId；CFG 被删除/对象缺失不会静默回退；无载荷谱仍可创建记录；原有 `experimentId` 仍能找到对应试验。

- [ ] **Step 2: Add compatible identity fields, keeping old source resolvers.**

`ConcreteTrial` 仅增加可选 `cfgId?: string`；`PhysicalBusinessScope` 仅增加可选 `cfgId?: string`，不变更其已有字段的解释。`createTrialFromCfg` 必须先验证 CFG 和主被试对象存在，再以该对象为锚点复用/建立仅用于兼容旧数据结构的内部 `ExperimentDefinition` 容器，调用现有 `addConcreteTrial` 创建真实试验，并记录 CFG ID。内部容器不作为 CFG 展示，也不能成为用户要手动填写的另一层设置。对其应使用有明确命名空间的标记（如 `internal:cfg-trials`），避免碰撞用户已有名字；重复创建时复用该内部容器，不反复创建。

在模型中定义来源结果：

~~~ts
export interface CfgTrialSource {
  trialId: string;
  physicalObjectId: string; // 选定主被试对象，兼容现有查找
  experimentId: string;     // 现有内部/遗留试验容器 ID，绝非 cfgId
  cfgId: string;            // 独立的试验构型 ID
}
~~~

这是一层**仅为本轮前端流程服务的兼容桥**，不是推荐的最终后端数据模型。旧容器对新试验不显示“试验构型”的业务标题，禁止双向同步出第二份 CFG。

- [ ] **Step 3: Remove unintended load-spectrum hard gate and integrate entry points.**

更新 `physicalObjectStore.ts` 的 `addConcreteTrial`、`addTrialRecord`、`updateConcreteTrial` 对载荷谱的强制校验，以及 `TrialCreatePage.tsx` 中载荷谱的必填规则；无谱时 `loadSpectrum` 按空字符串兼容旧类型即可。更新 `taskTrialWorkflow.ts`：任务试验复核依然要求试验名称和合法的 CFG 关联，但不将载荷谱作为必填。新增结果将 `cfgId` 传播到会话 `businessScope`；旧数据没有该字段仍须可浏览。

- [ ] **Step 4: Verify and commit.**

Run: `cd frontend && node --test tests/cfgTrialBridge.test.mjs tests/physicalObjects.test.mjs tests/taskTrialIntegration.test.mjs tests/trialCreationModel.test.mjs && npm run build`。Expected: PASS；旧试验、历史记录及来源导航稳定；手动检查新建试验只显示 CFG 一次选择。Commit: `git add frontend/src/workspace/cfgTrialBridge.ts frontend/src/workspace/physicalObjectStore.ts frontend/src/workspace/TrialCreatePage.tsx frontend/src/workspace/taskTrialWorkflow.ts frontend/src/workspace/sessionModel.ts frontend/tests/cfgTrialBridge.test.mjs frontend/tests/physicalObjects.test.mjs frontend/tests/taskTrialIntegration.test.mjs && git commit -m "feat: link concrete trials to independent CFG"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，包括旧数据不误迁移、无谱操作、CFG 来源失效和新/旧来源 ID 的正反向验证。

### Task 4: Task-First Navigation and Manual Multiple SETs

**Files:**
- Create: `frontend/src/workspace/trialSettingsModel.ts`
- Create: `frontend/src/workspace/TrialSettingsPanel.tsx`
- Modify: `frontend/src/workspace/physicalObjectStore.ts`
- Modify: `frontend/src/workspace/BusinessSidebar.tsx`
- Modify: `frontend/src/workspace/PhysicalObjectsPage.tsx`
- Test: `frontend/tests/trialSettings.test.mjs`
- Test: `frontend/tests/physicalNavigation.test.mjs`

**Interfaces:**
- Consumes: `ConcreteTrial` 和其 `cfgId`，`taskBookId`，`TEST_TYPES` / 现有试验科目数据。
- Produces: `TrialSetting = { id: string; name: string; fields: ValueField[]; programId?: string }`；
  `addTrialSetting(trialId: string, input: Omit<TrialSetting,'id'>): string`；
  `updateTrialSetting(trialId: string, settingId: string, patch: Partial<Omit<TrialSetting,'id'>>): void`。
- `ConcreteTrial.settings?: TrialSetting[]`，数组缺省作为空数组读取，以兼容旧数据。

**Acceptance:**
- 试验侧栏以 TASK 为主要业务管理入口；SUBJ/SET 在选中任务或试验内部展示。保持工作台、最近会话、项目入口的已有恢复能力，不把它们改造成试验数据的父节点。
- 一项具体试验可人工添加四组 0D/0.25D/0.5D/0.75D SET，也可暂时一组都没有；各 SET 字段互相独立，不复制 CFG 内全部装备参数。
- 设置在具体试验内展示和编辑；只显示所关联 CFG 的名称/编号摘要，详细参数点击进入；没有 SET 也可以进入预测。
- 既有 CSV/图表/执行记录归属不受影响。若未来记录按 SET 查看，本次只新增可选设置引用，不擅自搬运历史记录。

- [ ] **Step 1: Write failing SET isolation tests.**

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({
  stdin: { contents: "export * from './src/workspace/trialSettingsModel';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent'
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('SET definitions are independent manual inputs', () => {
  const a = api.createTrialSetting('s-1', '0D', []);
  const b = api.createTrialSetting('s-2', '0.25D', []);
  const changed = api.replaceTrialSetting([a,b], 's-1', { name:'0D 修改' });
  assert.equal(changed[0].name, '0D 修改');
  assert.equal(changed[1].name, '0.25D');
  assert.equal(changed.length, 2);
});
~~~

测试已沿用仓库现有 esbuild 动态打包方式。Run: `cd frontend && node --test tests/trialSettings.test.mjs`，Expected: FAIL。

- [ ] **Step 2: Implement the small pure SET operations.**

~~~ts
import type { ValueField } from './physicalObjectStore';
export interface TrialSetting { id: string; name: string; fields: ValueField[]; programId?: string }
export const createTrialSetting = (id: string, name: string, fields: ValueField[]): TrialSetting =>
  ({ id, name: name.trim(), fields: structuredClone(fields) });
export const replaceTrialSetting = (items: TrialSetting[], id: string,
  patch: Partial<Omit<TrialSetting,'id'>>): TrialSetting[] =>
  items.map(item => item.id === id ? { ...item, ...patch } : item);
~~~

将 `settings?: TrialSetting[]` 与新增/编辑方法接入 `physicalObjectStore.ts`；按 trialId 定位并单独修改，缺失 settingId 时明确失败，不影响其它试验。

- [ ] **Step 3: Add the SET panel inside a trial, not a new sidebar root.**

`TrialSettingsPanel.tsx` 仅在具体试验页显示“试验设置 / 新增设置 / 编辑设置”，一个设置的表单允许多行名称、内容、单位、说明；初始为空，不预造四组或复制 CFG 字段。`BusinessSidebar.tsx` 将“试验”作为任务视图的入口和列表，物理对象保留独立部分，科目/SET 不放一级菜单。`PhysicalObjectsPage.tsx` 原有试验明细仍可访问，但新 CFG 必须以摘要方式展示。

- [ ] **Step 4: Verify and commit.**

Run: `cd frontend && node --test tests/trialSettings.test.mjs tests/physicalNavigation.test.mjs tests/physicalObjects.test.mjs tests/sessionWorkbench.test.mjs && npm run build && npm run lint`。Expected: PASS。手动操作从 TASK 打开具体试验，在内部新增四组 SET，编辑一组不影响其它三组；创建零组 SET 仍可进入预测。Commit: `git add frontend/src/workspace/trialSettingsModel.ts frontend/src/workspace/TrialSettingsPanel.tsx frontend/src/workspace/physicalObjectStore.ts frontend/src/workspace/BusinessSidebar.tsx frontend/src/workspace/PhysicalObjectsPage.tsx frontend/tests/trialSettings.test.mjs frontend/tests/physicalNavigation.test.mjs && git commit -m "feat: organize manual trial settings under task workflows"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，纯模型保证数据独立和失效处理，浏览器确认 TASK/SET 层级与无 SET 的功能入口。

### Task 5: Automatically Reuse/Plan OM from CFG Context; User Supplies Run Inputs

**Files:**
- Create: `frontend/src/workspace/modelPlanModel.ts`
- Create: `frontend/src/workspace/modelFlowFixtures.ts`
- Create: `frontend/src/workspace/modelSchemeStore.ts`
- Modify: `frontend/src/workspace/PredictionWorkspace.tsx`
- Modify: `frontend/src/workspace/predictionContract.ts`
- Modify: `frontend/src/workspace/predictionParameters.ts`
- Test: `frontend/tests/modelPlanModel.test.mjs`
- Test: `frontend/tests/prediction.test.mjs`

**Interfaces:**
- Consumes: 当前试验 `cfgId`、CFG 的 OBJ 成员、用户所用通用 `modelId`、输入字段定义及本次用户输入。
- Produces: `ModelPlan = { modelId: string; cfgId: string; objectIds: string[]; schemeId?: string; action: 'reuse'|'plan'|'ambiguous' }`；
  `resolveModelPlan(request: { modelId: string; cfgId: string; objectIds: string[] }, catalog: ModelScheme[]): ModelPlan`。
- Produces: 单次分析请求的结构化输入；原有 `PredictionRequest` 的运行输入仍独立于 OM 方案定义，且不要求 `settingId`。

**Acceptance:**
- 从已选 CFG 的试验进入数字孪生/虚拟工况，CFG 自动继承；用户无需重复选择 CFG，也不手动先选 OM“方案1 气动模型”。
- 用户在同一个流程中提供通用模型与本次手填的分析参数；若有确切适配的旧方案系统复用，若无则自动规划，出现多个候选时要求明确选择而不猜测。
- 不按模型名称推断已包含试验台；仅以 MODEL 声明的字段及显式映射决定读取哪些 CFG 装备。更改目标转速等本次输入不创建新 OM；字段名称相似但不同单位/来源时不能自动绑定。
- 模型配置和本次输入能被单独追溯，运行结果保留 `trialId / cfgId / modelId / input snapshot`；当前预览结果必须保持 `demo` 标识，不声称执行正式 CFD。

- [ ] **Step 1: Write failing matching tests.**

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
const bundle = await build({
  stdin: { contents: "export * from './src/workspace/modelPlanModel';", resolveDir: process.cwd() },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent'
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundle.outputFiles[0].text).toString('base64'));
test('same CFG/MODEL/OBJ/configuration reuses scheme, runtime speed is irrelevant', () => {
  const request = { modelId:'MOD-01', cfgId:'CFG-07', objectIds:['fan-1','rig-1'], configKey:'geometry-v1' };
  const catalog = [{ id:'OM-01', modelId:'MOD-01', cfgId:'CFG-07', objectIds:['fan-1','rig-1'], configKey:'geometry-v1' }];
  const a = api.resolveModelPlan(request, catalog);
  const b = api.resolveModelPlan({ ...request }, catalog);
  assert.deepEqual(a, b);
  assert.equal(a.action, 'reuse');
  assert.equal(api.resolveModelPlan({ ...request, cfgId:'CFG-02' }, catalog).action, 'plan');
  assert.equal(api.resolveModelPlan({ ...request, configKey:'geometry-v2' }, catalog).action, 'plan');
});
~~~

另加无 CFG、缺失目标 OBJ、同型号多候选、顺序无关的成员 ID、不同模型配置 configKey 不复用、缺少必需字段/单位冲突、0 组 SET、改变运行转速不增加 OM，以及方案确认后下次可复用的存储测试。Expected: RED。

- [ ] **Step 2: Implement the matching contract, not model physics.**

~~~ts
export interface ModelScheme {
  id: string; modelId: string; cfgId: string;
  objectIds: string[]; configKey: string;
}
export interface ModelPlan {
  modelId: string; cfgId: string; objectIds: string[]; configKey: string;
  schemeId?: string; action: 'reuse' | 'plan' | 'ambiguous';
}
export function resolveModelPlan(
  request: { modelId: string; cfgId: string; objectIds: string[]; configKey: string },
  catalog: ModelScheme[]
): ModelPlan {
  if (!request.modelId || !request.cfgId || !request.objectIds.length || !request.configKey)
    throw new Error('缺少通用模型、试验构型、仿真对象或模型配置参数');
  const key = (items: string[]) => [...new Set(items)].sort().join('|');
  const matches = catalog.filter(item =>
    item.modelId === request.modelId && item.cfgId === request.cfgId &&
    item.configKey === request.configKey &&
    key(item.objectIds) === key(request.objectIds));
  return { ...request,
    schemeId: matches.length === 1 ? matches[0].id : undefined,
    action: matches.length === 1 ? 'reuse' : matches.length > 1 ? 'ambiguous' : 'plan' };
}
~~~

此函数是**交互原型的确定性方案查询**，不是对真实模型适用性的完整判断；正式模型的版本、配置参数与后端选择策略应在后续后端计划中补充。不得把单纯“同名 OM”或“相同转速”作为复用依据。

- [ ] **Step 3: Integrate one prediction entry and manually editable fields.**

在 `PredictionWorkspace.tsx` 继承当前试验的 `cfgId`；进入时先选择功能对应的 MODEL（如 CFD 通用模型），用户同时填写分析运行参数；页面调用 `resolveModelPlan`，默认复用匹配项，或在当前表单内自动规划“方案1 气动模型”这样的可复用方案。若需要填写模型配置参数，仅在这一流程中显示需要人工确认/补充的字段。不要要求用户先到“对象模型管理”创建，也不要在主界面重复罗列已由 CFG 代表的叶尖直径/机匣/叶片清单。

原有 `predictionParameters.ts` 的不同功能字段定义继续可用作前端演示；新建 `modelSchemeStore.ts` 使用独立的原型模型方案目录，以 `(modelId, cfgId, objectIds, configKey)` 去重保存自动规划并经用户确认的方案，从而下次进入可以复用；不向 `globalModelStore.ts` 双写，也不删除本地旧数据。新建 `modelFlowFixtures.ts` 只准备用于演示“MOD-01/CFG-07/OM-01”的明确样例数据，并带可识别的演示标记；不得把 `globalModelStore.ts` 中的旧“发动机模型”演示项目当成正式 CFD 目录。`services/predictionPreview.ts` 继续返回 `resultMode:'demo'`，正式后端模型运算不属于本任务。

- [ ] **Step 4: Verify and commit.**

Run: `cd frontend && node --test tests/modelPlanModel.test.mjs tests/prediction.test.mjs tests/crossFunctionSharing.test.mjs && npm run build && npm run lint`。Expected: PASS。手动验证“已有 OM → 自动复用”“无 OM → 同流程自动规划”“修改运行参数 → 不重建 OM”“CFG 失效 → 不使用其它 CFG 代替”“没有 SET → 可手工输入并预览”“演示结果仍显示演示”。Commit: `git add frontend/src/workspace/modelPlanModel.ts frontend/src/workspace/modelSchemeStore.ts frontend/src/workspace/modelFlowFixtures.ts frontend/src/workspace/PredictionWorkspace.tsx frontend/src/workspace/predictionContract.ts frontend/src/workspace/predictionParameters.ts frontend/tests/modelPlanModel.test.mjs frontend/tests/prediction.test.mjs && git commit -m "feat: inherit CFG and plan reusable model workflow"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，查询函数正反例、字段有效性/来源测试和浏览器“无重复选择”的交互证据共同覆盖全部条件。

### Task 6: End-to-End Frontend Workflow Acceptance

**Files:**
- Test: `frontend/tests/trialConfiguration.test.mjs`
- Test: `frontend/tests/cfgTrialBridge.test.mjs`
- Test: `frontend/tests/trialSettings.test.mjs`
- Test: `frontend/tests/modelPlanModel.test.mjs`
- Verify: `frontend/scripts/verify-session-workflows.mjs`
- Verify: `frontend/scripts/verify-physical-source-interactions.mjs`
- Verify: `frontend/scripts/verify-prediction.mjs`
- Optional new browser script after checking existing harness: `frontend/scripts/verify-cfg-model-flow.mjs`
- Documentation of verification: `docs/verification/2026-10-23-cfg-model-frontend-flow.md`

**Interfaces:** No new production API. User-visible route and model API from Tasks 1–5 are exercised together.

**Acceptance:**
- 从试验任务或自主试验入口选择 CFG（已有与弹窗新建）、建立具体试验、手填多组 SET；两个 CFG 创建入口一致。
- 具体试验下多次实测记录、CSV、表格/图表仍能关联原 ID；无载荷谱也能记录；任务书/项目会话导航保持可恢复。
- 模型分析不强制 SET，MODEL 与手工输入同流程，已配置的方案可复用，没有则可规划；CFG 摘要不展开内部参数，测试台是否参与模型输入由字段映射决定。
- 本轮不得删除或覆盖用户原本浏览器数据；正式与演示结果有明确区分；旧路径及旧对象可以正常打开。

- [ ] **Step 1: Run focused and full automated verification.**

~~~bash
cd frontend
node --test tests/trialConfiguration.test.mjs tests/cfgTrialBridge.test.mjs tests/trialSettings.test.mjs tests/modelPlanModel.test.mjs
node --test tests/*.test.mjs
npm run lint
npm run build
git diff --check
~~~

Expected: all commands exit 0。遇到仓库既有失败须记录基线，并证明本轮没有新增回归，不允许只写“Agent 已确认通过”。

- [ ] **Step 2: Verify user journey in an isolated browser profile.**

执行下列确切验收路径，保存操作截图和关键来源 ID（不可复用日常浏览器的 localStorage/IndexedDB）：

~~~text
A. TASK A → 气动性能试验 → 新建“起飞设计点性能试验”
   → 选择 CFG-07（风扇+气动试验台）→ 创建并进入工作台
   → 在试验内依次新建 SET 0D、0.25D、0.5D、0.75D。
B. 创建第二个具体试验 → CFG 不存在 → 打开内嵌 CFG 弹窗
   → 按角色选择装备 → 保存 → 自动选中 → 返回原试验草稿。
C. 从 CFG 管理页打开创建器 → 字段、角色与 B 一致
   → 取消不创建；无被试装备/失效对象被阻止。
D. 在具体试验中不创建任何 SET → 进入虚拟工况
   → 选择 MODEL → 手工输入运行条件 → 自动复用匹配 OM，
   或在同表单自动规划模型方案 → 预览标为“演示”。
E. 改变转速 → 模型方案身份不改变；切到另一个 CFG
   → 不错误复用旧方案；关闭/恢复会话后来源 ID 仍一致。
F. 在试验下新增执行记录、导入多个 CSV、保存图表；
   返回任务/项目/原记录，校验来源未变化。无载荷谱可继续。
G. 关闭页面/重新打开隔离浏览器：当前原型数据可恢复；
   实际用户浏览器旧数据未被打开、覆盖或删除。
~~~

- [ ] **Step 3: Save objective verification and commit.**

`docs/verification/2026-10-23-cfg-model-frontend-flow.md` 记录：工作树提交范围、测试命令及退出码、A–G 场景是否通过、来源 ID 样例、截图路径、尚需后端验证的行为。只可记录执行过的测试；不能预写通过结论。Commit: `git add docs/verification/2026-10-23-cfg-model-frontend-flow.md && git commit -m "test: document CFG and model frontend workflow acceptance"`。

**Coverage Gate:** `COVERAGE_COMPLETE`，自动回归 + 隔离浏览器 A–G + 实际验证证据对应全部验收约束。

---

## Per-Task Coverage Review

| Task | 必须证明的结果 | 直接证据 | Gate |
| --- | --- | --- | --- |
| 1 | OBJ 独立身份、跨层级引用、CFG 角色校验、旧存储不变 | equipmentComposition / trialConfiguration / physicalObjects tests | COVERAGE_COMPLETE |
| 2 | 单一 CFG 创建表单、弹窗带回、取消无写入 | validation tests + 双入口浏览器验收 | COVERAGE_COMPLETE |
| 3 | 新 trial 关联 cfgId、不重释 experimentId、无谱可建记录、旧来源可访问 | cfgTrialBridge + physicalObjects + taskTrialIntegration tests | COVERAGE_COMPLETE |
| 4 | TASK 管理、SET 多组手填且互不影响、不要求 SET 预测 | trialSettings tests + 浏览器验收 | COVERAGE_COMPLETE |
| 5 | 自动复用/规划 OM、手工分析参数、CFG 继承、演示结果不冒充真实 | modelPlanModel + prediction tests + 浏览器验收 | COVERAGE_COMPLETE |
| 6 | 端到端链路、原 CSV/成果可用、本机既有数据保护 | 全量 tests/build/lint + A–G 真实执行证据 | COVERAGE_COMPLETE |

上表的状态表示计划的**验证设计覆盖完整**，不是代码已实现或测试已通过。执行过程中任一验收项缺少实际测试证据则记为未通过，不得在验收记录中宣称完成。

## Self-Review Before Execution

- 范围未混合后端数据源替换、实际 CFD 计算或模型物理假设；这些归属后续路线图。
- 源码同名 `ExperimentDefinition` 不等于 CFG；`PhysicalBusinessScope.experimentId` 不等于 `cfgId`，新实现只通过兼容桥关联。
- “新建 CFG 两个位置”是**同一个编辑组件**，“预测复用/规划 OM”是**一个分析入口的不同状态**，不是重复的业务入口。
- 试验可以有四组人工 SET，但模型输入不强制从 SET 来；CFG 页面和模型页不反复展开对象技术参数。
- 来源失效、同名对象、两个模型方案候选、不存在载荷谱、旧试验记录、演示/真实区分都有明确验证路径。
- 本计划包含可执行任务、文件路径、测试命令和验收标准；不要求单独编写 Spec，也不授权本次直接变更业务代码。

## Execution Handoff

Plan 完成后使用以下任一方式逐 Task 执行，必须经过审查与测试：
1. Subagent-Driven（推荐）：`superpowers:subagent-driven-development`，每 Task 独立验收和提交；
2. Inline Execution：`superpowers:executing-plans`，分批执行、阶段复核。

执行前重新读取 `main` 的相关文件确认行号、接口及测试工具；计划中的新文件/签名在第一项实现完成后，以实际可运行代码为准。如后续模型计算契约出现与本业务规则冲突，应回到需求确认，不在执行中擅自更改 CFG/OM/SET 的定义。
