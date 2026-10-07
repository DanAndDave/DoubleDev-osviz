## 1. Status token in the parser

- [x] 1.1 Red then green: rewrite the `<App>` "Blocked tasks" tests in `test/app.test.tsx` for "Blocked suffix" (token at the end), "Note after the status token", "Trailing whitespace ignored" and "Ticked task is not blocked" (lines from the project-reading delta, `⊘`/`✓` and `progress`), then replace `BLOCKED_SUFFIX` with `BLOCKED_STATUS` as given in design.md in `src/tasks.ts`; verify with `bun test test/app.test.tsx`
- [x] 1.2 Red then green: "Dependency note is not blocked" and "Other spellings are not blocked" (plain ` — blocked`, hyphen, `` `Blocked` ``, `` `blocked`. ``, all shown with `○`); "Issue files not read" keeps passing
- [x] 1.3 Move the "Task lines" "Blocked task" test to the detail-panel delta's line (yellow `⊘`, text as written, note included) and `BLOCKED_TASKS` in the "Blocked marker" tests to write the status token; verify the Blocked marker describe passes unchanged otherwise

## 2. Close

- [x] 2.1 Update **Blocked task** in `CONTEXT.md` to the status token definition, and the `BLOCKED_STATUS` doc comment in `src/tasks.ts`
- [x] 2.2 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on a throwaway repo whose `tasks.md` holds the three `/triage` forms and observe `⊘` on the first two, `○` on the dependency note, and the row's yellow `blocked`
