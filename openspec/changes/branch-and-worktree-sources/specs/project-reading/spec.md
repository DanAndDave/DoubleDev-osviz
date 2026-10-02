## MODIFIED Requirements

### Requirement: Active Changes
The visualizer SHALL treat every directory directly under a Source's `openspec/changes/` as an active Change named by its directory name, except the `archive` directory. For a Source read from a commit, a directory is any path under `openspec/changes/` that has files below it in that commit. A Change is identified by its change id across Sources: directories with the same name in different Sources are Change versions of one Change.

#### Scenario: Archive excluded
- **WHEN** `openspec/changes/` contains directories `add-auth`, `fix-login` and `archive`
- **THEN** the active Changes are exactly `add-auth` and `fix-login`

#### Scenario: Files ignored
- **WHEN** `openspec/changes/` contains a file `README.md` next to change directories
- **THEN** `README.md` is not treated as a Change

#### Scenario: Same id in two Sources
- **WHEN** the Base and branch `add-auth` both contain `openspec/changes/add-auth/`, and the branch has edited it
- **THEN** there is one Change `add-auth` with two Change versions

### Requirement: Artifact presence
For each Change version, the visualizer SHALL report four Artifacts as present or missing: proposal (`proposal.md` exists), specs (at least one `.md` file exists anywhere under `specs/`), design (`design.md` exists), and tasks (`tasks.md` exists), all relative to the change directory in that Version's Source.

#### Scenario: Partially planned change
- **WHEN** a change directory contains `proposal.md` and `specs/cli/spec.md` but no `design.md` or `tasks.md`
- **THEN** proposal and specs are present, and design and tasks are missing

#### Scenario: Artifacts read from a branch commit
- **WHEN** branch `add-auth` is not checked out anywhere, and its commit adds `openspec/changes/add-auth/design.md` that the Base lacks
- **THEN** the branch's Change version of `add-auth` has design present and the Base's has design missing

### Requirement: Change time
The visualizer SHALL derive each Change version's Change time from its Source as follows. For a Source read from a commit, Change time SHALL be the committer time of the latest commit reachable from that commit that touches the change directory. For a worktree Source, if the change directory has no uncommitted edits (modified, staged, deleted or untracked files) in that worktree, Change time SHALL be the committer time of the latest commit reachable from the worktree's checked-out commit that touches the directory; otherwise, and when the worktree has no commits, it SHALL be the latest modification time of any file under the change directory in that worktree. For a Project outside git, Change time SHALL be the latest modification time of any file under the change directory.

#### Scenario: Committed change
- **WHEN** the change directory's latest commit has committer time 2026-09-01T10:00Z and the directory has no uncommitted edits
- **THEN** its Change time is 2026-09-01T10:00Z, regardless of file modification times

#### Scenario: Uncommitted checkbox tick
- **WHEN** a committed change's `tasks.md` is edited without committing and saved at 2026-09-02T08:00Z
- **THEN** its Change time is 2026-09-02T08:00Z

#### Scenario: Never committed
- **WHEN** a change directory is untracked and its newest file was modified at 2026-09-03T12:00Z
- **THEN** its Change time is 2026-09-03T12:00Z

#### Scenario: Not a git repository
- **WHEN** the Project is not inside a git repository
- **THEN** every Change time is the latest modification time of any file under that change directory

#### Scenario: Branch read from its commit
- **WHEN** branch `add-auth`, checked out nowhere, last touched `openspec/changes/add-auth/` in a commit with committer time 2026-09-07T09:00Z
- **THEN** the branch's Change version of `add-auth` has Change time 2026-09-07T09:00Z

#### Scenario: Uncommitted edit in another worktree
- **WHEN** worktree `wt-auth` has an uncommitted edit to `openspec/changes/add-auth/tasks.md` saved at 2026-09-08T15:00Z
- **THEN** the `wt:wt-auth` Change version of `add-auth` has Change time 2026-09-08T15:00Z

### Requirement: Reading never writes to the Project
Reading a Project SHALL NOT create, modify or delete any file inside the Project, any of its repository's worktrees, or its git directory, including git index refreshes and lock files. It SHALL NOT check out, fetch, or add or remove worktrees.

#### Scenario: Git directory untouched
- **WHEN** the visualizer reads a Project inside a git repository whose working tree has uncommitted edits
- **THEN** no file under the Project or its git directory, including `index` and any `*.lock` file, has been created, modified or deleted

#### Scenario: Other worktrees untouched
- **WHEN** the visualizer reads a Project whose repository has a linked worktree with uncommitted edits, and a branch checked out nowhere
- **THEN** no file under any worktree or the git directory, including each worktree's `index` and any `*.lock` file, has been created, modified or deleted
