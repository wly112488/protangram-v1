# Experiment Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an experiment-centered workbench shell with top function popovers, experiment resource navigation, floating canvas windows, worksheet data network, and linked bottom panel.

**Architecture:** Keep `MainLayout` as the product shell and delegate workbench behavior to focused components under `frontend/src/workbench`. Use local React state for experiment tabs, resource selection, and per-experiment window layouts.

**Tech Stack:** React 19, TypeScript, Vite, Ant Design 6, existing `@ant-design/icons`.

## Global Constraints

- Preserve the existing Ant Design enterprise app visual language.
- Do not introduce new npm dependencies.
- Do not delete existing routed pages.
- Floating windows must not be nested and must preserve layout per experiment.
- Worksheet data must be represented as a data network.
- This folder is not a git repository, so commit steps are skipped.

---

### Task 1: Workbench Data Model

**Files:**
- Create: `frontend/src/workbench/workbenchModel.ts`

**Interfaces:**
- Produces: `createInitialWorkbenchState()`, `openResourceWindow(state, experimentId, resourceId)`, and `updateWindowBounds(state, experimentId, windowId, bounds)`.

- [ ] Define types for experiments, resources, worksheet network nodes, and floating windows.
- [ ] Add deterministic sample experiments that match the current ProTangram domain.
- [ ] Add pure update helpers for opening/focusing resources and storing window bounds.

### Task 2: Workbench Components

**Files:**
- Create: `frontend/src/workbench/ExperimentWorkbench.tsx`
- Create: `frontend/src/workbench/FunctionBar.tsx`
- Create: `frontend/src/workbench/ExperimentNavigator.tsx`
- Create: `frontend/src/workbench/FreeCanvas.tsx`
- Create: `frontend/src/workbench/WorkbenchWindow.tsx`
- Create: `frontend/src/workbench/WorksheetNetwork.tsx`
- Create: `frontend/src/workbench/BottomExperimentPanel.tsx`

**Interfaces:**
- Consumes: model helpers from Task 1.
- Produces: a complete workbench component rendered by `MainLayout`.

- [ ] Implement the top function bar with grouped popovers.
- [ ] Implement experiment tabs with add, close, switch, rename display, and status markers.
- [ ] Implement resource tree selection and canvas window focusing.
- [ ] Implement draggable/resizable/minimizable floating windows.
- [ ] Implement worksheet network rendering inside a floating window.
- [ ] Implement the collapsible bottom experiment panel.

### Task 3: Shell Integration and Styling

**Files:**
- Modify: `frontend/src/layouts/MainLayout.tsx`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: `ExperimentWorkbench`.

- [ ] Replace the old left `Sider` layout with `ExperimentWorkbench`.
- [ ] Keep the existing header, URL display, user menu, theme toggle, and routed pages available as route labels.
- [ ] Add CSS for the workbench shell, top function bar, navigator, canvas, floating windows, data network, and bottom panel.

### Task 4: Verification

**Files:**
- No production files.

- [ ] Run `npm run build` in `frontend`.
- [ ] Fix TypeScript or Vite errors.
- [ ] Manually inspect the running UI if a dev server is available.

## Self-Review

- Spec coverage: top function bar, experiment navigator, free canvas, per-experiment window state, worksheet network, and bottom panel are covered.
- Placeholder scan: no TBD/TODO placeholders are present.
- Type consistency: component and helper names are defined before use.
