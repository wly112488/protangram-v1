# Task workspace implementation plan

## Goal

Add the first persistent task-driven workflow while preserving Project/Artifact storage, existing capability pages, standalone access, and legacy routes.

## Scope and files

- Add `frontend/src/workspace/taskTypes.ts` and `taskStore.ts` for the minimal persisted Task, requirements, report draft, and Artifact references.
- Add `TaskCenter.tsx` and `TaskWorkbench.tsx`; add task workspace styles alongside existing workspace styles.
- Route `/` to Task Center, expose the existing Project workspace at `/projects`, and add `/tasks/:taskId`.
- Extend `workspaceSession` and navigation helpers so task context survives capability transitions and refreshes.
- Update the existing four capability pages and report creation only where needed to preserve Task context and send saved results back to the Task report draft.
- Keep old route entries and Project/Artifact data intact. Do not edit backend, algorithms, or unrelated modules.

## Implementation sequence

1. Add the persisted Task model/store and create/reopen Task Center with a linked Project.
2. Add Task Workbench with editable requirements, report sections, artifact references, and direct entry to each capability.
3. Propagate Task context through workspace navigation and the existing capability transitions.
4. Add saved capability artifacts to the in-progress Task report and let report generation start from the Task draft.
5. Review the changed source and diff for scope. Do not commit or push.

## Constraints

- No TaskBook, TaskReport, or AnalysisRun objects in this phase.
- Task source content remains Task fields; ReportDraft is embedded in Task.
- Task is the business anchor; Project remains the data/artifact workspace.
- Tests/build are not run unless explicitly requested.
