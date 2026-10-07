# Proposal: Blocked tasks

Triage: ready-for-agent

## Why

Projects using osviz track blocked work in `openspec/changes/<id>/issues/*.md` with `status: blocked`, and mirror it in `tasks.md` by ending each blocked task with `— blocked`. osviz shows those tasks as ordinary open tasks, so a Change that cannot move looks the same as one that can.

## What Changes

- A **Blocked task** is an unticked task whose text, trailing whitespace removed, ends with ` — blocked`: a space, an em dash (U+2014), a space, then `blocked` in lowercase. A ticked task is never blocked. Other spellings (`- blocked`, `(blocked)`, `— Blocked`) are not blocked.
- Task progress is unchanged: a Blocked task still counts as an unticked task, so counts keep matching `openspec list`.
- A Change version row ends with a yellow `blocked` marker when that version has at least one Blocked task and is not archived. The collapsed row shows its Headline version's marker; expanded rows show each version's own.
- In the Detail panel, a Blocked task is shown with a yellow `⊘` instead of the dimmed `○`, its text as written.
- Settled with the user: the marker comes from `tasks.md` only. `issues/` files are not read; they stay the projects' own bookkeeping, and `tasks.md` already mirrors them.

Out of scope: reading `issues/` or any `status:` field; filtering or hiding blocked Changes; showing what a task is blocked by; a blocked count in the row.

## Capabilities

### New Capabilities

### Modified Capabilities
- `project-reading`: the Blocked task definition, read from `tasks.md` without changing Task progress.
- `change-list`: the `blocked` marker on Change version rows.
- `detail-panel`: Blocked tasks drawn with a yellow `⊘`.

## Impact

- `src/tasks.ts`: `Task` gains `blocked`, set by `parseTasks`.
- `src/project/change.ts`: `isBlocked(version)` beside `isArchived` and `isReadyToArchive`.
- `src/ui/App.tsx`: `markerOf` gains `blocked`; marker width already counts toward the list width.
- `src/ui/Panel.tsx`: the task line's symbol.
- `CONTEXT.md`: the **Blocked task** term.
