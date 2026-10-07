## ADDED Requirements

### Requirement: Blocked marker
A row showing a Change version that is not archived and has at least one Blocked task SHALL end with the marker `blocked` in yellow, after the Source label and `+N`. A collapsed Change row SHALL show its Headline version's marker; an expanded Change version row SHALL show its own version's. A row showing an archived Change version SHALL show `archived` and not `blocked`. Blocked Changes SHALL be shown and ordered like any other Change.

#### Scenario: Blocked task present
- **WHEN** Change `add-auth`'s Headline version is active at 2 of 5 and one of its unticked tasks ends with ` — blocked`
- **THEN** its row shows `2/5` and ends with a yellow `blocked`

#### Scenario: No blocked task
- **WHEN** Change `add-auth`'s Headline version has no Blocked task
- **THEN** its row has no `blocked` marker

#### Scenario: Blocked only in an older version
- **WHEN** Change `add-auth` has a Base version with a Blocked task and a newer worktree version `wt-auth` without one
- **THEN** its collapsed row has no `blocked` marker, and when expanded, the Base version's row ends with `blocked` and the `wt:wt-auth` row does not

#### Scenario: Archived with a blocked task
- **WHEN** Change `old-thing` is archived with a Blocked task, and archived Changes are shown
- **THEN** its row ends with `archived` and has no `blocked` marker

#### Scenario: Blocked Change keeps its place
- **WHEN** Change `blocked-one` has a Blocked task and Change time 2026-09-05, and Change `free` has Change time 2026-09-01
- **THEN** `blocked-one` is shown above `free`
