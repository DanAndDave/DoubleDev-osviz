## MODIFIED Requirements

### Requirement: List scrolling
The list SHALL have the terminal's height, minus three rows when the Detail panel is shown below it, and never less than one row, unless the Divider has been moved below the list (see the detail-panel capability's Moving the Divider requirement): then, while the panel is shown below it, the list SHALL have the height the Divider sets. When the list has more rows than its height, it SHALL show a window of consecutive rows filling its height, starting at the first row. The window SHALL move only when the selected row would not be shown. It SHALL then move just far enough to show the selected row together with the rows that cannot be selected directly above and below it, up to the nearest selectable row or the start or end of the list. When those do not all fit, it SHALL show the selected row and as many of the rows directly above it as fit. The window SHALL NOT leave rows empty below the last row while earlier rows are hidden. The window SHALL follow the terminal's current size, including after a resize.

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
