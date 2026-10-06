# Responsive Workspace UI Design

## Goal

Make the task center easy to find and usable at narrow viewport widths, then give the existing user-facing workflow pages a consistent visual structure without changing their business behavior.

## User and Product Context

Users can work in two modes: continue a task and its report, or open a standalone professional capability. The current application already has task/project context and four professional capability pages. This work improves navigation and visual continuity around those existing flows; it does not introduce another business workflow.

## Current Findings

- `/` already renders `TaskCenter`, but the primary header navigation has no explicit task-center item. The brand logo and user menu are indirect ways to return there.
- The workspace keeps a fixed-width project sidebar at narrow widths. At a 412px viewport, the sidebar consumes most of the available width and clips the center content, including task-center actions.
- The task center has create-task and standalone-capability actions, but those actions are difficult to discover when the center column is compressed. Task creation accepts pasted task-book content; there is no file-import workflow in this phase.
- Existing feature pages use mixed page headers, spacing, cards, and action placement. The four professional pages have shared preparation/result patterns that can be presented consistently while retaining their unique controls and visualizations.
- The visible navigation currently includes task-independent capability pages and report pages. Module Management and analysis Template Management remain legacy routes and are already intended to stay hidden from user-facing navigation.

## Approved Direction

Use one shared responsive workspace frame and consistent page chrome around existing module-specific content. Keep page-specific configuration controls, data tables, charts, diagrams, result cards, route-state transfers, and task/project context intact.

### Navigation and Task Center

- Add a persistent, clearly labeled `任务中心` navigation entry that routes to `/`.
- Show an active state for the task-center entry on `/` and `/tasks/:taskId` so users can return to the task list from a task workbench.
- Preserve the current capability and report routes and their active states.
- Keep task creation and standalone capability actions visible in the task-center empty state and populated state. Label task creation accurately; do not imply a file-import flow that does not exist.

### Responsive Workspace Frame

- At desktop widths, retain the project sidebar, center page, and AI assistant panel behavior.
- At tablet and mobile widths, prevent the project sidebar from taking fixed space away from page content. Collapse it behind a labeled control/drawer or hide it with an explicit way to reopen it.
- Keep the AI panel collapsed behind its existing mobile trigger; ensure that it does not overlap task-center or page actions.
- Let the header navigation adapt to narrow widths with an accessible compact menu or horizontal scrolling. Do not allow the brand, navigation, task-return action, and user actions to force the center page narrower than its usable width.
- Make page padding, grids, tables, modals, and action rows responsive. Wide data tables may scroll within their own container.

### Consistent Page Chrome

- Use a shared visual pattern for user-facing business pages: page title and short purpose, current task/project context when present, primary action in a predictable location, then the module content.
- Apply the pattern to TaskCenter, TaskWorkbench, DOE, AnalysisProjects, DigitalTwin, VirtualConditionExtension, report list/create/generate pages, and visible experiment-information pages.
- Preserve each page's unique preparation checklist, form, table, chart, workflow editor, and result actions. Standardization is about hierarchy, spacing, responsive behavior, and action placement, not flattening distinct work into identical cards.
- Keep direct navigation and `workspaceSession` state propagation unchanged. Task-mode return links remain visible and return to the same task.

## Scope

### Included

- Task center/workbench and shared workspace header/sidebar/layout.
- Existing visible primary navigation destinations: experiment information pages, intelligent DOE, data analysis, digital twin, virtual condition extension, and report pages.
- Direct shared CSS and presentation components needed to establish the navigation, responsive shell, and page chrome.
- Minimal adjustments to existing visual tests only if they already exist and directly cover changed presentation behavior.

### Excluded

- Backend/API work, data model changes, task/report lifecycle changes, business algorithms, calculations, charts' meaning, and professional module workflows.
- Deleting legacy pages/routes or changing hidden Module Management and analysis Template Management UI. Their user-facing navigation stays hidden.
- Changing report content semantics, project/artifact persistence, or unrelated workspace layout behavior.
- Commit, push, or publication.

## Acceptance Criteria

1. The header offers a direct `任务中心` action and marks it active on the task list and task workbench.
2. Task-center create/open actions remain visible and operable when the project sidebar is collapsed at narrow widths.
3. The project sidebar can be reopened at narrow widths and does not permanently consume the main page width.
4. The header and AI assistant do not cover page content or primary actions on narrow viewports.
5. The specified user-facing business pages share consistent title/context/action hierarchy and spacing.
6. Existing module-specific forms, tables, visualizations, route-state flows, and standalone capability entry points continue to use their current behavior.
7. Module Management and analysis Template Management remain absent from user-facing navigation, while their source/routes remain intact.
8. No backend, business-model, or calculation changes are introduced.

## Risks and Mitigations

- Broad CSS changes can affect existing pages unexpectedly. Limit shared selectors to workspace-owned classes and add page-level classes only where necessary.
- Compact navigation can hide destinations. Keep every existing primary destination reachable from the compact menu, and retain clear active state.
- Collapsing the project sidebar can obscure project navigation. Provide an explicit reopen control and preserve the current desktop layout.
- Page chrome can become overly uniform. Standardize hierarchy and spacing only; leave domain-specific content structures intact.

## Review Checklist

- [ ] Task center is an explicit primary navigation destination.
- [ ] Narrow viewport behavior has a clear way to show/hide project navigation.
- [ ] Task and standalone entry paths both remain available.
- [ ] Capability result and report flows are unchanged.
- [ ] Legacy hidden navigation remains hidden without deleting source or routes.
- [ ] No code, test, model, or backend scope has expanded beyond this specification.
