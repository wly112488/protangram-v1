# Experiment Workbench Design

## Goal

Convert ProTangram from a left-menu page application into an experiment-centered workbench. The active experiment owns its resource tree, floating canvas windows, worksheet data network, and bottom detail panel.

## Layout

The top header remains the product shell. The previous left navigation moves into a fixed top function bar. Clicking a function opens a non-modal popover below that function; it does not navigate, replace the canvas, or reset the current experiment state.

The left column becomes an experiment navigator. It contains experiment tabs and a resource tree for the active experiment. The tree groups outline, worksheet data, charts, analysis tasks, and reports. Selecting a resource opens or focuses the matching window on the canvas.

The center is a free canvas. Each chart, table network, or configuration panel appears as an independent floating window. Windows can be dragged, resized, minimized, closed, and stacked. Each experiment stores its own window layout.

The bottom panel is linked to the active experiment. It has fixed height, can collapse or expand, and contains sub-tabs for logs, parameters, runs, and data changes.

## Worksheet Data Network

Worksheet data is presented as a network instead of a flat table list. Data nodes represent derived worksheets such as design plan, raw acquisition, cleaned data, factor table, response table, analysis result, and report binding. Edges show lineage and downstream usage.

## Constraints

- Preserve the quiet Ant Design enterprise app style.
- Keep changes scoped to the main layout/workbench shell.
- Do not remove existing routed pages; the workbench can coexist with them.
- Avoid new dependencies for drag/resize in this first version.
- Store demo workbench state locally in React state for this implementation pass.

## Verification

- Build must pass with `npm run build`.
- Manual check should confirm function popovers do not navigate, experiment switching restores separate canvas layouts, resource clicks open/focus windows, and bottom content follows the active experiment.
