# Proposal: Branch and worktree sources

Blocked by: walking-skeleton
Triage: needs-triage

## What to build

The dashboard reads every Source of a Project, not just the files on disk under the given path, so a Change being worked on in a branch or a worktree shows its most current state. Each Change row shows its Headline version and can expand to every Change version. Sources are read with git plumbing and worktree files on disk, never through the `openspec` CLI and never by writing to the Project (ADR 0001).

## Acceptance criteria

- [ ] The Base is detected from the branch `origin/HEAD` names, then `main`, then `master`; `--base <ref>` overrides it.
- [ ] The Base is always a Source.
- [ ] A local branch other than the Base is a Source only when it has commits not in the Base and changes under `openspec/` since it split from the Base.
- [ ] A worktree qualifies by the same rule, or by having uncommitted edits under `openspec/`.
- [ ] Remote-tracking refs are ignored and nothing is fetched.
- [ ] A branch checked out in a worktree is read only from that worktree's files on disk, never also from its commit; this includes the main checkout, also when it is on the Base.
- [ ] Detached worktrees are Sources, labelled by folder name.
- [ ] The collapsed row shows the Headline version: the Change version with the latest Change time.
- [ ] The collapsed row also shows the Headline version's Source label (`wt:<folder>` for a worktree, the branch name for a branch) and `+N` when N other versions exist.
- [ ] Rows are sorted by the Headline version's Change time, newest first.
- [ ] `Enter` expands a Change into one row per Change version in the same format, and collapses it again.
- [ ] A Project that is not a git repository shows its files on disk as its only Source.
- [ ] Fixture tests cover: an unrelated feature branch (excluded), a stale branch with no `openspec/` edits (excluded), a worktree with only uncommitted checkbox ticks (included), and a detached worktree (included).
