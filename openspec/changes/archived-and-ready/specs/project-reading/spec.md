## ADDED Requirements

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
