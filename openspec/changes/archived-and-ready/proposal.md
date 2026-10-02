# Proposal: Archived and ready-to-archive changes

Blocked by: branch-and-worktree-sources
Triage: needs-triage

## What to build

A Change that has been archived anywhere is shown as finished, archived Changes can be toggled into view, and Changes that only await archiving stand out, since that is the state most likely to need action next.

## Acceptance criteria

- [ ] A Change version found under `openspec/changes/archive/<YYYY-MM-DD>-<change-id>/` belongs to the Change `<change-id>`.
- [ ] When any Change version is archived, it is the Headline version, even if another Source has a later Change time.
- [ ] Changes whose Headline version is archived are hidden by default; `a` shows and hides them, and shown ones are visibly marked as archived.
- [ ] A Ready to archive Change shows a `✓ ready to archive` marker.
- [ ] Open: whether a Change with zero task checkboxes can be Ready to archive.
