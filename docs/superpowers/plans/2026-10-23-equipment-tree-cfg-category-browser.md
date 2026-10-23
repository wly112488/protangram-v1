# ProTangram 物理对象树与 CFG 分类浏览 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 左侧物理对象按装备类别→具体对象→组成对象展示，演示风扇 A/B 归入现有“涵道风扇”类别视图；试验构型在独立分类区浏览，通过引用上面任意层级的物理对象组合生成，而不是被当成物理对象树的子节点。

**Architecture:** 本轮先调整**浏览投影**而不迁移用户存储：为原本的“涵道风扇”类别合并展示演示风扇实例，但保留每个对象真实 ID 和原始来源类别 ID，使旧 URL、已有任务/会话/CSV 不失效。左侧物理对象树去掉旧版 ExperimentDefinition 子节点；CFG 另设可编辑的分类索引，并始终使用现有 TrialConfigurationEditor 从物理对象树检索和引用装备，不复制装备参数。分类由用户整理而非系统根据角色推断。

**Tech Stack:** React 19、TypeScript 5.9、Ant Design 6 Tree / Select、React Router 7、Zustand 5、Vite 7、Node node:test + esbuild。

**Spec:** 无独立 Spec；当前计划的“业务契约”来自本轮用户说明和现有 XMind、HTML 的物理对象/装备关系与独立 CFG 关系。以 `feat/cfg-model-frontend-flow` 分支当前前端源码为实现基线，与 `2026-10-23-explicit-cfg-feature-workflow.md` 并行，可独立测试。

## Global Constraints / Business Contract

- “涵道风扇”“电机”“电推进”等是物理对象的分类；“涵道风扇 A（演示）”“涵道风扇 B（演示）”是具体对象，应在“涵道风扇”下查看；转子、静子、机匣等用户在风扇下建的组成对象继续在风扇下展示。
- 演示的“涵道风扇（演示）”独立类别只是当前样例数据的包装，**不应强迫用户在左侧单独展开第二个与涵道风扇重复的类别**。本次仅合并显示，不能因为名称相近就在真实持久化数据中批量挪动对象。
- 物理对象拥有独立稳定 ID。对象层级只负责浏览/组成关系，可被 CFG 跨层级按 ID 引用；一级对象可引用三级对象，不能写死“只能选直属子对象”。
- `ExperimentDefinition`（静推力构型 A、变转速构型 A 等）是旧版**历史试验布置**，不能仅凭名称认为它就是独立 CFG。不得直接迁移成 CFG、删除其旧试验/记录、抹除来源链接。
- 试验构型 CFG 是独立的装备角色组合。左侧“试验构型”只显示分类，不把所有 CFG 实例塞进物理对象树；点击分类后在中央 CFG 库查看分类内已有 CFG。分类不决定 CFG 的装备角色、适用功能或模型算法。
- CFG 新建与编辑始终从全局物理对象检索中按 ID 选择装备，保留角色（被试装备/供电/试验台/测量设备/陪试件/其他）；陪试件是可选成员，分类不强制任何成员角色。
- 演示数据、正式对象和任务/会话/CSV 的现有引用不丢失；保留 localStorage 和 IndexedDB。本轮不修改后端、不删除演示、不自动运行迁移或覆盖用户数据。
- 同名对象不得按名称去重；两个不同 ID 的转子仍是两个独立对象。合并“演示类别”的条件必须用已知 demo 标识精确限定，不能将用户创建的“涵道风扇（演示）”也随意合并。
- CFG 类别归属由用户选择。没有分类的 CFG 仍可浏览和被所有功能选择；分类只帮助查找，不影响功能里显式选择 CFG 的规则。

---

## Scope Check / Implementation Roadmap

