# Project-to-Trial References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow an organizational project to reference an existing concrete trial while keeping the physical-object hierarchy as the sole owner of the trial, execution records, CSV files and charts.

**Architecture:** Add a project-to-trial association containing stable source IDs; do not add project ownership fields to ConcreteTrial. The project UI manages references and resolves their display information from the canonical physical-object store. Opening a reference creates or reuses a project-scoped work session for that exact trial source, without reusing a session whose source is unrelated or unspecified.

**Tech Stack:** React, TypeScript, Ant Design, Zustand, localStorage persistence, existing Node test suite, Vite build and Playwright browser verification.

**Spec:** docs/superpowers/specs/2026-10-09-session-workbench-design.md. Related business evidence: docs/reviews/2026-10-13-cross-function-sharing.md and docs/reviews/2026-10-15-task-trial-integration.md.

## Global Constraints

- A session is a named, persistent work context. Creating one requires no project. Projects group sessions; formal tasks keep their requirements, artifact references and reports. Existing professional modules remain interactive pages.
- Persist session metadata, per-capability committed settings, editable drafts, preparation confirmations, completed results and route handoffs. Do not persist temporary loading or modal-open states.
- Internal spaces stay out of project pickers and navigation.
- Moving a session changes its group, not its inputs or artifact IDs.
- Existing projects and tasks retain their data.

---

## Scope Check

### Plan

- **Goal:** Add explicit project references to existing concrete trials.
- **Independent deliverable:** Users can add an existing trial to a project, see it in the project, open it in the correct project-scoped workbench, and remove the reference without deleting the trial.
- **Spec semantics covered:** Optional project grouping; stable business-source identity; canonical trial/record/file/chart ownership; task-book association remains a relationship rather than data ownership.
- **Dependencies:** Existing project store, physical-object store, source-resolution helpers and session store.
- **Implementation prerequisites:** Current source IDs and the project/session persistence model are already available. No backend API or new database is required.

This is one implementation unit: the model, project UI and source-aware opening behavior form one independently testable feature. This document is a future implementation plan only; no product code changes are requested or performed as part of creating it.

## Current Codebase Evidence

- frontend/src/workspace/types.ts defines Project and ProjectArtifact, but Project has no concrete-trial reference list.
- frontend/src/workspace/ProjectResourcesPage.tsx currently offers “在此项目中新建具体试验”; it does not offer adding an existing trial.
- frontend/src/workspace/physicalObjectStore.ts owns the hierarchy: object category → concrete physical object → trial configuration → concrete trial → execution records. Raw files and record-specific tables belong to execution records; charts are stored under the concrete trial and identify their source record.
- frontend/src/workspace/physicalBusinessContext.ts resolves a source from stable IDs. Its physicalObjectId field identifies the concrete physical object/configuration ID; experimentId and trialId identify the trial configuration and concrete trial. Names are display values, not identity.
- frontend/src/workspace/taskTrialModel.ts derives task-book views from the canonical physical-object and artifact stores instead of copying trials, records, files or results into the task.
- frontend/src/workspace/sessionStore.ts already has ensureProjectSession, but that method may reuse a project session with no businessScope. A reference-opening flow must not attach a different trial to a session whose existing drafts have no known source; add a source-specific helper instead of changing existing creation behavior.

## Business Contract

### Canonical data ownership

The canonical trial remains in physicalObjectStore. A project stores only a relationship to the trial using the tuple (physicalObjectId, experimentId, trialId). Do not add projectId to ConcreteTrial, do not copy ConcreteTrial into Project, and do not create copies of its execution records, CSV files, charts, tables or professional artifacts.

A trial can be referenced by more than one project. Each project keeps its own association entry; all entries resolve to the same canonical trial IDs. Project-specific work sessions and drafts remain separate when their storage projects differ. This prevents one project's unsaved or capability-specific state from silently becoming another project's state.

### Required user behavior

1. A project can add an existing concrete trial, not only create a new one.
2. The selection UI identifies a trial by the full hierarchy: object category, concrete physical object, trial configuration and concrete trial. It supports search and excludes trials already referenced by that project.
3. Adding a reference does not change the trial's taskBookId, name, records, files, charts, tables or existing artifact references.
4. The project shows its referenced trials and the current source hierarchy. Opening a reference navigates to the same canonical trial in a project-scoped session.
5. Removing a reference removes only the relationship. It must not delete the trial, any execution record, CSV, chart, table, session, saved artifact or report.
6. If the source IDs no longer resolve, show an unavailable-source state and allow the stale reference to be removed. Never guess a replacement by matching names.
7. The same trial may appear in multiple projects without duplicate source data. Adding the same source twice to one project is idempotent.
8. A project reference is not a task-book association and does not mark a formal task as complete. Existing task-book report and evidence rules remain unchanged.
9. Session-owned artifact spaces are not organizational projects and must not expose the project-reference picker.

