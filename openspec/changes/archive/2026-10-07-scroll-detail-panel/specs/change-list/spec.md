## MODIFIED Requirements

### Requirement: Selection
Change rows, Change version rows of an expanded Change, and Project error rows SHALL be selectable; header rows and rows saying there are no active changes SHALL NOT. The dashboard SHALL highlight exactly one selected row when at least one selectable row exists, starting with the first selectable row, and none otherwise. While the list has Focus (see the detail-panel capability's Panel focus requirement), `j` and the down arrow SHALL move the selection to the next selectable row below; `k` and the up arrow SHALL move it to the next selectable row above, skipping rows that cannot be selected, across Project boundaries. The selection SHALL NOT move past the first or last selectable row.

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
- **THEN** no row is highlighted
