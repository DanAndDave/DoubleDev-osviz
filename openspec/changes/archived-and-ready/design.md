## Context

Both Source readers skip `openspec/changes/archive/`: `worktree.ts` filters the directory listing, `commit.ts` drops paths whose first segment is `archive`. Everything that keys git output by Change is keyed by change id: `changeIdReader(prefix)` in `history.ts` maps a repository path to the first segment under `openspec/changes/`, and `parseLog` (Change time), the worktree's uncommitted set, and each Source's `changed` set (`sources.ts`) all use it. `read.ts` filters non-Base versions by `changed.has(v.id)`, groups by id, and orders each Change's versions with `byHeadline`, so `versions[0]` is the Headline version. That is where the archived-version decision recorded in the previous design was meant to go. `<App>` holds `selected` as a row index and `expanded` as a set of change ids.

## Goals / Non-Goals

**Goals:**
- One rule for "which directory does this path belong to", shared by every reader and by Source discovery.
- The Headline rule stays in `read.ts` only; the view only reads `versions[0]`.

**Non-Goals:**
- Showing the archive date.
- Treating an archived Change whose only versions are unreadable as archived (see Risks).

## Decisions

### Versions keyed by change directory
A Change version is identified within its Source by its change directory, relative to `openspec/changes/`: `add-auth` or `archive/2026-08-01-add-auth`. `history.ts` replaces `changeIdReader` with `changeDirReader(prefix)`, which maps a repository path to `{ dir, id, archived }` or `undefined`. It takes the first segment, or for `archive/` the first two segments, where the second must match `^\d{4}-\d{2}-\d{2}-(.+)$` with the id as the capture. `parseLog` keys Change times by `dir`. The worktree's uncommitted set, `sources.ts`'s `changed` sets and `read.ts`'s filter all use `dir`.

Keying by id alone would merge an active `add-auth` and an archived `archive/…-add-auth` in one Source into one Change time and one `changed` entry: the Base's unchanged active version would pick up the archive commit's time, and a branch that archived a Change would also contribute the Base's active version.

### Change version shape
`ChangeSummary` and `ChangeError` gain `dir: string` and `archived: boolean`, set by both readers from `changeDirReader`'s result (the worktree reader builds the same triple from its two directory listings). `changeSummary(...)` takes them alongside `id`.

### Reading archive directories
- Worktree: list `openspec/changes/` as today, and also `openspec/changes/archive/` (a missing `archive/` is empty), keeping directories whose name parses. Each one is read by the existing `readChange` with its own directory.
- Commit: the existing `ls-tree` already lists archive paths; files are grouped by `dir` instead of id, and `cat-file` fetches `<rev>:<prefix>openspec/changes/<dir>/tasks.md`. No new git calls.

### Headline order
`byHeadline` in `read.ts` becomes `byChangeTime` (readable before error, then later Change time, then label), followed by `headlineFirst`, which moves the first archived readable version to the front. Only the Headline moves, so expanded rows keep the existing "Headline first, then the others by Change time" order. Rejected: archived before active inside the sort, which would also list every older archived version ahead of newer active ones. `byHeadlineTime` is unchanged, so the Change ordering uses the archived version's Change time when one is the Headline, as the spec requires.

### Archived and Ready predicates
`change.ts` exports `isArchived(change)` (the Headline is readable and archived) and `isReadyToArchive(change)` (the Headline is readable, not archived, `total > 0`, `done === total`). The view calls them. They live beside the `Change` type rather than in `<App>` so the definitions in `CONTEXT.md` map to one place. Alternative: precomputed flags on the snapshot. Rejected: they would be derived data that must be kept in sync with `versions`.

### View
- `showArchived` state, default false; `a` toggles it. The visible Changes are `changes` filtered by `!isArchived` unless shown, and rows are derived from them as today.
- Selection follows its row: before toggling, remember the selected row's Change and version objects (the snapshot is unchanged, so object identity holds), and after deriving the new rows select the row with the same Change and version, else 0. `Enter` looks up by Change id instead, because after expanding or collapsing it selects the Change's first row, not a particular version.
- Marker column, last on the line: `archived` (dim) on any archived version row; `✓ ready to archive` (green) on the row showing the Headline version of a Change for which `isReadyToArchive` holds; otherwise nothing. Markers appear whether or not the Project is labelled.
- `No active changes` is shown when no row is visible, whatever `showArchived` is.

### CONTEXT.md
**Ready to archive** gains "at least one task checkbox, all ticked", as decided with the user. Ready to archive follows `openspec list`, which reports a Change with no checkboxes as "No tasks", not complete.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `project-reading`: Archived Change versions | `readProject` on fixtures; assert per Change the list of `(source, dir/archived, done/total, changeTime)`. |
| `sources`: Change versions per Source (archived on a branch, inherited archive not repeated) | `readProject` on fixtures with a branch and a worktree, as in `test/sources.test.ts`. |
| `change-list`: Headline from an archived version, archived hidden, toggle, selection across the toggle, markers | `<App>` on fixture Projects via `ink-testing-library`: `lastFrame()`, `a` and `j` written to `stdin`. |

The target seam stays `<App>` on a fixture Project; `readProject` is used where the frame cannot show the fact (directory, Change time). Archives are made in fixtures with `git mv` through the existing `Fixture.git`, so a branch archives the way `openspec archive` does.

## Risks / Trade-offs

- [An archived version whose `tasks.md` is unreadable is an error version, and Headlines are chosen among readable versions] → the Change shows its newest active version and is not treated as archived. Rare, and the expanded rows still show the error.
- [Two archive directories for one id in one Source (archived, re-created, archived again)] → both are Change versions from that Source; the newer is the Headline. Expanded rows show both with the same label. Accepted.
- [An archived Change's stale active version on a branch or worktree that never merged the archive] → still counted in `+N` and visible when expanded, which is how the user finds it.
