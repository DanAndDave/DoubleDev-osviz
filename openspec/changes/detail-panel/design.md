## Context

- `src/tasks.ts` turns `tasks.md` into `{ done, total }` with `TASK_LINE`, copied from OpenSpec 1.13.0; section names and task text are thrown away.
- `proposal.md` is only checked for existence: `commit.ts` filters the tree's paths, `worktree.ts` calls `exists()`. Only `tasks.md` contents are read, by one `git cat-file --batch` per commit Source or one `readFile` per worktree Change.
- `changeSummary` in `src/project/change.ts` builds every readable `ChangeSummary` from the presence flags and the `tasks.md` contents. A `readFile` failure other than `ENOENT` becomes an error `ChangeVersion` through the `.catch` in `readWorktreeSource`.
- `<App>` only draws: it never reads files or git, and a refresh swaps in a whole new `ProjectSnapshot`. Rows are `<Text>` lines in one column `<Box>`. Nothing sets a width or height today; long error rows wrap.
- Ink 7 exports `useWindowSize()`, which re-renders on stdout `resize`; Ink also re-lays out the root on `resize`. `ink-testing-library`'s stdout reports 100 columns and no `rows`, so Ink falls back to the real terminal's size (24 rows when there is none). Setting `columns`/`rows` on that stdout and emitting `resize` re-renders with the new size; checked with a throwaway script.

## Goals / Non-Goals

**Goals:**
- `<App>` stays draw-only: everything the panel shows is in the snapshot.
- The panel's height logic is a pure function of the shown Change version, the panel's width and its height, so its rules are testable without drawing.

**Non-Goals:**
- Parsing anything else from `proposal.md`, or any other Artifact's contents.
- Scrolling or a focus model.

## Decisions

### Read details with every read of the Project
`ChangeSummary` gains `sections: TaskSection[]`, `blockedBy: string | undefined` and `triage: string | undefined`, filled on every read. In `commit.ts` the `proposal.md` blobs join the `tasks.md` blobs in the same `cat-file --batch`; in `worktree.ts` `readOptional(proposal.md)` replaces `exists(proposal.md)`, so an existing but unreadable `proposal.md` throws into the existing `.catch` and becomes an error row, as `tasks.md` does. Alternative: read on selection through a second `readDetail` prop. Rejected: the selection would wait on a read, that read races with refresh, and `<App>` would no longer be handed everything it draws.

Cost: one more blob per Change in the git batch, one more `readFile` per worktree Change, every 5 seconds. `proposal.md` files here are a few KB.

### Task sections are the only parse of `tasks.md`
`src/tasks.ts` exports `parseTasks(content): TaskSection[]`, where `TaskSection = { heading: string | undefined; tasks: Task[] }` and `Task = { done: boolean; indent: number; text: string }`. A line matching `^##\s` (not `###`) starts a section; a `TASK_LINE` match is a task, with `indent` the leading whitespace length and `text` group 2; everything else is skipped. Every line is tested against `TASK_LINE` first, so a task line never starts a section. A leading section without a heading is kept only when it has tasks; a `##` section with no tasks is dropped at parse time. `countTasks` becomes the sum over sections and stays the single source of Task progress, so the row's counts and the panel's section counts cannot disagree, and `test/openspec-contract.test.ts` keeps guarding both.

`TASK_LINE` tests every line, including lines inside code fences. A `##` line inside a fence therefore also starts a section. This is consistent: a fenced task counts toward Task progress, so it needs a section to be shown in.

`changeSummary` takes the `tasks.md` contents as now and the `proposal.md` contents in place of the `proposal` flag; `artifacts.proposal` becomes `proposalContent !== undefined`.

### `Blocked by:` and `Triage:` lines
`src/proposal.ts` exports `parseProposal(content): { blockedBy?: string; triage?: string }`. It scans lines until the first line starting with `## `, and keeps the first line starting with exactly `Blocked by:` and the first starting with exactly `Triage:`, whole and unchanged. The panel shows them as written, so `blockedBy` is the line, not a parsed list.

