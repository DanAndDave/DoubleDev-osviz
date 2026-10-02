## Purpose

Keeps the dashboard current while it is left open: when the Project is re-read, how overlapping reads are avoided, and what the user's place in the list looks like afterwards.

## ADDED Requirements

### Requirement: Periodic refresh
While the dashboard is open, it SHALL re-read the Project every 5 seconds, counted from when the dashboard opened, from every Source, exactly as it reads the Project at startup, and SHALL then show the rows of the new read. It SHALL stop re-reading when the dashboard exits.

#### Scenario: Task ticked while open
- **WHEN** the dashboard shows Change `add-auth` at `3/10` and a task in its `tasks.md` is ticked
- **THEN** within 5 seconds its row shows `4/10`, without any key being pressed

#### Scenario: New Change appears
- **WHEN** the dashboard is open and a new Change `fix-login` is created in the Project
- **THEN** within 5 seconds a row for `fix-login` is shown, in its place by Change time

#### Scenario: Nothing before the interval
- **WHEN** the dashboard has been open for less than 5 seconds, a task is ticked, and no key is pressed
- **THEN** the row still shows the old Task progress

### Requirement: Refresh on demand
`r` SHALL re-read the Project immediately, the same way as the periodic refresh.

#### Scenario: Refresh key
- **WHEN** a task in Change `add-auth`'s `tasks.md` is ticked and the user presses `r`
- **THEN** the row shows the new Task progress without waiting for the next periodic refresh

### Requirement: No overlapping reads
A read of the Project SHALL NOT start while another read of it is in progress. A periodic refresh or an `r` that comes due during a read SHALL be skipped, not queued.

#### Scenario: Slow read
- **WHEN** a read of the Project is still in progress when the next 5-second tick comes due and the user presses `r`
- **THEN** no second read starts, and the next read starts at the first tick or `r` after the slow read has finished

### Requirement: Place kept across a refresh
A refresh SHALL keep which Changes are expanded and whether archived Changes are shown. After a refresh the selected row SHALL be:
- for a selected Change row, the row of the same Change, even when its Headline version has changed;
- for a selected Change version row, the row of the same Change version (same Source label and change directory), or, when that version is gone, its Change's first row;
- when the selected Change is no longer shown, the row at the same position, or the last row when there are fewer rows.

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

### Requirement: Problems during a refresh
When a refresh finds the Project unreadable, the dashboard SHALL show the error row it would show at startup and SHALL keep refreshing; once a later refresh reads the Project, its rows SHALL be shown again.

#### Scenario: openspec folder removed and restored
- **WHEN** the dashboard is open, the Project's `openspec/` folder is moved away, and a refresh runs
- **THEN** the error row saying no `openspec/` folder was found is shown, and after the folder is moved back the next refresh shows the Change rows again
