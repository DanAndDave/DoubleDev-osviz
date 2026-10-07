## MODIFIED Requirements

### Requirement: Blocked tasks
The visualizer SHALL treat a task of a Change version's `tasks.md` as a Blocked task when its checkbox is unchecked and its text after the checkbox, with trailing whitespace removed, contains the status token `` — `blocked` ``: a space, an em dash (U+2014), a space, then `blocked` in lowercase between backticks, followed by a space or by the end of the text. A task with a checked box SHALL NOT be a Blocked task. A Blocked task SHALL count toward Task progress exactly as any other unchecked task. No file other than `tasks.md` SHALL be read to decide whether a task is blocked.

#### Scenario: Blocked suffix
- **WHEN** `tasks.md` has `` - [ ] [01 Confine the sandbox](issues/01-confine.md) — `blocked` ``
- **THEN** the task is a Blocked task and Task progress is 0 done of 1

#### Scenario: Note after the status token
- **WHEN** `tasks.md` has `` - [ ] [03 Admit a worker tier](issues/03-admit.md) — `blocked` — the writing tier; waits on 57 ``
- **THEN** the task is a Blocked task

#### Scenario: Trailing whitespace ignored
- **WHEN** `tasks.md` has `` - [ ] 2.1 Wire the API — `blocked` `` followed by two trailing spaces
- **THEN** task `2.1` is a Blocked task

#### Scenario: Ticked task is not blocked
- **WHEN** `tasks.md` has `` - [x] 2.1 Wire the API — `blocked` ``
- **THEN** task `2.1` is not a Blocked task and Task progress is 1 done of 1

#### Scenario: Dependency note is not blocked
- **WHEN** `tasks.md` has `` - [ ] [05 Correct the seams](issues/05-correct.md) — `ready-for-agent` — blocked by 04 ``
- **THEN** the task is not a Blocked task

#### Scenario: Other spellings are not blocked
- **WHEN** `tasks.md` has `- [ ] 2.1 a — blocked`, `` - [ ] 2.2 b - `blocked` ``, `` - [ ] 2.3 c — `Blocked` `` and `` - [ ] 2.4 d — `blocked`. ``
- **THEN** none of them is a Blocked task

#### Scenario: Issue files not read
- **WHEN** a Change has `issues/01-api.md` containing `status: blocked` and its `tasks.md` has no task with the status token `` — `blocked` ``
- **THEN** the Change version has no Blocked task
