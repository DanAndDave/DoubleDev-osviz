## MODIFIED Requirements

### Requirement: Panel focus
Either the list or the Detail panel SHALL have Focus; the dashboard SHALL start with Focus on the list. `Tab` SHALL move Focus from the list to the panel, and from the panel back to the list. While no panel is shown, `Tab` SHALL do nothing, and when the panel stops being shown, Focus SHALL return to the list. While the panel has Focus, its border SHALL be drawn heavy (`┃` beside the list, `━` below it) and in cyan; while the list has Focus, it SHALL be drawn light (`│`, `─`) in the default colour. The list's selection marker SHALL show Focus too (see the change-list capability's Selection requirement). `Enter`, `a`, `r` and `q` SHALL act on the dashboard as before whichever side has Focus.

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
