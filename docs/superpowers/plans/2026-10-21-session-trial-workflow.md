# ProTangram 会话与试验工作流实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (\`- [ ]\`) syntax for tracking.

**Goal:** 让“新会话”入口真正创建会话记录，并在项目资源中按具体试验组织执行记录、CSV 和专业成果；保留现有数据归属，不引入跨项目引用具体试验的新关系。

**Architecture:** WorkSession 负责工作上下文与项目归属；PhysicalObjectStore 继续拥有具体试验、执行记录、原始 CSV、数据表和图表。项目中的“工作内容与试验”是基于现有项目会话和成果来源关系生成的只读视图，不复制或迁移试验数据。具体试验是执行记录的父级；专业成果按现有来源信息归属到具体试验或执行记录。

**Tech Stack:** React、TypeScript、Ant Design、React Router、Zustand persist/localStorage、Node.js test runner、esbuild；沿用仓库现有浏览器验收方式。

**Spec:** docs/superpowers/specs/2026-09-04-unified-project-workspace-design.md 中仍兼容的数据归属与独立使用原则；本计划“已确认业务约束”覆盖旧设计中与当前会话优先导航不一致的部分。

## Global Constraints

- “项目不是所有能力的前置条件。模型校准、数据分析、虚拟工况等仍可独立进入。”
- “业务执行先产生 Draft；只有明确确认/保存后才进入 Project。”
- “Draft 不进入项目树、不计入项目统计、不参与项目最近结果。”
- “后端 API 暂不改，本轮由前端 Zustand + persist/localStorage 统一状态。”
- 不新增后端接口、数据库表、外部依赖或数据迁移。
- 不创建第二份具体试验、执行记录、CSV 或图表；所有视图都引用现有稳定 ID。
- 任务书关联是可选项；没有任务书的具体试验仍必须能被项目会话和独立会话访问。
- 本期不实现“把已有具体试验直接关联到多个项目”的新选择器、新关系模型或迁移逻辑。
- 不自动拆解任务书；任务书原文与关联信息可作为可选附录，AI 拆解任务项不属于本计划。

---

## Plan Decomposition

### Plan 1：会话入口与项目试验目录

- **Goal:** 修正“新会话”入口语义，并让项目资源能够浏览当前已关联的具体试验。
- **Independent deliverable:** 点击“最近会话”旁的加号会创建并打开一条 WorkSession；项目中出现“工作内容与试验”视图，按具体试验汇总已有执行记录及来源成果。
- **Spec semantics covered:** 独立使用、项目可选、Draft/正式成果边界、试验与执行记录的数据归属。
- **Dependencies:** 当前 WorkSession、PhysicalObjectStore、ProjectArtifact 和物理来源解析逻辑。
- **Implementation prerequisites:** 已满足；当前源码已有相应 Store、稳定 ID、来源解析函数和测试工具。

本次只详细规划 Plan 1。允许一个项目查看由该项目现有会话或该项目成果来源明确关联的试验；不提供从其他项目挑选已有具体试验的入口。

## Implementation Roadmap

- **当前计划：会话入口与项目试验目录。** 完成后可以从侧栏新建会话，并从项目资源中查看已有项目会话关联的具体试验、执行记录及成果。
- **后续候选计划：跨项目引用已有具体试验。** 本期不实施、不预设关系模型。只有在明确批准该扩展后，才单独定义项目与具体试验的关联生命周期、权限/删除行为、来源冲突规则及验收标准。
- **后续候选计划：AI 任务拆解。** 本期不实施自动解析或生成任务项；先保留任务书原文和现有任务关联能力。

## Current Source Findings

