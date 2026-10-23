# ProTangram 功能内手动选择 CFG 与成果回流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户进入相关专业功能后亲自选择/创建 CFG、填写本次参数、执行并将成果保存到当前试验的共享数据，返回试验工作台后可再次使用已有数据，但系统不代选 CFG。

**Architecture:** 将“本次操作选择 CFG”做成独立的显式输入组件；既有试验 CFG 和上一次运行 CFG 仅用作历史提示，不作为已确认值。数字孪生/虚拟工况使用同一选择组件、同一 CFG 编辑器与已有模型配置/成果存储链路。功能级输入与运行快照独立于试验级资料，其他不需要 CFG 的功能不被统一拦截。

**Tech Stack:** React 19、TypeScript 5.9、Ant Design 6、React Router 7、Zustand 5、Vite 7、Node.js node:test、esbuild、仓库现有浏览器验收脚本。

**Spec:** 无独立 Spec；本计划“业务契约”记录本轮用户最后明确确认的规则，同时参考 XMind 的 CFG/OBJ/SET/MODEL/OM 定义、HTML 字段说明。实现以 `feat/cfg-model-frontend-flow` 分支现有代码为基线。若与 10 月 23 日前一份计划冲突，以“CFG 必须用户自己选择，后端不判断”为准。

## Global Constraints / Business Contract

- 进入需要 CFG 的功能时，**用户亲自选择已有 CFG 或新建并确认**；不能因存在 `trial.cfgId`、上次使用值、候选 OM、物理对象名称就自动确定本次 CFG。不能让后端替用户选择。
- 再次进入可展示上次 CFG 供快速选择，仍须本次明确确认；无确认不得执行依赖 CFG 的函数。用户也可改选另一 CFG，不默认重写原试验 CFG。
- CFG 表示按角色组成的装备组合，来源为既有物理对象；OBJ 是仿真对象，OM 是 MODEL 作用于对象的模型方案，SET 为人工填写的试验设置。用户所选 CFG、模型配置、本次运行参数三者分离。
- 一个 CFG 可供不同试验、不同专业功能引用；新结果必须记录本次用户选定的 cfgId、trialId、MODEL/OM（若使用）与输入快照。用户执行一次功能不需要复制 CFG，也不把临时参数写回装备。
- CFG 是否是某功能的输入，由该功能的操作定义决定：本次预测/虚拟工况模型输入路径要求用户明确选择；基础 CSV 数据分析、报告浏览不应被 CFG 选择弹窗阻断；DOE 仅在需要装备关联时调用同一组件。
- 新建 CFG 调用 `TrialConfigurationEditor` 原组件，不再造一套弹窗表单。保存后作为待确认选项返回，用户点击“确认使用”后才成为本次输入。
- 运行完成沿用已有共享数据/成果机制；保存成功后提供“返回具体试验工作台”动作，重新进入可查历史成果并按需重新选择 CFG；保存失败不能假装成功返回。
- 现阶段只整改前端交互，继续保留本地持久化和演示结果标记；不清除用户 localStorage/IndexedDB、不增加生产后端接口、不改变真实模型算法。
- 不把 `TrialSettingsPanel` 常驻所有功能上方；SET 可以在试验资料区域随时管理，不能因为没创建 SET 就阻止 CSV 分析或本次模型参数填写。

---

## Scope Check / Implementation Roadmap

| 实施单元 | 独立可验收产物 | 前置条件 |
| --- | --- | --- |
| **本计划** | 专业功能显式选择 CFG、按需配置、运行/保存/返回/再次进入 | CFG 编辑器、预测界面与共享成果保存链路已在特性分支存在 |
| **并行独立计划** `2026-10-23-equipment-tree-cfg-category-browser.md` | 物理对象树统一展示演示装备；CFG 分类独立浏览并复用对象 ID | 已有 `physicalNavigation` 与 CFG 库 |
| 后续：试验创建/任务书 PDF 核对重构 | 名称创建与任务书预填参数、原文核对的同一试验工作台 | 确定独立试验身份及任务书参数出处的数据契约 |
| 后续：真实后端数据和计算 | 数据库、文件存储、模型函数和版本追溯 | 前端验收、后端接口确定 |

本计划只详细实现第一项，不提前依赖后续接口，也不创建新的 Spec。

## Source Evidence / File Structure

