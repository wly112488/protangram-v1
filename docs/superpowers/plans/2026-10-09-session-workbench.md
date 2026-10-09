# Session Workbench Implementation Plan

> Execute inline with executing-plans; verify behavior with test-driven-development and verification-before-completion.

**Goal:** Make persistent sessions the primary entry to professional work, with optional project grouping.

**Architecture:** Add a Zustand session store with per-capability drafts, handoff context and stable internal artifact spaces. Keep legacy stores and routes; wrap professional pages in a session shell and bridge legacy capability navigation into the active session.

**Tech Stack:** React 19, React Router 7, Zustand 5, Ant Design 6, TypeScript, Vite; Node 24 tests and esbuild bundling for store tests.

## Constraints

- Preserve Chinese source using direct UTF-8 reads and writes.
- Retain existing projects, artifacts, formal task execution and report references.
- No remote synchronization claim, no new backend, no automatic publishing.
- Keep work in this checkout; commit and push approved changes to the GitHub codex branch as subsequently requested. No merge or deployment.

## Task 1: Session storage and identity

Files: sessionModel.ts, sessionStore.ts, types.ts, projectStore.ts, tests/sessionWorkbench.test.mjs.

Interfaces: createSession({ title?, projectId? }) returns a session ID; getWorkspaceSession(id) returns legacy-compatible context with sessionId and an internal targetProjectId; updateDraft(id, capability, key, value) isolates state; moveSession changes only organizational projectId.

- [x] Write store tests for independent artifact spaces, draft persistence across rehydration, project grouping without relocation, task reuse and storage errors; run and observe failure before implementation.
- [x] Add session types/store, hidden session-owned project spaces and navigation model. Keep hidden spaces from becoming the global active project.
- [x] Run store tests and existing business-session/model regressions.

Coverage: store public APIs directly verify isolation, persistence, task ownership and failure feedback. COVERAGE_COMPLETE.

## Task 2: Restore professional work

Files: useSessionState.ts, useWorkspaceBusinessSession.ts, businessSessionModel.ts, four professional pages, ReportCreate.tsx, TrialAIAssistant.tsx.

Interfaces: useSessionState(key, initial) matches useState; resolve session from URL; restore route handoffs; keep legacy routes compatible.

- [x] Add navigation/context tests to detect session identity loss on capability handoff and reload.
- [x] Connect committed settings, drafts, confirmations and completed outputs to session-scoped state; retain transient UI/loading states locally.
- [x] Keep session model snapshots independent; maintain original task/report references. Scope assistant history by session.
- [x] Verify persistence, source handoff and report scope; type-check.

Coverage: store/navigation tests plus live browser switching/reload and task regression tests. COVERAGE_COMPLETE.

## Task 3: Session layout and entry points

Files: SessionSidebar.tsx, SessionHome.tsx, SessionWorkbench.tsx, SessionShell.tsx, ProjectResourcesPage.tsx, router/index.tsx, sessionWorkspace.css, TaskCenter.tsx, ProjectSidebar.tsx, ProjectSaveTargetModal.tsx.

- [x] Register /sessions/:sessionId professional routes and preserve legacy routes for compatibility.
- [x] Render sidebar, home, session title/save status/actions and compact capability navigation; keep resource tree inside a drawer.
- [x] Add project creation/grouping, rename/pin/archive and task-session continuation. Hide internal storage spaces in organizational lists.
- [x] Open assistant on demand; verify desktop/narrow layout and functional navigation in a real browser.

Coverage: browser new/session/project/task paths, screenshots, refresh and viewport inspection. COVERAGE_COMPLETE.

## Task 4: Final verification

- [x] Run all frontend node tests, production build and targeted lint for changed files.
- [x] Review diff for cross-session leakage, missing legacy navigation and state overwrite on restore.
- [x] Record verification evidence and any real limitations here; leave changes ready for user review.

Coverage: tests, production build, lint and live browser checks. COVERAGE_COMPLETE.

## Verification evidence

- `npm run test:sessions`: 14/14 passed. Covers independent backing spaces, reload, project grouping, existing project/task reuse, session context, storage failures and source handoff reset while preserving assistant history.
- Full Node 24 frontend regression run: 68 tests, 59 passed, 9 failed. The same nine source/legacy-navigation assertions failed before this change (baseline 54 tests, 45 passed, 9 failed); no new failing test.
- `npm run build`: TypeScript and Vite production build passed. Existing large-bundle warning remains.
- Targeted ESLint for all new session files passed. Existing professional automatic-execution effects still trigger `react-hooks/set-state-in-effect` and dependency warnings; full lint is not claimed clean.
- `scripts/verify-session-workbench.mjs`: independent sessions, per-session model calibration, refresh, report creation/generation, unsaved binding restore, project grouping, assistant history, task entry/reload, resource directory and mobile navigation passed in an isolated Chrome context; no page errors.
- `scripts/verify-session-workflows.mjs`: analysis restore, analysis-to-virtual context, completed prediction restore, DOE plan/execution, interrupted execution recovery, DOE-to-analysis draft reset, report selection restore and explicit renewed selection passed; no page errors.
- Independent read-only review found and verified fixes for report backing scope, transient execution restore, stale destination drafts, report bindings, legacy project references and shared resource access. Final follow-up found no remaining blocking issue.
- Screenshots: `docs/previews/session-workbench-home.png`, `docs/previews/session-workbench-calibration.png`.

## Review notes

- Session work is saved in this browser's local storage; existing digital-twin inputs and professional calculations retain their mock behavior.
- Project membership groups sessions without moving or rewriting their artifact references. A shared project resource directory remains separately accessible.
- GitHub commit and push subsequently authorized; no merge or deployment. The user's pre-existing `frontend.7z` is untouched.

## Sidebar follow-up and GitHub synchronization

User-approved follow-up: separate independent/project session lists, move sidebar creation to the Recent heading plus, and add hover-only rename/archive/delete controls to project/session rows.

- [x] Observe failing store lifecycle tests and failing sidebar browser assertion before implementation.
- [x] Add persistent project rename/archive and conversation deletion, preserve artifact references and guard task-linked project deletion.
- [x] Filter sidebar lists by membership; support project and session archive recovery, hover controls, keyboard focus and touch fallback.
- [x] Verify session/project creation, rename, archive/restore, deletion and reload in an isolated Chrome context.
- [x] Complete final build, lint, targeted tests and read-only review; project deletion guards cover all task evidence and surviving session backing references.
- Synchronize the verified changes to `github/codex/session-workbench` as requested, excluding the pre-existing archive.
