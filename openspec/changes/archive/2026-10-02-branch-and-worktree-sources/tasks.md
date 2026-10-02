## 1. Test harness

- [x] 1.1 Extend `Fixture` with `worktree(folder, { branch?, detach? })` (runs `git worktree add` into a separate temp directory registered for cleanup, returns a `Fixture` rooted there) and use the existing `git(...)` helper for branches; verified by its use in sections 2–4

## 2. Snapshot reshape

- [x] 2.1 Move the disk reader (`readHistory`, `readChange`, helpers) into `src/project/worktree.ts` as `readWorktreeSource(dir)`, extracting the `git log --name-only` walk parser so a rev can be passed; verify the existing suite still passes unchanged
- [x] 2.2 Reshape `ProjectSnapshot` to `changes: Change[]` (`{ id, versions }`, each version carrying `source`) plus `labelled`, with Headline-first version order and Headline-time Change order in `read.ts`; update `<App>` to render `versions[0]`; verify the existing `<App>` and reader tests pass after adapting their accessors only

## 3. Sources

- [x] 3.1 Base detection in `src/project/sources.ts` (`--base`, `origin/HEAD` → local branch, `main`, `master`, else the given checkout; unknown `--base` is a Project error); verify the five "Base detection" scenarios through `readProject`
- [x] 3.2 Worktree listing and Base Source selection (Base read from the worktree that has it checked out, else from its commit; prunable and bare entries dropped); verify "Base checked out in the main checkout" and "Base not checked out"
- [x] 3.3 Implement `readCommitSource(path, rev)` in `src/project/commit.ts` (`ls-tree`, one `cat-file --batch`, the shared log walk); verify "Artifacts read from a branch commit" and "Branch read from its commit"
- [x] 3.4 Branch qualification (`for-each-ref` `ahead-behind` filter, `diff <base>...<tip> -- openspec`, `no merge base` = no difference); verify "Unrelated feature branch", "Stale branch", "Branch with OpenSpec edits" and "Remote branch ignored"
- [x] 3.5 Worktree qualification (committed rule or uncommitted `status` under `openspec`; branch in a worktree read once); verify "Uncommitted checkbox ticks only", "Detached worktree", "Branch in a worktree read once" and "Uncommitted edit in another worktree"
- [x] 3.6 Source labels and per-Source `changed` filtering; verify "Labels", "Untouched Change not repeated", "Change only on a branch", "Same id in two Sources" and "Plain directory"
- [x] 3.7 Extend the never-writes test to a repo with a linked worktree holding uncommitted edits and a branch checked out nowhere; verify "Other worktrees untouched"

## 4. Change list view

- [x] 4.1 Render the Source label (padded) and `+N` columns, omitted when the snapshot is unlabelled; verify "Headline from a worktree", "Single version" and "Ordered by Headline version" through `lastFrame()`
- [x] 4.2 `Enter` expands and collapses a Change (expansion as a set of change ids, selection moved to the Change's first row on collapse); verify "Expand", "Collapse" and "Into an expanded Change" by writing keys
- [x] 4.3 Render error versions with their label, Headline chosen among readable versions; verify "Unreadable version in another worktree" (skips as root, like the skeleton's permission test)

## 5. CLI

- [x] 5.1 Parse `--base` with `node:util` `parseArgs` in `src/args.ts`, returning `{ path, base }` or an error; verify "Base given", "Missing value" and "Unknown option" (the parsed result) as direct tests
- [x] 5.2 Pass `base` to `readProject` in `cli.tsx`; on an argument error print `osviz: <error>` and the usage line to stderr and exit 2; verify `bun run typecheck` passes

## 6. Verification

- [x] 6.1 Run `bun run typecheck` and the full `bun test` suite once; both pass
- [x] 6.2 Smoke-run `osviz` in a scratch repo with a worktree holding uncommitted ticks, a qualifying branch and an unrelated branch: observe labels, `+N`, `Enter` expand/collapse, and `osviz --base nope` / `osviz --frobnicate` errors
