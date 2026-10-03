## Context

`src/cli.tsx` parses one path and `--base`, awaits one `readProject`, and renders `<App initial read>`. `<App>` keeps `{ snapshot, expanded, showArchived, selected }` in one reducer. Rows come from `rowsOf(state)`, and a row is identified by `RowKey { id, version }`. One `useRef` flag guards against overlapping reads. An error snapshot renders as bare red text with no panel. The list never scrolls: below the list, `panelHeight` falls back to 2 and the frame runs past the terminal's last row. `readProject` never throws; every failure the ticket lists (no `openspec/`, a failing git command, an unknown `--base`, an unreadable file) arrives as a `{ kind: "error" }` snapshot or an error Change version.

## Goals / Non-Goals

**Goals:**
- One row model over every Project. Selection, scrolling, expanding and refresh each work on that one list; nothing is done separately per Project.
- With one Project, the screen stays as it is today, apart from the two deliberate changes in the specs: a selectable Project error row with its panel, and a list that scrolls.
- `src/project/` stays untouched: a Project is one `readProject` call.

**Non-Goals:**
- Reading Projects lazily or showing the dashboard before every first read has finished. The CLI awaits all of them, in parallel.
- Scroll indicators, page keys, or jumping between Projects.
- Catching a rejected `readProject`. Its contract is that it never throws (see Risks).

## Decisions

### Command line
`parseCommandLine` returns `{ projects: { label, path }[]; base }`. `label` is each positional as typed, and `path` is that positional resolved against `cwd`. When no positional is given, the only Project is `{ label: cwd, path: cwd }`, so a Project error panel shows a real path instead of `.`. `node:util` `parseArgs` already accepts positionals before, between and after `--base`. `USAGE` becomes `usage: osviz [path ...] [--base <ref>]`. Alternative: per-path `--base`. Rejected by the user; it needs token-order parsing for a rare case.

### `<App>` takes a list of Projects
`<App projects={[{ label, initial, read }, …]} />`. The CLI builds each `read` as `() => readProject(path, { base })` and awaits `Promise.all` of the first reads. `showHeaders` is `projects.length > 1`, decided once. `read` and `label` must not change for the dashboard's life, as today.

### Row model
`rowsOf` returns a union over the whole list:
- `header { project }`: only when `showHeaders`.
- `projectError { project, message }`: in place of the Project's rows when its snapshot is an error.
- `empty { project }`: `No active changes` when its snapshot has no shown Change.
- `change { project, key, change, version, others }`: today's `Row`.

`selectable(row)` is true for `change` and `projectError`. `RowKey` gains `project: number`, and `id` becomes `string | undefined`, where `undefined` names the Project error row. `sameKey` compares `project` too. `expanded` becomes one `ReadonlySet<string>` of change ids per Project, so the same id in two Projects expands separately. `State.snapshots` replaces `snapshot`.

Alternative: one `<ProjectList>` component per Project, each with its own reducer. Rejected: selection crosses Project boundaries and scrolling is one window over every row, so the state has to be shared anyway.

### Selection over selectable rows
`selected: number | undefined` indexes `rowsOf(state)` and always points at a selectable row; it is `undefined` when there is none. `move` steps to the next selectable index in its direction and stays put when there is none. `toggleExpanded` does nothing on a `projectError` row. `toggleArchived` keeps the key, or falls back to the first selectable row.

### Refresh per Project
`reading` becomes a `useRef<boolean[]>`, one flag per Project. `refresh()` starts a read for each Project whose flag is clear, and each read dispatches `refreshed { project, snapshot }` as it finishes, so a slow Project never holds up another. The interval and `r` call the same `refresh`, as today.

`refreshed` for Project `p` keeps the selected row by key. When the key is gone, the fallbacks in the live-refresh spec are tried in order:
1. A selected `projectError` of `p` that has become readable: `p`'s first selectable row.
2. A selected Change version that is gone: its Change's first row.
3. Otherwise: the old position among `p`'s selectable rows, measured in the old rows, clamped to `p`'s new selectable rows.
4. When `p` has no selectable row left: the nearest selectable row, searching down from `p`'s header, then up.
5. When nothing was selected: the first selectable row.

A refresh of another Project always finds the key, because the selected Project's rows did not change. This is what keeps the same row selected when rows above it are added or removed.

