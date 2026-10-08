# change-list Specification

## Purpose

Defines how the dashboard shows a Project's Changes: what each row contains, in what order rows appear, how the user moves between them, and how problems are shown.

## Requirements

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

### Requirement: Rows ordered by Change time
Within each Project, the dashboard SHALL order Change rows by their Headline version's Change time, most recent first. Changes with equal Change time SHALL be ordered by change id ascending. Changes with no readable Change version have no Change time; their error rows SHALL be shown above all of that Project's Change rows, ordered by change id ascending.

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
A Change whose Headline version is archived is an archived Change. The dashboard SHALL hide archived Changes by default. Pressing `a` SHALL show them in every Project, in the same order as other Changes, and pressing `a` again SHALL hide them. A row showing an archived Change version SHALL end with the marker `archived`, after the Source label and `+N`. When `a` hides or shows archived Changes, the selected row SHALL stay selected if it is still shown; otherwise the first selectable row SHALL be selected.

#### Scenario: Archived change present
- **WHEN** `openspec/changes/archive/2026-08-01-old-thing/` exists on the Base
- **THEN** no row for `old-thing` is shown

#### Scenario: Archived elsewhere hides a stale active version
- **WHEN** Change `add-auth` is archived on the Base, and worktree `wt-auth` still holds an edited active version of it
- **THEN** no row for `add-auth` is shown

#### Scenario: Toggle archived changes
- **WHEN** `old-thing` is archived on the Base, `live` is active, and the user presses `a`
- **THEN** `old-thing` is shown, ordered by its Change time, with the marker `archived`, and pressing `a` again hides it

#### Scenario: Toggle covers every Project
- **WHEN** Project `../web` has archived Change `old-web` and Project `../api` has archived Change `old-api`, and the user presses `a`
- **THEN** `old-web` is shown under `../web` and `old-api` under `../api`

#### Scenario: Selection kept across the toggle
- **WHEN** archived Changes are shown, Change `live` is selected below archived Change `old-thing`, and the user presses `a`
- **THEN** `old-thing` is hidden and `live` is still selected

#### Scenario: Selected archived Change hidden
- **WHEN** archived Changes are shown, archived Change `old-thing` is selected, and the user presses `a`
- **THEN** the first selectable row is selected

#### Scenario: Only archived changes
- **WHEN** every Change in the Project is archived
- **THEN** the dashboard shows the row saying there are no active changes until the user presses `a`

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

### Requirement: Blocked marker
A row showing a Change version that is not archived and has at least one Blocked task SHALL end with the marker `blocked` in yellow, after the Source label and `+N`. A collapsed Change row SHALL show its Headline version's marker; an expanded Change version row SHALL show its own version's. A row showing an archived Change version SHALL show `archived` and not `blocked`. Blocked Changes SHALL be shown and ordered like any other Change.

#### Scenario: Blocked task present
- **WHEN** Change `add-auth`'s Headline version is active at 2 of 5 and one of its unticked tasks has the status token `` — `blocked` ``
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

