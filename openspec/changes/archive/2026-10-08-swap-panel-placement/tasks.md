## 1. Placement mode

- [x] 1.1 Red then green: "v cycles the Placement mode" and "Below on a wide terminal" in the "Panel placement" describe of `test/app.test.tsx`; "Starts in auto" is the existing "terminal at least list + 40 wide" test, and the three existing placement tests stay unchanged, as they run in `auto`. Add `placement` to `State`, the `cyclePlacement` action on `v` in `apply`, and resolve `beside` from it as in design.md; verify with `bun test test/app.test.tsx`
- [x] 1.2 Red then green: "Beside squeezed" and "Beside with no room"; add `PANEL_SQUEEZED_MIN_WIDTH = 10` next to `PANEL_MIN_WIDTH`
- [x] 1.3 Red then green: "Mode kept across selection and refresh", "v with the panel focused" and "v without a panel"; ignore `cyclePlacement` while nothing is selected

## 2. Close

- [x] 2.1 Add **Placement mode** to `CONTEXT.md`, `v` to `README.md`'s keys table and the placement cycle to its detail panel paragraph
- [x] 2.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on this repo in a terminal about 100 columns wide, press `v` three times and observe beside → below → auto, then narrow the terminal to about 70 columns in `beside` and observe the squeezed panel with cut lines