### Scrolling
The list's height is `terminalRows` when the panel is beside the list or there is no panel. When the panel is below, it is `terminalRows - 3`: one separator row and the panel's minimum of two rows. It is never less than 1. A pure `windowTop(previousTop, rows, selected, height)` returns the first shown row:
1. Return 0 when every row fits.
2. Clamp `previousTop` to `[0, rows.length - height]`, so no empty rows are left at the bottom.
3. When nothing is selected, or the selected row is inside the window, return the clamped value.
4. Widen the selected index to `[a, b]` over the rows that cannot be selected next to it, stopping at the nearest selectable row or the start or end of the list.
5. Move just far enough to show `[a, b]`. When `b - a + 1 > height`, use `max(a, selected - height + 1)`, which shows the selected row and the rows above it.

`<App>` keeps the previous top in a `useRef` and recomputes it every render. The window therefore follows resizes and refreshes without a separate action. Because `windowTop` is pure and idempotent, a repeated render gives the same answer. Alternative: keep `top` in the reducer. Rejected: the height depends on the terminal size and on where the panel goes, which depends on the list's width; these are all values computed during render.

The list's width and column widths are measured over every row, not just the shown window, so scrolling never shifts the columns or moves the panel. Below the list, `panelHeight` becomes `terminalRows - shownRows - 1`, which is always at least 2.

### Column widths across Projects
`Widths` is computed over the `change` rows of every Project, so columns line up. The label column exists when any Project is labelled. A row from an unlabelled Project (outside git) leaves the column blank. The panel's `labelled` comes from the row's own Project.

### Panel for a Project error
`Panel` takes `subject: { kind: "version"; version; labelled } | { kind: "project"; label; message }`. The Project case builds the existing error lines, with the label in bold first, then the wrapped message. `fitPanel` already returns these two lines without fitting for a Change version's error row, so it shares that branch.

### Headers and Project error rows
A header is `<Text bold wrap="truncate-end">{label}</Text>` in a box as wide as the list, so it can never widen the list. A Project error row is drawn like a Change version's error row (`✗ message` in red, cut to one line by `truncate-end`). That replaces today's bare full-width error text, which wrapped.

## Testing seams

| Requirement | Seam |
| --- | --- |
| cli: Project path argument, Base option (parsing) | `parseCommandLine` in `test/args.test.ts`: several positionals, `--base` between them, labels as typed, no path → `cwd`. |
| cli: Problems do not exit the dashboard; Base missing in one Project | `<App>` via `show([pathA, pathB])` with one path lacking `openspec/`, and one fixture without the `--base` branch read with `{ base }`. |
| change-list: Project header rows, Error rows, Selection, Archived changes hidden, Expanding a Change | `<App>` via `show`, which takes one path or several; labels are the paths as given. Assertions use the existing `listLines`, `selected` and `press`. |
| change-list: List scrolling | The same seam with the terminal pinned small: `show(paths, { columns, rows })`, then `j`/`k` and `listLines`, plus a `resize` for the taller-terminal scenario. |
| detail-panel: Panel shows the selected Change version, Fitting, Empty and error cases | The same seam with `panelLines`. The "list that fills the terminal" test changes to the new scenario: a 7-row terminal and a 10-row list. |
| live-refresh: all requirements | The same seam, with `r`, fake timers and fixtures edited between reads. The two per-Project scenarios ("Slow Project does not hold up another", "Slow Project skipped, others read") render `<App>` directly with one hand-resolved `read` per Project, like today's "No overlapping reads" test. |

One seam: `<App>` with its `projects` prop. `show(paths: string | string[], size)` builds one `{ label: path, initial, read }` per path and records every read in `reads`, as today. The test "Project error: no panel" becomes "Project error: its row is selected and the panel shows it". The single-Project error tests assert that the row is cut to the list's width and that the panel shows the full message.

## Risks / Trade-offs

- [`readProject` rejecting on an unforeseen error would surface as an unhandled rejection and end the process] → its documented contract is never-throws, and every failure named in the ticket is an error snapshot. Wrapping it would hide bugs and is outside this change.
- [Mutating a `useRef` during render is outside React's purity rules] → Ink renders synchronously with no concurrent mode, and `windowTop` is idempotent, so a repeated render gives the same result.
- [Cutting a single Project's error row to the list's width hides part of a long message in the list] → the row is now selectable and the panel shows the full message, wrapped.
- [N Projects × every Source re-read every 5 seconds] → reads run in parallel, and a slow Project only delays itself. The cost is the same per Project as today.
- [Two worktrees of the same repository given as two paths show the same Changes twice] → that is what the user asked for. Each path is its own Project with its own Sources.