| 实施单元 | 独立成果 | 依赖 |
| --- | --- | --- |
| **本计划** | 物理对象树无旧试验布置节点、演示风扇合并显示、CFG 独立分类浏览、成员对象跨层级按 ID 选择 | 已有物理对象存储、树、CFG 库 |
| **并行计划** `2026-10-23-explicit-cfg-feature-workflow.md` | 专业功能进入时用户亲自选择 CFG，保存成果后返回 | 已有预测/成果链路 |
| 后续：对象持久化归属迁移 | 如确需把演示数据从原类别真正移动到新类别，先制定可回滚的数据映射/迁移/旧链接验证 | 浏览流程已通过 + 用户同意修改现有持久化数据 |
| 后续：后端资料库 | 以后端为真实 OBJ/CFG/成果来源，前端查询树 | 后端数据与访问契约明确 |

本阶段不提前规划数据迁移脚本，不把演示类别的虚拟归并伪称为已完成持久化迁移。

## Source Evidence / File Map

| 操作 | 文件 | 当前情况/责任 |
| --- | --- | --- |
| Create | `frontend/src/workspace/equipmentTreeProjection.ts` | 只读合并已知 demo 风扇类别，保留每个原始子节点 categoryId / objectId |
| Modify | `frontend/src/workspace/physicalNavigation.ts` | `buildPhysicalTreeModel` 目前将 `object.experiments` 中非内部项渲染为 kind=configuration，需移出树；旧来源路由仍保留 |
| Modify | `frontend/src/workspace/BusinessSidebar.tsx` | 目前只显示 `buildPhysicalTreeModel`；增加 CFG 分类 section，固定“物理对象”“试验构型”两块 |
| Modify | `frontend/src/workspace/PhysicalObjectsPage.tsx` | 旧历史试验布置在对象详情中可访问，保持旧路由；演示类别跳转后的面包屑用浏览上下文显示 |
| Modify | `frontend/src/workspace/trialConfigurationModel.ts` | 给 CFG 增加可选 `categoryId?:string`，不改变成员身份和角色 |
| Modify | `frontend/src/workspace/trialConfigurationStore.ts` | 增加用户维护的类别列表和选择；旧 CFG 不要求分类 |
| Create | `frontend/src/workspace/cfgCategoryModel.ts` | 纯函数根据类别与 CFG 构建分类索引，保留未分类 |
| Modify | `frontend/src/workspace/TrialConfigurationLibrary.tsx` | 分类筛选、创建/重命名类别、类别下 CFG 列表 |
| Modify | `frontend/src/workspace/TrialConfigurationEditor.tsx` | 可选分类字段，装备选项继续引用 `flattenEquipment` 原始 ID |
| Reuse | `frontend/src/workspace/demoData.ts` | 现有样例：`demo-category-fan` 包含 demo-fan-A/B；不在本轮重写原数据 |
| Test | `frontend/tests/equipmentTreeProjection.test.mjs`、`physicalNavigation.test.mjs`、`cfgCategoryModel.test.mjs`、`trialConfiguration.test.mjs`、`demoData.test.mjs` | 只读投影与分类归属验证 |
| Verify | `frontend/scripts/verify-object-categories.mjs`、`verify-physical-navigation.mjs`、`verify-cfg-model-flow.mjs` | 浏览器源 ID / 点击 / CFG 引用验证 |
| Create | `docs/verification/2026-10-23-equipment-tree-cfg-category-browser.md` | 真实验证证据 |

### Task 1: 只读的演示装备树投影，保留实际身份

**Files:** Create `frontend/src/workspace/equipmentTreeProjection.ts`; Test `frontend/tests/equipmentTreeProjection.test.mjs`.

**Interfaces:** `EquipmentCategoryView = { id:string; name:string; sourceCategoryIds:string[]; configurations:PhysicalConfiguration[] }`；`getEquipmentCategoryViews(categories:PhysicalObject[]):EquipmentCategoryView[]`。返回的是浏览聚合类别，真实路由来源仍以旧 `findObjectCategory` 为准。