### Explicitly out of scope

- Implementing the feature during this planning task.
- Adding project ownership fields to ConcreteTrial or changing the physical-object hierarchy.
- Copying trials, records, files, charts or artifacts into projects.
- Changing task-book associations or automatically accepting artifacts as task evidence.
- Backend schema/API work, cross-device synchronization or migration to a server database.
- Matching sources by names, parameter values, model names or task-book names.
- Reworking unrelated project navigation, professional calculations or report generation.

## Implementation Roadmap

### Plan 1: Project-to-trial reference support

- **Goal:** Add and manage references to existing concrete trials from an organizational project.
- **Independently testable deliverable:** A project can add, display, open and remove references while source data remains unchanged.
- **Spec semantics covered:** Optional project grouping, stable source IDs, independent session state, single ownership of trial data and task-book association boundaries.
- **Dependencies:** Current Project, PhysicalObject and WorkSession models.
- **Prerequisite before detailed implementation:** None beyond the current main-branch source already inspected in this plan.

No downstream plan is required for this feature.

## File Structure

- **Modify — frontend/src/workspace/types.ts:** Add ProjectTrialReference, an optional trialRefs array on Project, and the 'trials' ProjectView value.
- **Create — frontend/src/workspace/projectTrialReferenceModel.ts:** Own stable-ID matching and reference add/remove helpers.
- **Modify — frontend/src/workspace/projectStore.ts:** Persist reference additions/removals alongside the existing Project object; do not introduce a second persistence store.
- **Modify — frontend/src/workspace/projectModel.ts:** Add the “关联具体试验” project navigation item only when references exist.
- **Create — frontend/src/workspace/ProjectTrialReferencePicker.tsx:** Search the canonical hierarchy and add an existing trial to the active organizational project.
- **Create — frontend/src/workspace/ProjectTrialReferencesView.tsx:** List references, show the source hierarchy, open valid references and remove references.
- **Modify — frontend/src/workspace/ProjectResourcesPage.tsx:** Add the project-only “添加已有具体试验” action and mount the picker.
- **Modify — frontend/src/workspace/ProjectContent.tsx:** Render the referenced-trial view and keep it unavailable in session-only resource views.
- **Modify — frontend/src/workspace/ProjectOverview.tsx:** Show the reference count and link to the reference view when the project has references.
- **Modify — frontend/src/workspace/sessionStore.ts:** Add a source-specific project-session helper that reuses only a session already bound to the same trial source.
- **Create — frontend/tests/projectTrialReferences.test.mjs:** Test reference model, duplicate prevention, candidate enumeration and missing-source resolution.
- **Create — frontend/tests/projectTrialReferenceStore.test.mjs:** Test persisted project reference actions and legacy-project compatibility.
- **Create — frontend/tests/projectTrialReferenceSessions.test.mjs:** Test project-scoped session reuse and isolation.
- **Create — frontend/scripts/verify-project-trial-references.mjs:** Verify the complete user flow in an isolated browser context.

Do not modify physicalObjectStore.ts to add project ownership. Do not modify backend files.

---

## Task 1: Reference Model and Persistence

**Files:**
- Modify: frontend/src/workspace/types.ts
- Create: frontend/src/workspace/projectTrialReferenceModel.ts
- Modify: frontend/src/workspace/projectStore.ts
- Test: frontend/tests/projectTrialReferences.test.mjs
- Test: frontend/tests/projectTrialReferenceStore.test.mjs

**Interfaces:**

- **Consumes:** Project from types.ts; canonical source IDs from PhysicalBusinessScope and physicalBusinessContext.ts.
- **Produces:** ProjectTrialReference; Project.trialRefs; findProjectTrialReference; addProjectTrialReference; removeProjectTrialReference; projectStore.addTrialReference; projectStore.removeTrialReference.

**Acceptance:**

- One project can reference a concrete trial at most once.
- Two projects can reference the same source tuple.
- Removing a reference changes only that project's association list.
- Old persisted Project objects without trialRefs continue to load.
- The canonical physical-object store is not mutated by reference operations.

- [ ] **Step 1: Write failing tests for relationship identity and isolation**

