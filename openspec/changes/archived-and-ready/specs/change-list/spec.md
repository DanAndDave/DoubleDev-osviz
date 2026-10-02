## MODIFIED Requirements

### Requirement: Change row contents
The dashboard SHALL show one row per shown Change, for its Headline version: among the Change's readable versions, the archived Change version with the latest Change time when any version is archived, otherwise the Change version with the latest Change time; ties are broken by Source label ascending. The row SHALL contain, in order: the change id; an Artifact indicator of the letters `P S D T` (proposal, specs, design, tasks), each letter visibly filled when that Artifact is present and dimmed when missing; a progress bar proportional to Task progress; Task progress as `done/total`; the Headline version's Source label; and `+N` when N other Change versions of that Change exist. Rows SHALL omit `+N` when the Change has only one Change version, and the label when the Project has no Source labels.

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

#### Scenario: Archived version is the Headline
- **WHEN** Change `add-auth` is archived on the Base `main` with Change time 2026-09-01, and worktree `wt-auth` holds an active version at 5/10 with Change time 2026-09-05, and archived Changes are shown
- **THEN** its row shows the Base's archived version with `main` and `+1`

### Requirement: Archived changes hidden
A Change whose Headline version is archived is an archived Change. The dashboard SHALL hide archived Changes by default. Pressing `a` SHALL show them, in the same order as other Changes, and pressing `a` again SHALL hide them. A row showing an archived Change version SHALL end with the marker `archived`, after the Source label and `+N`. When `a` hides or shows archived Changes, the selected row SHALL stay selected if it is still shown; otherwise the first row SHALL be selected.

#### Scenario: Archived change present
- **WHEN** `openspec/changes/archive/2026-08-01-old-thing/` exists on the Base
- **THEN** no row for `old-thing` is shown

#### Scenario: Archived elsewhere hides a stale active version
- **WHEN** Change `add-auth` is archived on the Base, and worktree `wt-auth` still holds an edited active version of it
- **THEN** no row for `add-auth` is shown

#### Scenario: Toggle archived changes
- **WHEN** `old-thing` is archived on the Base, `live` is active, and the user presses `a`
- **THEN** `old-thing` is shown, ordered by its Change time, with the marker `archived`, and pressing `a` again hides it

#### Scenario: Selection kept across the toggle
- **WHEN** archived Changes are shown, Change `live` is selected below archived Change `old-thing`, and the user presses `a`
- **THEN** `old-thing` is hidden and `live` is still selected

#### Scenario: Selected archived Change hidden
- **WHEN** archived Changes are shown, archived Change `old-thing` is selected, and the user presses `a`
- **THEN** the first row is selected

#### Scenario: Only archived changes
- **WHEN** every Change in the Project is archived
- **THEN** the dashboard shows the row saying there are no active changes until the user presses `a`

## ADDED Requirements

### Requirement: Ready to archive marker
A Change SHALL be Ready to archive when its Headline version is not archived and its Task progress has at least one task, all done. The row showing a Ready to archive Change's Headline version SHALL end with the marker `✓ ready to archive`, after the Source label and `+N`. A Change with no tasks SHALL NOT be Ready to archive.

#### Scenario: Every task ticked
- **WHEN** Change `add-auth`'s Headline version is active with Task progress 7 of 7
- **THEN** its row ends with `✓ ready to archive`

#### Scenario: Tasks remaining
- **WHEN** Change `add-auth`'s Headline version is active with Task progress 6 of 7
- **THEN** its row has no `✓ ready to archive` marker

#### Scenario: No tasks
- **WHEN** Change `idea` has Task progress 0 of 0
- **THEN** its row has no `✓ ready to archive` marker

#### Scenario: Already archived
- **WHEN** Change `add-auth`'s Headline version is archived with Task progress 7 of 7, and archived Changes are shown
- **THEN** its row ends with `archived` and has no `✓ ready to archive` marker

#### Scenario: Ready on an older version only
- **WHEN** Change `add-auth` has a Base version at 7 of 7 and a newer worktree version at 7 of 8
- **THEN** its row shows `7/8` and no `✓ ready to archive` marker
