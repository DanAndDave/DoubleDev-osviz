## MODIFIED Requirements

### Requirement: Periodic refresh
While the dashboard is open, it SHALL re-read every Project every 5 seconds, counted from when the dashboard opened, from every Source, exactly as it reads the Projects at startup. As each Project's read finishes, the dashboard SHALL show that Project's rows from it, without waiting for the other Projects' reads. It SHALL stop re-reading when the dashboard exits.

#### Scenario: Task ticked while open
- **WHEN** the dashboard shows Change `add-auth` at `3/10` and a task in its `tasks.md` is ticked
- **THEN** within 5 seconds its row shows `4/10`, without any key being pressed

#### Scenario: New Change appears
- **WHEN** the dashboard is open and a new Change `fix-login` is created in the Project
- **THEN** within 5 seconds a row for `fix-login` is shown, in its place by Change time

#### Scenario: Nothing before the interval
- **WHEN** the dashboard has been open for less than 5 seconds, a task is ticked, and no key is pressed
- **THEN** the row still shows the old Task progress

#### Scenario: Every Project re-read
- **WHEN** the dashboard shows Projects `../web` and `../api`, and a task is ticked in a Change of each
- **THEN** within 5 seconds both rows show the new Task progress

#### Scenario: Slow Project does not hold up another
- **WHEN** a refresh's read of `../web` is still in progress and its read of `../api` has finished with a ticked task
- **THEN** `../api`'s row shows the new Task progress while `../web`'s rows still show the previous read

### Requirement: Refresh on demand
`r` SHALL re-read every Project immediately, the same way as the periodic refresh.

#### Scenario: Refresh key
- **WHEN** a task in Change `add-auth`'s `tasks.md` is ticked and the user presses `r`
- **THEN** the row shows the new Task progress without waiting for the next periodic refresh

### Requirement: No overlapping reads
A read of a Project SHALL NOT start while another read of the same Project is in progress. A periodic refresh or an `r` that comes due during a Project's read SHALL skip that Project, not queue a read of it, and SHALL still read every other Project that is not being read.

#### Scenario: Slow read
- **WHEN** a read of the Project is still in progress when the next 5-second tick comes due and the user presses `r`
- **THEN** no second read starts, and the next read starts at the first tick or `r` after the slow read has finished

#### Scenario: Slow Project skipped, others read
- **WHEN** a read of `../web` is still in progress when the next 5-second tick comes due, and the read of `../api` has finished
- **THEN** the tick starts a new read of `../api` and no second read of `../web`

### Requirement: Place kept across a refresh
A refresh SHALL keep which Changes are expanded and whether archived Changes are shown. After a refresh of the selected row's Project, the selected row SHALL be:
- for a selected Change row, the row of the same Change, even when its Headline version has changed;
- for a selected Change version row, the row of the same Change version (same Source label and change directory), or, when that version is gone, its Change's first row;
- for a selected Project error row, the same Project's error row while it still cannot be read, otherwise that Project's first selectable row;
- when the selected Change is no longer shown, the selectable row at the same position within its Project, or that Project's last selectable row when it has fewer, or, when the Project has no selectable row left, the nearest selectable row, looking down from the Project's header first;
- when no row was selected, the first selectable row.

A refresh of another Project SHALL keep the same row selected, even when rows above it are added or removed.

#### Scenario: Selected Change moves
- **WHEN** `bravo` is selected below `alpha`, and a task is ticked in `bravo` so it is now the most recent Change
- **THEN** after the refresh `bravo` is the first row and is still selected

#### Scenario: Expanded Change stays expanded
- **WHEN** Change `add-auth` is expanded into rows for `wt:wt-auth` and `main`, the `main` row is selected, and a task is ticked in the `wt-auth` worktree
- **THEN** after the refresh `add-auth` is still expanded and its `main` row is still selected

#### Scenario: Selected version gone
- **WHEN** Change `add-auth` is expanded, its `wt:wt-auth` row is selected, and worktree `wt-auth` is removed
- **THEN** after the refresh `add-auth`'s first row is selected

#### Scenario: Selected Change gone
- **WHEN** the second of three Changes is selected and that Change's folder is deleted
- **THEN** after the refresh the Change now in second position is selected

#### Scenario: Selected last Change gone
- **WHEN** the last of three Changes is selected and that Change's folder is deleted
- **THEN** after the refresh the new last row is selected

#### Scenario: Selected Change archived
- **WHEN** archived Changes are hidden, Change `add-auth` is selected, and it is archived on the Base
- **THEN** after the refresh `add-auth` is not shown and the row at its former position is selected

#### Scenario: Rows added in a Project above
- **WHEN** Change `rate-limit` of `../api` is selected below Project `../web`, and a new Change is created in `../web`
- **THEN** after the refresh the new Change is shown under `../web` and `rate-limit` is still selected

#### Scenario: Selected Project becomes readable
- **WHEN** Project `../web`'s error row is selected because its `openspec/` folder is missing, and the folder is restored
- **THEN** after the refresh `../web`'s first Change row is selected

#### Scenario: Selected Project's last Change gone
- **WHEN** Projects `../web` and `../api` are shown, `../web`'s only Change is selected, and its folder is deleted
- **THEN** after the refresh `../web` shows the row saying there are no active changes, and `../api`'s first Change is selected

### Requirement: Problems during a refresh
When a refresh finds a Project unreadable, the dashboard SHALL show the error row it would show at startup for that Project, SHALL keep showing the other Projects, and SHALL keep refreshing; once a later refresh reads the Project, its rows SHALL be shown again.

#### Scenario: openspec folder removed and restored
- **WHEN** the dashboard is open, the Project's `openspec/` folder is moved away, and a refresh runs
- **THEN** the error row saying no `openspec/` folder was found is shown, and after the folder is moved back the next refresh shows the Change rows again

#### Scenario: One Project breaks during a refresh
- **WHEN** Projects `../web` and `../api` are shown and `../web`'s `openspec/` folder is moved away
- **THEN** after the refresh `../web` shows its error row and `../api`'s rows are unchanged
