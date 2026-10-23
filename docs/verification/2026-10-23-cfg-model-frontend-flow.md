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

### Task 3

- RED: `cfgTrialBridge.test.mjs` exited 1 because the bridge module did not exist.
- GREEN: bridge tests prove shared CFG / distinct trials, stable compatibility container, ambiguous/missing source rejection before writes, nested primary-object record writes/navigation/task projections, unchanged legacy trial, and idempotent task confirmation with cfgId in the session.
- `node --test --test-reporter=dot tests/cfgTrialBridge.test.mjs tests/physicalObjects.test.mjs tests/taskTrialIntegration.test.mjs tests/trialCreationModel.test.mjs tests/taskAnalysisWorkflow.test.mjs tests/crossFunctionSharing.test.mjs`: 46 tests pass, exit 0. Build exit 0.
- Finding Gate: three existing assertions requiring a load spectrum were classified `OBSOLETE_TEST` under Task 3 / authoritative rule 7. Replaced those assertions with optional-spectrum record creation or the still-required trial-name guard; historical spectrum immutability assertions remain.
- Contract boundary includes nested equipment through record mutation, source navigation, task projection and original-file lookup; these existing resolvers were extended together to avoid creating inaccessible part-owned trials.
- Browser fixture imports must use one fresh Vite module graph: after HMR changes, restart the isolated dev server before dynamic-import seeding. Dependencies remain shared, production stores/source come from this workspace.

### Task 4

- RED: nested physical-navigation test saw the legacy internal container instead of a rotor; SET tests could not resolve the absent model.
- GREEN: `node --test --test-reporter=dot tests/trialSettings.test.mjs tests/physicalNavigation.test.mjs tests/physicalObjects.test.mjs tests/sessionWorkbench.test.mjs`: 56/56 pass. Build exit 0; targeted lint exit 0. Full lint retains the baseline findings.
- Four independent manual SETs were created in the actual session UI, one renamed and given a field, then all four restored on reload. The isolated browser also creates rotor → blade via the ordinary UI, edits blade parameters, and verifies both nested tree nodes and the trial-task entry.
- Original records and the other trial's settings remain unchanged in store tests; missing trial/setting IDs fail without writes. New compatibility containers stay out of the CFG/object tree. Legacy experiment nodes remain accessible.
- Acceptance audit closed for Task 4; zero-SET model-flow acceptance is repeated in Task 5/6.

### Task 5

- RED: model-plan tests could not resolve the new modules; the isolated browser also demonstrated that the old prediction page had no MODEL selector.
- GREEN: `node --test --test-reporter=spec tests/modelPlanModel.test.mjs tests/prediction.test.mjs tests/crossFunctionSharing.test.mjs`: 22/22 pass. Build and targeted model-flow lint passed.
- Matching verifies order-independent object IDs, different CFG/configuration separation, multiple-candidate ambiguity and missing identifiers. The independent scheme store confirms once and restores on reload; stale equipment/CFG cannot confirm a scheme.
- Explicit parameter bindings verify object/parameter IDs, units and required input definitions; same-name fields are never guessed. Selected equipment parameter values join the configuration identity; runtime inputs remain separate.
- Preview and archived artifact tests verify immutable CFG/trial/MODEL/scheme/configuration/runtime snapshots and demo nature; a mismatched source is rejected.
- Actual browser flow creates a scheme, changes speed to 6000 without adding a scheme, saves the demo result, and previews another CFG's zero-SET trial using its own scheme. No page errors. Legacy trials retain their original prediction interface.
- Acceptance audit closed for Task 5. Full journey and stale/ambiguous UI paths are audited again in Task 6.

### Task 6 — integration review corrections

