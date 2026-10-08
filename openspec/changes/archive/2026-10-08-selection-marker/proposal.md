# Proposal: Selection marker and Focus cue

Triage: ready-for-agent

## Why

The selected row is drawn in inverse video across its whole width, which swamps the row's own styling (bold and dimmed artifact letters, the green and yellow markers) and makes the selected Change the hardest one to read. And when `Tab` gives the Detail panel Focus, the only cue is the panel's single border line turning cyan; the list looks unchanged, so it is easy to miss that `j`/`k` now scroll the panel.

## What Changes

- Every list row but a Project header starts with a two-column **selection marker** column: `> ` on the selected row, two spaces on every other row. The selected row is no longer drawn in inverse video; it keeps its normal styling. The marker column counts toward the row's width, so the list is two columns wider than before.
- Header rows stay flush left, so a Project's rows read as indented under it.
- While the Detail panel has Focus, the list's `>` is drawn dimmed: the selection is kept but visibly inactive. While the list has Focus it is drawn at normal intensity.
- While the Detail panel has Focus, its border is drawn heavy (`┃` beside the list, `━` below it) as well as cyan, so the cue survives themes where cyan is faint and terminals without colour.

Out of scope: a cursor or marker inside the panel (`j`/`k` scroll it, they do not select a line), a key hint line, changing which keys move Focus.

## Capabilities

### New Capabilities

### Modified Capabilities
- `change-list`: Selection is shown by the `> ` marker column instead of highlighting, dimmed while the panel has Focus.
- `detail-panel`: Panel focus draws the focused panel's border heavy as well as cyan.

## Impact

- `src/ui/App.tsx`: `RowLine` draws the marker column and drops `inverse`; row widths include the column; the list's Focus passed to the marker.
- `src/ui/Panel.tsx`: `borderStyle` heavy while focused.
- `test/app.test.tsx`: helpers that find the selection by inverse video, read list lines and split the frame at the panel's border; width fixtures two columns narrower in their ids.
- `README.md` detail panel paragraph, `CONTEXT.md` **Focus** term.
