## 1. Blocked tasks in the panel

- [x] 1.1 Red then green: `<App>` "Task lines" test "Blocked task" (yellow `⊘`, undimmed text with ` — blocked`) by adding `blocked` to `Task` in `src/tasks.ts`, setting it in `parseTasks` with `/ — blocked$/` on unticked tasks, and drawing `⊘` in `Panel.tsx`'s task line; verify with `bun test test/app.test.tsx`
- [x] 1.2 Red then green: panel tests for "Trailing whitespace ignored", "Ticked task is not blocked" (`✓`, row `1/1`), "Other spellings are not blocked" (all four shown with `○`) and "Issue files not read" (fixture with `issues/01-api.md` holding `status: blocked`, task shown with `○`)

## 2. Blocked marker on rows

- [x] 2.1 Add `isBlocked(version)` to `src/project/change.ts`, exercised through the `<App>` tests below
- [x] 2.2 Red then green: "Blocked task present" (row `2/5` ending in yellow `blocked`) and "No blocked task" by adding `blocked` to `markerOf` and a yellow branch to `Marker` in `src/ui/App.tsx`
- [x] 2.3 Red then green: "Blocked only in an older version" (collapsed row unmarked; after `ENTER`, only the `main` row ends with `blocked`), "Archived with a blocked task" (after `a`, `archived` only) and "Blocked Change keeps its place"

## 3. Close

- [x] 3.1 Add **Blocked task** to `CONTEXT.md` under "What is shown"
- [x] 3.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on a throwaway repo with a ` — blocked` task and observe the yellow row marker and `⊘` in the panel
