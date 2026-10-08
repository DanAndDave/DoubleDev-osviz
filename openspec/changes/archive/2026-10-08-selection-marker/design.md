## Context

`RowLine` (`src/ui/App.tsx`) draws the selected row by setting `inverse` on its outer `<Text>`; Change rows and Project error rows take it, headers and `No active changes` rows never do. The list's width is the widest Change row (`changeRowWidth`) or `LIST_MIN_WIDTH`, and Placement compares it with the terminal width. `Panel` (`src/ui/Panel.tsx`) draws one light border side (`borderStyle="single"`) and colours it cyan while `focused`. Tests find the selection by the inverse escape and split the frame at `│`/`─`. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One place decides the marker column, so every non-header row agrees on it and on the list width.

**Non-Goals:**
- Changing `LIST_MIN_WIDTH`, `PANEL_MIN_WIDTH` or Placement thresholds: they compare against the list width, which now includes the column.

## Decisions

### Marker column in `RowLine`
`RowLine` gains `listFocused: boolean` (the list's Focus) and wraps every non-header row as `<Text wrap="truncate-end"><SelectionMarker/><RowContents/></Text>`: `SelectionMarker` renders `SELECTION_MARKER` (`> `, dimmed when `!listFocused`) on the selected row and as many spaces otherwise. `inverse` goes. The `empty` row takes the column too, so `No active changes` lines up with Change rows under a header.

Alternative: draw the column in `App`'s map, outside `RowLine`. Rejected: `RowLine` already owns the row's single `<Text>` and its truncation; a separate box per row would need its own width bookkeeping for the cut.

### Widths
`changeRowWidth` adds `SELECTION_MARKER.length`, so the width derives from the marker itself. Error rows are already cut to the list width by `truncate-end`, so they need nothing. Headers stay cut to the full list width.

### Heavy border
`Panel` sets `borderStyle={focused ? "bold" : "single"}`. Ink's `bold` box draws `┃`/`━`, one column and one row like `single`, so layout and `height` are unchanged.

Alternative: `double` (`║`/`═`). Rejected: reads as a frame style, not emphasis; `bold` pairs with the light style.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `change-list`: Selection | `<App>` via ink-testing-library. `split` keeps the raw list lines; `selectedLines` reads rows starting with `SELECTED` (`> `) instead of inverse video; `listLines`/`ids` strip the marker column so existing row-content tests keep asserting contents. New tests read the marker column and the styled `>` for the dim case. |
| `detail-panel`: Panel focus | `<App>`: `panelFocused` checks for cyan `┃`/`━`; `split` recognises both light and heavy borders. |
| Every other list requirement | Existing tests, through the updated helpers; width fixtures (`sixtyColumnList`, error row cut) account for the column. |

One seam: `<App>` on a fixture Project, as in every archived change.

## Risks / Trade-offs

- [List two columns wider: a terminal that just fitted the panel beside the list now puts it below] → accepted; `v` forces `beside`.
- [Dim `>` may be faint on some themes] → the heavy cyan border carries the Focus cue on its own.
