## Purpose

Defines how the dashboard shows a Project's Changes: what each row contains, in what order rows appear, how the user moves between them, and how problems are shown.

## ADDED Requirements

### Requirement: Change row contents
The dashboard SHALL show one row per active Change containing, in order: the change id; an Artifact indicator of the letters `P S D T` (proposal, specs, design, tasks), each letter visibly filled when that Artifact is present and dimmed when missing; a progress bar proportional to Task progress; and Task progress as `done/total`.

#### Scenario: Change in progress
- **WHEN** Change `add-auth` has proposal, specs and tasks but no design, and 7 of 10 tasks done
- **THEN** its row shows `add-auth`, `P`, `S` and `T` filled with `D` dimmed, a bar 70% full, and `7/10`

#### Scenario: Change without tasks
- **WHEN** Change `idea` has only `proposal.md`
- **THEN** its row shows an empty progress bar and `0/0`

### Requirement: Rows ordered by Change time
The dashboard SHALL order Change rows by Change time, most recent first. Changes with equal Change time SHALL be ordered by change id ascending. Per-change error rows have no Change time; they SHALL be shown above all Change rows, ordered by change id ascending.

#### Scenario: Most recent first
- **WHEN** `old-change` has Change time 2026-09-01 and `new-change` has Change time 2026-09-05
- **THEN** `new-change` is shown above `old-change`

#### Scenario: Error row first
- **WHEN** Change `broken` has an unreadable `tasks.md` and Change `fine` is readable
- **THEN** the error row for `broken` is shown above `fine`

### Requirement: Archived changes hidden
The dashboard SHALL NOT show changes under `openspec/changes/archive/`.

#### Scenario: Archived change present
- **WHEN** `openspec/changes/archive/2026-08-01-old-thing/` exists
- **THEN** no row for `old-thing` is shown

### Requirement: Selection
The dashboard SHALL highlight exactly one selected row when at least one row exists, starting with the first row. `j` and the down arrow SHALL move the selection down one row; `k` and the up arrow SHALL move it up one row. The selection SHALL NOT move past the first or last row.

#### Scenario: Move down
- **WHEN** the first of three rows is selected and the user presses `j`
- **THEN** the second row is selected

#### Scenario: Stop at the last row
- **WHEN** the last row is selected and the user presses the down arrow
- **THEN** the last row stays selected

### Requirement: Error rows
When the Project cannot be read, the dashboard SHALL show a single error row describing the problem in place of the Change rows. When one Change's `tasks.md` exists but cannot be read, that Change's row SHALL be replaced by an error row naming the change id and the problem, and the other Changes SHALL be shown normally.

#### Scenario: Unreadable tasks file
- **WHEN** Change `broken` has a `tasks.md` the visualizer lacks permission to read, and Change `fine` is readable
- **THEN** an error row names `broken` and the read failure, and `fine` is shown as a normal row

#### Scenario: No changes
- **WHEN** `openspec/changes/` has no active Changes
- **THEN** the dashboard shows a row saying there are no active changes