**Acceptance:** 已知 `demo-category-fan` 的 A/B 与正式“涵道风扇”显示同组，原始对象数组和 ID 不变；未安装演示数据时同样正常；用户创建的同名类别不得被误并；其它正式类别不受影响。

- [ ] **Step 1: 新增失败测试**：

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const api = await loadWorkspace("export * from './src/workspace/equipmentTreeProjection';");
test('known demo fan category joins fan view but never changes input identities', () => {
  const items = [
    { id:'category-fan',name:'涵道风扇',configurations:[{id:'real-fan',name:'风扇1'}] },
    { id:'demo-category-fan',name:'涵道风扇（演示）',configurations:[{id:'demo-fan-A',name:'风扇 A'}] },
    { id:'user-demo',name:'涵道风扇（演示）',configurations:[{id:'custom',name:'用户设备'}] },
  ];
  const before = structuredClone(items);
  const views = api.getEquipmentCategoryViews(items);
  assert.deepEqual(views.find(v=>v.id==='category-fan').configurations.map(v=>v.id),['real-fan','demo-fan-A']);
  assert.ok(views.some(v=>v.id==='user-demo'));
  assert.deepEqual(items,before);
});
~~~

- [ ] **Step 2: 验证 RED**。Run: `cd frontend && node --test tests/equipmentTreeProjection.test.mjs`。Expected: FAIL（文件尚未存在）。
- [ ] **Step 3: 编写只读分类聚合**：

~~~ts
import type { PhysicalObject, PhysicalConfiguration } from './physicalObjectStore';
export interface EquipmentCategoryView {
  id: string;
  name: string;
  sourceCategoryIds: string[];
  configurations: PhysicalConfiguration[];
}
export function getEquipmentCategoryViews(categories: PhysicalObject[]): EquipmentCategoryView[] {
  const result: EquipmentCategoryView[] = [];
  for (const category of categories) {
    const isKnownDemo = category.id === 'demo-category-fan' &&
      category.name === '涵道风扇（演示）';
    const parent = isKnownDemo ? result.find(item => item.name === '涵道风扇') : undefined;
    if (parent) {
      parent.sourceCategoryIds.push(category.id);
      parent.configurations.push(...category.configurations);
    } else {
      result.push({ id: category.id, name: category.name,
        sourceCategoryIds:[category.id], configurations:[...category.configurations] });
    }
  }
  const regular = result.find(item => item.id === 'category-fan');
  const demo = result.find(item => item.id === 'demo-category-fan');
  if (regular && demo && demo.name === '涵道风扇（演示）') {
    regular.sourceCategoryIds.push(...demo.sourceCategoryIds);
    regular.configurations.push(...demo.configurations);
    result.splice(result.indexOf(demo),1);
  }
  return result;
}
~~~

注意：真实 tree builder 在聚合展示时还必须保留每个子节点原来的 source category ID，不能单凭返回的 `view.id` 当作全部子节点的类别 ID；Task 2 负责该路由绑定。

- [ ] **Step 4: 验证并提交**。Run: `cd frontend && node --test tests/equipmentTreeProjection.test.mjs tests/demoData.test.mjs && npm run build`。Expected: PASS。

~~~bash
git add frontend/src/workspace/equipmentTreeProjection.ts frontend/tests/equipmentTreeProjection.test.mjs
git commit -m "feat: add non-destructive equipment category presentation"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 正式/演示合并、用户同名不误并、原引用不变的直接测试都已指定。

### Task 2: 物理树只显示对象和组成，旧试验布置留在详情

**Files:** Modify `frontend/src/workspace/physicalNavigation.ts`、`BusinessSidebar.tsx`、`PhysicalObjectsPage.tsx`; Test `frontend/tests/physicalNavigation.test.mjs`; Verify `frontend/scripts/verify-physical-navigation.mjs`、`verify-object-categories.mjs`.

