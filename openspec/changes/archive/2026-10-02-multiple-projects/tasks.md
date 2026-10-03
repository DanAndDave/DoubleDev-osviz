## 1. Command line and Project list

- [x] 1.1 Red then green in `test/args.test.ts`: several positionals in order with labels as typed, `--base` before, between and after them, no path → `[{ label: cwd, path: cwd }]`. Change `parseCommandLine` to return `{ projects: { label, path }[]; base }` and update `USAGE` to `usage: osviz [path ...] [--base <ref>]`. Verify `bun test test/args.test.ts`.
- [x] 1.2 Change `<App>` to take `projects: { label, initial, read }[]` and `src/cli.tsx` to await `Promise.all` of the first reads. Change `show` in `test/app.test.tsx` to take `string | string[]`, and the "No overlapping reads" test to pass one Project. Keep `State` on `projects[0]` for now. Verify `bun run typecheck` and the existing `bun test` pass unchanged.

## 2. One row model over every Project

- [x] 2.1 Red then green: "Two Projects in command-line order", "Projects not interleaved", "One Project has no header", "Project without active changes" and "Columns line up across Projects". Do this by making `State.snapshots` and per-Project `expanded`, and adding the `header`/`projectError`/`empty`/`change` row union with `RowKey.project`. Compute widths over every Project's `change` rows, and draw headers bold and cut to the list's width.
- [x] 2.2 Red then green: "One of several Projects fails", "One Project unreadable", "Long Project error cut to the list", and "Base missing in one Project" (two fixtures, read with `{ base: "develop" }`). Draw a Project error row as a one-line `✗ message`, cut like a Change version's error row. Change the single-Project "Error rows" assertions to the cut row.
- [x] 2.3 Red then green: "Starts below the first header", "Across a Project boundary", "Skipping a Project without rows to select", "Project error row selected" and "Nothing to select". Make `selected` `number | undefined` and have `move` step over rows that cannot be selected. Verify the existing Selection tests still pass.
- [x] 2.4 Red then green: "Toggle covers every Project", "Selected archived Change hidden" (first selectable row), "Same change id in two Projects" and "Enter on a Project error row". Verify the existing Archived and Expanding tests still pass.

## 3. Panel for a Project error

- [x] 3.1 Red then green: "Project error selected" and "Project error row selected" (label, then the full message wrapped). Change `Panel` to take a `version` or `project` subject, and take `labelled` from the selected row's Project. Replace the "Project error: no panel" test with the new behaviour. Verify the Detail panel tests still pass.

## 4. List scrolling

- [x] 4.1 Red then green: "Selection moves below the window", "Window stays while the selection is shown", "Selection moves above the window" and "Short list does not scroll" at a pinned small terminal. Add a pure `windowTop(previousTop, rows, selected, height)` kept in a `useRef`. The list's height is `terminalRows`, or `terminalRows - 3` with the panel below, and at least 1. Render only the window.
- [x] 4.2 Red then green: "Crossing into the next Project shows its header" and "First Project's header comes back". Do this by widening the selected row to the rows that cannot be selected next to it, up to the nearest selectable row or the end of the list.
- [x] 4.3 Red then green: "Taller terminal shows more rows" with `resize`, and "Below a list that fills the terminal" (7-row terminal, 10-row list, first line and `… 3 more`, replacing today's test). Set `panelHeight` to `terminalRows - shownRows - 1`. Verify the existing Panel placement and Fitting tests still pass.

## 5. Refresh per Project

- [x] 5.1 Red then green: "Every Project re-read" and "One Project breaks during a refresh". Use one `reading` flag per Project, and have each read dispatch `refreshed { project, snapshot }` as it finishes. Verify the existing Periodic refresh, Refresh on demand and Problems during a refresh tests pass.
- [x] 5.2 Red then green: "Slow Project does not hold up another" and "Slow Project skipped, others read". Render `<App>` with one hand-resolved `read` per Project and count calls for each.
- [x] 5.3 Red then green: "Rows added in a Project above", "Selected Project becomes readable" and "Selected Project's last Change gone". Use the `refreshed` fallbacks from `design.md`: Project error to first row, gone version to its Change's first row, old position within the Project clamped, nearest selectable row from the Project's header down then up, and nothing selected to first selectable row. Verify the existing Place kept across a refresh tests pass.

## 6. Close

- [x] 6.1 Run `bun run typecheck` and the full `bun test` once. Smoke-run `bun src/cli.tsx <repo-a> /tmp/no-openspec <repo-b>` in a terminal shorter than the list. Check the headers, the error row with its panel, that `j`/`k` cross Projects while the window scrolls, and that ticking a task in `<repo-b>` shows within 5 seconds while the error row stays.
