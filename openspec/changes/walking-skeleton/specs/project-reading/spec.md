## Purpose

Defines what the visualizer reads from a Project's files on disk and how it derives each Change's Artifacts, Task progress and Change time, without ever writing to the Project.

## ADDED Requirements

### Requirement: Active Changes
The visualizer SHALL treat every directory directly under `openspec/changes/` as an active Change named by its directory name, except the `archive` directory.

#### Scenario: Archive excluded
- **WHEN** `openspec/changes/` contains directories `add-auth`, `fix-login` and `archive`
- **THEN** the active Changes are exactly `add-auth` and `fix-login`

#### Scenario: Files ignored
- **WHEN** `openspec/changes/` contains a file `README.md` next to change directories
- **THEN** `README.md` is not treated as a Change

### Requirement: Artifact presence
For each Change, the visualizer SHALL report four Artifacts as present or missing: proposal (`proposal.md` exists), specs (at least one `.md` file exists anywhere under `specs/`), design (`design.md` exists), and tasks (`tasks.md` exists), all relative to the change directory.

#### Scenario: Partially planned change
- **WHEN** a change directory contains `proposal.md` and `specs/cli/spec.md` but no `design.md` or `tasks.md`
- **THEN** proposal and specs are present, and design and tasks are missing

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

### Requirement: Change time
The visualizer SHALL derive each Change's Change time as follows. If the Project is inside a git repository and the change directory has no uncommitted edits (modified, staged, deleted or untracked files), Change time SHALL be the committer time of the latest commit touching that directory. Otherwise Change time SHALL be the latest modification time of any file under the change directory.

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

### Requirement: Reading never writes to the Project
Reading a Project SHALL NOT create, modify or delete any file inside the Project or its git directory, including git index refreshes and lock files.

#### Scenario: Git directory untouched
- **WHEN** the visualizer reads a Project inside a git repository whose working tree has uncommitted edits
- **THEN** no file under the Project or its git directory, including `index` and any `*.lock` file, has been created, modified or deleted