**Interfaces:** `buildPhysicalTreeModel(objects)` 接收原始对象树，内部使用 Task 1 `getEquipmentCategoryViews` 计算显示分组；树节点保留原始 `categoryId`、`id`。`resolvePhysicalNavigation` 不变。

**Acceptance:** 左侧涵道风扇展开可同时看到用户风扇和 demo A/B，任意风扇下的转子/静子/机匣继续为树形子节点；不再有“静推力构型 A/变转速构型 A”这样的历史试验布置树节点；旧来源链接仍能打开相应试验布置、记录和 CSV。

- [ ] **Step 1: 更新失败测试**。将 `physicalNavigation.test.mjs` 中原“树保留 test-configuration 层”断言改为以下可验证业务结构：

~~~js
test('the object tree contains only object and category nodes', () => {
  const tree = api.buildPhysicalTreeModel(objects);
  const kinds = (items) => items.flatMap(n => [n.kind, ...kinds(n.children)]);
  assert.deepEqual([...new Set(kinds(tree))].sort(), ['category','object']);
  assert.equal(tree[0].children[0].children.some(n => n.id === 'setup-a'), false);
  assert.equal(resolvePhysicalNavigation(objects, query()).experiment.id, 'setup-a');
});
~~~

- [ ] **Step 2: 验证 RED**。Run: `cd frontend && node --test tests/physicalNavigation.test.mjs`。Expected: FAIL（旧树仍有 kind=configuration）。
- [ ] **Step 3: 移除树中的旧 ExperimentDefinition 显示**。在 `physicalNavigation.ts` 的 `buildObject` 中将 `children` 表达式改为仅递归真实的组成对象：

~~~ts
children: [
  ...(object.children ?? []).map(child => buildObject(child, categoryId, object.id)),
  ...('configurations' in object
    ? ((object as PhysicalObject).configurations ?? []).map(child => buildObject(child,categoryId,object.id))
    : []),
],
~~~

保留 `resolvePhysicalNavigation` 的 experimentId/recordId 路由解析，不能删除旧数据。在树入口对 Task 1 投影后的展示分组渲染子对象，但构造每个 demo 子节点时必须使用其原始 `demo-category-fan` ID：可通过按原始 categories 建立 `Map<objectId,categoryId>`，而不是把展示组 ID 当来源。侧边栏原来根据 `source.experiment` 生成 kind=configuration 的 selected key 改为选中所属真实对象的 key；点击 demo A/B 不改变旧 URL 中的原始 categoryId。若演示类别详情显示重复“演示”分类标题，可只修改页面显示别名，禁止更改持久化原名。

- [ ] **Step 4: 回归并提交**。Run: `cd frontend && node --test tests/physicalNavigation.test.mjs tests/equipmentComposition.test.mjs tests/demoData.test.mjs && npm run build`。Expected: PASS。浏览器需实测点击 demo A/B、普通风扇、转子三级和原历史试验链接均正常。

~~~bash
git add frontend/src/workspace/physicalNavigation.ts frontend/src/workspace/BusinessSidebar.tsx frontend/src/workspace/PhysicalObjectsPage.tsx frontend/tests/physicalNavigation.test.mjs
git commit -m "refactor: keep object tree separate from legacy trial setups"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 不显示旧布置是负向测试，旧链接、真实对象与 demo ID 一致则由源解析单测及浏览器共同验证。

### Task 3: CFG 分类由用户维护，不由组合角色推断

**Files:** Create `frontend/src/workspace/cfgCategoryModel.ts`; Modify `frontend/src/workspace/trialConfigurationModel.ts`、`trialConfigurationStore.ts`; Test `frontend/tests/cfgCategoryModel.test.mjs`、`trialConfiguration.test.mjs`.

**Interfaces:** `CfgCategory = { id:string;name:string }`；给 `TrialConfiguration` 添加可选 `categoryId?:string`；`listCfgCategoryGroups(categories:CfgCategory[], cfgs:TrialConfiguration[]):{id:string;name:string;cfgIds:string[]}[]`；store 增加 `categories`、`createCategory(name:string):string`、`setConfigurationCategory(cfgId:string,categoryId?:string):void`。

