# Proposal: Walking skeleton

Blocked by: none (can start immediately)
Triage: ready-for-agent

## Why

There is no code yet, and every later change (branch and worktree Sources, multiple Projects, detail panel, refresh) needs a running dashboard and a test harness to build on. This change delivers the thinnest end-to-end path: one Project, read from its files on disk, rendered as a list of Changes with their progress.

## What Changes

- New `osviz [path]` command, a Bun + TypeScript + Ink terminal dashboard, installed for local use with `bun link`. With no argument it uses the current directory.
- Lists each active Change in the Project, read from the files on disk under the path: change id, a `P S D T` Artifact indicator (each letter filled when that Artifact exists), a progress bar, and Task progress as `done/total`.
- Task progress counts exactly the lines OpenSpec counts, so our numbers match `openspec list`.
- Rows are sorted by Change time, newest first. Change time is the latest commit touching the change's folder, or the latest file modification time when the folder has uncommitted edits; in a folder that is not a git repository, the latest file modification time.
- Archived changes are not listed.
- `j`/`k` and the arrow keys move a visible selection; `q` quits.
- A path without an `openspec/` folder, or an unreadable `tasks.md`, shows an error row instead of exiting.
- Never writes to the Project: no checkout, fetch, `worktree add`, or lock files (ADR 0001).
- Test harness: fixture Projects built as temporary git repositories, plus a contract test that runs the real `openspec list --json` on fixture Projects and asserts our Task progress matches it.

Out of scope here, owned by later changes: other branches and worktrees, the Base, Headline versions and Source labels (`branch-and-worktree-sources`); several paths (`multiple-projects`); the detail panel (`detail-panel`); showing archived changes and the ready-to-archive marker (`archived-and-ready`); refreshing (`refresh`).

## Capabilities

### New Capabilities
- `cli`: how `osviz` is invoked, which Project it opens, and how it exits.
- `project-reading`: what is read from a Project and how: which Changes exist, their Artifacts, Task progress and Change time, and the guarantee that reading never writes to the Project.
- `change-list`: how Changes are shown: row contents, order, selection, and error rows.

### Modified Capabilities
None.

## Impact

- New TypeScript project at the repo root: package manifest with an `osviz` bin entry, TypeScript config, sources and tests.
- New dependencies: `ink`, `react`; dev dependencies: `typescript`, `@types/react`, `ink-testing-library`, and `@fission-ai/openspec` pinned for the contract test.
- Requires `git` on `PATH` for Projects inside a git repository.
