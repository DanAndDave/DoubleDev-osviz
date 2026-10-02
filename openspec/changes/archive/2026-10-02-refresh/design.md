## Context

`src/cli.tsx` reads the Project once with `readProject(path, { base })` and renders `<App snapshot>`. `<App>` holds three pieces of state: `selected` (a row index), `expanded` (a set of change ids) and `showArchived`. Rows are derived from the snapshot by `rowsOf`. The `a` toggle keeps its row by object identity (`r.change === row.change && r.version === row.version`), which holds only because the snapshot never changes. `readProject` never throws: an unreadable Project is a `{ kind: "error" }` snapshot.

## Goals / Non-Goals

**Goals:**
- `<App>` stays free of filesystem and git access: it is handed a read function, not a path.
- One rule for "which row is this", used by the `a` toggle and by a refresh, that survives a new snapshot.

**Non-Goals:**
- Reading only what changed. A refresh is a full `readProject`; its cost is the startup cost, every 5 seconds.
- Pausing refresh while a Change is expanded or a key is held.

## Decisions

### `<App>` takes a read function
`<App initial={snapshot} read={() => readProject(path, { base })} />`. The CLI still awaits the first read before rendering, so the first frame is never empty. Alternative: `<App>` takes a path and calls `readProject` itself. Rejected: it would make `<App>` read the Project, and tests could no longer control when a read finishes.

### Refresh loop
A `useEffect` starts `setInterval(refresh, 5000)` and clears it on unmount; `r` calls the same `refresh`. `refresh` returns at once when a `useRef` flag says a read is in progress; otherwise it sets the flag, calls `read()`, dispatches the result, and clears the flag when the promise settles. Skipped ticks are not queued, as the spec requires. The interval counts from when the dashboard opened, not from the end of the last read: a read slower than 5 seconds is followed immediately by the next tick that is not skipped. Alternative: a `setTimeout` chain started after each read, which spaces reads 5 seconds apart. Rejected: `r` would need to cancel and restart the chain, and the spec's "every 5 seconds" becomes "5 seconds after the last read ended".

A read that resolves after the dashboard exits dispatches into an unmounted component; React drops it.

### Row keys
A row is identified by `{ id, version }` where `version` is `undefined` for a collapsed Change row and `{ source, dir }` for an expanded Change version row. Object identity is dropped, including in the `a` toggle. Source label plus change directory is unique within a Change except when two worktrees in different parent folders share a folder name (both labelled `wt:<name>`); see Risks.

### One reducer for snapshot and place
`useReducer` holds `{ snapshot, expanded, showArchived, selected }`, where `selected` stays a row index into `rowsOf(snapshot, expanded, showArchived)`. Actions: `move(±1)`, `toggleExpanded`, `toggleArchived`, `refreshed(snapshot)`. Each action computes the old rows, the selected row's key, the new state's rows, and the new index, so a new snapshot and the selection it implies never render separately. Fallbacks when the key is not among the new rows:
- `toggleArchived`: the first row (unchanged behaviour).
- `refreshed`: for a version key, the first row of the same Change; otherwise the old index clamped to the new last row.
- `toggleExpanded`: unchanged, the Change's first row.

`expanded` keeps ids of Changes that disappeared; a Change re-created with the same id comes back expanded. Harmless, and pruning would need its own rule for the error snapshot.

An error snapshot has no rows. After it, the old row's key is lost (there was no selected row), so the first successful refresh selects the clamped old index, which is 0.

## Testing seams

| Requirement | Seam |
| --- | --- |
| Periodic refresh | `<App>` via `ink-testing-library` with `read={() => readProject(f.root)}` on a fixture Project; `jest.useFakeTimers()` and `advanceTimersByTime(5000)` drive the interval, then the test awaits the read promise the `read` wrapper records and checks `lastFrame()`. |
| Refresh on demand, Place kept across a refresh, Problems during a refresh | The same `<App>` seam with real timers: edit the fixture, press `r` (and `j`, `Enter`, `a`), await the recorded read, check the frame and the inverse-video row. |
| No overlapping reads | `<App>` with a `read` that returns a promise the test resolves by hand and counts its calls; press `r` and advance past a tick while the first read is pending, assert one call, resolve, press `r`, assert two. |

One seam: `<App>` with its `read` prop. The existing `show(path)` helper gains the `read` prop so every existing test runs through the new interface. `bun:test`'s fake timers were checked to drive Ink's `setInterval`, `useInput` and rendering.

## Risks / Trade-offs

- [A large Project with many branches makes a full read slow] → reads never overlap, so a slow read lowers the refresh rate instead of piling up. Reading incrementally is a separate change if it matters.
- [The frame redraws every 5 seconds even when nothing changed] → Ink diffs its output, so an unchanged frame should not flicker [INFERENCE; the smoke run in task 4.1 checks it].
- [Keys arriving while a read is in progress act on the old snapshot] → the reducer applies the read's result to whatever state is current when it lands, so a `j` pressed mid-read is kept.
- [Two worktrees with the same folder name share a Source label] → a selected version row of one may land on the other's after a refresh. The ambiguity is already visible in the labels; making labels unique is a `sources` change, not this one.