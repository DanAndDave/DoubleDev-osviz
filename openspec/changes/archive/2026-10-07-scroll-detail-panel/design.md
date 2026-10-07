## Context

`App` (`src/ui/App.tsx`) holds the dashboard in a `useReducer` `State` (`snapshots`, `expanded`, `showArchived`, `selected`) and routes `j`/`k` to a `move` action. `Panel` (`src/ui/Panel.tsx`) receives a `PanelSubject` and a height and calls `fitPanel`, which collapses finished Task sections from the top and then cuts with `… N more`. The panel's height is known only at render: it depends on terminal size, placement and how many list rows are shown. See proposal.md for why the panel must scroll.

## Goals / Non-Goals

**Goals:**
- One reducer step decides selection, Focus and scroll position together, as it already does for selection.
- Collapsing stays exactly as specified; scrolling is a window over its output.

**Non-Goals:**
- A general focus system (Ink's `useFocus`): two sides only.
- Per-Change scroll memory.

## Decisions

### Focus and scroll in `State`
`State` gains `focus: "list" | "panel"` and `scroll: number`. A wrapper around the existing `reduce` resets `scroll` to 0 whenever the selected row's key changes (`move`, `toggleExpanded`, a refresh fallback), and sets `focus` to `"list"` whenever nothing is selected, so every action path obeys both rules without each case repeating them. New actions: `toggleFocus` (ignored with nothing selected) and `scroll { by, limit }`.

Alternative: keep scroll in a `useState` beside the reducer. Rejected: resetting it on selection change would need an effect comparing keys across renders, and render-then-correct shows one wrong frame.

### Clamping against a limit computed at render
`Panel.tsx` exports `scrollLimit(subject, height)`: 0 for error panels, panels that fit, and panels with fewer than three rows below the first line; otherwise `lines - height` after collapsing. `App` computes it each render, draws the panel at `min(scroll, limit)`, and passes `limit` in the `scroll` action, which applies `clamp(min(scroll, limit) + by, 0, limit)`. Ink's `useInput` re-subscribes the latest handler each render, so the action carries the current limit.

The stored `scroll` may exceed the limit after a refresh or resize; render clamps it (spec: "shows its last lines"), and the next key press starts from the clamped value, so `k` responds at once.

Alternative: store the limit in `State` via a `resized` action. Rejected: the limit depends on list layout derived during render; mirroring it into state duplicates layout logic.

### Windowing after collapsing
`fitPanel` splits into `collapse(subject, height)` (the collapsed lines, uncut) and `windowOf(lines, height, scroll)`. With body `B` = lines after the first and `r = height - 1` rows for it:
- `scroll = 0`: today's output (all of `B` if it fits, else `B[0..r-1)` and `… N more`).
- `scroll = s ≥ 1`: `… N above` hiding `B[0..s+1)`, then `B` from `s + 1`, cut with `… N more` unless the rest fits in `r - 1` rows.

The limit `lines - height` is the smallest `s` at which the rest fits. Task counting for both lines reuses `tasksIn`.

### Focus cue
`Panel` takes `focused` and sets `borderColor="cyan"` on its `Box`; Ink colours the left or top border alike.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `detail-panel`: Panel focus | `<App>` via ink-testing-library: `press(app, "\t")`, the border line's colour from the styled frame, `selected()` for the list. |
| `detail-panel`: Scrolling the panel | `<App>` panel via `panelLines`, using the `section` fixture from "Fitting the panel's height"; `resize` and `refresh` for the keep/clamp scenarios. |
| `detail-panel`: Fitting the panel's height | Existing tests, unchanged. |
| `change-list`: Selection | Existing Selection tests (list Focus by default); the panel-Focus case is covered under Panel focus. |

One seam: `<App>` on a fixture Project, as in every archived change.

## Risks / Trade-offs

- [Each scroll step from the top moves the body two lines, as the `… above` line takes a row] → inherent to marking hidden lines; accepted, and every later step moves one line.
- [User forgets the panel has Focus and `j` seems dead] → cyan border; `Tab` toggles back.
