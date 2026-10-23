# CFG / model frontend flow execution evidence

Authority: `docs/superpowers/plans/2026-10-23-trial-cfg-model-frontend-flow.md`, explicitly approved for execution by the user on 2026-10-23.

Workspace: `/home/jiaxing/projects/protangram-v1-preview`; branch `feat/cfg-model-frontend-flow`; base `4a7878a`.
Runtime: WSL Node v24.21.0 / npm 11.19.0. Run frontend commands from this workspace's `frontend/`; its existing node_modules symlink provides dependencies only. esbuild's resolveDir and Vite's project root point to this workspace's source.

## Baseline

- `node --test --test-reporter=dot tests/*.test.mjs`: exit 0.
- `npm run build`: exit 0 (existing bundle size warning).
- `npm run lint`: exit 1, **36 errors / 4 warnings** across 17 existing files. The plan explicitly permits recording pre-existing failures and proving no new regressions. Existing findings will be compared by file/rule, not made green through unrelated rewrites.
- No user's browser profile or existing localStorage/IndexedDB is used for acceptance.

## Verification contracts

Threat boundary for all tasks: normal UI/store operations, persisted legacy state, ordinary missing/stale references and invalid inputs; excludes arbitrary runtime tampering. Backend APIs, database storage and real model execution are outside this plan.

| Task | Business invariant / failure consequence | Supported production paths and discriminating evidence |
| --- | --- | --- |
| 1 | Equipment IDs survive hierarchy traversal; CFG references existing equipment by role and never rewrites legacy experiments. Otherwise trial membership or old data is misattributed. | Three-level composition, same-name distinct IDs, empty tree; CFG create/get/reload, optional roles, duplicate/invalid members; old storage snapshot unchanged. |
| 2 | Management page and embedded modal use the same validated CFG editor. Saving returns the new ID; cancellation preserves the trial draft and creates nothing. | Validator regression plus isolated browser actions through both containers, validation errors and cancellation. |
| 3 | CFG ID remains independent of legacy experimentId; new trials preserve source IDs and work without a load spectrum. Stale/ambiguous equipment cannot silently select another source. | Bridge creation/reuse, stale references, multiple tested objects, legacy snapshots, empty spectrum records; task draft confirmation and session/source resolution. |
| 4 | SETs are independent manual inputs under a trial and TASK is the trial-management entry. Zero SETs does not block prediction; existing records/CSV are untouched. | Store add/update/reload, distinct trials/sets and missing IDs; task/sidebar navigation and isolated browser editing of four sets. |
| 5 | Model schemes match MODEL+CFG+OBJ+configuration, independent of runtime speed; required input units/sources are explicit. Outputs retain demo nature and input/source snapshots. | Pure matching, ambiguity/missing IDs, persistence/deduplication, field validation; same-page MODEL/input flow, changing speed/CFG, stale CFG and zero SET in isolated browser. |
| 6 | Entire task → trial → CFG → SET / prediction → original CSV/results chain remains recoverable without touching user data. | Final targeted/full tests, build, lint comparison and browser A–G with screenshots and source IDs. |

## Execution log

### Task 1

- RED: equipmentComposition / trialConfiguration suites exited 1 because the new production modules were absent (the plan's specified initial failure).
- GREEN: `node --test --test-reporter=spec tests/equipmentComposition.test.mjs tests/trialConfiguration.test.mjs tests/physicalObjects.test.mjs`: 20/20 pass, exit 0.
- `npm run build`: exit 0. Contract-surface check: additive composition method and independent CFG key; legacy physical store version and experiment/trial schemas unchanged.
- Acceptance audit closed: distinct nested equipment IDs, cross-level members, invalid-role/reference rejection, cloned member input, reload, and unchanged original physical storage verified directly.
- Lint baseline detail is persisted in `cfg-model-lint-baseline.json`.

### Task 2

- RED: isolated browser could not find the required CFG selector in the old three-step creation page.
- GREEN: `verify-cfg-model-flow.mjs` verifies the CFG selector, modal save/auto-selection, cancelled CFG causes no writes and preserves trial name, creating a trial, management editor role rejection and successful save. Exit 0; no page errors.
- An actual label collision between the page and modal (`name` / `description` DOM IDs) was reproduced and fixed with the editor's own Form namespace; the browser test now exercises both forms together.
- `tests/trialConfiguration.test.mjs`: exit 0; build exit 0. Full lint still has the same 36 errors / 4 warnings; file/rule comparison found no new findings. Targeted lint for all new/changed CFG components passed.
- Browser runtime: isolated Playwright 1.61 installation under `/tmp/protangram-cfg-browser-V6aviC`, cached Chromium headless shell with locally extracted runtime libraries. Vite serves this workspace at `http://127.0.0.1:5193`; screenshots are in `frontend/node_modules/.tmp/cfg-model-flow/`.
- Acceptance audit closed for the shared editor and both entrypoints. CFG-to-trial identity and optional spectrum are Task 3 work.
