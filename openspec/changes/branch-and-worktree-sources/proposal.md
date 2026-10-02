# Proposal: Branch and worktree sources

Blocked by: walking-skeleton
Triage: ready-for-agent

## Why

The dashboard reads only the files on disk under the given path, so a Change being worked on in another branch or worktree shows its stale Base state, or doesn't show at all. Agents work in worktrees and branches; the dashboard has to show where each Change actually stands.

## What Changes

- Every Project is read from all its Sources: the Base, worktrees (files on disk, committed or not, including the main checkout and detached worktrees), and local branches no worktree has checked out. Sources are read with git plumbing and worktree files on disk, never through the `openspec` CLI and never by writing to the Project (ADR 0001).
- Base detection: the local branch `origin/HEAD` names, then `main`, then `master`. New `--base <ref>` option overrides it. When none of these exist, the checkout at the given path is the Base.
- A local branch other than the Base is a Source only when it has commits not in the Base and changes under `openspec/` since it split from the Base. A worktree qualifies by the same rule, or by having uncommitted edits under `openspec/`. Remote-tracking refs are ignored and nothing is fetched.
- A branch checked out in a worktree is read only from that worktree's files on disk, never also from its commit; this includes the main checkout, also when it is on the Base.
- The Base contributes a Change version for every Change it holds. Every other Source contributes a Change version only for the Changes it changed since it split from the Base (committed or uncommitted), so `+N` means another place is really working on that Change.
- Each Change row shows its Headline version (the Change version with the latest Change time), that version's Source label (the branch name for a branch or for a worktree on the Base, `wt:<folder>` for any other worktree), and `+N` when N other versions exist.
- Rows are sorted by the Headline version's Change time, newest first.
- `Enter` expands a Change into one row per Change version in the same format, and collapses it again.
- A Project that is not a git repository shows its files on disk as its only Source.
- Fixture tests cover: an unrelated feature branch (excluded), a stale branch with no `openspec/` edits (excluded), a worktree with only uncommitted checkbox ticks (included), and a detached worktree (included).

Out of scope, owned by later changes: archived Change versions and the ready-to-archive marker (`archived-and-ready`); refreshing (`refresh`); several Projects (`multiple-projects`).

## Capabilities

### New Capabilities
- `sources`: which Sources a Project has (Base detection, branch and worktree qualification, labels) and which Change versions each Source contributes.

### Modified Capabilities
- `project-reading`: Changes, Artifacts, Task progress and Change time are read per Change version, from worktree files on disk or from git objects; the never-writes guarantee extends to every Source.
- `change-list`: rows show the Headline version with its Source label and `+N`; ordering uses the Headline version; `Enter` expands and collapses Change versions; per-change error rows name the Source.
- `cli`: new `--base <ref>` option.

## Impact

- `src/project/`: Source discovery, a git-object reader next to the existing disk reader, and a snapshot of Changes holding Change versions in place of one row per change directory.
- `src/ui/App.tsx`: Source label and `+N` columns, expansion state.
- `src/args.ts`, `src/cli.tsx`: `--base`.
- `test/`: fixture helper grows branches and worktrees.
- No new dependencies. Requires git 2.41 or newer (`for-each-ref` `ahead-behind`).
