## ADDED Requirements

### Requirement: Panel focus
Either the list or the Detail panel SHALL have Focus; the dashboard SHALL start with Focus on the list. `Tab` SHALL move Focus from the list to the panel, and from the panel back to the list. While no panel is shown, `Tab` SHALL do nothing, and when the panel stops being shown, Focus SHALL return to the list. While the panel has Focus, its border SHALL be drawn in cyan; while the list has Focus, it SHALL be drawn as before. `Enter`, `a`, `r` and `q` SHALL act on the dashboard as before whichever side has Focus.

#### Scenario: Starts on the list
- **WHEN** the dashboard opens with a Change selected
- **THEN** the list has Focus and the panel's border is not cyan

#### Scenario: Tab moves Focus to the panel and back
- **WHEN** the list has Focus and the user presses `Tab`
- **THEN** the panel's border is drawn in cyan, and pressing `Tab` again draws it as before

#### Scenario: Movement keys follow Focus
- **WHEN** Changes `a` and `b` are shown, `a` is selected, the panel has Focus, and the user presses `j`
- **THEN** `a` stays selected

#### Scenario: Other keys unaffected
- **WHEN** the panel has Focus and the user presses `a`
- **THEN** archived Changes are shown, as when the list has Focus

#### Scenario: No panel
- **WHEN** the dashboard shows the row saying there are no active changes and the user presses `Tab`
- **THEN** no panel is shown and nothing else changes

### Requirement: Scrolling the panel
While the panel has Focus, `j` and the down arrow SHALL scroll it one line down, and `k` and the up arrow one line up. Scrolling SHALL apply to the lines left after Task sections are collapsed to fit (see Fitting the panel's height); it SHALL NOT expand a collapsed Task section. The panel's first line SHALL stay in place. Scrolled down by S lines, the panel SHALL show the lines that follow its first line starting S lines further down, in its remaining rows, with the first of those rows replaced by `… N above`, N counting the tasks in the lines it hides, and the last replaced by `… N more` while lines remain below, N counting the tasks it hides; tasks are counted as for `… N more` in Fitting the panel's height, and either line SHALL read `…` alone when it hides no task. The panel SHALL NOT scroll above its top, nor further down once its last line is shown. A panel whose lines fit its height, an error panel, and a panel with fewer than three rows below its first line SHALL NOT scroll. The panel SHALL return to its top whenever another row is selected. A refresh or a resize SHALL keep the scroll position; while the panel's lines do not reach that far down, it SHALL show its last lines.

#### Scenario: Scroll one line down
- **WHEN** the shown Change version has Task sections `1. Read` (3/3 done) and `2. Draw` (0/8 done), no `Blocked by:` or `Triage:` line, the panel has 8 rows and Focus, and the user presses `j`
- **THEN** the panel shows its first line, `… 3 above`, tasks `2.1` to `2.5`, and `… 3 more`

#### Scenario: Scroll to the end
- **WHEN** the same panel is at its top and the user presses `j` three times
- **THEN** the panel shows its first line, `… 5 above`, and tasks `2.3` to `2.8`, with no `… more` line, and pressing `j` again changes nothing

#### Scenario: Scroll back up
- **WHEN** the same panel is scrolled to the end and the user presses `k` three times
- **THEN** the panel shows its first line, `1. Read` collapsed, the `2. Draw` line, tasks `2.1` to `2.4`, and `… 4 more`, and pressing `k` again changes nothing

#### Scenario: Nothing to scroll
- **WHEN** every line of the shown Change version fits the panel, the panel has Focus, and the user presses `j`
- **THEN** the panel is unchanged

#### Scenario: Another row selected
- **WHEN** the panel of Change `a` is scrolled down, the user presses `Tab`, `j` to select Change `b`, `k` to select `a` again, and `Tab`
- **THEN** the panel shows `a` from its top

#### Scenario: Refresh keeps the position
- **WHEN** the panel is scrolled down one line, a task is ticked in the shown Change version's `tasks.md`, and a refresh runs
- **THEN** the panel is still scrolled down one line and shows the task as done

#### Scenario: Terminal made taller
- **WHEN** the panel is scrolled to the end and the terminal is made tall enough for every line
- **THEN** the panel shows every line, with no `… above` line, without any key being pressed

## MODIFIED Requirements

### Requirement: Fitting the panel's height
Every panel line SHALL take one terminal row, cut short with `…` when wider than the panel; only an error message wraps. Beside the list, the panel SHALL have the terminal's full height; below the list, it SHALL have the terminal rows the list and the line separating them leave free, never less than two rows. When the panel's lines fit its height, all of them SHALL be shown. Otherwise, Task sections with a heading whose every task is done SHALL be collapsed to their heading line, one at a time from the top, until the lines fit. If they still do not fit, the panel, until it is scrolled (see Scrolling the panel), SHALL show its lines in order up to its height, with the last line replaced by `… N more`, where N is the number of tasks below the cut: one for each task line not shown, and a collapsed Task section's total when its heading line is not shown. Tasks of a collapsed Task section whose heading line is shown SHALL NOT be counted. When no task is below the cut, the last line SHALL be `…` alone. The panel's first line SHALL always be shown. Fitting SHALL follow the terminal's current size, including after a resize.

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
