# Proposal: Refresh

Blocked by: walking-skeleton
Triage: ready-for-agent

## Why

The dashboard reads the Project once at startup, so it goes stale as soon as an agent ticks a task, commits, or archives a Change. It is meant to be left open while that work happens; without re-reading, the user has to quit and restart to see progress.

## What Changes

- The dashboard re-reads the Project every 5 seconds while it is open, from every Source, exactly as at startup. Polling rather than filesystem watching, because watching misses branch-ref updates and is fiddly across worktrees.
- `r` re-reads the Project immediately.
- A read still in progress is never started again: a tick or an `r` that arrives during a read is skipped, not queued.
- The selection and the expanded Changes survive a refresh. A selected collapsed row stays selected while its Change is still shown, even when its Headline version changes; a selected Change version row stays selected while that version is still shown, otherwise its Change's row is selected. When the selected Change is no longer shown, the row now at the same position is selected, clamped to the last row.
- A refresh that finds the Project unreadable shows the error row, as at startup, and the next successful refresh brings the rows back.

Out of scope: several Projects (`multiple-projects`, which generalises "the Project" to "every Project"); a configurable interval; any indicator that a read is in progress.

## Capabilities

### New Capabilities
- `live-refresh`: re-reading the Project periodically and on `r`, never overlapping reads, and keeping selection and expanded Changes across a refresh.

### Modified Capabilities

## Impact

- `src/ui/App.tsx`: takes the first snapshot and a read function instead of a fixed snapshot; owns the refresh timer, `r`, and the in-progress guard. Selection, expansion and the archived toggle move into one reducer so a new snapshot and the selection it implies change together.
- `src/cli.tsx`: passes the read function (`readProject` with the Project path and `--base`) alongside the first snapshot.
- `test/app.test.tsx`: the `show` helper passes the read function.
- No change to `src/project/`: a refresh is a fresh `readProject`.
