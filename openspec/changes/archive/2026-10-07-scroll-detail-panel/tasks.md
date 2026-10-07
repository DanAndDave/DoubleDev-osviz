## 1. Focus

- [x] 1.1 Red then green: "Starts on the list", "Tab moves Focus to the panel and back" and "No panel" in a new `<App>` "Panel focus" describe in `test/app.test.tsx`; add `focus` to `State`, the `toggleFocus` action on `Tab`, the Focus-to-list rule, and `Panel`'s `focused` cyan border; verify with `bun test test/app.test.tsx`
- [x] 1.2 Red then green: "Movement keys follow Focus" and "Other keys unaffected"; route `j`/`k`/arrows by Focus

## 2. Scrolling

- [x] 2.1 Red then green: "Scroll one line down", "Scroll to the end", "Scroll back up" and "Nothing to scroll" in a "Scrolling the panel" describe; split `fitPanel` into collapsing and windowing, export `scrollLimit`, add `scroll` to `State` and the clamped `scroll` action as in design.md; the "Fitting the panel's height" describe keeps passing unchanged
- [x] 2.2 Red then green: "Another row selected", "Refresh keeps the position" and "Terminal made taller"; reset `scroll` on selection change in the reducer wrapper and clamp at render

## 3. Close

- [x] 3.1 Add **Focus** to `CONTEXT.md`, `Tab` and the panel scrolling to `README.md`'s keys table and detail panel paragraph
- [x] 3.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` in a short terminal on a throwaway repo with a long `tasks.md`, press `Tab`, `j`, `k`, and observe the cyan border, `… N above`/`… N more` and the scroll stopping at both ends