- frontend/src/workspace/BusinessSidebar.tsx 中“最近会话”旁已有加号，但当前 startSession 直接导航到 /trials/new，实际启动的是“创建具体试验”，不是创建 WorkSession。
- frontend/src/workspace/sessionStore.ts 的 createSession 已创建并持久化 WorkSession；openSession 可以切换其当前能力。空会话进入 DOE 工作台时，SessionWorkbench 会提示先创建具体试验，不需要提前创建试验。
- frontend/src/workspace/physicalObjectStore.ts 中 ConcreteTrial 持有 records 和 charts；TestRecord 持有 rawFiles 与 tables；图表通过 sourceRecordId 指向真实执行记录。
- frontend/src/workspace/sessionModel.ts 中 WorkSession.businessScope 保存物理对象、试验构型、具体试验和执行记录的来源 ID；storageProjectId 与 projectId 的含义不同，不能混用。
- frontend/src/workspace/ProjectContent.tsx 的项目概览已通过会话 businessScope 和成果 sourceScope 找到相关试验，但尚无独立的“工作内容与试验”导航视图。
- frontend/src/workspace/taskTrialModel.ts 将任务书下的试验作为现有物理对象数据的实时投影，不复制试验或执行记录；ConcreteTrial.taskBookId 为可选字段。
- 项目创建具体试验时，frontend/src/workspace/TrialCreatePage.tsx 通过 projectId 创建项目会话并保存试验来源；任务书可以留空。当前 UI 没有从另一个项目直接选择已有具体试验的入口。

## Agreed Business Structure

项目资源中的“工作内容与试验”按以下关系呈现，而不是把具体试验与执行记录拆成同级分类：

~~~text
项目
├── 项目概览
├── 工作内容与试验
│   └── 具体试验
│       ├── 执行记录
│       │   ├── 第 1 次执行记录
│       │   │   ├── CSV 文件 / 派生数据表
│       │   │   └── 本次记录关联的图表与分析成果
│       │   └── 第 N 次执行记录
│       └── 专业功能及成果
│           └── 仅展示来源能对应到当前具体试验的成果
└── 其他项目成果
~~~

约束说明：

1. 具体试验是稳定的业务对象；执行记录是其子项。打开具体试验后查看该试验的多次执行记录，不新增与具体试验并列的“执行记录”根节点。
2. 每次执行记录只展示自己拥有的 CSV、派生数据表，以及能由来源 ID 确认属于该记录的成果。不能因为文件名相同、当前会话相同或页面相邻而推断来源。
3. 专业功能沿用当前会话和具体试验上下文。结果列表可汇总成果，但每项成果仍保留真实 sourceScope、artifact ID、record ID；不复制成果到新的“项目试验”存储。
4. 任务书与关联信息是可选附录。无 taskBookId 的试验不隐藏、不阻断，也不需要创建虚假任务书。
5. 项目视图仅投影当前已有的项目会话关系或项目成果来源关系；不提供“引用其他项目已有试验”的新入口，也不因此创建 ProjectTrial 关系对象。

## File Structure

- Modify: frontend/src/workspace/BusinessSidebar.tsx — 将“最近会话”加号改为创建 WorkSession 并打开空会话工作台，不再跳转到创建具体试验页。
- Create: frontend/src/workspace/projectTrialModel.ts — 从当前项目的会话 businessScope 和项目成果 sourceScope 派生具体试验目录；按稳定 ID 去重，来源失效时不猜测替代对象。
- Create: frontend/src/workspace/ProjectTrialsView.tsx — 展示具体试验、嵌套执行记录、CSV/表格概况、专业成果及可选任务书关联。
- Modify: frontend/src/workspace/types.ts — 增加 ProjectView 值 trials。
- Modify: frontend/src/workspace/projectModel.ts — 在项目导航中增加“工作内容与试验”视图入口。
- Modify: frontend/src/workspace/ProjectSidebar.tsx — 项目资源目录显示该视图；会话资源抽屉仍保持当前会话的资源范围，不出现项目级试验目录入口。
- Modify: frontend/src/workspace/ProjectContent.tsx — 增加视图标题和 ProjectTrialsView 分支，不改变已有 overview、CSV 成果目录和 ArtifactHistory 行为。
- Create: frontend/tests/projectTrialModel.test.mjs — 覆盖来源解析、项目范围、去重、嵌套执行记录、无任务书试验及失效来源。
- Modify: frontend/tests/projectCreationEntry.test.mjs — 回归检查侧栏新会话按钮不再直接导航到 /trials/new。
- Existing verification: frontend/tests/sessionWorkbench.test.mjs、frontend/tests/physicalNavigation.test.mjs、frontend/tests/taskTrialIntegration.test.mjs、frontend/tests/crossFunctionSharing.test.mjs。

## Task 1: Correct the New-Session Entry

**Files:**
- Modify: frontend/src/workspace/BusinessSidebar.tsx
- Modify: frontend/tests/projectCreationEntry.test.mjs
- Test: frontend/tests/sessionWorkbench.test.mjs

