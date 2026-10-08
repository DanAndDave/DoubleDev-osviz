## MODIFIED Requirements

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