**Acceptance:** 旧 CFG 没有 categoryId 仍然存在并可选择；一个 CFG 属于用户指定的分类或“未分类”，更改分类不更改 CFG 成员、模型方案与成果引用；任何类别均可引用任何装备成员，不能由角色猜测其所属分类。

- [ ] **Step 1: 新建失败测试**：

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { loadWorkspace } from './helpers/workspaceTest.mjs';
const api = await loadWorkspace("export * from './src/workspace/cfgCategoryModel';");
test('categories are user-assigned; missing category stays visible', () => {
  const groups = api.listCfgCategoryGroups(
    [{id:'aero',name:'气动试验'}],
    [{id:'cfg-1',name:'A',categoryId:'aero',members:[]},
     {id:'cfg-2',name:'B',members:[]}],
  );
  assert.deepEqual(groups.find(g=>g.id==='aero').cfgIds,['cfg-1']);
  assert.deepEqual(groups.find(g=>g.id==='unclassified').cfgIds,['cfg-2']);
});
~~~

- [ ] **Step 2: 验证 RED**。Run: `cd frontend && node --test tests/cfgCategoryModel.test.mjs`。Expected: FAIL。
- [ ] **Step 3: 实现纯分类关系**：

~~~ts
import type { TrialConfiguration } from './trialConfigurationModel';
export interface CfgCategory { id:string; name:string }
export interface CfgCategoryGroup { id:string; name:string; cfgIds:string[] }
export function listCfgCategoryGroups(
  categories: CfgCategory[], cfgs: TrialConfiguration[],
): CfgCategoryGroup[] {
  const groups: CfgCategoryGroup[] = categories.map(c => ({ ...c, cfgIds:[] }));
  groups.push({id:'unclassified',name:'未分类',cfgIds:[]});
  for (const cfg of cfgs) {
    const group = groups.find(c => c.id === cfg.categoryId) ??
      groups.find(c => c.id === 'unclassified')!;
    group.cfgIds.push(cfg.id);
  }
  return groups;
}
~~~

在 `trialConfigurationModel.ts` 的 `TrialConfiguration` 加入 `categoryId?:string`；在 `trialConfigurationStore.ts` 接入 `categories:[]`，新分类 ID 用 `cfg-category-` + crypto.randomUUID()，拒绝空名/重名；`setConfigurationCategory` 必须验证 cfgId、categoryId 合法，未分类传 undefined。存储继续用现有 `protangram-trial-configurations-v1`，保持向后兼容的默认合并；不改变成员 ids。将 store 分类 CRUD 的新增/重载/无效 ID 测试补进 `trialConfiguration.test.mjs`。

- [ ] **Step 4: 验证并提交**。Run: `cd frontend && node --test tests/cfgCategoryModel.test.mjs tests/trialConfiguration.test.mjs && npm run build`。Expected: PASS。

~~~bash
git add frontend/src/workspace/cfgCategoryModel.ts frontend/src/workspace/trialConfigurationModel.ts frontend/src/workspace/trialConfigurationStore.ts frontend/tests/cfgCategoryModel.test.mjs frontend/tests/trialConfiguration.test.mjs
git commit -m "feat: add user-managed CFG category index"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 明确分类/未分类/失效分类均可显示、分类不改变组成和来源，由纯测试及 store 回归覆盖。

### Task 4: 左侧 CFG 只列分类，中央复用 CFG 编辑器和对象检索

**Files:** Modify `frontend/src/workspace/BusinessSidebar.tsx`、`TrialConfigurationLibrary.tsx`、`TrialConfigurationEditor.tsx`、`router/index.tsx`（若需要确保分类查询参数能够保留）; Test `frontend/tests/trialConfiguration.test.mjs`、`physicalNavigation.test.mjs`; Verify `frontend/scripts/verify-cfg-model-flow.mjs`。

