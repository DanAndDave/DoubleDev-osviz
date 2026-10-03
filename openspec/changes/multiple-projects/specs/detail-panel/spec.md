## MODIFIED Requirements

### Requirement: Panel shows the selected Change version
When a row is selected, the dashboard SHALL show a Detail panel for it. For a collapsed Change row, the panel SHALL show the Change's Headline version. For an expanded Change version row, it SHALL show the row's own Change version. For a Project error row, it SHALL show that Project's error. The panel SHALL change with the selection, and with each refresh, to show the selected row as last read. When no row is selected, there SHALL be no panel.

#### Scenario: Collapsed row shows the Headline version
- **WHEN** Change `add-auth` has a Base version at 4/10 and a newer version in worktree `wt-auth` at 7/10, and its collapsed row is selected
- **THEN** the panel shows the tasks of the `wt:wt-auth` version

#### Scenario: Expanded row shows its own version
- **WHEN** Change `add-auth` is expanded and its `main` version row is selected
- **THEN** the panel shows the tasks of the `main` version

#### Scenario: Selection moves
- **WHEN** the panel shows Change `a` and the user presses `j` to select Change `b`
- **THEN** the panel shows Change `b`

#### Scenario: Refresh updates the panel
- **WHEN** the panel shows task `1.2` of the selected Change as open, the task is ticked in `tasks.md`, and a refresh runs
- **THEN** the panel shows task `1.2` as done

#### Scenario: No rows
- **WHEN** the dashboard shows the row saying there are no active changes
- **THEN** no panel is shown

#### Scenario: Project error selected
- **WHEN** the user runs `osviz /tmp/empty` and `/tmp/empty/openspec/` does not exist
- **THEN** the Project's error row is selected and the panel shows that Project's error

### Requirement: Fitting the panel's height
Every panel line SHALL take one terminal row, cut short with `…` when wider than the panel; only an error message wraps. Beside the list, the panel SHALL have the terminal's full height; below the list, it SHALL have the terminal rows the list and the line separating them leave free, never less than two rows. When the panel's lines fit its height, all of them SHALL be shown. Otherwise, Task sections with a heading whose every task is done SHALL be collapsed to their heading line, one at a time from the top, until the lines fit. If they still do not fit, the panel SHALL show its lines in order up to its height, with the last line replaced by `… N more`, where N is the number of tasks below the cut: one for each task line not shown, and a collapsed Task section's total when its heading line is not shown. Tasks of a collapsed Task section whose heading line is shown SHALL NOT be counted. When no task is below the cut, the last line SHALL be `…` alone. The panel's first line SHALL always be shown. Fitting SHALL follow the terminal's current size, including after a resize.

#### Scenario: Short tasks file shown in full
- **WHEN** the shown Change version has 6 tasks in 2 Task sections, one of them all done, and the panel has 20 rows
- **THEN** both Task sections are shown with every task

#### Scenario: Finished sections collapse first
- **WHEN** the panel's first line and Task sections `1. Read` (3/3 done), `2. Draw` (3/3 done) and `3. Close` (0/3 done) take 13 lines, and the panel has 10 rows
- **THEN** `1. Read` is collapsed to its heading line, and `2. Draw` and `3. Close` are shown with all their tasks

#### Scenario: Cut after collapsing
- **WHEN** the shown Change version has Task sections `1. Read` (3/3 done) and `2. Draw` (0/8 done), no `Blocked by:` or `Triage:` line, and the panel has 8 rows
- **THEN** the panel shows its first line, `1. Read` collapsed, the `2. Draw` line, tasks `2.1` to `2.4`, and `… 4 more`

#### Scenario: Collapsed section below the cut counted
- **WHEN** the shown Change version has Task sections `1. Draw` (0/8 done) and `2. Read` (3/3 done), no `Blocked by:` or `Triage:` line, and the panel has 6 rows
- **THEN** the panel shows its first line, the `1. Draw` line, tasks `1.1` to `1.3`, and `… 8 more`

#### Scenario: Below a list that fills the terminal
- **WHEN** the panel is below the list, the terminal has 7 rows, the list has 10 rows, and the selected Change version has 3 open tasks
- **THEN** the list shows 4 rows, and the panel shows its first line and `… 3 more` in the terminal's last two rows

#### Scenario: Terminal made shorter
- **WHEN** the panel shows every task and the terminal is made shorter than the panel
- **THEN** finished Task sections collapse and, if needed, the panel is cut with `… N more`, without any key being pressed

### Requirement: Empty and error cases
When the shown Change version has no `tasks.md`, the panel SHALL show `No tasks.md` in place of Task sections. When its `tasks.md` has no task, the panel SHALL show `No tasks`. When the selected row is a Change version's error row, the panel SHALL show the change id and Source label, then the full error message, wrapped to the panel's width. When the selected row is a Project's error row, the panel SHALL show the Project's path as given on the command line, then the full error message, wrapped to the panel's width.

#### Scenario: No tasks file
- **WHEN** the shown Change version has only `proposal.md`
- **THEN** the panel shows `No tasks.md`

#### Scenario: Tasks file without tasks
- **WHEN** the shown Change version's `tasks.md` holds only headings and prose
- **THEN** the panel shows `No tasks`

#### Scenario: Error row selected
- **WHEN** the selected row is the error row of Change `broken` in `wt:wt-a`, whose `tasks.md` cannot be read
- **THEN** the panel shows `broken`, `wt:wt-a` and the full read failure message

#### Scenario: Project error row selected
- **WHEN** the user runs `osviz ../web /tmp/empty`, `/tmp/empty/openspec/` does not exist, and `/tmp/empty`'s error row is selected
- **THEN** the panel shows `/tmp/empty`, then the full message saying no `openspec/` folder was found, wrapped to the panel's width
