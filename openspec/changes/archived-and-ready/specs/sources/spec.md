## MODIFIED Requirements

### Requirement: Change versions per Source
The Base SHALL contribute a Change version for every active Change and every archived Change version it holds. Every other Source SHALL contribute a Change version only for each active change directory, and each archive directory, that differs between the Source and the commit where it split from the Base, counting uncommitted edits for a worktree.

#### Scenario: Untouched Change not repeated
- **WHEN** the Base holds Changes `a` and `b`, and a qualifying branch edits only `openspec/changes/b/`
- **THEN** `a` has one Change version (the Base's) and `b` has two

#### Scenario: Change only on a branch
- **WHEN** branch `new-idea` adds `openspec/changes/new-idea/proposal.md` and the Base has no such Change
- **THEN** Change `new-idea` has one Change version, from `new-idea`

#### Scenario: Archived on a branch
- **WHEN** the Base holds active Change `add-auth`, and branch `wrap-up` moves it to `openspec/changes/archive/2026-09-10-add-auth/`
- **THEN** `add-auth` has two Change versions: the Base's active one and `wrap-up`'s archived one

#### Scenario: Archive inherited from the Base not repeated
- **WHEN** the Base holds `openspec/changes/archive/2026-08-01-old/`, and a qualifying worktree has not changed that directory
- **THEN** `old` has one Change version, the Base's
