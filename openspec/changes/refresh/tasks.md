## 1. Read function and reducer

- [x] 1.1 Change `<App>` to take `initial` and `read` props and pass `read={() => readProject(args.path, { base: args.base })}` from `src/cli.tsx`; update the `show` helper in `test/app.test.tsx` to pass both and record each read's promise; verify `bun run typecheck` and the existing `bun test` pass unchanged
- [x] 1.2 Move `snapshot`, `expanded`, `showArchived` and `selected` into one `useReducer` with `move`, `toggleExpanded` and `toggleArchived` actions, and replace the `a` toggle's object-identity lookup with the `{ id, version: { source, dir } | undefined }` row key; verify the existing Selection, Expanding and Archived tests still pass

## 2. Refreshing

- [x] 2.1 Red then green: "Refresh key" (tick a task, press `r`, await the read, row shows the new progress) and "openspec folder removed and restored", by adding the `refreshed(snapshot)` action and an `r` handler
- [x] 2.2 Red then green: "Task ticked while open", "New Change appears" and "Nothing before the interval" under `jest.useFakeTimers()`, by adding the 5-second `setInterval` effect cleared on unmount
- [x] 2.3 Red then green: "Slow read" with a hand-resolved `read` that counts calls, by adding the in-progress `useRef` guard shared by the tick and `r`

## 3. Place kept across a refresh

- [x] 3.1 Red then green: "Selected Change moves" and "Expanded Change stays expanded" (worktree fixture), by keying the selected row before applying `refreshed`
- [x] 3.2 Red then green: "Selected version gone" (remove the worktree with `git worktree remove`), "Selected Change gone", "Selected last Change gone" and "Selected Change archived", by the `refreshed` fallbacks: same Change's first row, else the old index clamped to the last row

## 4. Close

- [x] 4.1 Run `bun run typecheck` and the full `bun test` once; smoke-run `bun src/cli.tsx` on a throwaway git repo, tick a task in another terminal and observe the row update within 5 seconds, then press `r` after another edit and observe it update at once with the selection kept
