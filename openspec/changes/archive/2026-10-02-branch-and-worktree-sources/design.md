## Context

The walking skeleton reads one Source, the files on disk under the given path (`src/project/read.ts`): `readHistory` runs one `git status` and one `git log --name-only` walk, `readChange` reads one change directory, and `readProject` returns `{ kind: "ok", changes: ChangeRow[] }`, sorted. `<App>` renders that list and owns the selection. Every git call goes through `src/project/git.ts`, which sets `GIT_OPTIONAL_LOCKS=0`. ADR 0001 fixes the approach: git plumbing plus worktree files on disk, local refs only, no writes; a branch checked out in a worktree is read only from that worktree.

Observed with git 2.55 (the version used here): `git worktree list --porcelain -z` lists every worktree with `HEAD <sha>`, then `branch refs/heads/<name>` or `detached`, plus `prunable …` when its folder is gone. `git for-each-ref --format='%(ahead-behind:<base>)' refs/heads` prints `ahead behind` per branch in one call (requires git 2.41 or newer). `git diff A...B` fails with `no merge base` for unrelated histories. `ls-tree --full-name` and `diff`/`log --name-only` print repository-root-relative paths when run from a subdirectory. `cat-file --batch` answers `<rev>:<path> missing` for absent objects.

## Goals / Non-Goals

