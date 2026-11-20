# Proposal: Move the Divider with the mouse

Triage: ready-for-agent

## Why

The list is always as wide as its widest Change row, and below it the panel gets whatever rows the list leaves. A user who wants more room for long task lines beside the list, or more Change rows above a panel below it, cannot get it. The proposal for swap-panel-placement put "resizing the split" out of scope; this change takes it on.

## What Changes

- The **Divider** is the Detail panel's border between it and the list: a column beside the list, a row below it.
- `m` **arms** the Divider, whichever side has Focus. While no panel is shown, `m` does nothing, as `Tab` and `v` do. Armed, the dashboard turns on terminal mouse reporting, and the panel's border is drawn double (`║` beside the list, `═` below it).
- While armed, pressing the left mouse button moves the Divider to the pointer, and dragging moves it with the pointer. Releasing the button disarms it; so do `m` again and `Esc`. Disarmed, mouse reporting is off, so plain click-drag selects text in the terminal as before.
- Beside the list, the Divider sets the list's width: from 10 columns up to the terminal's width minus 10, Change rows cut with `…` when narrower than they are. Below the list, it sets the list's height: from one row up to the terminal's height minus three, the list keeping that height even with fewer rows.
- Each placement keeps its own Divider position, for the life of the dashboard, across refreshes, selection changes, Placement mode changes and resizes; when the terminal shrinks, the position is clamped to the new bounds. Before the Divider is first moved, every size rule stays as today.
- The Placement mode still decides beside or below from the list's widest row, not from a moved Divider.

Out of scope: moving the Divider by keyboard, resetting it to its starting place, saving it between runs, mouse wheel scrolling, clicking rows.

## Capabilities

### New Capabilities

### Modified Capabilities
- `detail-panel`: a new Moving the Divider requirement; Panel placement and Panel focus defer to it for the list's width and the border's style.
- `change-list`: List scrolling defers to the Divider for the list's height below the panel.

## Impact

- `src/ui/App.tsx`: `divider` and `dividerArmed` in `State`, three actions (`m`, `Esc`/release, pointer), SGR mouse report parsing in `useInput`, list width and height from the Divider, an `onMouseCapture` prop.
- `src/ui/Panel.tsx`: an `armed` prop drawing the border double.
- `src/cli.tsx`: turns xterm mouse reporting (modes 1002 and 1006) on and off for `onMouseCapture`, and off on exit.
- `test/app.test.tsx`: tests for the new requirement.
- `README.md` keys table, `CONTEXT.md` **Divider** term.