Create frontend/tests/projectTrialReferences.test.mjs with these tests against projectTrialReferenceModel.ts:

    import test from 'node:test';
    import assert from 'node:assert/strict';
    import {
      addProjectTrialReference,
      findProjectTrialReference,
      removeProjectTrialReference,
    } from '../src/workspace/projectTrialReferenceModel.ts';

    const project = (id) => ({
      id, name: id, status: '进行中', createdAt: '2026-10-21T00:00:00.000Z',
      updatedAt: '2026-10-21T00:00:00.000Z', basicInfo: {}, datasets: [], artifacts: [],
    });
    const source = { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-1' };

    test('same source can be referenced by two projects but not duplicated in one project', () => {
      const first = addProjectTrialReference(project('project-a'), source, 'ref-a', '2026-10-21T01:00:00.000Z');
      const duplicate = addProjectTrialReference(first.project, source, 'ref-duplicate', '2026-10-21T02:00:00.000Z');
      const second = addProjectTrialReference(project('project-b'), source, 'ref-b', '2026-10-21T03:00:00.000Z');

      assert.equal(first.added, true);
      assert.equal(duplicate.added, false);
      assert.equal(duplicate.reference.id, 'ref-a');
      assert.equal(duplicate.project.trialRefs.length, 1);
      assert.equal(second.project.trialRefs[0].trialId, 'trial-1');
      assert.equal(findProjectTrialReference(second.project, source).id, 'ref-b');
    });

    test('removing a reference leaves the canonical source IDs and another project reference intact', () => {
      const first = addProjectTrialReference(project('project-a'), source, 'ref-a', '2026-10-21T01:00:00.000Z');
      const second = addProjectTrialReference(project('project-b'), source, 'ref-b', '2026-10-21T01:00:00.000Z');
      const removed = removeProjectTrialReference(first.project, 'ref-a', '2026-10-21T04:00:00.000Z');

      assert.equal(removed.removed, true);
      assert.equal(removed.project.trialRefs.length, 0);
      assert.equal(second.project.trialRefs[0].trialId, 'trial-1');
      assert.deepEqual(source, { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-1' });
    });

    test('legacy projects without trialRefs can receive their first reference', () => {
      const legacyProject = project('legacy-project');
      assert.equal(legacyProject.trialRefs, undefined);
      const added = addProjectTrialReference(legacyProject, source, 'legacy-ref', '2026-10-21T05:00:00.000Z');
      assert.equal(added.added, true);
      assert.equal(added.project.trialRefs.length, 1);
    });

- [ ] **Step 2: Run the tests and confirm the missing model fails**

Run from frontend:

    node --test tests/projectTrialReferences.test.mjs

Expected: FAIL because projectTrialReferenceModel.ts and its exports do not exist yet.

- [ ] **Step 3: Add the relationship type and pure model helpers**

Add to frontend/src/workspace/types.ts:

    export interface ProjectTrialReference {
      id: string;
      physicalObjectId: string;
      experimentId: string;
      trialId: string;
      createdAt: string;
    }

    // Add this property to the existing Project interface; do not create a second interface.
    trialRefs?: ProjectTrialReference[];

Create frontend/src/workspace/projectTrialReferenceModel.ts with these functions and behavior:

    import type { Project, ProjectTrialReference } from './types.ts';

    export type ProjectTrialSource = Pick<
      ProjectTrialReference,
      'physicalObjectId' | 'experimentId' | 'trialId'
    >;

    export const sameProjectTrialSource = (
      left?: Partial<ProjectTrialSource>,
      right?: Partial<ProjectTrialSource>,
    ) => Boolean(left?.physicalObjectId && left?.experimentId && left?.trialId)
      && left?.physicalObjectId === right?.physicalObjectId
      && left?.experimentId === right?.experimentId
      && left?.trialId === right?.trialId;

    export const findProjectTrialReference = (
      project: Pick<Project, 'trialRefs'>,
      source: ProjectTrialSource,
    ) => (project.trialRefs ?? []).find(reference => sameProjectTrialSource(reference, source));

    export const addProjectTrialReference = (
      project: Project,
      source: ProjectTrialSource,
      referenceId: string,
      createdAt: string,
    ) => {
      const existing = findProjectTrialReference(project, source);
      if (existing) return { project, reference: existing, added: false };
      const reference: ProjectTrialReference = { id: referenceId, ...source, createdAt };
      return {
        project: { ...project, trialRefs: [...(project.trialRefs ?? []), reference], updatedAt: createdAt },
        reference,
        added: true,
      };
    };

    export const removeProjectTrialReference = (
      project: Project,
      referenceId: string,
      updatedAt: string,
    ) => {
      const trialRefs = project.trialRefs ?? [];
      if (!trialRefs.some(reference => reference.id === referenceId)) return { project, removed: false };
      return {
        project: { ...project, trialRefs: trialRefs.filter(reference => reference.id !== referenceId), updatedAt },
        removed: true,
      };
    };

Keep IDs as the sole relationship key. Display names are resolved from the current source; do not persist copied names in the reference.

- [ ] **Step 4: Add projectStore actions and persistence tests**

Extend ProjectWorkspaceState with:

    addTrialReference: (projectId: string, source: ProjectTrialSource) => string | null;
    removeTrialReference: (projectId: string, referenceId: string) => void;

Implement the actions with the following logic inside the existing Zustand store object:

    addTrialReference: (projectId, source) => {
      const project = get().projects.find(item => item.id === projectId);
      if (!project) return null;
      const now = new Date().toISOString();
      const result = addProjectTrialReference(project, source, newId('project-trial-ref'), now);
      if (!result.added) return result.reference.id;
      set(state => ({
        projects: state.projects.map(item => item.id === projectId ? result.project : item),
      }));
      return result.reference.id;
    },
    removeTrialReference: (projectId, referenceId) => {
      const project = get().projects.find(item => item.id === projectId);
      if (!project) return;
      const result = removeProjectTrialReference(project, referenceId, new Date().toISOString());
      if (!result.removed) return;
      set(state => ({
        projects: state.projects.map(item => item.id === projectId ? result.project : item),
      }));
    },

Import the helpers and ProjectTrialSource type from projectTrialReferenceModel.ts. Do not change deleteProject or physicalObjectStore behavior.

Create frontend/tests/projectTrialReferenceStore.test.mjs. Set globalThis.localStorage and globalThis.window.localStorage to an in-memory Map before importing the store. Seed the key protangram-project-workspace-v1 with a Zustand persist payload whose projects array contains a legacy project without trialRefs, then bundle projectStore.ts with esbuild using this entry:

    stdin: {
      contents: "export { useProjectStore, WORKSPACE_STORAGE_KEY } from './src/workspace/projectStore';",
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',

Import the bundle from a data URL and export useProjectStore and WORKSPACE_STORAGE_KEY. Then run this test body against the bundled store:

    test('project reference actions persist and stay scoped to each project', () => {
      const store = useProjectStore.getState();
      const projectA = store.createProject({ name: '项目 A' });
      const projectB = store.createProject({ name: '项目 B' });
      const source = { physicalObjectId: 'object-1', experimentId: 'setup-1', trialId: 'trial-1' };

      const referenceA = useProjectStore.getState().addTrialReference(projectA, source);
      const referenceAAgain = useProjectStore.getState().addTrialReference(projectA, source);
      const referenceB = useProjectStore.getState().addTrialReference(projectB, source);

      assert.equal(referenceAAgain, referenceA);
      assert.equal(useProjectStore.getState().projects.find(item => item.id === projectA).trialRefs.length, 1);
      assert.equal(useProjectStore.getState().projects.find(item => item.id === projectB).trialRefs.length, 1);
      const saved = JSON.parse(localStorage.getItem(WORKSPACE_STORAGE_KEY));
      assert.ok(saved.state.projects.find(item => item.id === projectA).trialRefs.length === 1);

      useProjectStore.getState().removeTrialReference(projectA, referenceA);
      assert.equal(useProjectStore.getState().projects.find(item => item.id === projectA).trialRefs.length, 0);
      assert.equal(useProjectStore.getState().projects.find(item => item.id === projectB).trialRefs[0].id, referenceB);
    });

Also verify a legacy Project object with no trialRefs remains readable after the store is initialized. The test must not depend on the user's browser storage.

Run:

    node --test tests/projectTrialReferences.test.mjs tests/projectTrialReferenceStore.test.mjs

Expected: all model and persistence tests PASS.

- [ ] **Step 5: Commit the independently tested model**

    git add src/workspace/types.ts src/workspace/projectTrialReferenceModel.ts src/workspace/projectStore.ts tests/projectTrialReferences.test.mjs tests/projectTrialReferenceStore.test.mjs
    git commit -m "feat: add project trial reference model"

**Per-Task Coverage Review**

- Relationship uniqueness → duplicate-add test verifies one reference remains and returns the existing ID.
- Many-to-many reference → two project objects independently reference the same stable source tuple.
- Reference removal boundary → removal test verifies the other project's reference and source tuple remain intact.
- Legacy compatibility → optional trialRefs means existing persisted projects remain valid; add a regression fixture with no trialRefs before closing this task.

Coverage result: **COVERAGE_COMPLETE**.

---

## Task 2: Project Picker, Reference View and Navigation

**Files:**
- Modify: frontend/src/workspace/projectModel.ts
- Create: frontend/src/workspace/ProjectTrialReferencePicker.tsx
- Create: frontend/src/workspace/ProjectTrialReferencesView.tsx
- Modify: frontend/src/workspace/ProjectResourcesPage.tsx
- Modify: frontend/src/workspace/ProjectContent.tsx
- Modify: frontend/src/workspace/ProjectOverview.tsx
- Test: frontend/tests/projectTrialReferences.test.mjs

**Interfaces:**

- **Consumes:** Project.trialRefs; listProjectTrialCandidates; resolveProjectTrialReference; projectStore add/remove actions.
- **Produces:** ProjectView value 'trials'; a project navigation item labelled “关联具体试验”; a project-only picker; a list with open/remove actions.

**Acceptance:**

- The picker shows only existing concrete trials from the canonical hierarchy and shows their complete hierarchy path.
- Search filters by category, physical object, trial configuration, concrete-trial name, load spectrum and task-book ID/name where available.
- Existing references are excluded from candidates; adding a reference updates the project list immediately.
- The project view shows current source names resolved by IDs, execution-record count and task-book association when present.
- A stale reference is visible as unavailable and can be removed; it cannot open a guessed source.
- The picker is not rendered in session-owned resource views.

- [ ] **Step 1: Add model tests for candidates and stale references**

Extend the imports in frontend/tests/projectTrialReferences.test.mjs with listProjectTrialCandidates and resolveProjectTrialReference. Add this fixture and assertions:

    const objects = [{
      id: 'category-1', name: '涵道风扇',
      configurations: [{
        id: 'object-1', name: '电涵道风扇',
        experiments: [{
          id: 'setup-1', name: '静推构型',
          trials: [
            { id: 'trial-1', name: '静推力试验', loadSpectrum: 'LS-1', records: [], charts: [] },
            { id: 'trial-2', name: '静推力试验', loadSpectrum: 'LS-2', records: [], charts: [] },
          ],
        }],
      }],
    }];
    const reference = {
      id: 'ref-1', physicalObjectId: 'object-1', experimentId: 'setup-1',
      trialId: 'trial-1', createdAt: '2026-10-21T01:00:00.000Z',
    };

    test('candidate list excludes only the exact referenced source tuple', () => {
      assert.deepEqual(listProjectTrialCandidates(objects).map(item => item.trialId), ['trial-1', 'trial-2']);
      assert.deepEqual(listProjectTrialCandidates(objects, [reference]).map(item => item.trialId), ['trial-2']);
    });

    test('missing source IDs are not replaced by a same-named trial', () => {
      assert.equal(resolveProjectTrialReference(objects, reference).missing, false);
      assert.equal(resolveProjectTrialReference(objects, { ...reference, trialId: 'deleted-trial' }).missing, true);
    });

The duplicate trial names are intentional: they prove source matching is based on IDs, not names.

- [ ] **Step 2: Run the focused test before UI implementation**

Run:

    node --test tests/projectTrialReferences.test.mjs

Expected: candidate and stale-reference tests fail until listProjectTrialCandidates and resolveProjectTrialReference are present and correctly wired to the fixture.

- [ ] **Step 3: Add the project picker**

First add resolveProjectTrialReference and listProjectTrialCandidates to projectTrialReferenceModel.ts. Import PhysicalObject as a type and use these implementations:

    export function resolveProjectTrialReference(objects: PhysicalObject[], reference: ProjectTrialReference) {
      const category = objects.find(item => item.configurations.some(config => config.id === reference.physicalObjectId));
      const physicalObject = category?.configurations.find(config => config.id === reference.physicalObjectId);
      const experiment = physicalObject?.experiments.find(item => item.id === reference.experimentId);
      const trial = experiment?.trials.find(item => item.id === reference.trialId);
      if (!category || !physicalObject || !experiment || !trial) return { reference, missing: true as const };
      return { reference, missing: false as const, category, physicalObject, experiment, trial };
    }

    export function listProjectTrialCandidates(objects: PhysicalObject[], references: ProjectTrialReference[] = []) {
      return objects.flatMap(category => category.configurations.flatMap(physicalObject =>
        physicalObject.experiments.flatMap(experiment => experiment.trials
          .filter(trial => !references.some(reference => sameProjectTrialSource(reference, {
            physicalObjectId: physicalObject.id, experimentId: experiment.id, trialId: trial.id,
          })))
          .map(trial => ({
            physicalObjectId: physicalObject.id,
            experimentId: experiment.id,
            trialId: trial.id,
            categoryName: category.name,
            physicalObjectName: physicalObject.name,
            experimentName: experiment.name,
            trialName: trial.name,
            recordCount: trial.records.length,
            taskBookId: trial.taskBookId,
          })))));
    }

    export type ProjectTrialCandidate = ReturnType<typeof listProjectTrialCandidates>[number];

The candidate function traverses category.configurations, physicalObject.experiments and experiment.trials; excludes candidates when sameProjectTrialSource matches a reference; returns the three IDs, four display names, recordCount and taskBookId. Do not fall back to names.

Create ProjectTrialReferencePicker.tsx as a controlled modal with props open, project, objects, onAdd(source), onCancel. Use listProjectTrialCandidates(objects, project.trialRefs) as the source list. Render each candidate's path as “categoryName / physicalObjectName / experimentName / trialName”; include recordCount and task-book association as secondary information. Search must filter only display fields and must never participate in identity matching. The add action calls onAdd with only physicalObjectId, experimentId and trialId, then leaves the candidate unavailable in the current picker because it is now referenced.

The picker must not accept an arbitrary name as a reference and must not create a concrete trial. Add a local search string and filter candidates by the hierarchy labels plus load-spectrum name and task-book ID/name; the filter changes only the displayed candidate list, not identity. A representative selection handler is:

    const addSelectedTrial = (candidate: ProjectTrialCandidate) => {
      onAdd({
        physicalObjectId: candidate.physicalObjectId,
        experimentId: candidate.experimentId,
        trialId: candidate.trialId,
      });
    };

- [ ] **Step 4: Add a reference view and project navigation**

Extend ProjectView in frontend/src/workspace/types.ts with 'trials'. In buildProjectNavigation, add “关联具体试验” only when a non-session-owned project has at least one reference:

    if (!project.sessionOwnerId && (project.trialRefs ?? []).length > 0) {
      items.push({ key: project.id + ':trials', title: '关联具体试验', view: 'trials' });
    }

Create ProjectTrialReferencesView.tsx to resolve each reference through resolveProjectTrialReference and render:
- available source: hierarchy path, number of execution records, optional task-book name, open action and remove action;
- unavailable source: “来源不可用”, the referenced IDs for diagnosis, disabled open action and remove action.

The remove action must call removeTrialReference(project.id, reference.id) after a confirmation. It must not call any physical-object, file, chart, session or artifact deletion API.

- [ ] **Step 5: Wire the picker and project view**

In ProjectResourcesPage.tsx, add state for the picker and render the action only for a selected organizational project:

    {!isSessionResources && projectId && (
      <Button onClick={() => setAddTrialOpen(true)}>添加已有具体试验</Button>
    )}

Mount ProjectTrialReferencePicker with open={addTrialOpen}, the currently resolved project and canonical objects. Its onAdd handler must re-read useProjectStore.getState().projects before calling addTrialReference; if the project no longer exists, close the picker and show an error rather than writing to another project. Render the picker only when pathname does not start with /sessions/.

In ProjectContent.tsx, add the '关联具体试验' label to the existing viewLabels record and render ProjectTrialReferencesView for the 'trials' view only when the current workspace is not session-owned. In ProjectOverview.tsx, show the referenced-trial count and a button that selects the 'trials' view when the count is nonzero. Keep all existing ProjectArtifact and worksheet rendering behavior unchanged.

- [ ] **Step 6: Run the focused tests and inspect the UI diff**

Run:

    node --test tests/projectTrialReferences.test.mjs
    git diff --check

Expected: all project-reference model tests PASS; git diff --check emits no output. Review the diff to confirm no reference action mutates ConcreteTrial or taskBookId.

- [ ] **Step 7: Commit the project UI**

    git add src/workspace/projectModel.ts src/workspace/ProjectTrialReferencePicker.tsx src/workspace/ProjectTrialReferencesView.tsx src/workspace/ProjectResourcesPage.tsx src/workspace/ProjectContent.tsx src/workspace/ProjectOverview.tsx tests/projectTrialReferences.test.mjs
    git commit -m "feat: manage referenced trials in projects"

**Per-Task Coverage Review**

- Candidate enumeration and exclusion → model tests verify complete hierarchy and duplicate exclusion.
- Stable-ID resolution → stale-source test removes a source ID and verifies no name-based replacement.
- Project-only navigation → browser acceptance verifies the picker is absent from /sessions/ resource pages.
- Remove-only semantics → test and browser verification compare source records/files/charts before and after removing a reference.
- Project discoverability → project navigation and overview expose the view when references exist.

Coverage result: **COVERAGE_COMPLETE**.

---

## Task 3: Open References in Source-Specific Project Sessions

**Files:**
- Modify: frontend/src/workspace/sessionStore.ts
- Modify: frontend/src/workspace/ProjectTrialReferencesView.tsx
- Create: frontend/tests/projectTrialReferenceSessions.test.mjs
- Create: frontend/scripts/verify-project-trial-references.mjs

**Interfaces:**

- **Consumes:** project ID, reference source tuple, resolvePhysicalSource, samePhysicalSource and getSessionPath.
- **Produces:** sessionStore.ensureProjectTrialSession(projectId, businessScope), which returns the ID of a session bound to the exact canonical trial source.

**Acceptance:**

- Opening a reference validates that the project and full source tuple still exist.
- A project trial session is reused only when it belongs to the same storage project and already has the same concrete-trial source.
- An unrelated session or a session with no source is never silently repurposed for an existing referenced trial.
- Opening a trial in two projects preserves the same physicalObjectId, experimentId and trialId but keeps storageProjectId and session drafts scoped to each project.
- Task-book association is not changed.

- [ ] **Step 1: Write failing session isolation tests**

Create frontend/tests/projectTrialReferenceSessions.test.mjs. Initialize an in-memory localStorage, bundle sessionStore.ts, projectStore.ts, physicalObjectStore.ts and physicalBusinessContext.ts with esbuild, and export useSessionStore, useProjectStore, usePhysicalObjectStore and resolvePhysicalSource. Create a category, physical object, trial configuration and concrete trial using the physical-object store, then create project A and project B. Use a scope with the IDs returned by the store methods.

Add these assertions:

    test('project trial sessions reuse only the same source within the same project', () => {
      const first = useSessionStore.getState().ensureProjectTrialSession(projectA, scope);
      const repeated = useSessionStore.getState().ensureProjectTrialSession(projectA, scope);
      const otherProject = useSessionStore.getState().ensureProjectTrialSession(projectB, scope);

      assert.equal(first, repeated);
      assert.notEqual(first, otherProject);
      assert.equal(useSessionStore.getState().sessions.find(item => item.id === first).storageProjectId, projectA);
      assert.equal(useSessionStore.getState().sessions.find(item => item.id === otherProject).storageProjectId, projectB);
      assert.deepEqual(
        ['physicalObjectId', 'experimentId', 'trialId'].map(key => useSessionStore.getState().sessions.find(item => item.id === first).businessScope[key]),
        ['physicalObjectId', 'experimentId', 'trialId'].map(key => scope[key]),
      );
    });

    test('a scope-less project session is not repurposed and invalid sources are rejected', () => {
      const blank = useSessionStore.getState().ensureProjectSession(projectA);
      const opened = useSessionStore.getState().ensureProjectTrialSession(projectA, scope);
      assert.notEqual(blank, opened);
      assert.throws(() => useSessionStore.getState().ensureProjectTrialSession(projectA, { ...scope, trialId: 'deleted-trial' }));
    });

    test('opening a referenced trial does not change its task-book association', () => {
      const before = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, scope).trial.taskBookId;
      useSessionStore.getState().ensureProjectTrialSession(projectA, scope);
      const after = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, scope).trial.taskBookId;
      assert.equal(after, before);
    });

- [ ] **Step 2: Run the session tests and confirm the new action is missing**

Run:

    node --test tests/projectTrialReferenceSessions.test.mjs

Expected: FAIL because ensureProjectTrialSession has not been added.

- [ ] **Step 3: Add a source-specific session-store action**

Add this signature to SessionStore in sessionStore.ts:

    ensureProjectTrialSession: (projectId: string, businessScope: PhysicalBusinessScope) => string;

Implement it using the existing create and update helpers. Before session lookup, verify that projectId identifies an existing organizational project, that businessScope contains physicalObjectId, experimentId and trialId, and that resolvePhysicalSource(usePhysicalObjectStore.getState().objects, businessScope) resolves a non-missing concrete trial. Throw a clear error if any validation fails.

Use this implementation shape:

    ensureProjectTrialSession: (projectId, businessScope) => {
      if (!businessScope.physicalObjectId || !businessScope.experimentId || !businessScope.trialId) {
        throw new Error('项目引用缺少完整的具体试验来源');
      }
      const project = useProjectStore.getState().projects.find(item => item.id === projectId && !item.sessionOwnerId);
      if (!project) throw new Error('目标项目不存在或不是组织项目');
      const source = resolvePhysicalSource(usePhysicalObjectStore.getState().objects, businessScope);
      if (source.missing || !source.configuration || !source.experiment || !source.trial) {
        throw new Error('关联的具体试验不存在');
      }
      const scope = {
        ...businessScope,
        physicalObjectName: source.configuration.name,
        experimentName: source.experiment.name,
        trialName: source.trial.name,
      };
      const existing = get().sessions.find(session => !session.taskId && !session.archived
        && session.storageProjectId === projectId
        && session.businessScope?.trialId === source.trial.id
        && samePhysicalSource(session.businessScope, scope));
      if (existing) {
        update(existing.id, session => ({ ...session, businessScope: scope }));
        return existing.id;
      }
      return create({
        title: source.trial.name + ' · 试验工作',
        projectId,
        storageProjectId: projectId,
        businessScope: scope,
      });
    },

Reuse only a non-task, non-archived session where storageProjectId equals projectId and samePhysicalSource(session.businessScope, scope) is true and the trialId is equal. Update display names from the canonical source. Otherwise create a new session with the canonical trial name, projectId and storageProjectId both set to the requested project, and businessScope containing the source IDs and current display names. Do not change ensureProjectSession, which remains the creation path for a new trial launched from a project.

- [ ] **Step 4: Open references through the new action**

In ProjectTrialReferencesView.tsx, the open handler must first resolve the reference against the latest physical-object store. If it is missing, show “关联的具体试验已不存在，请移除失效引用后重试” and do not navigate. Otherwise build a PhysicalBusinessScope from the resolved IDs and current names, call ensureProjectTrialSession(project.id, scope), call openSession(sessionId, 'doe'), then navigate to getSessionPath(sessionId, 'doe'). Do not change the canonical trial's taskBookId or write the reference project ID into the trial.

- [ ] **Step 5: Run model and session tests**

Run:

    node --test tests/projectTrialReferences.test.mjs tests/projectTrialReferenceSessions.test.mjs

Expected: all reference and session-isolation tests PASS.

- [ ] **Step 6: Add browser acceptance scenarios**

Create verify-project-trial-references.mjs using the existing Playwright scripts' isolated browser-context pattern. Begin with this setup and use only a fresh browser context:

    import assert from 'node:assert/strict';
    import { createRequire } from 'node:module';
    const require = createRequire(process.env.PROTANGRAM_PLAYWRIGHT_ROOT ?? '/tmp/protangram-browser-check/node_modules/playwright/package.json');
    const { chromium } = require('playwright');
    const baseURL = process.env.PROTANGRAM_TEST_URL ?? 'http://127.0.0.1:5175';
    const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route =>
      ['POST', 'PUT', 'PATCH', 'DELETE'].includes(route.request().method()) ? route.abort() : route.continue());
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));

