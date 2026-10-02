# Proposal: Archived and ready-to-archive changes

Blocked by: branch-and-worktree-sources
Triage: ready-for-agent

## Why

The dashboard ignores `openspec/changes/archive/`, so a Change archived on the Base still shows as active whenever a stale worktree or branch holds an edited copy, and a finished Change looks like any other. The state most likely to need action next, every task ticked but not yet archived, does not stand out.

## What Changes

- A directory `openspec/changes/archive/<YYYY-MM-DD>-<change-id>/` in any Source is an archived Change version of the Change `<change-id>`, read like an active one (Artifacts, Task progress, Change time). Other directories under `archive/` are ignored.
- The Headline version is an archived Change version whenever one exists (the newest by Change time among several), even if another Source has a later Change time. So a Change archived anywhere is shown as finished.
- A non-Base Source contributes an archived Change version only when that archive directory differs since the Source split from the Base, the same rule active versions already follow.
- Changes whose Headline version is archived are hidden by default. `a` shows and hides them, and shown archived rows carry an `archived` marker.
- A Change is **Ready to archive** when its Headline version is not archived and its Task progress has at least one checkbox, all ticked. Its row shows `✓ ready to archive`.
- Settled from the ticket's open item: a Change with zero task checkboxes is never Ready to archive. This matches `openspec list`, which reports such Changes as "No tasks", not complete. `CONTEXT.md` gets "at least one" in its definition.

Out of scope: archiving from the dashboard (the visualizer never writes, ADR 0001); a key-hint footer; refresh (`refresh`).

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-reading`: archived change directories are read as archived Change versions of their Change.
- `sources`: the Headline rule prefers archived versions; non-Base Sources contribute archived versions they changed.
- `change-list`: archived Changes hidden by default and toggled with `a`, an `archived` marker, the `✓ ready to archive` marker, and selection kept on its Change across the toggle.

## Impact

- `src/project/`: change-directory parsing (`history.ts`) keys versions by change directory, so an active `x` and an archived `archive/<date>-x` in one Source get separate Change times and `changed` entries. Both readers read archive directories. `read.ts` orders archived versions first.
- `src/project/change.ts`: a Change version records its change directory.
- `src/ui/App.tsx`: the `a` toggle, markers, and selection that follows its Change.
- `CONTEXT.md`: the Ready to archive definition.
