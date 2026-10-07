## MODIFIED Requirements

### Requirement: Task lines
Each task SHALL be shown on one line: a green `✓` when its checkbox is checked, a yellow `⊘` when it is a Blocked task, or a dimmed `○` otherwise, then the task's text after the checkbox, with the text of a done task dimmed. A Blocked task's text SHALL be shown as written, including its ` — blocked` ending. A task indented in `tasks.md` SHALL be indented by the same number of characters in the panel. A task line wider than the panel SHALL be cut short and end with `…`. Lines under a task that are not tasks SHALL NOT be shown.

#### Scenario: Done and open tasks
- **WHEN** a Task section has `- [x] 1.1 Parse sections` and `- [ ] 1.2 Draw panel`
- **THEN** the panel shows `✓ 1.1 Parse sections` with a green `✓` and dimmed text, and `○ 1.2 Draw panel` with a dimmed `○`

#### Scenario: Blocked task
- **WHEN** a Task section has `- [ ] 1.3 Wire the API — blocked`
- **THEN** the panel shows `⊘ 1.3 Wire the API — blocked` with a yellow `⊘` and undimmed text

#### Scenario: Nested task
- **WHEN** `tasks.md` has `  - [ ] 1.2.1 nested` under task `1.2`
- **THEN** the nested task's line is indented two characters more than `1.2`'s

#### Scenario: Long task
- **WHEN** a task's text is 200 characters and the panel is 40 columns wide
- **THEN** the task takes one line, ending in `…`

#### Scenario: Continuation lines hidden
- **WHEN** a task is followed by an indented prose line that is not a checkbox
- **THEN** the prose line is not shown