Seed the canonical physical-object, project and session storage keys with synthetic fixture data in this context. Use real visible controls for selection, addition, opening and removal; do not call component handlers directly. Verify these user-visible flows:
1. Create project A and project B, then add the same existing concrete trial to each.
2. Verify both projects show the same canonical hierarchy and record count.
3. Open the reference in project A; assert the session route and stored businessScope contain the original source IDs.
4. Open the reference in project B; assert its storageProjectId differs from project A while the source IDs remain equal.
5. Remove the reference from project A; assert project B still lists it and the original trial, records, CSV files and charts remain unchanged.
6. Remove or invalidate a referenced source in the isolated fixture; assert the UI displays “来源不可用”, disables open and permits removal.
7. Navigate to /sessions/<sessionId>/resources and assert the organizational-project picker is not present.
8. Confirm the page has no runtime errors.

- [ ] **Step 7: Run browser acceptance and commit**

Run with an existing Vite server:

    PROTANGRAM_TEST_URL=http://127.0.0.1:5175 node scripts/verify-project-trial-references.mjs

Expected: all eight scenarios print PASS and the script exits with status 0.

Then run:

    git add src/workspace/sessionStore.ts src/workspace/ProjectTrialReferencesView.tsx tests/projectTrialReferenceSessions.test.mjs scripts/verify-project-trial-references.mjs
    git commit -m "feat: open referenced trials in project sessions"

