# Proposal: Swap the Detail panel's placement

Triage: ready-for-agent

## Why

The Detail panel's placement is decided by the terminal's width alone: beside the list when the terminal is at least the list's width plus 40 columns, otherwise below it. A user who wants the panel below on a wide terminal (long task lines, or a tall narrow window split) or beside on a narrower one cannot get it.

## What Changes

- The dashboard has a **Placement mode**: `auto`, `beside` or `below`. It starts as `auto`, which keeps today's rule.
- `v` cycles the Placement mode `auto` → `beside` → `below` → `auto`, whichever side has Focus. While no panel is shown, `v` does nothing, as `Tab` does.
- `beside` shows the panel right of the list at any terminal width. When the terminal is narrower than the list's width plus 40 columns, the panel takes the columns the list leaves, its lines cut with `…` as usual. Only when that leaves fewer than 10 columns, border included, is the panel shown below the list instead.
- `below` shows the panel below the list at any terminal width.
- The Placement mode is kept across refreshes, resizes and selection changes, for the life of the dashboard; it is not saved.
- Every other placement-dependent rule (panel height beside or below, list height minus three rows when the panel is below, border side, Focus colour) follows the placement shown, unchanged.

Out of scope: a command-line option for the starting Placement mode, saving it between runs, an on-screen indicator of the mode, resizing the split.

## Capabilities

### New Capabilities

### Modified Capabilities
- `detail-panel`: Panel placement gains the Placement mode and the `v` key.

## Impact

- `src/ui/App.tsx`: `placement` in `State`, a `cyclePlacement` action on `v` (ignored with nothing selected), the beside/below decision taking the mode into account, a 10-column squeezed-panel minimum next to `PANEL_MIN_WIDTH`.
- `test/app.test.tsx`: Panel placement tests for the mode.
- `README.md` keys table and detail panel paragraph, `CONTEXT.md` **Placement mode** term.
