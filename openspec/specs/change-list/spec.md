# change-list Specification

## Purpose

Defines how the dashboard shows a Project's Changes: what each row contains, in what order rows appear, how the user moves between them, and how problems are shown.

## Requirements

### Requirement: Change row contents
The dashboard SHALL show one row per active Change, for its Headline version: the Change version with the latest Change time, ties broken by Source label ascending. The row SHALL contain, in order: the change id; an Artifact indicator of the letters `P S D T` (proposal, specs, design, tasks), each letter visibly filled when that Artifact is present and dimmed when missing; a progress bar proportional to Task progress; Task progress as `done/total`; the Headline version's Source label; and `+N` when N other Change versions of that Change exist. Rows SHALL omit `+N` when the Change has only one Change version, and the label when the Project has no Source labels.

#### Scenario: Change in progress
- **WHEN** Change `add-auth` has proposal, specs and tasks but no design, and 7 of 10 tasks done
- **THEN** its row shows `add-auth`, `P`, `S` and `T` filled with `D` dimmed, a bar 70% full, and `7/10`

#### Scenario: Change without tasks
- **WHEN** Change `idea` has only `proposal.md`
- **THEN** its row shows an empty progress bar and `0/0`

#### Scenario: Headline from a worktree
- **WHEN** Change `add-auth` has a Base version at 4/10 with Change time 2026-09-01 and a version in worktree `wt-auth` at 7/10 with Change time 2026-09-05
- **THEN** its row shows `7/10`, `wt:wt-auth` and `+1`

#### Scenario: Single version
- **WHEN** Change `idea` exists only on the Base `main`
- **THEN** its row shows `main` and no `+N`

### Requirement: Rows ordered by Change time
The dashboard SHALL order Change rows by their Headline version's Change time, most recent first. Changes with equal Change time SHALL be ordered by change id ascending. Changes with no readable Change version have no Change time; their error rows SHALL be shown above all Change rows, ordered by change id ascending.

#### Scenario: Most recent first
- **WHEN** `old-change` has Change time 2026-09-01 and `new-change` has Change time 2026-09-05
- **THEN** `new-change` is shown above `old-change`

#### Scenario: Error row first
- **WHEN** Change `broken` has an unreadable `tasks.md` and Change `fine` is readable
- **THEN** the error row for `broken` is shown above `fine`

#### Scenario: Ordered by Headline version
- **WHEN** Change `a` has a Base version from 2026-09-01 and a branch version from 2026-09-09, and Change `b` has only a Base version from 2026-09-05
- **THEN** `a` is shown above `b`

### Requirement: Archived changes hidden
The dashboard SHALL NOT show changes under `openspec/changes/archive/`.

#### Scenario: Archived change present
- **WHEN** `openspec/changes/archive/2026-08-01-old-thing/` exists
- **THEN** no row for `old-thing` is shown

### Requirement: Selection
The dashboard SHALL highlight exactly one selected row when at least one row exists, starting with the first row. `j` and the down arrow SHALL move the selection down one row; `k` and the up arrow SHALL move it up one row. The selection SHALL NOT move past the first or last row. Change version rows of an expanded Change SHALL be selectable like any other row.

#### Scenario: Move down
- **WHEN** the first of three rows is selected and the user presses `j`
- **THEN** the second row is selected

#### Scenario: Stop at the last row
- **WHEN** the last row is selected and the user presses the down arrow
- **THEN** the last row stays selected

#### Scenario: Into an expanded Change
- **WHEN** Change `a` is expanded into two Change version rows, its first row is selected, and the user presses `j`
- **THEN** `a`'s second Change version row is selected

### Requirement: Error rows
When the Project cannot be read, the dashboard SHALL show a single error row describing the problem in place of the Change rows. When a Change version's `tasks.md` exists but cannot be read, that Change version SHALL be shown as an error row naming the change id, the Source label and the problem, wherever that Change version would be shown; the Headline version SHALL be chosen among the Change's readable versions, and a Change with no readable version SHALL be shown as its error row. Other Changes SHALL be shown normally.

#### Scenario: Unreadable tasks file
- **WHEN** Change `broken` has a `tasks.md` the visualizer lacks permission to read, and Change `fine` is readable
- **THEN** an error row names `broken` and the read failure, and `fine` is shown as a normal row

#### Scenario: No changes
- **WHEN** `openspec/changes/` has no active Changes in any Source
- **THEN** the dashboard shows a row saying there are no active changes

#### Scenario: Unreadable version in another worktree
- **WHEN** Change `a` is readable on the Base, its version in worktree `wt-a` has an unreadable `tasks.md`, and the user expands `a`
- **THEN** the collapsed row showed the Base version with `+1`, and the expanded rows show the Base version and an error row naming `a`, `wt:wt-a` and the read failure

### Requirement: Expanding a Change
`Enter` on a collapsed Change's row SHALL expand it into one row per Change version, in the Change row format with each version's own Source label and without `+N`, Headline version first, then the others by Change time, most recent first, ties by Source label. `Enter` on any row of an expanded Change SHALL collapse it and select its row. Every Change SHALL start collapsed.

#### Scenario: Expand
- **WHEN** Change `add-auth` has versions in `wt:wt-auth` (newest), `main` and `fix`, its row is selected, and the user presses `Enter`
- **THEN** three rows for `add-auth` are shown in the order `wt:wt-auth`, then the next newest, then the oldest, each with its own Task progress

#### Scenario: Collapse
- **WHEN** Change `add-auth` is expanded, its third Change version row is selected, and the user presses `Enter`
- **THEN** `add-auth` is shown as one row again and that row is selected