### Requirement: Selection
Change rows, Change version rows of an expanded Change, and Project error rows SHALL be selectable; header rows and rows saying there are no active changes SHALL NOT. The dashboard SHALL mark exactly one selected row when at least one selectable row exists, starting with the first selectable row, and none otherwise. While the list has Focus (see the detail-panel capability's Panel focus requirement), `j` and the down arrow SHALL move the selection to the next selectable row below; `k` and the up arrow SHALL move it to the next selectable row above, skipping rows that cannot be selected, across Project boundaries. The selection SHALL NOT move past the first or last selectable row.

Every row but a header row SHALL start with a two-column marker column, before the contents the other requirements describe: `> ` on the selected row and two spaces on every other row. Header rows SHALL start in the list's first column, with no marker column. The marker column SHALL count toward a row's width. The selected row SHALL otherwise be drawn exactly as when it is not selected, with no highlighting. While the list has Focus, the selected row's `>` SHALL be drawn at normal intensity; while the panel has Focus, it SHALL be drawn dimmed.

#### Scenario: Selected row marked
- **WHEN** Changes `a` and `b` are shown and `a` is selected
- **THEN** `a`'s row starts with `> `, `b`'s row starts with two spaces, and neither row is highlighted

#### Scenario: Marker follows the selection
- **WHEN** Changes `a` and `b` are shown, `a` is selected, and the user presses `j`
- **THEN** `b`'s row starts with `> ` and `a`'s row starts with two spaces

#### Scenario: Headers are not indented
- **WHEN** Projects `../web` and `../api` are shown
- **THEN** each header row starts with its path in the list's first column, and each Change row and `No active changes` row starts with the marker column

#### Scenario: Marker dimmed while the panel has Focus
- **WHEN** Change `a` is selected and the user presses `Tab`
- **THEN** `a`'s row still starts with `> `, with the `>` dimmed, and pressing `Tab` again draws it at normal intensity

#### Scenario: Move down
- **WHEN** the first of three rows is selected and the user presses `j`
- **THEN** the second row is selected

#### Scenario: Stop at the last row
- **WHEN** the last row is selected and the user presses the down arrow
- **THEN** the last row stays selected

#### Scenario: Into an expanded Change
- **WHEN** Change `a` is expanded into two Change version rows, its first row is selected, and the user presses `j`
- **THEN** `a`'s second Change version row is selected

#### Scenario: Starts below the first header
- **WHEN** the dashboard opens with Projects `../web` and `../api`, and `../web`'s first Change is `login`
- **THEN** `login` is selected and the header `../web` is not

#### Scenario: Across a Project boundary
- **WHEN** `../web`'s last Change is selected and `../api` has Changes, and the user presses `j`
- **THEN** `../api`'s first Change is selected

#### Scenario: Skipping a Project without rows to select
- **WHEN** Projects `../web`, `../empty` and `../api` are shown, `../empty` has no active Changes, `../web`'s last Change is selected, and the user presses `j`
- **THEN** `../api`'s first Change is selected

#### Scenario: Project error row selected
- **WHEN** Project `../web`'s last Change is selected, Project `../gone` below it cannot be read, and the user presses `j`
- **THEN** `../gone`'s error row is selected

#### Scenario: Nothing to select
- **WHEN** every shown Project has no active Changes
- **THEN** no row starts with `> `

### Requirement: Error rows
When a Project cannot be read, the dashboard SHALL show a single error row describing the problem in place of that Project's Change rows, under its header when there is one, and SHALL show the other Projects normally. When a Change version's `tasks.md` or `proposal.md` exists but cannot be read, that Change version SHALL be shown as an error row naming the change id, the Source label and the problem, wherever that Change version would be shown; the Headline version SHALL be chosen among the Change's readable versions, and a Change with no readable version SHALL be shown as its error row. Other Changes SHALL be shown normally. A Project's error row and a Change version's error row SHALL each take one line no wider than the list: a longer problem description SHALL be cut short and end with `…`.

#### Scenario: Unreadable tasks file
- **WHEN** Change `broken` has a `tasks.md` the visualizer lacks permission to read, and Change `fine` is readable
- **THEN** an error row names `broken` and the read failure, and `fine` is shown as a normal row

#### Scenario: Unreadable proposal file
- **WHEN** Change `broken` has a `proposal.md` the visualizer lacks permission to read, and Change `fine` is readable
- **THEN** an error row names `broken` and the read failure, and `fine` is shown as a normal row

#### Scenario: Long error cut to the list
- **WHEN** Change `broken`'s error message is 300 characters long and the list's widest Change row is 60 columns
- **THEN** the error row is one line of 60 columns ending in `…`

#### Scenario: No changes
- **WHEN** `openspec/changes/` has no active Changes in any Source
- **THEN** the dashboard shows a row saying there are no active changes

#### Scenario: Unreadable version in another worktree
- **WHEN** Change `a` is readable on the Base, its version in worktree `wt-a` has an unreadable `tasks.md`, and the user expands `a`
- **THEN** the collapsed row showed the Base version with `+1`, and the expanded rows show the Base version and an error row naming `a`, `wt:wt-a` and the read failure

#### Scenario: One Project unreadable
- **WHEN** the user runs `osviz ../web /tmp/empty` and `/tmp/empty/openspec/` does not exist
- **THEN** the header `/tmp/empty` is followed by one error row saying no `openspec/` folder was found, and `../web`'s Change rows are shown normally

#### Scenario: Long Project error cut to the list
- **WHEN** a Project's error message is wider than the list
- **THEN** its error row is one line as wide as the list, ending in `…`

### Requirement: Expanding a Change
`Enter` on a collapsed Change's row SHALL expand it into one row per Change version, in the Change row format with each version's own Source label and without `+N`, Headline version first, then the others by Change time, most recent first, ties by Source label. `Enter` on any row of an expanded Change SHALL collapse it and select its row. Every Change SHALL start collapsed. Changes with the same change id in different Projects are different Changes, expanded and collapsed separately. `Enter` on a Project error row SHALL do nothing.

#### Scenario: Expand
- **WHEN** Change `add-auth` has versions in `wt:wt-auth` (newest), `main` and `fix`, its row is selected, and the user presses `Enter`
- **THEN** three rows for `add-auth` are shown in the order `wt:wt-auth`, then the next newest, then the oldest, each with its own Task progress

#### Scenario: Collapse
- **WHEN** Change `add-auth` is expanded, its third Change version row is selected, and the user presses `Enter`
- **THEN** `add-auth` is shown as one row again and that row is selected

#### Scenario: Same change id in two Projects
- **WHEN** Projects `../web` and `../api` both have a Change `add-auth` with two versions, and the user presses `Enter` on `../web`'s `add-auth`
- **THEN** `../web`'s `add-auth` is expanded and `../api`'s `add-auth` stays collapsed

#### Scenario: Enter on a Project error row
- **WHEN** a Project's error row is selected and the user presses `Enter`
- **THEN** the rows and the selection do not change

### Requirement: Project header rows
When two or more Projects are shown, the dashboard SHALL show each Project's rows under a header row, Projects in command-line order. A header row SHALL show the Project's path as given on the command line, in bold, on one line no wider than the list; a longer path SHALL be cut short and end with `…`. Each Project's rows SHALL follow the rules for a single Project: its Change rows in its own order, its error row, or its `No active changes` row. Rows of different Projects SHALL NOT be interleaved. With one Project, no header row SHALL be shown. The id, progress and Source label columns of Change rows SHALL line up across all Projects.

#### Scenario: Two Projects in command-line order
- **WHEN** the user runs `osviz ../web ../api`, `../web` has Change `login` and `../api` has Change `rate-limit`
- **THEN** the list shows the header `../web`, the row for `login`, the header `../api`, then the row for `rate-limit`

#### Scenario: Projects not interleaved
- **WHEN** the user runs `osviz ../web ../api`, `../web`'s only Change has Change time 2026-09-01 and `../api`'s only Change has Change time 2026-09-05
- **THEN** `../web`'s Change is shown above `../api`'s Change

#### Scenario: One Project has no header
- **WHEN** the user runs `osviz ../web`
- **THEN** the list shows `../web`'s Change rows and no header row

#### Scenario: Project without active changes
- **WHEN** the user runs `osviz ../web ../api` and `../api` has no active Changes in any Source
- **THEN** the header `../api` is followed by a row saying there are no active changes

#### Scenario: Columns line up across Projects
- **WHEN** `../web` has Change `a` at `10/12` and `../api` has Change `rate-limit` at `1/2`
- **THEN** the artifact letters and progress bars of both rows start at the same column

### Requirement: List scrolling
The list SHALL have the terminal's height, minus three rows when the Detail panel is shown below it, and never less than one row. When the list has more rows than its height, it SHALL show a window of consecutive rows filling its height, starting at the first row. The window SHALL move only when the selected row would not be shown. It SHALL then move just far enough to show the selected row together with the rows that cannot be selected directly above and below it, up to the nearest selectable row or the start or end of the list. When those do not all fit, it SHALL show the selected row and as many of the rows directly above it as fit. The window SHALL NOT leave rows empty below the last row while earlier rows are hidden. The window SHALL follow the terminal's current size, including after a resize.

#### Scenario: Selection moves below the window
- **WHEN** one Project has Changes `c01` to `c10`, newest first, the list is 4 rows tall, and the user presses `j` five times
- **THEN** `c06` is selected and the list shows `c03` to `c06`

#### Scenario: Window stays while the selection is shown
- **WHEN** the list shows `c03` to `c06` with `c06` selected, and the user presses `k` three times
- **THEN** `c03` is selected and the list still shows `c03` to `c06`

#### Scenario: Selection moves above the window
- **WHEN** the list shows `c03` to `c06` with `c03` selected, and the user presses `k`
- **THEN** `c02` is selected and the list shows `c02` to `c05`

#### Scenario: Crossing into the next Project shows its header
- **WHEN** Project `../web` has Changes `w1` to `w3` and Project `../api` has Changes `a1` to `a3`, the list is 4 rows tall, `w3` is selected, and the user presses `j`
- **THEN** `a1` is selected and the list shows `w2`, `w3`, the header `../api`, and `a1`

#### Scenario: First Project's header comes back
- **WHEN** in the same list, `a3` is selected and the user presses `k` until `w1` is selected
- **THEN** the list shows the header `../web`, `w1`, `w2` and `w3`

#### Scenario: Taller terminal shows more rows
- **WHEN** one Project has 10 Changes, the list is 4 rows tall, the sixth Change is selected, and the terminal is made 12 rows tall with the panel beside the list
- **THEN** all 10 Change rows are shown and the sixth is still selected, without any key being pressed

#### Scenario: Short list does not scroll
- **WHEN** the list has fewer rows than its height
- **THEN** every row is shown
