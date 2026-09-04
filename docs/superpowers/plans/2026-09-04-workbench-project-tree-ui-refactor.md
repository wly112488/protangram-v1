# Workbench Project Tree UI Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the ProTangram workbench shell around a persistent left project tree and clearer central workspace without changing existing business routes, contracts, AI behavior, or persisted backend formats.

**Architecture:** Keep `FunctionBar`, `MainLayout`, router pages, `GeneratedExperiment` persistence, and `TrialAIAssistant` as the existing business backbone. Refactor `ExperimentWorkbench` so the left project tree is always present, root-route content becomes project-aware, and child routes render through the same shell. Add a small pure tree-model helper so project-tree semantics are testable independently from React rendering.

**Tech Stack:** React 19, TypeScript 5.9, React Router 7, Ant Design 6, Vite 7, CSS in `frontend/src/index.css`, Node built-in test runner for the pure helper.

**Spec:** `docs/superpowers/specs/2026-09-04-workbench-project-tree-ui-refactor-design.md`

## Global Constraints

- This change is display-layer only.
- Keep `BusinessRouteState`, model/data/task/result contracts, cross-feature routing, DOE flows, report flows, and `TrialAIAssistant` behavior unchanged.
- Do not add a new project entity model or persist algorithm results into the project tree.
- Do not add a fixed right-side AI panel.
- Left tree may only expose content already present in the current front-end `GeneratedExperiment` data.
- Continue using the existing single `frontend/src/index.css`; do not add a new stylesheet.

---

### Task 1: Add testable project-tree view model

**Files:**
- Create: `frontend/src/workbench/projectTreeModel.ts`
- Create: `frontend/src/workbench/projectTreeModel.test.ts`

**Interfaces:**
- Consumes: a minimal `ProjectTreeExperiment` with `id`, `name`, `designSummary`, `worksheetData`, `extraItems`.
- Produces: `buildProjectTree(experiments): ProjectTreeNode[]`, `resolveProjectSelection(experiments, selectedKey): { experimentId: string | null; view: ProjectTreeView }`.

- [ ] **Step 1: Write the failing test**

Create `projectTreeModel.test.ts` with Node's test runner. Cover: project overview always exists, worksheet appears only when worksheet data exists, design summary appears when summary exists, extra items are preserved, and child selection resolves to the correct project/view.

- [ ] **Step 2: Run test to verify it fails**

Run from `frontend`:

```bash
node --experimental-strip-types --test src/workbench/projectTreeModel.test.ts
```

Expected: FAIL because `projectTreeModel.ts` does not yet exist.

- [ ] **Step 3: Write minimal implementation**

Implement only the pure tree/selection logic needed by the workbench. No React, no Ant Design, no persistence.

- [ ] **Step 4: Run test to verify it passes**

Run the same command. Expected: all project-tree model tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/workbench/projectTreeModel.ts frontend/src/workbench/projectTreeModel.test.ts
git commit -m "test: define project tree workbench semantics"
```

### Task 2: Refactor the persistent workbench shell

**Files:**
- Modify: `frontend/src/workbench/ExperimentWorkbench.tsx`

**Interfaces:**
- Consumes: existing `GeneratedExperiment`, localStorage functions, `FunctionBar`, React Router `location` and `Outlet`, plus `buildProjectTree` / `resolveProjectSelection` from Task 1.
- Produces: persistent shell `FunctionBar -> left project tree -> central root view or Outlet`.

- [ ] **Step 1: Add the helper-backed tree integration before changing layout**

Replace the current inline `createExperimentTree` path with the tested pure tree model and adapt it to Ant Design `Tree` nodes inside `ExperimentWorkbench`.

- [ ] **Step 2: Keep the left project tree mounted for both `/` and child routes**

Change the render structure from the current branch `location.pathname === '/' ? ... : <Outlet />` into one shared `layout-content` shell. The left navigator and splitter remain mounted; the right side renders either the root workbench or the routed page.

- [ ] **Step 3: Add root-route states**

Implement only these root states:
- no opened project: a compact empty workspace message;
- project overview: project name, design method, run count, factor count, block count, and existing item count;
- design summary: reuse the current summary fields;
- worksheet: show the selected project's existing worksheet.

Do not fabricate model, anomaly, credibility, chart, calibration, or virtual-condition fields.

- [ ] **Step 4: Preserve current create/import behavior**

Keep `handleDesignGenerated`, `handleImportExperiment`, research-object persistence, worksheet data, resizers, and current localStorage keys unchanged.

- [ ] **Step 5: Route selection behavior**

When a user clicks a project-tree item while inside a child route, navigate to `/` and display that selected project/view. Top business menus remain responsible for entering feature pages.

- [ ] **Step 6: Build check**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build PASS with no new errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/workbench/ExperimentWorkbench.tsx
git commit -m "refactor: keep project tree across workbench routes"
```

### Task 3: Align the visual hierarchy with the approved prototype

**Files:**
- Modify: `frontend/src/index.css`
- Modify only if needed for spacing: `frontend/src/layouts/MainLayout.tsx`
- Do not modify behavior in: `frontend/src/workbench/FunctionBar.tsx`

**Interfaces:**
- Consumes: existing `layout-*` classes and Ant Design component structure.
- Produces: shallow blue-gray application background, white rounded navigator/workspace surfaces, subdued borders/shadows, clearer project-tree hierarchy, and no strong full-width horizontal divider above the worksheet.

- [ ] **Step 1: Restyle the workbench shell**

Update the existing `layout-workbench`, `layout-function-bar`, `layout-content`, `layout-navigator`, `layout-main`, `layout-canvas`, and worksheet-related rules. Keep all existing class names used by business pages.

- [ ] **Step 2: Add scoped project-tree/root-state classes**

Add only classes required by the new root project overview and project-tree labels. Avoid global Ant Design overrides unrelated to this shell.

- [ ] **Step 3: Remove the visually heavy worksheet separator**

Keep the drag handle usable but render it as a subtle hover affordance instead of a permanent bordered horizontal bar.

- [ ] **Step 4: Verify FunctionBar behavior remains unchanged**

Do not alter `handleGroupClick`, Popover groups, DOE modals, equipment manager modal, or routes. Only CSS should change its appearance.

- [ ] **Step 5: Full verification**

Run:

```bash
npm run build
npm run lint
node --experimental-strip-types --test src/workbench/projectTreeModel.test.ts
```

Expected: build PASS, project-tree tests PASS. If lint reports pre-existing unrelated errors, record them separately and ensure no new lint errors are introduced by the modified files.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/index.css frontend/src/layouts/MainLayout.tsx
git commit -m "style: simplify project workbench presentation"
```

### Task 4: Regression review against existing business behavior

**Files:**
- Review only unless fixes are necessary: `frontend/src/components/TrialAIAssistant.tsx`, `frontend/src/types/businessContext.ts`, `frontend/src/router/index.tsx`, `frontend/src/workbench/FunctionBar.tsx`

**Interfaces:**
- Confirms that no contract or route changes leaked into this display refactor.

- [ ] **Step 1: Compare branch against base commit**

Confirm changed production files are limited to the workbench shell/layout styling unless a build fix required another display-only file.

- [ ] **Step 2: Confirm untouched AI and business-contract files**

Verify `TrialAIAssistant.tsx`, `businessContext.ts`, and router business paths have no diff.

- [ ] **Step 3: Final build/test**

Run the Task 3 verification commands again from a clean checkout of the branch.

- [ ] **Step 4: Report exact branch and commit state**

Provide the branch name, changed files, verification results, and any remaining limitations, especially that algorithm-result persistence into the left project tree is intentionally not implemented.