**Interfaces:**
- Consumes: useSessionStore.getState().createSession、openSession、sessionModel.ts 中的 getSessionPath。
- Produces: 点击“新建会话”后，一条持久化 WorkSession 被创建并打开；此动作不创建 ConcreteTrial、TestRecord 或 CSV。

**Acceptance:**
- 加号的行为是创建会话记录，而不是进入具体试验创建表单。
- 新会话打开后可看到“请先创建具体试验”的引导；具体试验只在用户主动执行创建流程后产生。
- 新会话保留独立使用能力，不要求项目或任务书。
- 刷新后会话记录仍存在，且未产生新的具体试验或执行记录。

- [ ] **Step 1: Add a failing source-contract regression**

在 frontend/tests/projectCreationEntry.test.mjs 中增加以下测试：

~~~js
test('recent-session plus creates a session instead of opening trial creation', () => {
  const sidebar = readFileSync(path.join(frontendRoot, 'src/workspace/BusinessSidebar.tsx'), 'utf8');
  assert.match(sidebar, /aria-label="新建会话"/);
  assert.match(sidebar, /createSession\\(\\{ title: '新会话' \\}\\)/);
  assert.match(sidebar, /openSession\\([^,]+, 'doe'\\)/);
  assert.match(sidebar, /getSessionPath\\([^,]+, 'doe'\\)/);
  assert.doesNotMatch(sidebar, /const startSession = \\(\\) => open\\('\\/trials\\/new'\\)/);
});
~~~

- [ ] **Step 2: Run the regression and confirm it fails before implementation**

Run from frontend:

~~~bash
node --test tests/projectCreationEntry.test.mjs
~~~

Expected: the new test fails because startSession currently navigates directly to /trials/new and does not create a WorkSession.

- [ ] **Step 3: Change the session action**

在 BusinessSidebar.tsx 中从 sessionModel 引入 getSessionPath，并将 startSession 改为：

~~~tsx
const startSession = () => {
  const sessionId = useSessionStore.getState().createSession({ title: '新会话' });
  useSessionStore.getState().openSession(sessionId, 'doe');
  open(getSessionPath(sessionId, 'doe'));
};
~~~

保留现有“最近会话”加号及其 aria-label；不要在该回调中调用 addConcreteTrial、addTrialRecord 或 /trials/new。

- [ ] **Step 4: Run the focused tests**

~~~bash
node --test tests/projectCreationEntry.test.mjs tests/sessionWorkbench.test.mjs
~~~

Expected: all tests pass. The session-store test must continue proving independent sessions have separate storage projects and retain their drafts after reload.

- [ ] **Step 5: Verify the actual user flow**

启动前端后，在浏览器中点击左侧“最近会话”旁的加号。确认 URL 进入新的 /sessions/<id>/doe，页面提示先创建具体试验；刷新后仍打开同一会话。对比点击前后的 protangram-physical-objects-v1，确认没有新增 ConcreteTrial 或 TestRecord。随后点击页面中的“创建具体试验”，确认只有该明确动作才进入 /trials/new。

- [ ] **Step 6: Commit the isolated change**

~~~bash
git add frontend/src/workspace/BusinessSidebar.tsx frontend/tests/projectCreationEntry.test.mjs
git commit -m "fix: create a session from the recent-session action"
~~~

**Per-Task Coverage Review:** 按钮语义由源码回归测试覆盖；实际路由与持久化由浏览器流程覆盖；未创建试验的负向约束通过比较物理对象 Store 前后状态直接验证。

**Coverage result: COVERAGE_COMPLETE**

## Task 2: Build the Project-Trial Projection Model

**Files:**
- Create: frontend/src/workspace/projectTrialModel.ts
- Create: frontend/tests/projectTrialModel.test.mjs
- Reuse: frontend/src/workspace/physicalBusinessContext.ts
- Reuse: frontend/src/workspace/sessionModel.ts
- Reuse: frontend/src/workspace/physicalObjectStore.ts

**Interfaces:**
- Consumes: projectId、PhysicalObject[]、Project[]、WorkSession[]。
- Produces: ProjectTrialEntry[]；每个条目包含实际类别、具体物理对象、试验构型、ConcreteTrial 及关联会话；执行记录仍直接读取 trial.records。