**Per-Task Coverage Review**

- Source validity → tests reject missing category/object/configuration/trial IDs and browser UI disables opening stale references.
- Same-source reuse → repeated opening in one project returns the same session ID.
- Cross-project isolation → two projects get separate storage projects and drafts while retaining identical source IDs.
- Task-book boundary → test asserts taskBookId is unchanged.
- UI end-to-end behavior → browser script verifies add, display, open, remove, stale source and session-resource isolation.

Coverage result: **COVERAGE_COMPLETE**.

---

## Final Verification Contract

Before treating this plan as complete after implementation:

1. Run the focused model/session tests and the full test suite:

       node --test tests/projectTrialReferences.test.mjs tests/projectTrialReferenceSessions.test.mjs
       node --test tests/*.test.mjs

   Expected: all selected and full-suite tests pass.

2. Run lint on every changed TS/TSX module using the repository's existing ESLint configuration, then run:

       npm run build
       git diff --check

   Expected: build succeeds and git diff --check emits no output. Record any pre-existing lint or bundle warnings separately; do not suppress them to make the result appear clean.

3. Run the Playwright browser script against an isolated test context. The script must not use the user's existing browser profile or modify real user data.

4. Review the final diff against the Business Contract. Specifically verify that no code adds projectId to ConcreteTrial, copies source records/files/charts, changes taskBookId, matches by display names, or deletes canonical data when a reference is removed.

5. Keep the implementation limited to the frontend project store, project UI and source-specific session creation. No backend API, database migration or deployment is part of this plan.

## Self-Review

- **Spec coverage:** Optional project grouping is preserved; project-to-trial links are additive; source ownership remains in physicalObjectStore; session drafts stay scoped; task-book reporting behavior is unchanged. Each implementation requirement maps to a task above.
- **Placeholder scan:** All tasks specify target files, observable outcomes, commands and expected results. No unresolved decision is delegated to the implementer.
- **Type consistency:** ProjectTrialReference consistently uses physicalObjectId, experimentId and trialId; ensureProjectTrialSession consumes the corresponding PhysicalBusinessScope; the UI navigates through getSessionPath using the returned session ID.
- **Scope boundary:** This file plans the future project-reference extension only. It does not implement the extension or authorize unrelated refactors.