### Layout from the terminal size
`<App>` reads `{ columns, rows } = useWindowSize()`. The list's width is the widest Change row's length, computed from the existing column widths plus its marker, and at least 40; string length is the display width because rows hold only ASCII ids and labels and single-width `█░✓`. When `columns ≥ listWidth + 40` the root `<Box>` is a row: the list `<Box width={listWidth}>`, then the panel `<Box>` with a left border and `flexGrow`, `rows` high. Otherwise it is a column: the list, then the panel with a top border, `max(rows − list rows − 1, 2)` high. The border is the line separating panel and list in both layouts and counts toward the panel's 40 columns.

An error row is drawn as `<Text wrap="truncate-end">` inside the list's fixed-width `<Box>`, so Ink cuts its message with `…` and it never widens the list or wraps. When every row is an error row, the list is 40 columns.

The two 40-column minimums are constants next to `BAR_WIDTH`.

### Fitting is a pure function
`fitPanel(version, height): PanelLine[]` builds the panel's lines: first line, `Blocked by:` and `Triage:` lines, then sections, or `No tasks.md` / `No tasks`. Fitting:
1. Build every line with no section collapsed. If the count ≤ `height`, done.
2. Collapse finished sections with a heading one at a time, top first, rebuilding the count after each, stopping as soon as it fits.
3. If it still does not fit, keep the first `height − 1` lines and append `… N more`, where N counts the task lines dropped plus the totals of collapsed sections whose heading line was dropped; `…` alone when N is 0.

The first line is never dropped: `height` is at least 2 by the layout rule. Each `PanelLine` is drawn as one `<Text wrap="truncate-end">`, which Ink cuts to the panel's width with `…` and never wraps, so the number of lines is the rendered height and the function needs no width. The error case is the exception: its message wraps and is not fitted, since an error row has no tasks to cut.

Alternative: let Ink clip with `overflow="hidden"`. Rejected: it cannot place `… N more` or know what it hid.

### Below the list when it fills the terminal
When the list alone fills the terminal, the panel still gets 2 rows, so the frame is taller than the terminal and its top scrolls away. That is what the list already does when it is longer than the terminal, and `multiple-projects` brings list scrolling.

## Testing seams

| Requirement | Seam |
| --- | --- |
| Task sections, Task lines, Panel heading, Empty and error cases | `<App>` via `ink-testing-library` with `read={() => readProject(f.root)}` on a fixture Project, the existing `show` seam. A `panelLines(frame)` helper returns the lines right of the border (beside) or below it (below); assertions on its plain text, and on styled text for `✓`/`○` colour and dimming. |
| Fitting the panel's height | The same `<App>` seam with the terminal size pinned: `show(path, { columns, rows })` sets `columns` and `rows` on the test stdout before the first render. Resize scenarios set them again and emit `resize`. |
| Panel placement | The same seam: frames at 100 and 99 columns for a list measured at 60, and a resize between them. |
| Panel shows the selected Change version | The same seam with `j`, `Enter` and `r` as the live-refresh tests do. |
| Error rows (modified) | The existing `<App>` "Error rows" tests, plus an unreadable `proposal.md` fixture and a long error message, through `show`. |

One seam: `<App>` with its `read` prop. `show` gains an optional terminal size and defaults it to 200×50, wide and tall enough that every existing test's panel sits beside the list and nothing is fitted. Existing list assertions switch from `plainLines(frame)` to a `listLines(frame)` helper that takes each line's text left of the border, so they keep testing the list alone; `selectedLines` likewise. The `project-reading.test.ts` unreadable-file test gains a `proposal.md` twin at the `readProject` seam.

## Risks / Trade-offs

- [`TASK_LINE` sees tasks inside code fences, so a fenced example in `tasks.md` shows as tasks] → the row already counts them; matching OpenSpec's counts is the existing contract, and the panel shows what is counted.
- [Reading every `proposal.md` every 5 seconds] → one batched git call per commit Source and small files on disk; same order as the `tasks.md` reads already done.
- [A `PanelLine` drawn without `wrap="truncate-end"` would wrap and break the height count] → one component draws every `PanelLine`; the "Long task" scenario at a 40-column panel catches a regression.
- [Frame taller than the terminal when the list fills it] → Ink clears and redraws; same as a long list today. Accepted until list scrolling lands.
- [`useWindowSize` falls back to the real terminal's size when stdout has no `rows`, so test results could depend on the terminal running them] → `show` always sets both `columns` and `rows`.
