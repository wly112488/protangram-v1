# Unified Project Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current split workbench state with one persisted ProjectWorkspace model and rebuild the shell to match the approved three-column workspace plus fixed AI panel, while wiring formal results from the four core business flows into project artifacts.

**Architecture:** Zustand persist owns Project state, migration, artifact CRUD, and current selection. A WorkspaceShell renders one integrated Header, ProjectSidebar, center Outlet/project content, and fixed AI panel. Business pages keep their existing calculation/navigation behavior; only explicit confirmation/save actions write formal ProjectArtifact records.

**Tech Stack:** React 19, TypeScript 5.9, Zustand 5, Ant Design 6, React Router 7, node:test for pure workspace model tests.

**Spec:** `docs/superpowers/specs/2026-09-04-unified-project-workspace-design.md`

## Global Constraints
- Do not change backend APIs in this iteration.
- Draft calculation results never enter the project tree or project statistics.
- Top-level capability routes remain usable without a selected project.
- Formal project writes require an explicit confirmation/save action.
- Project tree category nodes are derived from real persisted project content only.
- Existing TrialAIAssistant context, quick prompts, mock answers, and BusinessAction callbacks must remain functional.
- Remove the browser-address-bar visual shell, permanent bottom worksheet, large grid background, and separate second navigation bar.
- Visual tokens follow the approved reference: #F4F7FB/#EEF3F9 background, #FFFFFF cards, #DDE6F2 borders, #0D2043 text, #74829C secondary text, #2F80FF primary, #57C9D7 accent.

---

### Task 1: Unified project domain model and migration

**Files:**
- Create: `frontend/src/workspace/types.ts`
- Create: `frontend/src/workspace/projectModel.ts`
- Create: `frontend/src/workspace/projectStore.ts`
- Test: `frontend/tests/projectWorkspaceModel.test.ts`

**Interfaces:**
- Produces `Project`, `ProjectArtifact`, `ProjectArtifactType`, `ProjectView`, `BusinessSession`.
- Produces `migrateLegacyExperiments`, `buildProjectNavigation`, `getProjectStats`, `addArtifactToProject`, `removeArtifactFromProject`.
- Produces `useProjectStore` with `projects`, `activeProjectId`, `activeView`, `setActiveProject`, `setActiveView`, `createProject`, `importLegacyExperiment`, `setWorksheet`, `addArtifact`, `removeArtifact`.

- [ ] **Step 1: Write failing model tests** covering legacy experiment migration, category-node derivation, artifact add/remove, statistics, and no empty category nodes.
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/projectWorkspaceModel.test.ts` from `frontend`; expected failure because workspace model does not exist.
- [ ] **Step 3: Implement pure workspace types/model functions** with deterministic IDs passed by caller where needed and no browser dependency.
- [ ] **Step 4: Implement Zustand persisted store** under key `protangram-project-workspace-v1`; initialize from legacy `protangram-generated-experiments` only when unified storage is empty.
- [ ] **Step 5: Re-run model tests** and expect all pass.

### Task 2: Workspace shell, integrated header, project sidebar, and project content

**Files:**
- Create: `frontend/src/workspace/WorkspaceHeader.tsx`
- Create: `frontend/src/workspace/ProjectSidebar.tsx`
- Create: `frontend/src/workspace/ProjectOverview.tsx`
- Create: `frontend/src/workspace/ProjectContent.tsx`
- Create: `frontend/src/workspace/WorkspaceShell.tsx`
- Modify: `frontend/src/workbench/FunctionBar.tsx`
- Modify: `frontend/src/layouts/MainLayout.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- `WorkspaceHeader` embeds existing FunctionBar business behavior in the same visual header row as logo/title/user controls.
- `ProjectSidebar` consumes store selectors only and drives project/view selection.
- `ProjectContent` renders overview, worksheet, chart aggregation, and artifact-category history views.
- `WorkspaceShell` renders `Header + Sidebar + Center + AI` on every route.

- [ ] **Step 1: Add shell CSS/markup assertions to the existing model test file as pure class/token expectations where possible; verify the old implementation lacks the new shell contract.**
- [ ] **Step 2: Refactor FunctionBar** to support `variant="header"`, preserving all Popover/Modal handlers while removing its standalone bar wrapper in header mode.
- [ ] **Step 3: Build WorkspaceHeader** with brand/title, FunctionBar header variant, theme/user actions, and route-aware active nav styling.
- [ ] **Step 4: Build ProjectSidebar** with search, new/import menu, stable 250px card, category tree from `buildProjectNavigation`, and no fake nodes.
- [ ] **Step 5: Build ProjectOverview/ProjectContent** so worksheet is an explicit view, stats/recent results are store-derived, and category views show latest + history.
- [ ] **Step 6: Replace MainLayout workbench shell** with WorkspaceShell; remove address bar UI and permanent bottom worksheet behavior.
- [ ] **Step 7: Apply approved visual tokens** in `index.css`, scoped to `workspace-*` classes to avoid changing unrelated pages.