**Acceptance:**
- 仅从当前项目已有的会话 businessScope 或该项目成果的 sourceScope 找到具体试验；不增加新的项目—试验关系模型。
- 同一项目内多个会话指向同一具体试验时只显示一个具体试验条目。
- 具体试验下的 records 完整保留且不被复制；无任务书的具体试验正常出现。
- 失效的来源 ID 不得回退到同名对象、其他构型或其他执行记录。

- [ ] **Step 1: Add failing projection tests**

新建 frontend/tests/projectTrialModel.test.mjs，先以以下 fixture 和断言定义预期行为。测试通过 esbuild 将 TypeScript 模型打包后导入，与现有模型测试保持一致。

~~~js
import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';

const bundled = await build({
  stdin: {
    contents: \"export * from './src/workspace/projectTrialModel';\",
    resolveDir: process.cwd(),
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const api = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));

const objects = [{
  id: 'category-1', name: '涵道风扇', configurations: [{
    id: 'object-1', name: '风扇 A', experiments: [{
      id: 'setup-1', name: '性能试验构型', trials: [
        { id: 'trial-1', name: '推力试验', records: [
          { id: 'record-1', executionNumber: 1, rawFiles: [], tables: [] },
          { id: 'record-2', executionNumber: 2, rawFiles: [], tables: [] },
        ], charts: [] },
        { id: 'trial-2', name: '独立试验', records: [], charts: [] },
      ],
    }],
  }],
}];
const projects = [
  { id: 'project-a', artifacts: [] },
  { id: 'project-b', artifacts: [] },
];
const scope = { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-1' };
const sessions = [
  { id: 'session-a1', projectId: 'project-a', storageProjectId: 'project-a', businessScope: scope },
  { id: 'session-a2', projectId: 'project-a', storageProjectId: 'project-a', businessScope: scope },
  { id: 'session-b', projectId: 'project-b', storageProjectId: 'project-b',
    businessScope: { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-2' } },
];

test('project trial view deduplicates sessions and retains nested execution records', () => {
  const entries = api.getProjectTrialEntries('project-a', objects, projects, sessions);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].trial.id, 'trial-1');
  assert.deepEqual(entries[0].trial.records.map(record => record.id), ['record-1', 'record-2']);
  assert.equal(entries[0].sessions.length, 2);
});

test('a trial without taskBookId remains visible in its project', () => {
  const entries = api.getProjectTrialEntries('project-a', objects, projects, sessions);
  assert.equal(entries[0].trial.taskBookId, undefined);
});

test('another project trial is not included without a project-local session or artifact source', () => {
  assert.deepEqual(api.getProjectTrialEntries('project-a', objects, projects, sessions).map(entry => entry.trial.id), ['trial-1']);
});

test('invalid source IDs do not fall back to a different trial', () => {
  const invalid = [{ id: 'bad', projectId: 'project-a', storageProjectId: 'project-a',
    businessScope: { physicalObjectId: 'object-1', experimentId: 'missing-setup', trialId: 'trial-2' } }];
  assert.deepEqual(api.getProjectTrialEntries('project-a', objects, projects, invalid), []);
});
~~~

- [ ] **Step 2: Run the model tests and confirm the missing export fails**

~~~bash
node --test tests/projectTrialModel.test.mjs
~~~

Expected: FAIL because projectTrialModel.ts does not exist yet.

- [ ] **Step 3: Implement the source projection**

新建 frontend/src/workspace/projectTrialModel.ts：

~~~ts
import type { PhysicalBusinessScope, WorkSession } from './sessionModel';
import type { ConcreteTrial, ExperimentDefinition, PhysicalConfiguration, PhysicalObject } from './physicalObjectStore';
import type { Project, ProjectArtifact } from './types';
import { resolvePhysicalSource } from './physicalBusinessContext';

export interface ProjectTrialEntry {
  category: PhysicalObject;
  object: PhysicalConfiguration;
  experiment: ExperimentDefinition;
  trial: ConcreteTrial;
  sessions: WorkSession[];
}

const artifactScope = (artifact: ProjectArtifact): PhysicalBusinessScope | undefined =>
  artifact.payload.sourceScope as PhysicalBusinessScope | undefined;

export function getProjectTrialEntries(
  projectId: string,
  objects: PhysicalObject[],
  projects: Project[],
  sessions: WorkSession[],
): ProjectTrialEntry[] {
  const project = projects.find(item => item.id === projectId);
  if (!project) return [];

  const projectSessions = sessions.filter(session =>
    session.projectId === projectId || session.storageProjectId === projectId,
  );
  const scopes = [
    ...projectSessions.map(session => session.businessScope),
    ...project.artifacts.map(artifactScope),
  ].filter((scope): scope is PhysicalBusinessScope =>
    Boolean(scope?.physicalObjectId && scope.experimentId && (scope.trialId || scope.testRecordId)),
  );

  const entries = new Map<string, ProjectTrialEntry>();
  for (const scope of scopes) {
    const source = resolvePhysicalSource(objects, scope);
    if (source.missing || !source.family || !source.configuration || !source.experiment || !source.trial) continue;

    const key = [source.configuration.id, source.experiment.id, source.trial.id].join(':');
    const linkedSessions = projectSessions.filter(session => {
      const candidate = session.businessScope;
      return candidate?.physicalObjectId === source.configuration!.id
        && candidate.experimentId === source.experiment!.id
        && (candidate.trialId === source.trial!.id
          || Boolean(candidate.testRecordId && source.trial!.records.some(record => record.id === candidate.testRecordId)));
    });
    const existing = entries.get(key);
    if (existing) {
      existing.sessions = [...new Map([...existing.sessions, ...linkedSessions].map(session => [session.id, session])).values()];
    } else {
      entries.set(key, {
        category: source.family,
        object: source.configuration,
        experiment: source.experiment,
        trial: source.trial,
        sessions: linkedSessions,
      });
    }
  }

  return [...entries.values()].sort((left, right) =>
    left.object.name.localeCompare(right.object.name, 'zh-CN')
      || left.experiment.name.localeCompare(right.experiment.name, 'zh-CN')
      || left.trial.name.localeCompare(right.trial.name, 'zh-CN'),
  );
}
~~~

- [ ] **Step 4: Run the projection and ownership regressions**

~~~bash
node --test tests/projectTrialModel.test.mjs tests/physicalNavigation.test.mjs tests/taskTrialIntegration.test.mjs
~~~

Expected: all tests pass. The new projection must not mutate objects, sessions, projects, records or artifacts.

- [ ] **Step 5: Commit the model and its tests**

~~~bash
git add frontend/src/workspace/projectTrialModel.ts frontend/tests/projectTrialModel.test.mjs
git commit -m "feat: derive project trial entries from existing sources"
~~~

**Per-Task Coverage Review:** Project scope is asserted by the second-project fixture; duplicate sessions are asserted by the deduplication test; nested record ownership and taskBookId optionality are asserted directly; invalid parent IDs are asserted not to resolve to a different trial.

**Coverage result: COVERAGE_COMPLETE**

## Task 3: Add the “Work Content and Trials” Project View

**Files:**
- Create: frontend/src/workspace/ProjectTrialsView.tsx
- Modify: frontend/src/workspace/types.ts
- Modify: frontend/src/workspace/projectModel.ts
- Modify: frontend/src/workspace/ProjectSidebar.tsx
- Modify: frontend/src/workspace/ProjectContent.tsx
- Test: frontend/tests/projectTrialModel.test.mjs
- Verify: frontend/tests/projectCreationEntry.test.mjs and browser workflow

**Interfaces:**
- Consumes: getProjectTrialEntries、getTrialArtifacts、collectAnalysisResults、physicalSourcePath、taskBookPath。
- Produces: a ProjectView named trials, displayed as “工作内容与试验”; trial cards contain nested execution records and source-aware professional results.

**Acceptance:**
- The project navigation includes “工作内容与试验”.
- Concrete trials are the parent entries; execution records appear inside their concrete trial, not as a sibling category.
- Each execution record shows its execution number and its own CSV/data-table references; clicking it opens the exact record by stable IDs.
- Professional results use the existing source-aware analysis result model. Missing or removed source files are not silently substituted.
- If a trial has a valid taskBookId, show an optional link to that taskbook. If no taskbook is linked, the trial remains fully usable and no empty taskbook node is created.
- Session-resource drawers do not expose the project-level trial catalog; their current-session scope remains unchanged.
- No “link existing trial from another project” control or ProjectTrial persistence is added.

- [ ] **Step 1: Add the project navigation key**

在 frontend/src/workspace/types.ts 的 ProjectView 联合类型中增加 trials。

在 frontend/src/workspace/projectModel.ts 的 buildProjectNavigation 中，在项目概览后加入：

~~~ts
{ key: project.id + ':trials', title: '工作内容与试验', view: 'trials' },
~~~

- [ ] **Step 2: Wire the new view without changing existing result views**

在 frontend/src/workspace/ProjectContent.tsx 中为 viewLabels 增加 trials 对应的“工作内容与试验”，导入 ProjectTrialsView，并在 worksheet/charts 分支之后、ArtifactHistory fallback 之前增加：

~~~tsx
if (activeView === 'trials') return <ProjectTrialsView projectId={activeProjectId} />;
~~~

在 frontend/src/workspace/ProjectSidebar.tsx 中，项目级目录显示 trials；当组件以 projectId 作为会话资源抽屉的固定范围时，过滤掉 trials：

~~~tsx
children: buildProjectNavigation(project)
  .filter(item => !projectId || item.view !== 'trials')
  .map(item => ({ key: item.key, title: item.title, isLeaf: true })),
~~~

- [ ] **Step 3: Render the trial hierarchy from the projection**

新建 ProjectTrialsView.tsx，沿用 Ant Design 的 Card、List、Button、Empty、Tag、Typography；从 Store 读取当前项目、会话、物理对象和任务书。核心数据计算如下：

~~~tsx
const entries = useMemo(
  () => getProjectTrialEntries(projectId, objects, projects, sessions),
  [projectId, objects, projects, sessions],
);
~~~

每个具体试验卡片必须从 entry.trial.records 读取执行记录；不得另建执行记录 Store。记录入口使用现有来源导航：

~~~tsx
const path = physicalSourcePath(objects, {
  physicalObjectId: entry.object.id,
  experimentId: entry.experiment.id,
  trialId: entry.trial.id,
  testRecordId: record.id,
});
if (path) navigate(path);
~~~

在每个具体试验卡片中按以下顺序展示：

1. 具体试验名称、所属物理对象/试验构型、载荷谱和执行记录数量。
2. 执行记录列表；每条记录展示 executionNumber、记录名称、有效 CSV 文件名和派生数据表数量，并提供“查看执行记录”操作。
3. “专业功能及成果”区域：使用 getTrialArtifacts(projects, sessions, scope, trial) 获取现有来源成果，再用 collectAnalysisResults(trial, artifacts) 和 AnalysisResults 渲染；不要复制 artifact 或自行拼接无来源的结果。
4. 可选任务书附录：只有 taskBookId 存在时才展示任务书关联信息和“查看任务书”入口，目标使用 taskBookPath(taskBookId)。如果 ID 不再对应现有任务，明确显示关联失效，不得自动改绑其他任务。

无试验时显示 Empty 和“在此项目中新建具体试验”按钮，按钮导航到 /trials/new?projectId=<当前项目 ID>。此操作创建新的具体试验，不提供选择其他项目已有试验的入口。

- [ ] **Step 4: Add navigation-model assertions**

在 projectTrialModel.test.mjs 或独立的项目导航测试中，调用 buildProjectNavigation，确认即使项目没有具体试验，也存在唯一的 trials 导航项；测试同一具体试验对应多个项目会话时仍只返回一个条目。

- [ ] **Step 5: Run focused tests and build**

~~~bash
node --test tests/projectTrialModel.test.mjs tests/projectCreationEntry.test.mjs tests/physicalNavigation.test.mjs tests/taskTrialIntegration.test.mjs tests/crossFunctionSharing.test.mjs
npm run test:sessions
npm run build
~~~

Expected: all focused tests pass and TypeScript/Vite production build succeeds. Existing unrelated warnings must be reported, not silently reclassified as this change's failures.

- [ ] **Step 6: Verify the rendered user flow**

在浏览器中分别验证：

- 项目 A 下已有具体试验时，“工作内容与试验”只显示一次该具体试验，展开后能看到所有执行记录。
- 点击第 N 次执行记录后，URL 中的 objectId、configurationId、experimentId、trialId、recordId 与所选来源一致。
- 试验的 CSV、图表和专业成果仍能通过原有目录查看；删除或失效的来源不会被其他文件替代。
- 无 taskBookId 的试验仍出现在项目目录中；有任务书的试验可以打开对应任务书。
- 项目 B 没有相应项目会话或来源成果时，不会因为项目 A 存在该试验而自动显示该试验。
- 会话资源抽屉中没有项目级“工作内容与试验”入口，现有当前会话成果访问不回归。
- 左侧“最近会话”加号创建会话，不会直接创建具体试验。

- [ ] **Step 7: Commit the view and navigation changes**

~~~bash
git add frontend/src/workspace/types.ts frontend/src/workspace/projectModel.ts frontend/src/workspace/ProjectSidebar.tsx frontend/src/workspace/ProjectContent.tsx frontend/src/workspace/ProjectTrialsView.tsx frontend/tests/projectTrialModel.test.mjs
git commit -m "feat: organize project content around concrete trials"
~~~

**Per-Task Coverage Review:** 新增导航项由模型测试覆盖；来源解析、去重和父子关系由 projectTrialModel.test.mjs 覆盖；实际路由、空状态、任务书可选性、当前会话范围和不跨项目自动显示由浏览器验收覆盖。对于“不创建第二份试验/记录/成果”，检查 Store 写入前后对象数量和 ID 集合一致。

**Coverage result: COVERAGE_COMPLETE**

## Task 4: Final Regression and Scope Audit

**Files:**
- Verify: frontend/src/workspace/BusinessSidebar.tsx
- Verify: frontend/src/workspace/ProjectTrialsView.tsx
- Verify: frontend/src/workspace/projectTrialModel.ts
- Verify: frontend/src/workspace/ProjectContent.tsx
- Verify: frontend/src/workspace/physicalObjectStore.ts and sessionStore.ts remain ownership sources

**Acceptance:**
- 新会话创建不产生具体试验或执行记录。
- 具体试验、执行记录、CSV、图表和专业成果仍由现有 Store 与来源 ID 管理。
- 项目目录是现有关系的投影，不创建第二份数据。
- 任务书仍然可选；AI 自动任务拆解与跨项目引用已有具体试验未进入本期实现。

- [ ] **Step 1: Run the full frontend test suite**

~~~bash
node --test tests/*.test.mjs
~~~

Expected: all tests pass. If the baseline contains unrelated failures, compare against the same main revision and document the exact pre-existing failures; do not suppress or relabel newly introduced failures.

- [ ] **Step 2: Run the production build and diff checks**

~~~bash
npm run build
git diff --check
git status --short
~~~

Expected: build passes, diff check is clean, and only files listed in this plan are changed.

- [ ] **Step 3: Review source ownership and excluded scope**

Search the diff for addConcreteTrial、addTrialRecord、sourceScope、businessScope、taskBookId and projectId. Confirm the sidebar session action creates only a WorkSession; the project view reads current sources; no new trial copy, cross-project reference model, taskbook auto-parser, backend endpoint or dependency was introduced.

- [ ] **Step 4: Commit the verified result**

~~~bash
git add frontend/src/workspace/BusinessSidebar.tsx frontend/src/workspace/projectTrialModel.ts frontend/src/workspace/ProjectTrialsView.tsx frontend/src/workspace/types.ts frontend/src/workspace/projectModel.ts frontend/src/workspace/ProjectSidebar.tsx frontend/src/workspace/ProjectContent.tsx frontend/tests/projectCreationEntry.test.mjs frontend/tests/projectTrialModel.test.mjs
git commit -m "feat: align session and trial resource navigation"
~~~

**Per-Task Coverage Review:** The complete test suite covers existing source and task integration contracts; build and diff checks cover type correctness and patch scope; manual browser checks cover actual navigation and negative conditions. The final source audit directly verifies excluded features remain absent.

**Coverage result: COVERAGE_COMPLETE**

## Self-Review

- **Spec coverage:** Standalone capability access, persisted session records, project resource navigation, source-aware artifacts and taskbook optionality are assigned to Tasks 1–4. Cross-project references and AI task decomposition are explicitly deferred and not silently treated as current requirements.
- **Placeholder scan:** No TBD/TODO or unspecified test commands remain. Browser checks have explicit expected outcomes.
- **Type consistency:** ProjectView.trials, buildProjectNavigation, ProjectSidebar and ProjectContent use the same view key; projectTrialModel returns stable ConcreteTrial references rather than copied records.
- **Negative conditions:** Tests and browser checks cover no trial creation on session click, no wrong-source fallback, no duplicate trial entries, no project B leakage without a project-local source, and no taskbook requirement.

## Execution Handoff

After saving this plan, ask the user to choose one execution mode:

1. **Subagent-Driven (recommended)** — use a fresh subagent per task and review each task before proceeding.
2. **Inline Execution** — execute the tasks in this session with checkpoints for review.