| 操作 | 文件 | 用途/当前问题 |
| --- | --- | --- |
| Create | `frontend/src/workspace/featureCfgChoiceModel.ts` | 本次 CFG 选择的纯状态模型 |
| Create | `frontend/src/workspace/FeatureCfgPicker.tsx` | 选已有 / 新建 / 手动确认的共用 UI |
| Modify | `frontend/src/workspace/PredictionWorkspace.tsx` | 当前通过 `physicalSource.trial?.cfgId` 自动决定调用 `CfgPredictionForm`，应移除该自动决定 |
| Modify | `frontend/src/workspace/CfgPredictionForm.tsx` | 只使用当前用户确认的 cfgId，成功保存后可以返回 |
| Modify | `frontend/src/workspace/SessionWorkbench.tsx` | 当前所有专业功能上方都渲染 `TrialSettingsPanel`，应改为按需展开 |
| Reuse | `frontend/src/workspace/TrialConfigurationEditor.tsx`、`trialConfigurationStore.ts` | 已有独立 CFG 创建器及稳定 ID，不重写 |
| Reuse | `frontend/src/workspace/modelPlanModel.ts`、`modelSchemeStore.ts` | MODEL/OM 方案查询；不能把方案匹配解释为用户已选择 CFG |
| Reuse | `frontend/src/workspace/analysisResultModel.ts`、`services/predictionPreview.ts` | 共享成果和预测快照已有实现 |
| Test | `frontend/tests/featureCfgChoice.test.mjs` | 新选择纯逻辑测试 |
| Test | `frontend/tests/modelPlanModel.test.mjs`、`prediction.test.mjs`、`sessionWorkbench.test.mjs` | 现有回归 |
| Verify | `frontend/scripts/verify-cfg-model-flow.mjs`、`verify-session-workflows.mjs` | 隔离浏览器全流程 |
| Create | `docs/verification/2026-10-23-explicit-cfg-feature-workflow.md` | 实测证据，不允许预先声明通过 |

### Task 1: CFG 只有用户明确确认后才成为本次输入

**Files:** Create `frontend/src/workspace/featureCfgChoiceModel.ts`; Test `frontend/tests/featureCfgChoice.test.mjs`.

**Interfaces:** `CfgChoiceState`；`beginCfgChoice(suggestedCfgId?: string):CfgChoiceState`；`confirmCfgChoice(state:CfgChoiceState,cfgId:string,validIds:Set<string>):CfgChoiceState`；`requireCfgChoice(state:CfgChoiceState):string`。不访问 trial store 或后端。

**Acceptance:** 上次 CFG 与旧试验 cfgId 只是提示，不能自动算本次选择；空值/失效 ID 阻止执行；合法 CFG 经用户确认才能返回。

- [ ] **Step 1: 写失败测试**。在新测试文件中写入完整测试：

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const api = await loadWorkspace("export * from './src/workspace/featureCfgChoiceModel';");
test('prior CFG is not a confirmed choice', () => {
  const state = api.beginCfgChoice('old-cfg');
  assert.equal(state.suggestedCfgId, 'old-cfg');
  assert.equal(state.confirmedCfgId, undefined);
  assert.throws(() => api.requireCfgChoice(state), /请明确选择/);
});
test('valid CFG must be confirmed; invalid CFG is rejected', () => {
  const set = new Set(['cfg-A', 'cfg-B']);
  const state = api.confirmCfgChoice(api.beginCfgChoice('cfg-A'), 'cfg-B', set);
  assert.equal(api.requireCfgChoice(state), 'cfg-B');
  assert.throws(() => api.confirmCfgChoice(state, 'missing', set), /失效/);
  assert.throws(() => api.confirmCfgChoice(state, '', set), /失效/);
});
~~~

- [ ] **Step 2: 验证 RED**。Run: `cd frontend && node --test tests/featureCfgChoice.test.mjs`。Expected: FAIL，文件尚不存在。
- [ ] **Step 3: 最小实现**：

~~~ts
export interface CfgChoiceState {
  suggestedCfgId?: string;
  confirmedCfgId?: string;
}
export function beginCfgChoice(suggestedCfgId?: string): CfgChoiceState {
  return { suggestedCfgId, confirmedCfgId: undefined };
}
export function confirmCfgChoice(
  state: CfgChoiceState, cfgId: string, validIds: Set<string>,
): CfgChoiceState {
  if (!cfgId || !validIds.has(cfgId)) throw new Error('所选 CFG 已失效，请重新选择');
  return { ...state, confirmedCfgId: cfgId };
}
export function requireCfgChoice(state: CfgChoiceState): string {
  if (!state.confirmedCfgId) throw new Error('请明确选择试验构型 CFG');
  return state.confirmedCfgId;
}
~~~

- [ ] **Step 4: GREEN + Commit**。Run: `cd frontend && node --test tests/featureCfgChoice.test.mjs && npm run build`。Expected: PASS。

