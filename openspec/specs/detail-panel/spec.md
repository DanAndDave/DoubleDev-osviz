# detail-panel Specification

## Purpose

Shows what is left to do in the selected row's Change version, and what it is waiting on, next to the list: its Task sections with each task's state, and its blocking and triage lines, fitted to the terminal.

## Requirements

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

### Requirement: Panel placement
The panel SHALL be shown beside the list, to its right, when the terminal is at least the list's width plus 40 columns wide; otherwise it SHALL be shown below the list. The list SHALL be as wide as its widest Change row, and at least 40 columns. The placement SHALL follow the terminal's current size, including after it is resized while the dashboard is open.

#### Scenario: Wide terminal
- **WHEN** the list is 60 columns wide and the terminal is 100 columns wide
- **THEN** the panel is shown beside the list

#### Scenario: Narrow terminal
- **WHEN** the list is 60 columns wide and the terminal is 99 columns wide
- **THEN** the panel is shown below the list

#### Scenario: Resized while open
- **WHEN** the panel is shown beside a 60-column list and the terminal is narrowed to 90 columns
- **THEN** the panel is shown below the list without any key being pressed, and widening the terminal to 100 columns moves it beside the list again

### Requirement: Panel heading
The panel's first line SHALL show the change id and, when the Project has Source labels, the Source label of the shown Change version. Below it, the panel SHALL show the `Blocked by:` line and then the `Triage:` line of the Change version's `proposal.md`, each as written in the file and each only when present. A line is present when a line of `proposal.md` before its first `##` heading starts with exactly `Blocked by:` or `Triage:`; only the first such line of each counts. When `proposal.md` does not exist, neither line SHALL be shown.

#### Scenario: Both lines present
- **WHEN** the shown Change version's `proposal.md` starts with `# Proposal: Add auth`, `Blocked by: walking-skeleton`, `Triage: ready-for-agent`
- **THEN** the panel shows the change id and Source label, then `Blocked by: walking-skeleton`, then `Triage: ready-for-agent`

#### Scenario: Lines absent
- **WHEN** the shown Change version's `proposal.md` has no `Blocked by:` or `Triage:` line
- **THEN** the panel shows neither line

#### Scenario: Lines after the first section ignored
- **WHEN** `proposal.md` has a `## Why` heading followed by a line `Triage: needs-info` in a code sample, and no `Triage:` line before `## Why`
- **THEN** the panel shows no `Triage:` line

#### Scenario: First occurrence only
- **WHEN** `proposal.md` has `Blocked by: a` and later `Blocked by: b`, both before its first `##` heading
- **THEN** the panel shows `Blocked by: a` only

#### Scenario: No proposal
- **WHEN** the shown Change version has no `proposal.md`
- **THEN** the panel shows its change id line and its tasks, and no `Blocked by:` or `Triage:` line

#### Scenario: Project without Source labels
- **WHEN** the Project is outside git
- **THEN** the panel's first line shows the change id only

### Requirement: Task sections
The panel SHALL group the tasks of the shown Change version's `tasks.md` into Task sections, one per `##` heading, in file order. A Task section SHALL hold the tasks between its heading and the next `##` heading; `#` and `###` headings SHALL NOT start a Task section, so tasks under a `###` heading belong to the `##` above it. Tasks before the first `##` heading SHALL form a Task section without a heading, shown first. A task is any line that counts toward Task progress, so the Task sections' counts SHALL add up to the Change version's Task progress. A `##` heading with no task under it SHALL NOT be shown. Each Task section with a heading SHALL be shown as a line with its heading text, without the `##` marker, and its Task progress as `done/total`, preceded by a green `✓` when every task in it is done, followed by its tasks in file order.

#### Scenario: Sections with their own progress
- **WHEN** `tasks.md` has `## 1. Read` with 2 of 3 tasks done and `## 2. Draw` with 0 of 2 done
- **THEN** the panel shows a `1. Read` line with `2/3` above its three tasks, and a `2. Draw` line with `0/2` above its two tasks

#### Scenario: Sub-heading stays in its section
- **WHEN** `tasks.md` has `## 1. Read`, one task, `### Edge cases` and two more tasks
- **THEN** the panel shows one `1. Read` section with all three tasks and `x/3`, and no `Edge cases` line

#### Scenario: Tasks before the first heading
- **WHEN** `tasks.md` has two tasks, then `## 1. Read` with one task
- **THEN** the panel shows the two tasks first without a heading line, then the `1. Read` section

#### Scenario: Heading without tasks
- **WHEN** `tasks.md` has `## Notes` with only prose under it
- **THEN** no `Notes` line is shown

#### Scenario: Counts add up to the row
- **WHEN** a Change version's row shows `5/9`
- **THEN** the done and total counts of its Task sections, including one without a heading, add up to 5 and 9

#### Scenario: Finished section marked
- **WHEN** Task section `1. Read` has 3 of 3 tasks done
- **THEN** its line shows a green `✓` before `3/3`

### Requirement: Task lines
Each task SHALL be shown on one line: a green `✓` when its checkbox is checked, a yellow `⊘` when it is a Blocked task, or a dimmed `○` otherwise, then the task's text after the checkbox, with the text of a done task dimmed. A Blocked task's text SHALL be shown as written, including its `` — `blocked` `` status token and any note after it. A task indented in `tasks.md` SHALL be indented by the same number of characters in the panel. A task line wider than the panel SHALL be cut short and end with `…`. Lines under a task that are not tasks SHALL NOT be shown.

#### Scenario: Done and open tasks
- **WHEN** a Task section has `- [x] 1.1 Parse sections` and `- [ ] 1.2 Draw panel`
- **THEN** the panel shows `✓ 1.1 Parse sections` with a green `✓` and dimmed text, and `○ 1.2 Draw panel` with a dimmed `○`

#### Scenario: Blocked task
- **WHEN** a Task section has `` - [ ] 1.3 Wire the API — `blocked` — waits on 57 ``
- **THEN** the panel shows `` ⊘ 1.3 Wire the API — `blocked` — waits on 57 `` with a yellow `⊘` and undimmed text

#### Scenario: Nested task
- **WHEN** `tasks.md` has `  - [ ] 1.2.1 nested` under task `1.2`
- **THEN** the nested task's line is indented two characters more than `1.2`'s

#### Scenario: Long task
- **WHEN** a task's text is 200 characters and the panel is 40 columns wide
- **THEN** the task takes one line, ending in `…`

#### Scenario: Continuation lines hidden
- **WHEN** a task is followed by an indented prose line that is not a checkbox
- **THEN** the prose line is not shown

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
