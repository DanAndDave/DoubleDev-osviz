# project-reading Specification

## Purpose

Defines what the visualizer reads from a Project's files on disk and how it derives each Change's Artifacts, Task progress and Change time, without ever writing to the Project.

## Requirements

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

### Requirement: Archived Change versions
The visualizer SHALL treat every directory directly under a Source's `openspec/changes/archive/` whose name is `<YYYY-MM-DD>-<change-id>` (four digits, two digits, two digits, then the change id) as an archived Change version of the Change `<change-id>`. Other files and directories under `archive/` SHALL be ignored. An archived Change version's Artifacts, Task progress and Change time SHALL be derived from its archive directory by the same rules as an active one's from its change directory. For a Source read from a commit, a directory is any such path that has files below it in that commit.

#### Scenario: Archived directory belongs to its Change
- **WHEN** a Source contains `openspec/changes/archive/2026-08-01-add-auth/` with `tasks.md` at 3 of 3
- **THEN** Change `add-auth` has an archived Change version from that Source with Task progress 3 of 3

#### Scenario: Active and archived in one Source
- **WHEN** a Source contains both `openspec/changes/add-auth/` and `openspec/changes/archive/2026-08-01-add-auth/`
- **THEN** Change `add-auth` has two Change versions from that Source, one active and one archived, each with the Change time of its own directory

#### Scenario: Unrecognised archive entries ignored
- **WHEN** `openspec/changes/archive/` contains a directory `notes` and a file `README.md`
- **THEN** neither is read as a Change version

#### Scenario: Archived on a branch
- **WHEN** branch `add-auth`, checked out nowhere, commits `openspec/changes/archive/2026-09-10-add-auth/tasks.md` at 2026-09-10T12:00Z
- **THEN** the branch's archived Change version of `add-auth` has Change time 2026-09-10T12:00Z

### Requirement: Artifact presence
For each Change version, the visualizer SHALL report four Artifacts as present or missing: proposal (`proposal.md` exists), specs (at least one `.md` file exists anywhere under `specs/`), design (`design.md` exists), and tasks (`tasks.md` exists), all relative to the change directory in that Version's Source.

#### Scenario: Partially planned change
- **WHEN** a change directory contains `proposal.md` and `specs/cli/spec.md` but no `design.md` or `tasks.md`
- **THEN** proposal and specs are present, and design and tasks are missing

#### Scenario: Artifacts read from a branch commit
- **WHEN** branch `add-auth` is not checked out anywhere, and its commit adds `openspec/changes/add-auth/design.md` that the Base lacks
- **THEN** the branch's Change version of `add-auth` has design present and the Base's has design missing

### Requirement: Task progress matches OpenSpec
The visualizer SHALL compute Task progress from the change's top-level `tasks.md` by counting every line that consists of optional leading whitespace, a `-` or `*` bullet, optional whitespace, and a checkbox `[ ]`, `[x]` or `[X]` (a whitespace character inside the brackets counting as unchecked). Lines inside code fences and indented lines count. A checked box is one containing `x` or `X`. For the same files, the visualizer's done and total counts SHALL equal those reported by `openspec list --json`.

#### Scenario: Mixed checkboxes
- **WHEN** `tasks.md` contains `- [x] 1.1 a`, `* [X] 1.2 b`, `- [ ] 1.3 c` and `  - [ ] 1.3.1 nested`
- **THEN** Task progress is 2 done of 4

#### Scenario: Non-task lines
- **WHEN** `tasks.md` contains `## 1. Setup`, `- plain bullet` and `[x] no bullet`
- **THEN** none of those lines count toward Task progress

#### Scenario: No tasks file
- **WHEN** a change directory has no `tasks.md`
- **THEN** Task progress is 0 done of 0

#### Scenario: Agreement with OpenSpec
- **WHEN** `openspec list --json` is run on a Project
- **THEN** for every Change, its `completedTasks` and `totalTasks` equal the visualizer's done and total counts

### Requirement: Blocked tasks
The visualizer SHALL treat a task of a Change version's `tasks.md` as a Blocked task when its checkbox is unchecked and its text after the checkbox, with trailing whitespace removed, ends with a space, an em dash (U+2014), a space and `blocked`, in that case. A task with a checked box SHALL NOT be a Blocked task. A Blocked task SHALL count toward Task progress exactly as any other unchecked task. No file other than `tasks.md` SHALL be read to decide whether a task is blocked.

#### Scenario: Blocked suffix
- **WHEN** `tasks.md` has `- [ ] 2.1 Wire the API — blocked`
- **THEN** task `2.1` is a Blocked task and Task progress is 0 done of 1

#### Scenario: Trailing whitespace ignored
- **WHEN** `tasks.md` has `- [ ] 2.1 Wire the API — blocked  ` with two trailing spaces
- **THEN** task `2.1` is a Blocked task

#### Scenario: Ticked task is not blocked
- **WHEN** `tasks.md` has `- [x] 2.1 Wire the API — blocked`
- **THEN** task `2.1` is not a Blocked task and Task progress is 1 done of 1

#### Scenario: Other spellings are not blocked
- **WHEN** `tasks.md` has `- [ ] 2.1 a - blocked`, `- [ ] 2.2 b (blocked)`, `- [ ] 2.3 c — Blocked` and `- [ ] 2.4 d — blocked by auth`
- **THEN** none of them is a Blocked task

#### Scenario: Issue files not read
- **WHEN** a Change has `issues/01-api.md` containing `status: blocked` and its `tasks.md` has no task ending in ` — blocked`
- **THEN** the Change version has no Blocked task

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
