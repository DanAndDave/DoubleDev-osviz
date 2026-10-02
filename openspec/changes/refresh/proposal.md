# Proposal: Refresh

Blocked by: walking-skeleton
Triage: needs-triage

## What to build

The dashboard stays current while it is left open: it re-reads every Project periodically and on demand. Polling is chosen over filesystem watching because watching misses branch-ref updates and is fiddly across worktrees.

## Acceptance criteria

- [ ] Every Project is re-read every 5 seconds.
- [ ] `r` re-reads every Project immediately.
- [ ] Selection and expanded rows survive a refresh when their Change still exists.
- [ ] A refresh still in progress is not started again by the next tick or by `r`.
