## Context

`App` (`src/ui/App.tsx`) decides placement in one expression each render: `beside = terminalColumns >= listWidth + PANEL_MIN_WIDTH`. Everything placement-dependent already reads that one boolean: `panelBelow` (list height minus three), `panelHeight`, the root `<Box>`'s `flexDirection`, and `Panel`'s `beside` prop (border side and height). The list `<Box>` has a fixed `width={listWidth}` and `flexShrink={0}`; the panel `<Box>` has `flexGrow={1}`, so beside the list it already takes whatever columns the root's `width={terminalColumns}` leaves. Every `PanelLine` is drawn with `wrap="truncate-end"`, so a narrower panel cuts lines with `…` without changing its height. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- The Placement mode changes only the `beside` decision; every rule downstream of it stays as is.

**Non-Goals:**
- A `Placement mode` type shared with `Panel`: `Panel` keeps taking the resolved `beside` boolean.

## Decisions

### Placement mode in `State`
`State` gains `placement: "auto" | "beside" | "below"`, initially `"auto"`, and `Action` gains `{ type: "cyclePlacement" }`, dispatched on `v`. `apply` ignores it when `selected` is undefined (as `toggleFocus` does), so `v` with no panel leaves the mode at `auto`; otherwise it advances `auto → beside → below → auto`. No other action touches `placement`, so selection, refresh and resize keep it.

Alternative: `useState` beside the reducer. Rejected only for consistency: every other user-driven dashboard setting (`showArchived`, `focus`) lives in `State`, and the "no panel" guard reads `selected`, which is reducer state.

### Resolving `beside`
`const beside = placement === "below" ? false : terminalColumns >= listWidth + (placement === "beside" ? PANEL_SQUEEZED_MIN_WIDTH : PANEL_MIN_WIDTH);` with `PANEL_SQUEEZED_MIN_WIDTH = 10` next to `PANEL_MIN_WIDTH`. 10 columns leave 8 text columns after the border and `paddingLeft`, enough for a task symbol and a few characters. Nothing else in `App` or `Panel` changes: the flex layout already gives the panel the remaining columns.

Alternative: shrink the list to make room for a forced-beside panel. Rejected: the list's width is its widest row by spec, and cutting Change rows hides the columns the dashboard exists to show.

### `v` and Focus
`v` is handled in the same `useInput` block as `a`/`r`, independent of `focus`. Moving the panel does not move Focus; the cyan border follows the panel to its new side because `Panel` already colours whichever border it draws.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `detail-panel`: Panel placement | `<App>` via ink-testing-library in the existing "Panel placement" describe: `sixtyColumnList(size)`, `press(app, "v")`, `placement(frame)`, `resize`, `refresh`; `panelLines` for the squeezed cut line; `panelFocused` for the Focus scenario; `noActiveChanges` plus a written Change and `refresh` for "v without a panel". |
| `detail-panel`: Fitting the panel's height, `change-list`: List scrolling | Existing tests, unchanged: they run in `auto`. |

One seam: `<App>` on a fixture Project, as in every archived change.

## Risks / Trade-offs

- [No on-screen sign of the mode, so `auto` and a forced mode look the same until a resize] → out of scope per proposal; the README keys table documents the cycle.
- [In `beside` at 10–39 columns the panel is cramped and most task text is cut] → the user chose it, and `v` reaches `below` in one press.
- [Third `v` press on a narrow terminal looks like it did nothing (`below` → `auto` both below)] → spec scenario "v cycles the Placement mode" pins this as intended.
