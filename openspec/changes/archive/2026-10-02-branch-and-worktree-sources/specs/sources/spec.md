## Purpose

Defines which Sources a Project is read from (the Base, qualifying local branches and worktrees), how each Source is labelled, and which Change versions each Source contributes.

## ADDED Requirements

### Requirement: Base detection
When the Project is inside a git repository, the visualizer SHALL choose its Base as the first of these that exists: the ref given with `--base`; the local branch named by `refs/remotes/origin/HEAD` (for `origin/trunk`, the local branch `trunk`); the local branch `main`; the local branch `master`. When `--base` names a ref that does not exist, the Project SHALL show an error naming that ref. When none of these exist, the checkout at the given path SHALL be the Base.

#### Scenario: origin/HEAD names the Base
- **WHEN** `refs/remotes/origin/HEAD` points at `origin/trunk`, and local branches `trunk` and `main` exist
- **THEN** the Base is `trunk`

#### Scenario: main before master
- **WHEN** there is no `origin/HEAD` and local branches `main` and `master` both exist
- **THEN** the Base is `main`

#### Scenario: Override
- **WHEN** the user passes `--base develop` and a local branch `develop` exists
- **THEN** the Base is `develop`, even when `main` exists

#### Scenario: Unknown override
- **WHEN** the user passes `--base nope` and no ref `nope` exists
- **THEN** the Project shows an error naming `nope`

#### Scenario: No Base found
- **WHEN** the repository has only a branch `develop`, checked out at the given path, and no `--base`
- **THEN** the checkout at the given path is the Base

### Requirement: Base is always a Source
The Base SHALL always be a Source, whether or not it holds any Changes. When the Base is checked out in a worktree, it SHALL be read from that worktree's files on disk; otherwise from its latest commit.

#### Scenario: Base checked out in the main checkout
- **WHEN** the main checkout is on `main`, `main` is the Base, and `tasks.md` of Change `add-auth` has an uncommitted checkbox tick
- **THEN** the Base's Change version of `add-auth` includes that tick

#### Scenario: Base not checked out
- **WHEN** the given path is a worktree on branch `feat` and no worktree has the Base `main` checked out
- **THEN** the Base is read from `main`'s latest commit

### Requirement: Branch qualification
A local branch other than the Base, not checked out in any worktree, SHALL be a Source only when it has commits not in the Base and some file under the Project's `openspec/` differs between the branch and the commit where it split from the Base. Branches with no commit in common with the Base SHALL NOT be Sources. Remote-tracking refs SHALL be ignored, and the visualizer SHALL NOT fetch.

#### Scenario: Unrelated feature branch
- **WHEN** branch `feat-ui` has commits not in the Base that change only files outside `openspec/`
- **THEN** `feat-ui` is not a Source

#### Scenario: Stale branch
- **WHEN** branch `old` has no commits that are not in the Base
- **THEN** `old` is not a Source

#### Scenario: Branch with OpenSpec edits
- **WHEN** branch `add-auth` has a commit not in the Base that edits `openspec/changes/add-auth/tasks.md`
- **THEN** `add-auth` is a Source

#### Scenario: Remote branch ignored
- **WHEN** `refs/remotes/origin/add-auth` has OpenSpec edits the Base lacks and no local branch `add-auth` exists
- **THEN** no Source is created for it

### Requirement: Worktree qualification
A worktree other than the one holding the Base SHALL be a Source when its checked-out commit qualifies by the branch rule, or when it has uncommitted edits (modified, staged, deleted or untracked files) under the Project's `openspec/`. Detached worktrees SHALL be judged by the same rule. A branch checked out in a worktree SHALL be read only from that worktree's files on disk, never also from its commit. Worktrees whose folder no longer exists SHALL be ignored.

#### Scenario: Uncommitted checkbox ticks only
- **WHEN** a worktree on branch `work` has no commits beyond the Base, and its `openspec/changes/add-auth/tasks.md` has uncommitted checkbox ticks
- **THEN** that worktree is a Source

#### Scenario: Detached worktree
- **WHEN** a detached worktree has a commit not in the Base that edits a file under `openspec/changes/`
- **THEN** that worktree is a Source

#### Scenario: Branch in a worktree read once
- **WHEN** branch `add-auth` qualifies and is checked out in worktree `wt-auth`, which has an uncommitted tick
- **THEN** exactly one Source exists for it, read from `wt-auth`'s files on disk, and it includes the tick

### Requirement: Source labels
Each Source SHALL have a label: a worktree checked out on the Base is labelled with the Base's branch name; any other worktree is labelled `wt:<folder>`, where `<folder>` is the worktree directory's name; a branch read from its commit is labelled with its branch name. When the given path is the Base because no Base was found, its label SHALL be its branch name, or `wt:<folder>` when detached.

#### Scenario: Labels
- **WHEN** the main checkout is on Base `main`, worktree folder `wt-auth` is on branch `add-auth`, and branch `fix` is not checked out
- **THEN** their labels are `main`, `wt:wt-auth` and `fix`

### Requirement: Change versions per Source
The Base SHALL contribute a Change version for every active Change it holds. Every other Source SHALL contribute a Change version only for each active Change whose change directory differs between the Source and the commit where it split from the Base, counting uncommitted edits for a worktree.

#### Scenario: Untouched Change not repeated
- **WHEN** the Base holds Changes `a` and `b`, and a qualifying branch edits only `openspec/changes/b/`
- **THEN** `a` has one Change version (the Base's) and `b` has two

#### Scenario: Change only on a branch
- **WHEN** branch `new-idea` adds `openspec/changes/new-idea/proposal.md` and the Base has no such Change
- **THEN** Change `new-idea` has one Change version, from `new-idea`

### Requirement: Project outside git
A Project that is not inside a git repository SHALL have exactly one Source: its files on disk, with no label.

#### Scenario: Plain directory
- **WHEN** the Project is a directory outside any git repository
- **THEN** each Change has exactly one Change version, read from the files on disk, and no Source label is shown
