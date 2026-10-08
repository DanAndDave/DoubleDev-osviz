## MODIFIED Requirements

### Requirement: Panel placement
The dashboard SHALL have a Placement mode, one of `auto`, `beside` and `below`, starting as `auto`. In `auto`, the panel SHALL be shown beside the list, to its right, when the terminal is at least the list's width plus 40 columns wide; otherwise it SHALL be shown below the list. In `beside`, the panel SHALL be shown beside the list whenever the terminal is at least the list's width plus 10 columns wide, taking every column right of the list; otherwise it SHALL be shown below the list. In `below`, the panel SHALL be shown below the list at any terminal width. The list SHALL be as wide as its widest Change row, and at least 40 columns. The placement SHALL follow the terminal's current size, including after it is resized while the dashboard is open.

`v` SHALL change the Placement mode from `auto` to `beside`, from `beside` to `below`, and from `below` to `auto`, whichever side has Focus. While no panel is shown, `v` SHALL do nothing. The Placement mode SHALL be kept when the selection changes, on a refresh and on a resize, for as long as the dashboard is open.

#### Scenario: Wide terminal
- **WHEN** the Placement mode is `auto`, the list is 60 columns wide and the terminal is 100 columns wide
- **THEN** the panel is shown beside the list

#### Scenario: Narrow terminal
- **WHEN** the Placement mode is `auto`, the list is 60 columns wide and the terminal is 99 columns wide
- **THEN** the panel is shown below the list

#### Scenario: Resized while open
- **WHEN** the Placement mode is `auto`, the panel is shown beside a 60-column list and the terminal is narrowed to 90 columns
- **THEN** the panel is shown below the list without any key being pressed, and widening the terminal to 100 columns moves it beside the list again

#### Scenario: Starts in auto
- **WHEN** the dashboard opens with a Change selected, the list 60 columns wide and the terminal 100 columns wide
- **THEN** the panel is shown beside the list

#### Scenario: v cycles the Placement mode
- **WHEN** the list is 60 columns wide, the terminal is 99 columns wide, the Placement mode is `auto`, and the user presses `v`
- **THEN** the panel is shown beside the list, pressing `v` again shows it below the list, and pressing `v` a third time keeps it below the list, as `auto` does at 99 columns

#### Scenario: Below on a wide terminal
- **WHEN** the Placement mode is `below`, the list is 60 columns wide and the terminal is 200 columns wide
- **THEN** the panel is shown below the list

#### Scenario: Beside squeezed
- **WHEN** the Placement mode is `beside`, the list is 60 columns wide, the terminal is 75 columns wide, and the selected Change version's first task is wider than the panel
- **THEN** the panel is shown beside the list in the terminal's last 15 columns, and the task's line is cut short and ends with `…`

#### Scenario: Beside with no room
- **WHEN** the Placement mode is `beside`, the list is 60 columns wide and the terminal is 69 columns wide
- **THEN** the panel is shown below the list, and widening the terminal to 70 columns moves it beside the list

#### Scenario: Mode kept across selection and refresh
- **WHEN** the Placement mode is `below` on a terminal wide enough for `auto` to show the panel beside the list, and the user presses `j` and then `r`
- **THEN** the panel is still shown below the list

#### Scenario: v with the panel focused
- **WHEN** the panel has Focus and the user presses `v`
- **THEN** the Placement mode changes as when the list has Focus, and the panel keeps Focus

#### Scenario: v without a panel
- **WHEN** the dashboard shows the row saying there are no active changes and the user presses `v`
- **THEN** no panel is shown, and once a Change is shown and selected, the panel is placed as in `auto`