- Independent pre-landing review identified two `IN_SCOPE_DEFECT` findings within the established task/source invariant: trial-scoped MODEL results were absent from TASK/report projections, and component-owned autonomous trials were absent from the task association picker.
- RED: the two added tests in `taskTrialIntegration.test.mjs` failed (missing artifact, missing recursive candidate helper). GREEN: `node --test --test-reporter=dot tests/taskTrialIntegration.test.mjs tests/cfgTrialBridge.test.mjs tests/crossFunctionSharing.test.mjs tests/taskAnalysisWorkflow.test.mjs` passed 27 tests; `npx tsc -b` and targeted ESLint passed, exit 0.
- Trial-scoped results are projected separately from record-scoped results, deduplicated in totals, and removed from the original task's current report sources after reassignment. Component trials retain their real parent IDs during association.
- Read-only independent re-review closed both findings and reran 16 related tests, exit 0. Affected Task 3/5 audits reopened and closed with the above direct regression evidence; no unrelated behavior was added.
- Plan-level audit found two further source-path gaps within the existing contract: TASK/Project navigation omitted `cfgId`, and TASK/Project still grouped/labeled new CFG trials by their shared legacy container. These are `IN_SCOPE_DEFECT`, not a change to the approved business model.
- RED: the new group-isolation test observed one group instead of two CFGs; an isolated existing acceptance profile showed missing `businessScope.cfgId` and zero actual CFG labels in the project trial table. The full browser journey independently failed the same CFG-ID assertion.
- GREEN: `taskTrialIntegration` now passes 8/8, preserving the old container ID while separating independent CFG display groups. A direct browser rerun retained the exact original CFG ID and displayed its actual name. Affected regression (`taskTrialIntegration`, `projectTrials`, `cfgTrialBridge`, `crossFunctionSharing`) passed 23/23; TypeScript, targeted ESLint and build exit 0.
- Harness-only corrections: use dropdown aria-controls to avoid hidden Ant Design dropdowns; allow Ant loading-icon prefixes in button accessible names; reload simulated persisted duplicate candidates before testing ambiguity. These do not relax any production assertions.
- The same legacy-container labeling gap also existed on physical-object pages: isolated browser RED observed `1 个试验构型` for an internal container, instead of zero historical layouts. Legacy layouts are now explicitly labeled as historical, internal containers are excluded from their counts/editor, and old trial addresses/data remain unchanged. Related physical/navigation/task/project regression passed 32 tests; TypeScript and targeted lint exit 0.

## Integration acceptance scope

Existing browser harnesses were inspected before adding `frontend/scripts/verify-cfg-model-flow.mjs`. The old session/prediction scripts hard-code other ports/runtime library paths and the superseded object → legacy-layout creation UI. They were not run against an unrelated server or used to restore obsolete requirements. The new harness reuses their Playwright/CSV/worksheet approach against this worktree on port 5193.

The browser harness always creates a new persistent profile under `/tmp/protangram-cfg-profile-*`, closes and reopens that exact isolated profile, stubs legacy API reads, and aborts any HTTP write. No daily browser profile is accessed. Sample equipment is added through the existing public stores; user operations use the actual rendered UI. Persisted legacy candidate duplication/stale CFG are deliberately simulated through their stores, then restored.

Task 1–5 acceptance audits are closed with the implementation, TDD and direct evidence above. Cross-task integration review covers independent OBJ/CFG IDs, optional SET/spectrum, scheme identity versus runtime input, immutable result provenance, TASK/Project navigation and local persistence. No backend, data migration, real CFD or deployment is part of this acceptance.

- Final integration browser run of the complete harness: exit 0, A–G plus stale/ambiguous/unit/component/legacy-address assertions passed, zero page errors and zero HTTP writes. Screenshots/manifest will be regenerated at the frozen source commit below for the durable acceptance artifact.
- Task 6 acceptance audit and Plan Execution Audit closed with no unresolved material gap after the corrections above. The remaining gate is the final repository-wide regression on frozen implementation/test sources and persistence of its objective result.

## Frozen final verification and completion

Implementation and verification code freeze: **`6670d459ec02e5837745315e56379ab252576934`**. All commands below exercised that commit's source in this worktree; subsequent changes only persist documentation/screenshots and checklist status.

| Verification | Actual result |
| --- | --- |
| `node --test --test-reporter=spec tests/trialConfiguration.test.mjs tests/cfgTrialBridge.test.mjs tests/trialSettings.test.mjs tests/modelPlanModel.test.mjs` | Exit 0; 12/12 pass |
| `node --test --test-reporter=spec tests/*.test.mjs` (frozen full regression) | Exit 0; **165/165 pass**, 0 failed/skipped/cancelled |
| `npm run build` (frozen source) | Exit 0; existing >500 kB bundle warning remains |
| `npm run lint` | Exit 1; baseline **36 errors / 4 warnings** remain |
| ESLint API comparison against `cfg-model-lint-baseline.json` by file/rule/severity multiplicity | Exit 0; 36 errors / 4 warnings, **added: []** |
| `git diff --check` | Exit 0 |
| `node scripts/verify-cfg-model-flow.mjs` (frozen source, isolated Chromium) | Exit 0; A–G and negative paths pass; page errors `[]`, HTTP writes `[]` |