~~~bash
git add frontend/src/workspace/featureCfgChoiceModel.ts frontend/tests/featureCfgChoice.test.mjs
git commit -m "feat: define explicit CFG choice for professional inputs"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 未选择阻止运行、有效确认、来源失效都有直接测试。

### Task 2: 统一的功能内 CFG 选择器

**Files:** Create `frontend/src/workspace/FeatureCfgPicker.tsx`; Reuse `frontend/src/workspace/TrialConfigurationEditor.tsx`; Test `frontend/tests/featureCfgChoice.test.mjs`; Verify `frontend/scripts/verify-cfg-model-flow.mjs`.

**Interfaces:** `FeatureCfgPicker({ suggestedCfgId?:string; onConfirm:(cfgId:string)=>void; onCancel:()=>void })`。确认回调仅来自用户点击，创建 CFG 后仍待用户确认。

**Acceptance:** 选择已有、弹窗新建使用同一个编辑器；取消不改变本次模型草稿、不执行、不替用户设置 CFG；再次进入可以看到推荐/上次使用但不会自动确认。

- [ ] **Step 1: 先录制旧界面负例**。在隔离浏览器新建试验并保留旧 `trial.cfgId`，进入数字孪生；当前旧代码会直接打开模型表单，作为待修复 RED 行为记录。
- [ ] **Step 2: 创建完整选择组件**：

~~~tsx
import { useState } from 'react';
import { Button, Modal, Select, Space } from 'antd';
import { useTrialConfigurationStore } from './trialConfigurationStore';
import TrialConfigurationEditor from './TrialConfigurationEditor';

export default function FeatureCfgPicker({ suggestedCfgId, onConfirm, onCancel }: {
  suggestedCfgId?: string;
  onConfirm: (id: string) => void;
  onCancel: () => void;
}) {
  const configs = useTrialConfigurationStore(s => s.configurations);
  const [value, setValue] = useState<string>();
  const [creating, setCreating] = useState(false);
  return <Space direction="vertical" style={{ width: '100%' }}>
    {suggestedCfgId && <span>上次使用：{configs.find(c => c.id === suggestedCfgId)?.name ?? '已失效'}</span>}
    <Select aria-label="本次选择 CFG" value={value} onChange={setValue}
      showSearch optionFilterProp="label" placeholder="选择本次使用的 CFG"
      options={configs.map(c => ({ value: c.id, label: c.name }))} />
    <Space>
      <Button onClick={() => setCreating(true)}>新建 CFG</Button>
      <Button type="primary" disabled={!value || !configs.some(c => c.id === value)}
        onClick={() => { if (value) onConfirm(value); }}>确认使用</Button>
      <Button onClick={onCancel}>取消</Button>
    </Space>
    <Modal title="新建试验构型" open={creating} onCancel={() => setCreating(false)}
      footer={null} destroyOnHidden width={780}>
      <TrialConfigurationEditor onCancel={() => setCreating(false)}
        onSaved={id => { setValue(id); setCreating(false); }} />
    </Modal>
  </Space>;
}
~~~

- [ ] **Step 3: 增加浏览器验收断言**。在 `verify-cfg-model-flow.mjs` 覆盖“选已有→确认”“新建→回填待确认”“取消→未确认”“无 CFG 不可执行”；选择器 UI 本身不自动运行任何模型。
- [ ] **Step 4: 构建+提交**。Run: `cd frontend && node --test tests/featureCfgChoice.test.mjs tests/trialConfiguration.test.mjs && npm run build`。Expected: PASS。浏览器验收在 Task 4 统一执行。

~~~bash
git add frontend/src/workspace/FeatureCfgPicker.tsx frontend/scripts/verify-cfg-model-flow.mjs
git commit -m "feat: add reusable explicit CFG picker"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 选择/取消/新建与未确认的边界由浏览器脚本验证，纯状态由 Task 1 测试验证。

### Task 3: 专业功能按需选择，不再自动继承 CFG 或常驻 SET

**Files:** Modify `frontend/src/workspace/PredictionWorkspace.tsx`、`CfgPredictionForm.tsx`、`SessionWorkbench.tsx`; Test `frontend/tests/prediction.test.mjs`、`sessionWorkbench.test.mjs`、`trialSettings.test.mjs`; Verify `frontend/scripts/verify-cfg-model-flow.mjs`.

**Interfaces:** `PredictionWorkspace` 在当前次功能入口持有 `CfgChoiceState`，只把 `confirmedCfgId` 传给 `CfgPredictionForm`；现有成果 `archive` 回调保持不变。

