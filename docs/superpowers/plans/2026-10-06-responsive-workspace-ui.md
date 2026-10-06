# Responsive Workspace UI Implementation Plan

> **For agentic workers:** Use the native inline execution method and work through the tasks in order. Do not commit or push.

**Goal:** Make Task Center discoverable and usable on narrow screens, and give existing user-facing business pages a consistent responsive visual hierarchy without changing their business behavior.

**Architecture:** Extend the existing primary navigation model and workspace shell. Add a small shared page-heading presentation component/style only if it reduces repeated markup without changing page state. Retain each page's existing domain content and route-state handling.

**Tech Stack:** React, TypeScript, React Router, Ant Design, existing workspace CSS.

**Spec:** `docs/superpowers/specs/2026-10-06-responsive-workspace-ui-design.md`

## Global Constraints

- Preserve the existing task/project context and route-state flows.
- Keep the desktop project sidebar and AI panel behavior.
- Provide explicit task-center navigation and narrow-screen access to project navigation.
- Preserve module-specific forms, tables, charts, workflows, calculations, and result actions.
- Keep Module Management and analysis Template Management out of user-facing navigation; retain their source and routes.
- Do not modify backend, business models, persistence behavior, or unrelated modules.
- Do not commit, push, or publish.
- Do not add or run tests/build commands unless the user requests verification.

## Review Focus

- At narrow viewports, the project sidebar must not permanently consume the main content width.
- `/` and `/tasks/:taskId` must show Task Center as the active primary destination.
- Task-mode capability navigation must preserve the same task and return path.
- Standalone capability links must remain available from Task Center and the header.
- Existing primary routes and hidden legacy navigation must remain unchanged beyond presentation.

---

### Task 1: Task Center Navigation and Responsive Workspace Shell

**Files:**
- Modify: `frontend/src/workspace/presentationModel.ts`
- Modify: `frontend/src/workspace/WorkspaceHeader.tsx`
- Modify: `frontend/src/workbench/FunctionBar.tsx`
- Modify: `frontend/src/workspace/WorkspaceShell.tsx`
- Modify: `frontend/src/workspace/ProjectSidebar.tsx`
- Modify: `frontend/src/workspace/workspace.css`

**Interfaces:**
- `primaryNavigationItems` remains the source for visible primary navigation destinations.
- Extend `HeaderActiveKey` with `taskCenter`; map `/` and `/tasks/*` to this key.
- Keep existing task `workspaceSession` and route state unchanged.

- [x] Add a direct `任务中心` primary navigation item targeting `/` and active-state handling for task center and task workbench routes.
- [x] Add a responsive way to open and close project navigation at narrow breakpoints. Preserve current desktop sidebar behavior and `ProjectSidebar` project actions.
- [x] Ensure compact header navigation exposes all existing destinations and does not overlap the active task return action or user controls.
- [x] Adjust shell grid and center overflow/padding so task-center primary actions fit at 412px width.
- [x] Review the changed files and confirm no task/project store or route-state behavior changed.

### Task 2: Shared Page Hierarchy for Task and Professional Capability Pages

**Files:**
- Create if needed: `frontend/src/workspace/WorkspacePageHeader.tsx`
- Modify: `frontend/src/workspace/taskWorkspace.css`
- Modify: `frontend/src/workspace/workspace.css`
- Modify: `frontend/src/workspace/TaskCenter.tsx`
- Modify: `frontend/src/workspace/TaskWorkbench.tsx`
- Modify: `frontend/src/pages/experiment/design/IntelligentExperimentDesign.tsx`
- Modify: `frontend/src/pages/analysis/projects/AnalysisProjects.tsx`
- Modify: `frontend/src/pages/analysis/DigitalTwin.tsx`
- Modify: `frontend/src/pages/analysis/VirtualConditionExtension.tsx`

**Interfaces:**
- Shared heading accepts a title, optional description/context, and optional action content; it does not own navigation or business state.
- Capability pages continue using `useWorkspaceBusinessSession` and current `workspaceSession` state.

- [x] Establish consistent title, purpose/context, and primary-action placement across task center/workbench and the four core capability pages.
- [x] Apply responsive spacing and action wrapping while preserving each page's existing forms, preparation checklist, result panels, charts, and route-state transitions.
- [x] Confirm task-return links still target the current task and standalone mode remains task-optional by reviewing handlers and navigation state.

### Task 3: Apply the Page Hierarchy to Experiment Information and Reports

**Files:**
- Modify: `frontend/src/pages/experiment/info/BOMManagement.tsx`
- Modify: `frontend/src/pages/experiment/info/TestSubjects.tsx`
- Modify: `frontend/src/pages/experiment/info/TestMethods.tsx`
- Modify: `frontend/src/pages/experiment/info/SamplingRequirements.tsx`
- Modify: `frontend/src/pages/experiment/design/ExperimentCreate.tsx`
- Modify: `frontend/src/pages/experiment/design/OutlineDesign.tsx`
- Modify: `frontend/src/pages/analysis/projects/AnalysisProjectCreate.tsx`
- Modify: `frontend/src/pages/analysis/projects/AnalysisExecution.tsx`
- Modify: `frontend/src/pages/report/ReportList.tsx`
- Modify: `frontend/src/pages/report/ReportCreate.tsx`
- Modify: `frontend/src/pages/report/ReportGenerate.tsx`
- Modify: `frontend/src/pages/report/ReportTemplates.tsx`
- Modify: `frontend/src/workspace/workspace.css` and/or a focused shared page stylesheet

**Interfaces:**
- Use the shared heading from Task 2 where it fits; preserve existing page-local actions and route handlers.
- Table-heavy pages keep horizontal scrolling inside their table region rather than expanding the workspace shell.

- [x] Normalize page title/subtitle/action hierarchy and responsive content spacing across experiment-information, experiment-design support, analysis setup/execution, and report pages.
- [x] Make side-by-side panels, forms, action groups, and report editor regions stack or scroll within their own content areas on narrow screens.
- [x] Preserve all route destinations, report/artifact links, forms, and feature-specific interaction logic.

### Task 4: Scope Review

**Files:**
- Review: all files changed in Tasks 1–3.
- Review: `frontend/src/workbench/FunctionBar.tsx` navigation contents.

- [x] Inspect the final diff for accidental changes to business logic, persistence, data models, or legacy route definitions.
- [x] Confirm Module Management and analysis Template Management remain absent from the user-facing navigation.
- [x] Confirm no commit or push was created. Automated tests/build were not run.

\n