## MODIFIED Requirements

### Requirement: Error rows
When the Project cannot be read, the dashboard SHALL show a single error row describing the problem in place of the Change rows. When a Change version's `tasks.md` or `proposal.md` exists but cannot be read, that Change version SHALL be shown as an error row naming the change id, the Source label and the problem, wherever that Change version would be shown; the Headline version SHALL be chosen among the Change's readable versions, and a Change with no readable version SHALL be shown as its error row. Other Changes SHALL be shown normally. A Change version's error row SHALL take one line no wider than the list: a longer problem description SHALL be cut short and end with `…`.

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
