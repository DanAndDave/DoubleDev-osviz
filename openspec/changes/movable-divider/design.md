## Context

`App` (`src/ui/App.tsx`) sizes the layout each render: `listWidth` is the widest Change row (at least 40), `beside` resolves the Placement mode against it, `listHeight` is the terminal's height (minus three with the panel below) and `panelHeight` is what the shown rows leave. The list `<Box>` has `width={listWidth}`, `flexShrink={0}`; the panel `<Box>` has `flexGrow={1}` and draws one border: left beside, top below. Rows are `wrap="truncate-end"`, so a narrower list cuts them with `…`.

Ink 7 has no mouse support, but its input parser treats an SGR mouse report (`ESC [ < b ; x ; y M|m`) as one CSI sequence, and `useInput` hands it over as `input === "[<b;x;yM"` with no key flag set; no existing key binding matches such a string.

When a panel is shown the frame is exactly the terminal's height (beside: `panelHeight = terminalRows`; below: list rows + border + `panelHeight`), so Ink writes it fullscreen and frame row 0 is screen row 1. Pointer coordinates therefore map to frame coordinates by subtracting one.

## Goals / Non-Goals

**Goals:**
- Plain click-drag text selection keeps working: mouse reporting is on only while the Divider is armed.
- `App` stays render-only: it does not write terminal control sequences itself.

**Non-Goals:**
- Hit-testing the border. Armed, a press anywhere moves the Divider there; one-column targets are fiddly and the user already said what they want by pressing `m`.
- Keyboard moving, resetting, saving.

## Decisions

### State
`State` gains `divider: { beside: number | undefined; below: number | undefined }` (undefined: never moved; today's sizing) and `dividerArmed: boolean`. Actions: `toggleDivider` (`m`, ignored with nothing selected, as `toggleFocus` and `cyclePlacement`), `disarmDivider` (`Esc`, button release), `moveDivider { side, at }` (ignored unless armed). `reduce`'s every-action rule that returns Focus to the list with nothing selected also disarms.

Each placement keeps its own place because the units differ (columns vs rows) and a column count is meaningless as a row count.

### Clamping
`App` clamps `at` before dispatching, since only it knows the terminal size (as it passes `limit` with `scroll`), and clamps again where it draws, for resizes. Beside: `[10, terminalColumns - 10]`, mirroring `PANEL_SQUEEZED_MIN_WIDTH` for both sides. Below: `[1, max(terminalRows - 3, 1)]`, the same three rows the panel keeps today.

### Layout
- `naturalWidth` (today's `listWidth`) still decides `beside`, so a moved Divider never flips placement.
- `listWidth = beside && divider.beside !== undefined ? clamp(divider.beside) : naturalWidth`.
- Below with a moved Divider, `listHeight` is the clamped place and the list `<Box>` gets `height={listHeight}` so the border sits there even with fewer rows; `panelHeight` subtracts that height instead of `shown.length`.

### Pointer events
In `useInput`, `/^\[<(\d+);(\d+);(\d+)([Mm])$/` matches a report; it returns before any key check. Final `m` with button code 0 (the left button's release) disarms. Final `M` with button code 0 (press) or 32 (motion with the left button) dispatches `moveDivider` at `x - 1` beside or `y - 1` below. Wheel (64/65) and other buttons, pressed or released, are ignored. Modifier bits (4, 8, 16) are masked off so Ctrl/Alt-drags still work.

### Mouse capture seam
`App` takes `onMouseCapture?: (on: boolean) => void` and calls it from an effect on `dividerArmed`: `true` when armed, `false` in the cleanup (disarm or unmount). `cli.tsx` passes a function writing `ESC[?1002h ESC[?1006h` / `ESC[?1002l ESC[?1006l` to stdout when it is a TTY, and writes the off sequence again after `waitUntilExit()` in a `finally`.

Alternative: write the sequences from `App` via `useStdout()`. Rejected: ink-testing-library records every stdout write as the last frame, and it would make `App` own terminal modes.

Mode 1002 (button-event tracking) reports presses, releases and motion only while a button is held, which is exactly a drag; 1006 (SGR) gives unbounded decimal coordinates and distinguishes release by its final byte.

### Armed look
`Panel` gains `armed`; its `borderStyle` is `"double"` while armed, else `"bold"`/`"single"` by Focus. The colour still follows Focus.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `detail-panel`: Moving the Divider | `<App>` via ink-testing-library with an `onMouseCapture` recorder; pointer events written to `stdin` as SGR reports; list width read from where the panel's border character sits in the frame, list height from the row of the `═`/`─` border. |
| `detail-panel`: Panel placement, Panel focus; `change-list`: List scrolling | Existing tests, unchanged: they never arm the Divider. |

One seam: `<App>` on a fixture Project, as in every archived change. `cli.tsx`'s escape sequences are checked by a smoke run in a real terminal.

## Risks / Trade-offs

- [A frame shorter than the terminal (no panel) would not map rows to the screen] → the Divider cannot be armed without a panel, and with one the frame is fullscreen.
- [Process killed while armed leaves the terminal reporting the mouse] → normal exit and Ctrl+C both run the `finally`; a `kill -9` needs `reset`, as with any TUI.
- [Terminals without SGR mouse (1006) send legacy X10 reports] → ignored: they do not match the pattern; their stray bytes arrive as one multi-character input that matches no key.