**Interfaces:** 接入 Task 3 `listCfgCategoryGroups` 及 store 的 `setConfigurationCategory`。URL 采用现有 `/trial-configurations?categoryId=<id>`，不增加一套管理路由；CFG 成员继续由 `flattenEquipment` 提供 ID 与展示路径。

**Acceptance:** 左侧“物理对象”与“试验构型”独立；试验构型区只展开分类，点击后中央显示该类 CFG，未分类也可查；新建 CFG 使用已有编辑器从物理对象所有层级选择成员，选类不限制成员来源；选择 CFG 的专业功能仍依赖用户亲自选择，而不是分类自动选中。

- [ ] **Step 1: 新增 UI RED 验收**。在浏览器脚本中先断言左侧存在“试验构型”分类区，且该区不会直接把 CFG-07 作为实体树节点；旧界面失败。
- [ ] **Step 2: 生成类别导航**。在 `BusinessSidebar.tsx` 从分类 store 和 CFG list 创建：

~~~tsx
const groups = listCfgCategoryGroups(cfgCategories, cfgs);
const cfgNav = <section className="session-nav-section">
  <div className="session-section-label">试验构型</div>
  {groups.map(group => <button className="session-sidebar-link"
    key={group.id} onClick={() => open('/trial-configurations?categoryId=' +
      encodeURIComponent(group.id))}>{group.name}</button>)}
</section>;
~~~

将 `cfgNav` 插入物理对象区之后；不要把 CFG 子实体塞回 `Tree`。用真实的 Zustand 选择器取得 `cfgCategories` 和 `cfgs`，确保状态更新能刷新分类。

- [ ] **Step 3: 分类筛选与创建表单使用同一 CFG 模型**。在 `TrialConfigurationLibrary.tsx` 使用 `useSearchParams` 获取 categoryId，由 `listCfgCategoryGroups` 产生对应 cfgIds 并过滤原 list；无效 categoryId 显示可恢复的“分类不存在”提示而不是默认跳到其它 CFG。新建 CFG 时向 `TrialConfigurationEditor` 传当前分类作为初始字段；编辑器增加可选分类 Select，列出用户创建的类别，保存回 `TrialConfiguration.categoryId`。用户选择其它分类只改变分类关联，不改变被试/供电/试验台等成员。对已有 CFG 的分类调整调用 `setConfigurationCategory`，不调用 `createConfiguration` 复制一个新 CFG。

- [ ] **Step 4: 构建与浏览器验收**。Run: `cd frontend && node --test tests/cfgCategoryModel.test.mjs tests/trialConfiguration.test.mjs tests/physicalNavigation.test.mjs && npm run build`。Expected: PASS。浏览器验证类别“气动试验”下用三级叶片作为某角色、另用一级试验台作为成员成功保存 cfgId；没有陪试件也成功；点击旧试验链接仍有数据；两个同名对象可单独选择。

~~~bash
git add frontend/src/workspace/BusinessSidebar.tsx frontend/src/workspace/TrialConfigurationLibrary.tsx frontend/src/workspace/TrialConfigurationEditor.tsx frontend/src/router/index.tsx
git commit -m "feat: organize CFG categories separately from equipment tree"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 分类导航、同一编辑器、跨层级按 ID 引用、不自动按分类定 CFG、无陪试件创建由浏览器验证。

### Task 5: 端到端树/CFG 关系验收和保留旧数据

**Files:** Verify `frontend/scripts/verify-object-categories.mjs`、`verify-physical-navigation.mjs`、`verify-cfg-model-flow.mjs`; Test `frontend/tests/demoData.test.mjs`、`equipmentComposition.test.mjs`、`physicalNavigation.test.mjs`、`cfgCategoryModel.test.mjs`; Create `docs/verification/2026-10-23-equipment-tree-cfg-category-browser.md`。

