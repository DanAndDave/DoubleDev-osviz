## 1. Change directories

- [x] 1.1 Replace `changeIdReader` in `src/project/history.ts` with `changeDirReader(prefix)` returning `{ dir, id, archived }` (archive entries must match `<YYYY-MM-DD>-<id>`), key `parseLog` by `dir`, and migrate every caller (`worktree.ts`, `commit.ts`, `sources.ts`, `read.ts` filter by `dir`); verify `bun run typecheck` and the existing suite still pass
- [x] 1.2 Add `dir` and `archived` to `ChangeSummary`/`ChangeError` and `changeSummary(...)` in `src/project/change.ts`; verify typecheck

## 2. Reading archived versions

- [x] 2.1 Red then green: `readProject` tests for "Archived directory belongs to its Change", "Active and archived in one Source" (separate Change times) and "Unrecognised archive entries ignored", by reading `openspec/changes/archive/` in `readWorktreeSource`
- [x] 2.2 Red then green: "Archived on a branch" (project-reading, Change time from the branch commit) by grouping `ls-tree` paths by `dir` in `readCommitSource`
- [x] 2.3 Red then green: sources scenarios "Archived on a branch" (`git mv` on a branch gives Base active + branch archived) and "Archive inherited from the Base not repeated"; verify both pass via `readProject`
- [x] 2.4 Red then green: `byHeadline` in `read.ts` puts archived before active; `readProject` test that the archived Base version is `versions[0]` despite a newer worktree version

## 3. Dashboard

- [x] 3.1 Add `isArchived` and `isReadyToArchive` to `src/project/change.ts`, exercised through the `<App>` tests below
- [x] 3.2 Red then green: `<App>` tests "Archived change present", "Archived elsewhere hides a stale copy" and "Only archived changes" (update the existing `archived changes get no row` and `no active changes` tests instead of duplicating them)
- [x] 3.3 Red then green: `a` toggles archived Changes with the `archived` marker, "Archived version is the Headline" (`main` and `+1` shown), and selection kept or reset across the toggle
- [x] 3.4 Red then green: `✓ ready to archive` marker scenarios (all ticked, tasks remaining, no tasks, already archived, ready on an older version only)

## 4. Close

- [x] 4.1 Update the **Ready to archive** definition in `CONTEXT.md` to require at least one task checkbox
- [x] 4.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on a throwaway repo with an archived Change and press `a`, observing the toggle and markers