**Acceptance:** 数字孪生、虚拟工况在当前功能内手动选 CFG；旧 `trial.cfgId` 不自动启用；再次进入必须重新确认；无 CFG 的 CSV 分析不被阻止；SET 面板不占据所有功能的上方，但数据仍保留。

- [ ] **Step 1: 补充 RED 浏览器场景**。断言具有 `trial.cfgId` 的试验首次进入虚拟工况也必须出现“本次选择 CFG”，不能未经本次用户确认直接出现“执行演示预览”。
- [ ] **Step 2: 在 `PredictionWorkspace.tsx` 加入显示边界**。新增组件（并增加必要 imports）：

~~~tsx
function ExplicitCfgPrediction({ service, target, context, trialId, archive, suggestedCfgId }: {
  service: PredictionService; target: PredictionTarget; context: ProfessionalDataContext;
  trialId: string; archive: (task: PredictionPreviewTask) => boolean; suggestedCfgId?: string;
}) {
  const [choice, setChoice] = useState(() => beginCfgChoice(suggestedCfgId));
  const [picking, setPicking] = useState(true);
  if (!choice.confirmedCfgId || picking) return <div>
    <FeatureCfgPicker suggestedCfgId={suggestedCfgId}
      onCancel={() => setPicking(false)}
      onConfirm={id => {
        setChoice(confirmCfgChoice(choice, id,
          new Set(useTrialConfigurationStore.getState().configurations.map(c => c.id))));
        setPicking(false);
      }} />
    {!picking && <Button onClick={() => setPicking(true)}>选择 CFG</Button>}
  </div>;
  return <div>
    <Button onClick={() => { setChoice(beginCfgChoice(choice.confirmedCfgId)); setPicking(true); }}>
      更换本次 CFG
    </Button>
    <CfgPredictionForm key={choice.confirmedCfgId} service={service}
      target={target} context={context} trialId={trialId}
      cfgId={choice.confirmedCfgId} archive={archive} />
  </div>;
}
~~~

将原按 `physicalSource.trial?.cfgId` 自动分流的末尾逻辑改为：

~~~tsx
return physicalSource.trial
  ? <ExplicitCfgPrediction key={physicalSource.trial.id + ':' + service}
      service={service} target={target} context={dataContext}
      trialId={physicalSource.trial.id} archive={archive}
      suggestedCfgId={physicalSource.trial.cfgId} />
  : <PredictionForm service={service} target={target} context={dataContext} archive={archive} />;
~~~

第二支仅是旧无试验会话兼容，不是新业务绕过 CFG 的入口。退出/切换功能时必须销毁当前次确认状态；不把这次选择写进 `trial.cfgId` 或全局会话后再默认为已确认。

- [ ] **Step 3: 移除常驻 SET，并保留访问入口**。在 `SessionWorkbench.tsx` 删除：

~~~tsx
{physicalSource.trial&&!physicalSource.missing&&<TrialSettingsPanel trial={physicalSource.trial} />}
~~~

在该试验的“试验资料 / 数据与成果”操作区增加“试验设置”按钮，以状态控制现有 `TrialSettingsPanel` 在 `Modal` 内显示；不要删除任何 SET、记录或 CSV。按钮只控制可见性，不改变数据。
- [ ] **Step 4: 验证+提交**。Run: `cd frontend && node --test tests/featureCfgChoice.test.mjs tests/prediction.test.mjs tests/sessionWorkbench.test.mjs tests/trialSettings.test.mjs && npm run build`。Expected: PASS。浏览器额外验证不同功能可以分别选择不同 CFG，模型结果快照记录的是当前次选择。

~~~bash
git add frontend/src/workspace/PredictionWorkspace.tsx frontend/src/workspace/CfgPredictionForm.tsx frontend/src/workspace/SessionWorkbench.tsx frontend/scripts/verify-cfg-model-flow.mjs
git commit -m "feat: require manual CFG selection in relevant function flows"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 正向选择、旧 cfgId 不自动选、CSV 不被挡、SET 不常驻但仍可打开，分别由浏览器和现有回归覆盖。

### Task 4: 共享成果保存、返回、重新进入

**Files:** Modify `frontend/src/workspace/CfgPredictionForm.tsx`、`PredictionWorkspace.tsx`; Verify `frontend/scripts/verify-cfg-model-flow.mjs`、`verify-session-workflows.mjs`; Test `frontend/tests/modelPlanModel.test.mjs`、`analysisResults.test.mjs`、`crossFunctionSharing.test.mjs`; Create `docs/verification/2026-10-23-explicit-cfg-feature-workflow.md`.