### Task 3: Convert TrialAIAssistant from Drawer to fixed workspace panel

**Files:**
- Modify: `frontend/src/components/TrialAIAssistant.tsx`
- Modify: `frontend/src/workspace/WorkspaceShell.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Keep `TrialAIAssistantProvider`, `useTrialAIAssistant`, `AIAssistantContext`, `getMockAnswer` behavior, quick actions, result actions, and session persistence semantics.
- Default rendering becomes embedded panel; below 1440px the panel can collapse to a floating trigger without changing AI logic.

- [ ] **Step 1: Extract assistant conversation body from Drawer-specific rendering while leaving context/session logic unchanged.**
- [ ] **Step 2: Render fixed `<aside className="workspace-ai-panel">` in desktop layout and responsive fallback trigger for narrow widths.**
- [ ] **Step 3: Verify context labels, quick actions, send flow, clear conversation, report action, and BusinessAction callbacks remain reachable.**

### Task 4: Wire Digital Twin and Intelligent Design formal results into Project artifacts

**Files:**
- Modify: `frontend/src/pages/analysis/DigitalTwin.tsx`
- Modify: `frontend/src/pages/experiment/design/IntelligentExperimentDesign.tsx`

**Interfaces:**
- Both pages derive `BusinessSession` from explicit route state/session helper; top navigation is standalone, project-origin navigation is project mode.
- Digital Twin: `开始校准` stays Draft; new `保存到项目` writes `calibration` artifact only after calibrated.
- Intelligent Design: recommendation generation stays Draft; existing final confirmation writes `design` artifact when project mode, or asks target project when standalone.

- [ ] **Step 1: Add pure artifact-factory tests** for calibration/design payloads in `projectWorkspaceModel.test.ts`, verify failing before factories exist.
- [ ] **Step 2: Implement artifact factories** in `projectModel.ts` and make tests pass.
- [ ] **Step 3: Add Digital Twin save action** preserving existing model-selection, calibration, export, AI and downstream navigation behavior.
- [ ] **Step 4: Add Intelligent Design confirmation write** without changing recommendation algorithm/mock behavior.

### Task 5: Wire Data Analysis and Virtual Condition formal results into Project artifacts

**Files:**
- Modify: `frontend/src/pages/analysis/projects/AnalysisExecution.tsx`
- Modify: `frontend/src/pages/analysis/VirtualConditionExtension.tsx`

**Interfaces:**
- Analysis: calculation remains Draft; `保存分析结果` writes `analysis`; `确认根因` writes `rootCause` when that decision exists.
- Virtual Condition: prediction remains Draft; `保存预测结果` writes `virtualCondition`; `生成验证试验` persists current accepted prediction before existing downstream navigation.

- [ ] **Step 1: Add analysis/root-cause/virtual artifact-factory tests and verify failure first.**
- [ ] **Step 2: Implement factories and make tests pass.**
- [ ] **Step 3: Wire AnalysisExecution explicit save/confirm actions** without auto-saving on calculation completion.
- [ ] **Step 4: Wire VirtualConditionExtension explicit save action and accepted-result behavior for validation-experiment flow.**

### Task 6: Compatibility cleanup and verification

**Files:**
- Modify/delete as needed: `frontend/src/workbench/ProjectWorkbench.tsx`, `frontend/src/workbench/projectTreeModel.ts`, `frontend/tests/projectTreeModel.test.ts`
- Temporary verification workflow only if required for remote CI; remove it after collecting results.

**Interfaces:**
- No production component may use `GeneratedExperiment`/`extraItems` as the primary project model after this task.
- Legacy localStorage remains read-only migration input.

- [ ] **Step 1: Search changed branch for primary usages of `GeneratedExperiment`, `extraItems`, old address bar shell, and permanent worksheet shell; remove/redirect obsolete production usages.**
- [ ] **Step 2: Run** `node --experimental-strip-types --test tests/projectWorkspaceModel.test.ts`.
- [ ] **Step 3: Run** `npm run build`.
- [ ] **Step 4: Run** `npm run lint` and distinguish pre-existing lint failures from introduced failures.
- [ ] **Step 5: Verify branch diff against the spec checklist and confirm AI/business routes were not removed.
