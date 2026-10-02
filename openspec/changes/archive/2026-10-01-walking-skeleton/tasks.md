## 1. Project setup

- [x] 1.1 Create the package manifest (name `osviz`, ESM, `bin.osviz` → the CLI entry, scripts `test` = `bun test` and `typecheck` = `tsc --noEmit`), `tsconfig.json` (strict, `jsx: react-jsx`) and `.gitignore` (`node_modules`); verify `bun install` succeeds
- [x] 1.2 Add `ink@^7.1.1` and `react@^19.2`, dev `typescript`, `@types/react`, `ink-testing-library@^4` and `@fission-ai/openspec@1.13.0` (exact); verify `bun pm ls` lists them and `bunx openspec --version` prints 1.13.0
- [x] 1.3 Probe Ink input under Bun: a throwaway test renders a component using `useInput`, writes `q` to `stdin`, and sees it handled; verify it passes, then delete it. If it fails, stop and raise it (ADR 0002)

## 2. Test harness

- [x] 2.1 Add a fixture helper that creates an isolated temp git repo (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, fixed identity), writes files, commits with a given author/committer date, sets file mtimes, and removes the directory after the test; verified by its use in sections 3 and 4

## 3. Reading a Project

- [x] 3.1 Implement the task-line parser with OpenSpec's regex verbatim; verify the "Mixed checkboxes", "Non-task lines" and "No tasks file" scenarios pass as tests
- [x] 3.2 Implement Active Change discovery and Artifact presence; verify the "Archive excluded", "Files ignored" and "Partially planned change" scenarios pass
- [x] 3.3 Add the single git helper that always sets `GIT_OPTIONAL_LOCKS=0`, and Change time from one `git status --porcelain -z` plus one `git log --name-only` walk, falling back to newest file mtime; verify the four Change time scenarios pass, including a Project in a subdirectory of its repo
- [x] 3.4 Implement the error model: missing path and missing `openspec/` give a Project error; a failing git command gives a Project error; an existing but unreadable `tasks.md` gives a per-change error; verify with tests for each (the permission test skips when running as root)
- [x] 3.5 Verify the "Git directory untouched" scenario with a before/after listing of every file under the fixture Project and its `.git`
- [x] 3.6 Add the contract test: fixture Projects covering nested, fenced, `*`-bulleted, uppercase-`X` and missing `tasks.md` cases; run the pinned `openspec list --json` in each and assert per-change `completedTasks`/`totalTasks` equal ours

## 4. Change list view

- [x] 4.1 Render Change rows (id, `P S D T` with present letters bold and missing dimmed, 20-cell bar, `done/total`) and the "no active changes" row; verify the "Change in progress", "Change without tasks", "Archived change present" and "No changes" scenarios against `lastFrame()`
- [x] 4.2 Order rows by Change time descending, ties by id ascending; verify "Most recent first" and a tie case through the rendered frame
- [x] 4.3 Add selection with `j`/`k`/arrow keys clamped to the list; verify "Move down" and "Stop at the last row" by writing keys and inspecting the highlighted row
- [x] 4.4 Render Project error rows and per-change error rows; verify "Path without openspec folder", "Path does not exist" and "Unreadable tasks file" through the frame
- [x] 4.5 Quit on `q` via Ink's `exit()`; verify the rendered app unmounts after `q`

## 5. CLI entry

- [x] 5.1 Implement the argument function (`argv`, `cwd`) → Project path, defaulting to `cwd`; verify "Path given" and "No path given" as direct tests
- [x] 5.2 Wire the CLI entry: shebang `#!/usr/bin/env bun`, resolve the path, read the Project, render `<App>`; verify `bun run typecheck` passes

## 6. Verification

- [x] 6.1 Run `bun run typecheck` and the full `bun test` suite once; both pass
- [x] 6.2 Run `bun link`, then `osviz` in this repository and `osviz /tmp` in a terminal; observe the change rows here, the error row for `/tmp`, selection moving with `j`/`k`/arrows, and `q` exiting cleanly
