# Proposal: Scroll the Detail panel

Triage: ready-for-agent

## Why

When a Change version's Task sections do not fit the Detail panel, even after finished sections collapse, the panel ends in `… N more` and the cut tasks cannot be seen from the dashboard at all. The list already scrolls with `j`/`k`; the panel should too.

## What Changes

- `Tab` moves **Focus** between the list and the Detail panel; the dashboard starts with Focus on the list. `Tab` does nothing while no panel is shown, and Focus returns to the list when the panel goes away.
- While the panel has Focus, `j`/`↓` and `k`/`↑` scroll the panel one line down or up instead of moving the selection. `Enter`, `a`, `r` and `q` act as before whatever has Focus.
- The panel's border is drawn in cyan while it has Focus, so the user can see which side the movement keys act on.
- Scrolling applies after fitting: finished Task sections still collapse first, and scrolling reaches the lines that still do not fit. The panel's first line stays put. Scrolled down, the first line below it reads `… N above`, N counting the tasks above it the way `… N more` counts the tasks below; the panel scrolls no further once its last line is shown.
- The scroll position resets to the top whenever another row is selected. A refresh or resize keeps it, moved up only as far as needed when the panel's lines got fewer or the panel got taller.
- An error panel (a Change version's or a Project's) and a panel with fewer than three rows below its first line do not scroll.

Out of scope: page-at-a-time scrolling, remembering each Change's scroll position, expanding collapsed sections by scrolling, mouse wheel.

## Capabilities

### New Capabilities

### Modified Capabilities
- `change-list`: Selection moves with `j`/`k` only while the list has Focus.
- `detail-panel`: new Panel focus and Scrolling the panel requirements.

## Impact

- `src/ui/App.tsx`: Focus and panel scroll position in the dashboard state, `Tab` handling, `j`/`k` routed by Focus, scroll reset on selection change.
- `src/ui/Panel.tsx`: fitting split into collapsing and windowing; the panel takes a scroll position and a focused flag; a scroll limit for the dashboard to clamp against.
- `test/app.test.tsx`: tests for Focus and scrolling.
- `README.md` keys table, `CONTEXT.md` **Focus** term.
