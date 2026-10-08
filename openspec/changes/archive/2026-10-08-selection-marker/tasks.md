## 1. Selection marker

- [x] 1.1 Red then green: "Selected row marked", "Marker follows the selection", "Headers are not indented" and "Nothing to select" in the `<App>` Selection describe of `test/app.test.tsx`; switch `selectedLines` to rows starting with `> ` and make `listLines`/`ids` strip the marker column; replace `inverse` in `RowLine` with the marker column, add it to `changeRowWidth`; fix width fixtures; verify with `bun test test/app.test.tsx`
- [x] 1.2 Red then green: "Marker dimmed while the panel has Focus"; pass the list's Focus to `RowLine` and dim the `>` while the panel has it

## 2. Focus border

- [x] 2.1 Red then green: "Tab moves Focus to the panel and back" and "Focused panel below the list" check heavy cyan borders; `split` accepts `┃`/`━`; `Panel` uses `borderStyle="bold"` while focused; verify with `bun test test/app.test.tsx`

## 3. Close

- [x] 3.1 Update `README.md`'s detail panel paragraph and `CONTEXT.md`'s **Focus** term for the `>` marker and heavy border
- [x] 3.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on a throwaway repo with two Changes, press `j`, `Tab`, `Tab`, and observe `>` moving, dimming, and the heavy cyan border
