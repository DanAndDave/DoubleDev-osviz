# Read OpenSpec state from git objects, never through the openspec CLI, never mutating

The `openspec` CLI only sees checked-out files, so reading a branch through it would mean creating temporary worktrees inside the user's repositories, at roughly a second per call. We instead read every Source with git plumbing (`git ls-tree`, `git cat-file --batch`, worktree files on disk) and parse `tasks.md` and Artifact presence ourselves. That gives one code path for the Base, branches, and worktrees, and lets us guarantee the visualizer never writes to a Project: no checkout, no fetch, no `worktree add`, no lock files.

Sources are local only: local branches and linked worktrees. Remote-tracking refs are ignored and nothing is fetched.

A branch that is checked out in a worktree is read only from that worktree's files on disk, never also from its commit, so each branch is exactly one Source and uncommitted edits (including on the Base) count as the most current state. Detached worktrees are Sources too, labelled by folder name.

## Consequences

Our parsing can drift from OpenSpec's own counting rules. A contract test runs the real `openspec list --json` on fixture projects and asserts our Task progress matches it.