**Interfaces:** 不增加生产接口；所有变更在 Tree 导航和既有 CFG 库内完成。

**Acceptance:** 原始用户存储不被清理/迁移；演示 A/B 显示在同一个“涵道风扇”浏览组，但原始演示 ID、已有试验记录、CSV 和任务来源仍有效；旧“静推力构型 A”不出现于对象树，却仍能从历史试验访问；CFG 从任意层级物理对象引用并按类别组织。

- [ ] **Step 1: 全量回归**：

~~~bash
cd frontend
node --test tests/*.test.mjs
npm run build
npm run lint
git diff --check
~~~

Expected: tests/build PASS；Lint 如果原仓库存在基线问题，记录与基线的差值及修改文件新增告警，而不声明全部通过。

- [ ] **Step 2: 隔离浏览器逐场景核对**。在**隔离 profile**下运行现有 verify-object-categories/verify-physical-navigation/verify-cfg-model-flow 的适配用例，至少核对：演示与真实风扇合并显示、点击两者均正确打开、旧 URL 正常、从风扇三级部件选择任意成员新建 CFG、分类内列表正确、已有 CFG 未分类仍可选择、取消新建不写入 CFG、重新加载后层级仍稳定。运行前检查脚本要求的 Vite 端口和 Playwright 安装路径，不用假路径制造通过日志。
- [ ] **Step 3: 写证据并提交**。记录真实截图、对象原始 id/categoryId、CFG id/categoryId、旧实验链接、测试命令及退出码至 `docs/verification/2026-10-23-equipment-tree-cfg-category-browser.md`；不要先写“全通过”。

~~~bash
git add frontend/scripts/verify-object-categories.mjs frontend/scripts/verify-physical-navigation.mjs frontend/scripts/verify-cfg-model-flow.mjs docs/verification/2026-10-23-equipment-tree-cfg-category-browser.md
git commit -m "test: verify equipment tree and CFG category ownership"
~~~

**Coverage Gate: COVERAGE_COMPLETE** — 旧数据未动（前后状态快照）、树中的正/反节点、来源 ID、CFG 跨层级引用、未分类保留均有独立验证途径。

## Per-Task Coverage Review

| Task | 核验范围 | 证据 | Gate |
| --- | --- | --- | --- |
| 1 | 已知 demo 类别合并显示、输入不变、同名用户类别不被合并 | `equipmentTreeProjection.test.mjs` | COVERAGE_COMPLETE |
| 2 | 物理树无旧 ExperimentDefinition、原链接不失效 | `physicalNavigation.test.mjs` + 浏览器链接检查 | COVERAGE_COMPLETE |
| 3 | CFG 人工分类、无分类可用、变更不影响组成 | `cfgCategoryModel.test.mjs` + CFG store tests | COVERAGE_COMPLETE |
| 4 | 两类导航独立，CFG 从 OBJ 树跨层级选装备 | CFG UI 浏览器脚本 + 回归 | COVERAGE_COMPLETE |
| 5 | 演示与用户数据保持、历史记录与共享成果仍可用 | 全量测试 + 独立浏览器和源 ID 截图 | COVERAGE_COMPLETE |

这些 Gate 表示本计划已设计直接证据，不表示任务已执行或测试结果已通过。

## Self-Review / Execution Handoff

- XMind 的独立 OBJ/CFG 关系没有被“左侧树层级”反过来限制；CFG 分类是查找用途，不是装备角色判断依据。
- 没有把旧 `ExperimentDefinition` 自动改造成新 CFG，也不做存储迁移；demo 整理先改展示而不是覆盖老用户数据。
- 本计划与“功能内手选 CFG”计划可独立执行；二者都修改 CFG UI 时，执行前重新读取最新源码并处理实际接口变化。
- 不新建 Spec，不改后端。可用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 执行，按 Task RED → 实现 → GREEN → Commit。
