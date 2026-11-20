## ADDED Requirements

### Requirement: Moving the Divider
The Divider is the panel's border between it and the list: a column beside the list, a row below it. `m` SHALL arm the Divider, whichever side has Focus, and `m` again or `Esc` SHALL disarm it. While no panel is shown, `m` SHALL do nothing, and when the panel stops being shown, the Divider SHALL be disarmed. While the Divider is armed, the dashboard SHALL have the terminal report the mouse (xterm modes 1002 and 1006), and SHALL stop it when the Divider is disarmed or the dashboard closes; while it is disarmed, the mouse SHALL NOT be reported, so click-drag selects text in the terminal.

While the Divider is armed, pressing the left mouse button SHALL move the Divider to the pointer's column beside the list, or the pointer's row below it, and moving the pointer with the button held SHALL move the Divider with it. Releasing the button SHALL disarm the Divider. Beside the list, the Divider at column C (counting from 0) SHALL make the list C columns wide, at least 10 and at most the terminal's width minus 10; Change rows wider than the list SHALL be cut short and end with `…`. Below the list, the Divider at row R SHALL make the list R rows tall, at least one and at most the terminal's height minus three, even when it has fewer rows. The Divider's place beside the list and its place below it SHALL each be kept, for as long as the dashboard is open, across selection changes, refreshes, Placement mode changes and resizes, and SHALL be clamped to those bounds at the terminal's current size. Other keys SHALL act as before while the Divider is armed.

#### Scenario: Not armed by default
- **WHEN** the dashboard opens with a Change selected
- **THEN** the mouse is not reported and the panel's border is drawn light

#### Scenario: m arms and disarms
- **WHEN** the user presses `m`
- **THEN** the mouse is reported and the panel's border is drawn double (`║` beside the list, `═` below it), and pressing `m` again stops the reports and draws the border light

#### Scenario: Esc disarms
- **WHEN** the Divider is armed and the user presses `Esc`
- **THEN** the mouse is no longer reported

#### Scenario: Dragging beside the list
- **WHEN** the panel is beside a 60-column list in a 120-column terminal, the Divider is armed, and the user presses the left button at column 60, drags to column 80 and releases it
- **THEN** the list is 80 columns wide, the panel takes the remaining 40, and the mouse is no longer reported

#### Scenario: Narrowing the list cuts its rows
- **WHEN** the panel is beside a 60-column list, the Divider is armed, and the user presses the left button at column 30
- **THEN** the list is 30 columns wide and its Change rows are cut short, ending with `…`

#### Scenario: Clamped to the terminal
- **WHEN** the panel is beside the list in a 120-column terminal, the Divider is armed, and the user drags to column 115
- **THEN** the list is 110 columns wide and the panel 10

#### Scenario: Dragging below the list
- **WHEN** the panel is below a one-row list in a 30-row terminal, the Divider is armed, and the user presses the left button at row 10
- **THEN** the list is 10 rows tall, its row followed by 9 empty rows, and the panel's border is on row 10

#### Scenario: Kept across placement changes
- **WHEN** the Divider was moved to column 50 beside the list, and the user presses `v` until the panel is below the list and then beside it again
- **THEN** the panel below the list is placed as before the Divider was moved, and back beside it the list is 50 columns wide

#### Scenario: Pointer ignored while disarmed
- **WHEN** the Divider is not armed and a left button press at column 30 arrives
- **THEN** nothing changes

#### Scenario: m without a panel
- **WHEN** the dashboard shows the row saying there are no active changes and the user presses `m`
- **THEN** the mouse is not reported

## MODIFIED Requirements

### Requirement: Panel placement
The dashboard SHALL have a Placement mode, one of `auto`, `beside` and `below`, starting as `auto`. In `auto`, the panel SHALL be shown beside the list, to its right, when the terminal is at least the list's natural width plus 40 columns wide; otherwise it SHALL be shown below the list. In `beside`, the panel SHALL be shown beside the list whenever the terminal is at least the list's natural width plus 10 columns wide, taking every column right of the list; otherwise it SHALL be shown below the list. In `below`, the panel SHALL be shown below the list at any terminal width. The list's natural width SHALL be its widest Change row's, and at least 40 columns; beside the panel, the list SHALL have its natural width until the Divider is moved there (see Moving the Divider). The placement SHALL follow the terminal's current size, including after it is resized while the dashboard is open.

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

### Requirement: Panel focus
Either the list or the Detail panel SHALL have Focus; the dashboard SHALL start with Focus on the list. `Tab` SHALL move Focus from the list to the panel, and from the panel back to the list. While no panel is shown, `Tab` SHALL do nothing, and when the panel stops being shown, Focus SHALL return to the list. While the panel has Focus, its border SHALL be drawn heavy (`┃` beside the list, `━` below it) and in cyan; while the list has Focus, it SHALL be drawn light (`│`, `─`) in the default colour; while the Divider is armed, it SHALL be drawn double instead, in the colour Focus gives it (see Moving the Divider). The list's selection marker SHALL show Focus too (see the change-list capability's Selection requirement). `Enter`, `a`, `r` and `q` SHALL act on the dashboard as before whichever side has Focus.

#### Scenario: Starts on the list
- **WHEN** the dashboard opens with a Change selected
- **THEN** the list has Focus and the panel's border is light and not cyan

#### Scenario: Tab moves Focus to the panel and back
- **WHEN** the list has Focus and the user presses `Tab`
- **THEN** the panel's border is drawn heavy and in cyan, and pressing `Tab` again draws it light in the default colour

#### Scenario: Focused panel below the list
- **WHEN** the panel is shown below the list and the user presses `Tab`
- **THEN** the panel's top border is drawn as a cyan line of `━`

#### Scenario: Movement keys follow Focus
- **WHEN** Changes `a` and `b` are shown, `a` is selected, the panel has Focus, and the user presses `j`
- **THEN** `a` stays selected

#### Scenario: Other keys unaffected
- **WHEN** the panel has Focus and the user presses `a`
- **THEN** archived Changes are shown, as when the list has Focus

#### Scenario: No panel
- **WHEN** the dashboard shows the row saying there are no active changes and the user presses `Tab`
- **THEN** no panel is shown and nothing else changes

