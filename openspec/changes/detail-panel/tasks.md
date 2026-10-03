## 1. Test seam

- [x] 1.1 Give `show` in `test/app.test.tsx` an optional `{ columns, rows }` (default 200×50) set on the test stdout before the first render, and a `resize(app, size)` helper that sets both and emits `resize`; add `listLines` and `panelLines` frame helpers and switch existing list assertions and `selectedLines` to read the list part only; verify the existing `bun test` passes unchanged

## 2. Reading details

- [x] 2.1 Red then green at the `readProject` seam: an existing `proposal.md` without read permission makes that Change version an error and leaves other Changes readable, by having `worktree.ts` read `proposal.md` with `readOptional` and `changeSummary` take its contents in place of the `proposal` flag; verify the new test and the Artifact presence tests pass
- [x] 2.2 Add `parseTasks` to `src/tasks.ts` (Task sections with `heading`, and tasks with `done`, `indent`, `text`), make `countTasks` the sum over its sections, and add `sections` to `ChangeSummary`; verify `test/openspec-contract.test.ts` and the Task progress tests pass
- [x] 2.3 Add `src/proposal.ts` with `parseProposal` (first `Blocked by:` / `Triage:` line before the first `## `), and `blockedBy` / `triage` on `ChangeSummary`; in `commit.ts`, read `proposal.md` blobs in the same `cat-file --batch` as `tasks.md`; verify `bun run typecheck` passes

## 3. Panel content

- [x] 3.1 Red then green through `<App>`: "Collapsed row shows the Headline version", "Expanded row shows its own version", "Selection moves", "Refresh updates the panel" and "No rows", by drawing a panel for the selected row's Change version beside the list
- [x] 3.2 Red then green: the Panel heading scenarios ("Both lines present", "Lines absent", "Lines after the first section ignored", "First occurrence only", "No proposal", "Project without Source labels"), on a fixture with a branch or worktree for the labelled case and one outside git
- [x] 3.3 Red then green: the Task sections scenarios (own progress, sub-heading, tasks before the first heading, heading without tasks, counts add up to the row, finished section `✓`)
- [x] 3.4 Red then green: the Task lines scenarios (green `✓` with dimmed text and dimmed `○`, nested indent, 200-character task cut with `…` at a 40-column panel, continuation lines hidden)
- [x] 3.5 Red then green: "No tasks file", "Tasks file without tasks" and "Error row selected" (full message wrapped in the panel)

## 4. Layout and fitting

- [x] 4.1 Red then green: "Wide terminal", "Narrow terminal" and "Resized while open", by sizing the list from its widest Change row (at least 40) and choosing row or column layout from `useWindowSize`
- [x] 4.2 Red then green: "Long error cut to the list" and "Unreadable proposal file" in the "Error rows" tests, by drawing error rows truncated inside the fixed-width list
- [x] 4.3 Red then green: "Short tasks file shown in full", "Finished sections collapse first", "Cut after collapsing", "Collapsed section below the cut counted", "Below a list that fills the terminal" and "Terminal made shorter", by the pure fitting function and the panel heights from design.md

## 5. Close

- [x] 5.1 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on this repository in a wide terminal, move through rows and check the panel against each change's `tasks.md` and `proposal.md`, then narrow the terminal below the list's width plus 40 and shorten it, and observe the panel move below the list, collapse finished sections and end with `… N more`