**Goals:**
- One reading path per kind of Source: worktree files on disk (the skeleton's reader, run once per worktree) and git objects (new), both producing the same Change version summary.
- Process count proportional to qualifying candidates, not to the number of branches.

**Non-Goals:**
- Archived Change versions and the Headline rule's archived exception (`archived-and-ready`).
- Showing *why* a Source qualified, or listing non-qualifying Sources.
- Submodules and bare repositories as Projects.

## Decisions

### Snapshot shape: Changes holding Change versions
`ProjectSnapshot` becomes `{ kind: "error", message } | { kind: "ok", changes: Change[], labelled: boolean }`. A `Change` is `{ id, versions: ChangeVersion[] }`, where a `ChangeVersion` is the skeleton's summary or error plus `source: string | undefined` (the label; `undefined` only outside git, where `labelled` is false). The reader orders `versions` with the Headline version first, then by Change time descending, ties by label. Error versions come after every readable one, and a Change with no readable version sorts with the error rows. It also orders `changes` by Headline Change time as today. The view picks `versions[0]` for the collapsed row and `versions.length - 1` for `+N`, so the Headline rule lives in the reader only, where `archived-and-ready` will change it.

Alternative: the view computes the Headline. Rejected: it would spread the rule over two modules, and `archived-and-ready` must edit exactly one place.

### Module layout
- `src/project/sources.ts`: `findSources(path, base?)` → `{ kind: "none" } | { kind: "error", message } | { kind: "git", sources: Source[] }`, where a `Source` is `{ label, read: "worktree", dir, changed? } | { label, read: "commit", rev, changed }`. `dir` is the Project directory inside that worktree, and `changed` is the set of change ids the Source may contribute (absent for the Base, which contributes all).
- `src/project/worktree.ts`: the skeleton's disk reader moved out of `read.ts` unchanged in behaviour (`readHistory` + `readChange`), exposed as `readWorktreeSource(dir)`.
- `src/project/commit.ts`: `readCommitSource(path, rev)`, the git-object reader.
- `src/project/read.ts`: `readProject(path, { base })` checks the path and `openspec/`, calls `findSources`, reads each Source in parallel, keeps only versions whose id is in the Source's `changed` set, groups by id, chooses Headlines, sorts.

### Finding Sources
1. `git rev-parse --show-prefix` (as today) gives the Project's prefix inside the repository. Failing with "not a git repository", or git not runnable outside any `.git`, gives `none`; the skeleton's rules are kept.
2. Base: `--base` resolved with `rev-parse --verify -q <ref>^{commit}` (unknown → Project error `unknown --base ref: <ref>`). Otherwise `symbolic-ref -q --short refs/remotes/origin/HEAD` → strip `origin/` → `refs/heads/<name>` if it exists, then `refs/heads/main`, then `refs/heads/master` (`rev-parse --verify -q`). If none exists, there is no Base ref: the worktree at the given path is the Base Source, and no other Source can qualify, because qualification needs a Base commit to compare against. This keeps the skeleton's behaviour for repositories without these branches and for repositories with no commits.
3. `git worktree list --porcelain -z`: drop `bare` and `prunable` entries. A worktree whose branch is the Base branch becomes the Base Source (`read: "worktree"`, label = Base branch name). If none has it, the Base is `read: "commit"` at the Base rev, labelled with the branch name (or with the ref as typed when `--base` names a non-branch ref).
4. Candidates: every other worktree, and every local branch not checked out in a worktree. `for-each-ref --format=%(refname:short)%00%(ahead-behind:<base>)` drops branches with `ahead == 0` in one call. Worktrees are always candidates, since uncommitted edits can qualify them.
5. Per remaining candidate, in parallel: `git diff --name-only -z <base>...<tip> -- openspec` run from the Project directory; for a worktree also `git status --porcelain=v1 -z --untracked-files=all -- openspec` run from its Project directory. A `no merge base` failure counts as no committed difference. A candidate qualifies when either list is non-empty. Its `changed` set is the change ids under `openspec/changes/` found in either list. Any other git failure is a Project error, as in the skeleton.

Label: a worktree on a branch other than the Base, or detached, is `wt:<basename of worktree path>`. A branch read from a commit is its short name.

Alternative: `rev-list --count` plus a separate `diff` per branch. Rejected: two processes per branch for every branch, where `ahead-behind` filters all of them in one call.

### Reading a commit Source
Three git calls per commit Source, run from the Project directory:
- `ls-tree -r -z --full-name --name-only <rev> -- openspec/changes` → active Changes (first path segment after the prefix, excluding `archive`) and Artifact presence from the path list (`proposal.md`, `design.md`, `tasks.md`, any `specs/**/*.md`).
- `cat-file --batch` fed `<rev>:<repo path of tasks.md>` for each Change with tasks → contents parsed with the skeleton's `countTasks`. One process for all Changes; read the stdin and stdout of a single `Bun.spawn`. The response is `<sha> blob <size>\n<bytes>\n` per object.
- `log -z --no-renames --diff-merges=combined --format=%x01%ct --name-only <rev> -- openspec/changes` → Change time per id: the skeleton's walk with a rev argument. Share the parser with `worktree.ts` instead of copying it.

A git object cannot be "unreadable" the way a file can, so commit Sources produce no per-version errors. Any failing call is a Project error.

### Version filtering
The Base contributes every active Change. Every other Source contributes versions only for ids in `changed` that are active Changes in that Source, so a branch deleting a Change contributes nothing for it. Filtering happens after reading, which keeps both readers unaware of Sources.

### View
`<App>` keeps `selected: number` and `expanded: Set<string>` (change ids) and derives the visible row list: per Change, one Headline row when collapsed, or one row per version when expanded. Columns after the skeleton's are the label padded to the longest visible label, then `+N`. Both are omitted when `labelled` is false. `key.return` toggles the Change of the selected row and moves the selection to that Change's first row. Error versions render as the skeleton's error row with the label added.

### CLI
`src/args.ts` uses `node:util` `parseArgs` (`strict: true`, `allowPositionals: true`, option `base: { type: "string" }`). It accepts `--base x` and `--base=x` anywhere, and rejects unknown options and a missing value with a thrown `ERR_PARSE_ARGS_*` error. The function returns `{ path, base }` or `{ error }`. `cli.tsx` prints `osviz: <error>` and `usage: osviz [path] [--base <ref>]` to stderr and exits 2 on error.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `sources`: Base detection, Base always a Source, branch and worktree qualification, labels, versions per Source, outside git | `readProject(path, { base })` on fixture repos with branches and worktrees; assert per Change the list of `(source, done/total)` versions. Exact sets of Sources cannot be read off a frame reliably. |
| `project-reading`: Active Changes, Artifact presence, Change time for commit and worktree Sources | `readProject` on fixtures, asserting `artifacts` and `changeTime` of the named version. |
| `project-reading`: never writes, other worktrees | The skeleton's before/after listing, extended to every worktree folder and the shared `.git`. |
| `project-reading`: matches OpenSpec | Unchanged contract test; commit Sources reuse `countTasks`, so no new contract case. |
| `change-list`: row contents, ordering, selection, error rows, expanding | `<App>` on fixture Projects via `ink-testing-library`: `lastFrame()`, keys written to `stdin` (`\r` for Enter). |
| `cli`: Base option | The argument function tested directly. The exit-2 path is a 3-line branch in `cli.tsx`, smoke-run by hand. |

The target seam stays `<App>` on a fixture Project; `readProject` is used where the frame cannot show the fact.

Fixtures: `Fixture` grows `branch(name)`/`checkout(name)` through the existing `git(...)` helper and `worktree(folder, { branch?, detach? })`. The latter runs `git worktree add` into a separate temp directory registered for cleanup and returns a `Fixture` rooted there, so `write`/`commit` work inside it. Commit dates stay explicit, so Headline choice and ordering are deterministic.

## Risks / Trade-offs

- [`ahead-behind` needs git 2.41+] → documented in the proposal's Impact. An older git fails the call, which surfaces as a Project error naming the git failure rather than wrong output.
- [Many worktrees each cost a `diff` and a `status`] → worktrees are few in practice; branches, which can number in hundreds, are filtered in one call.
- [Project directory missing in another worktree's checkout (prefix absent on that branch)] → `git status` and `diff` there report nothing under `openspec`, so the worktree does not qualify. `readWorktreeSource` is only called for qualifying Sources.
- [Label collisions: two worktrees with the same folder name in different parents] → both are shown with the same label. This is accepted, since folder names are what the ticket asks for.
- [`--base` naming a remote-tracking ref] → allowed because the user asked explicitly; ADR 0001's "remote refs are ignored" governs automatic discovery only. The rule is recorded here so it isn't mistaken for a bug.