Browser reproduction in this verification environment, from `frontend/`:

```bash
LD_LIBRARY_PATH=/tmp/protangram-cfg-browser-V6aviC/runtime/usr/lib/x86_64-linux-gnu \
PROTANGRAM_PLAYWRIGHT_ROOT=/tmp/protangram-cfg-browser-V6aviC/node_modules/playwright/package.json \
PROTANGRAM_CHROMIUM_PATH=/home/jiaxing/.cache/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell \
PROTANGRAM_VERIFY_OUTPUT=../docs/verification/cfg-model-flow \
node scripts/verify-cfg-model-flow.mjs
```

The environment paths are explicit dependencies, not portable defaults; the harness supports replacing them with equivalent installed Playwright/Chromium paths. Dev server: `npm run dev -- --host 127.0.0.1 --port 5193 --strictPort` in this worktree's frontend.

| Journey | Observed acceptance and durable artifact |
| --- | --- |
| A | TASK A → 起飞设计点性能试验 → existing CFG-07 (fan + rig); four independent SETs, edited/restored. `cfg-model-flow/trial-settings.png` |
| B | Same editor in creation modal; cancel creates nothing, save selects the new CFG and preserves the draft; second zero-SET trial uses that CFG. `acceptance.json` |
| C | Management editor cancellation and missing tested-role rejection; successful correction. Missing equipment also rejected by store/validator tests. `cfg-model-flow/cfg-editor.png` |
| D | Zero-SET virtual-condition preview plans its scheme; another trial of the same CFG reuses the existing scheme. MODEL and manual inputs are in one form. `acceptance.json` |
| E | Speed 6000 reuses the same OM; another CFG/configuration does not. Multiple persisted candidates demand explicit selection; mismatched units block running; explicit equipment mapping works; stale CFG never falls back. `cfg-model-flow/model-reuse.png` |
| F | Two CSVs and one saved chart retain trial/record/file IDs through TASK and project navigation. Trial-scoped demo results appear in TASK/report sources. Nested blade trial can associate with TASK. `cfg-model-flow/project-source.png`, `cfg-model-flow/equipment-composition.png` |
| G | Persistent isolated browser closes/reopens; CFG/SET/OM/trial/project state and speed draft restore; original CSV is read back from IndexedDB. Original demo object snapshots remain identical and an old trial address opens. `cfg-model-flow/restored-model.png`, `acceptance.json` |

All screenshots were visually inspected (SET, model reuse, CFG editor and project-source views). The complete machine-readable manifest is [`cfg-model-flow/acceptance.json`](cfg-model-flow/acceptance.json); it records the tested source commit, isolated profile, old route, all source IDs, scheme configuration and saved demo input snapshots. Example source chain from the frozen run:

- CFG: `cfg-f9b5bbfe-f546-4e81-b490-28e49e950010`
- Trial: `trial-f9fb16b9-7c2a-453f-8cce-72e7ff659add`
- Legacy-compatible experiment ID (distinct from CFG): `trial-configuration-4f525ade-4b68-4e81-bb82-8e0a155c5e09`
- Execution: `record-3e8f049b-230d-4763-a831-f373f823b9d8`
- CSV: `raw-15544d2d-5801-40b9-8c52-05139afa6dcb`; chart: `chart-f960841a-c4cd-40a3-ae08-f9b2137bd051`
- Reused OM: `om-758e9c08-20b2-4c7b-83a2-dc7b702dd576`

Task Acceptance Audits **1–6: closed**, and **Plan Execution Audit: closed**, with no unresolved in-scope defect. TDD execution evidence is recorded in the per-task sections and integration corrections above. Frozen full regression and browser acceptance succeeded; `COVERAGE_COMPLETE` now describes executed evidence, not merely the plan's proposed coverage.

Implementation commit range: `4a7878a..6670d45` on `feat/cfg-model-frontend-flow` (seven implementation/correction commits); this final documentation commit adds only execution status and verification artifacts. No push, PR, merge into main, backend integration or deployment was performed. The original development branch was not merged.

Still intentionally unverified/out of scope: authoritative backend OBJ/CFG/SET/OM persistence, API/database/file migration, multi-device synchronization, real MODEL/CFD execution and deployment. Current model outputs remain explicitly **demo**; browser storage remains the prototype's persistence mechanism.