**Interfaces:** 复用现有 `archive(task:PredictionPreviewTask):boolean`；增加可选 `onSavedAndReturn?:()=>void`。返回时走当前 session 的试验工作台路由，而不是打开独立模型管理页。

**Acceptance:** 运行结果包含本次 cfgId/模型配置/本次人工输入快照；保存成功可回到试验工作台并在共享成果中打开；失败留在当前页面；再次进入给历史 CFG 建议但要求用户亲自确认，功能输入可按历史关联恢复，不自动运行。

- [ ] **Step 1: 浏览器脚本写 RED**。执行选 CFG-A→人工输入→运行→保存返回→从共享成果打开，断言 `result.modelPlan.cfgId` 为 CFG-A；再进入功能必须重新确认，即使曾选过 CFG-A；用 CFG-B 再运行不更改先前结果中的 cfgId。
- [ ] **Step 2: 在现有保存函数中统一处理“保存并返回”**。对 `CfgPredictionForm` 的 props 增加：

~~~ts
onSavedAndReturn?: () => void;
~~~

原 `save` 使用现有 `savePredictionPreview` + `archive` 一条链路，接受参数 `shouldReturn:boolean`；只在 `archive(task)` 成功后执行：
~~~ts
setResult(task);
setSaved(true);
if (shouldReturn) onSavedAndReturn?.();
~~~
失败时保留结果、错误及 CFG 选择，不改变用户工作区。用 `useParams` + `useNavigate`、现有 `getSessionPath(sessionId,'doe')` 将回调从 `PredictionWorkspace` 传给子组件；如果路由不在有效 session 中，不猜测返回目标而保留“查看共享成果”操作。

- [ ] **Step 3: 全量回归+隔离浏览器验收**。

~~~bash
cd frontend
node --test tests/*.test.mjs
npm run build
npm run lint
git diff --check
~~~

Expected: tests / build PASS。Lint 若存在仓库基线问题，分别记录基线和本轮新增错误；浏览器使用隔离用户资料并使用脚本既有 `PROTANGRAM_PLAYWRIGHT_ROOT`、`PROTANGRAM_TEST_URL` 配置（检查真实 Playwright 安装路径后执行）。必须检查取消、来源失效、保存失败、重新进入、另一 CFG 和共享成果不变。
- [ ] **Step 4: 保存真实证据并提交**。创建 `docs/verification/2026-10-23-explicit-cfg-feature-workflow.md`，记下实际命令、退出码、测试结果、截图、成果 ID、试验 ID 和所选 cfgId，不得填写未实际运行的通过结论。

~~~bash
git add frontend/src/workspace/CfgPredictionForm.tsx frontend/src/workspace/PredictionWorkspace.tsx frontend/scripts/verify-cfg-model-flow.mjs frontend/scripts/verify-session-workflows.mjs docs/verification/2026-10-23-explicit-cfg-feature-workflow.md
git commit -m "test: verify manual CFG input and saved result return"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 结果关联、返回、再进入手动确认、失败留页、历史成果不可被覆盖均有指定浏览器验证。

## Per-Task Coverage Review

| Task | 必须证明 | 证据 | Gate |
| --- | --- | --- | --- |
| 1 | 旧 CFG ≠ 本次确认；合法/失效选择 | `featureCfgChoice.test.mjs` | COVERAGE_COMPLETE |
| 2 | 共享创建器；取消/新建返回后仍待确认 | `verify-cfg-model-flow.mjs` + CFG 回归 | COVERAGE_COMPLETE |
| 3 | 按功能显式 CFG、无全局 SET、无需 CFG 的 CSV 不受影响 | prediction/session/SET tests + 浏览器 | COVERAGE_COMPLETE |
| 4 | 保存至共享成果、返回工作台、重新进入须确认 | 全量测试 + 隔离浏览器 + 记录来源 ID | COVERAGE_COMPLETE |

上表为**计划测试覆盖**，不意味着代码已经修改或验证已经成功。

## Self-Review / Execution Handoff

- 无新增 Spec、无后端自动 CFG 选择。旧 `trial.cfgId` 即便有值，也不能替代用户本次选择。
- 功能参数和 MODEL/OM 复用与 CFG 选择分开；不要因为某个 OM 存在就反推 CFG，也不要把换转速当成创建新 OM。
- 用户原有浏览器状态、CSV、SET、成果仍受保护；不引入并行计算接口或第二套共享成果存储。
- 按 writing-plans 执行：每任务 RED → 实现 → GREEN → Commit；可选 `superpowers:subagent-driven-development`（推荐，逐 Task 审查）或 `superpowers:executing-plans`（分批执行）。
