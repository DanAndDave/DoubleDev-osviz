# Proposal: Multiple projects

Blocked by: walking-skeleton
Triage: needs-triage

## Why

An agent fleet works in several repositories at once, and the dashboard shows one Project. Watching them all means one terminal per repository. `osviz <path> <path> ...` puts every Project in one list, so one dashboard covers the fleet. One failing Project must never take the others down.

## What Changes

- `osviz` accepts any number of paths. No path still means the working directory. `--base <ref>` applies to every Project; a Project without that ref shows `unknown --base ref` as its error row.
- With two or more Projects, each Project gets a header row showing its path as typed, with its rows underneath, in command-line order. Within a Project, rows keep today's order. With one Project there is no header, so today's screen is unchanged.
- A Project that cannot be read (no `openspec/` folder, a missing path, a failing git command, an unknown `--base` ref) shows one error row under its own header, cut to one line. The other Projects render normally. The dashboard never exits because a Project fails.
- Project error rows can be selected like Change rows. The Detail panel then shows the Project's path and the full error message, wrapped. This also applies with one Project, which today shows the error with no panel.
- Header rows and `No active changes` rows cannot be selected. `j`/`k` skip them, so the selection moves across Project boundaries.
- The list scrolls when it is taller than the room it has: the terminal's height beside the panel, or the terminal's height minus three rows when the panel is below it. The selected row always stays visible, and so does a Project's header when that Project's first row is selected. When the panel is below a long list, the panel keeps its two rows inside the terminal instead of being pushed below its last row.
- `a`, `Enter` and the column widths cover the whole list. Every Project is re-read every 5 seconds and on `r`. Each Project has its own guard against overlapping reads, so a slow Project never delays another Project's rows.

Out of scope: per-Project `--base`; scroll indicators; a config file listing Projects; rendering before the first read of every Project has finished.

## Capabilities

### New Capabilities

### Modified Capabilities
- `cli`: path argument becomes a list of paths; `--base` applies to every Project; one Project's failure never exits the dashboard.
- `change-list`: Project header rows in command-line order; per-Project ordering, error rows and `No active changes` rows; selection skips rows that cannot be selected, and Project error rows can be selected; the list scrolls to keep the selection visible.
- `detail-panel`: a panel for a selected Project error row; the panel below a scrolled list stays inside the terminal.
- `live-refresh`: re-reading every Project, a separate in-progress guard per Project, and keeping the selected row's place when other Projects' rows move.

## Impact

- `src/args.ts`: `parseCommandLine` returns every path (resolved, plus the text as typed) and the shared `--base`; `USAGE` shows `[path ...]`.
- `src/cli.tsx`: reads every Project in parallel before the first render and passes one `{ label, initial, read }` per Project to `<App>`.
- `src/ui/App.tsx`: the rows become one list over all Projects, with header, Project-error and `No active changes` rows. Row keys and expanded ids include the Project's index. A scroll window is fitted to the terminal. There is one read guard per Project, and refreshes dispatch per Project.
- `src/ui/Panel.tsx`: shows a Project error as well as a Change version.
- `test/app.test.tsx`, `test/args.test.ts`: the `show` helper takes one or more paths. The Project-error and "list that fills the terminal" tests change to match the modified scenarios.
- No change to `src/project/`: each Project is one `readProject` call, which never throws.
