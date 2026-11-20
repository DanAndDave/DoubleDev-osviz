## 1. Arming

- [x] 1.1 Red then green: "Not armed by default", "m arms and disarms", "Esc disarms" and "m without a panel" in a new "Moving the Divider" describe of `test/app.test.tsx`, with an `onMouseCapture` recorder. Add `dividerArmed` to `State`, `toggleDivider`/`disarmDivider` in `apply`, the disarm-with-nothing-selected rule in `reduce`, the `onMouseCapture` effect, and `Panel`'s `armed` double border

## 2. Dragging

- [x] 2.1 Red then green: "Dragging beside the list", "Narrowing the list cuts its rows", "Clamped to the terminal" and "Pointer ignored while disarmed". Add `divider` to `State`, `moveDivider`, SGR report parsing in `useInput`, and `listWidth` from the Divider beside the list
- [x] 2.2 Red then green: "Dragging below the list" and "Kept across placement changes"; list height and `panelHeight` from the Divider below the list

## 3. Close

- [x] 3.1 `cli.tsx`: pass `onMouseCapture` writing modes 1002/1006 on and off when stdout is a TTY, and turn them off after `waitUntilExit()` in a `finally`
- [x] 3.2 Add **Divider** to `CONTEXT.md`, `m` to `README.md`'s keys table and the Divider to its detail panel paragraph
- [x] 3.3 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` in a real terminal, press `m`, drag the Divider beside and below the list, and check that click-drag selects text again after release
