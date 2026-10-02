## Context

Greenfield: the repo holds only workflow docs and OpenSpec scaffolding. Stack and data-source decisions are settled in ADR 0002 (Bun + TypeScript + Ink) and ADR 0001 (read state ourselves, never through the `openspec` CLI, never writing). Vocabulary follows `CONTEXT.md`. Toolchain observed locally: Bun 1.4.2, Node 26.8.1, git 2.55.0, `@fission-ai/openspec` 1.13.0; latest `ink` is 7.1.1 (peer `react` ≥ 19.2), `ink-testing-library` 4.0.0.

OpenSpec 1.13.0 counts tasks with `/^\s*[-*]\s*\[([\sxX])\]\s*(.*)/` applied to every line of the tracked tasks file (for the `spec-driven` schema, the change's top-level `tasks.md`), fenced lines included, and lists every directory under `openspec/changes/` except `archive`.

## Goals / Non-Goals

**Goals:**
- A module split whose reading half the later changes extend (more Sources, more Projects, refresh) without rewriting the UI, and whose UI half they extend (expansion, detail panel, project headers) without rewriting the reader.
- A test harness that builds real git fixture repositories quickly and deterministically.

**Non-Goals:**
- Reading anything but the files on disk under the given path: no branches, no other worktrees, no Base detection.
- Custom OpenSpec schemas whose tracked tasks file is not `tasks.md`.
- Linting/formatting setup, a compiled single-file binary.

## Decisions

### Module layout: reader → snapshot → view
- `src/project/` reads one Project and returns a plain `ProjectSnapshot` value: either `{ kind: "error", message }` or `{ kind: "ok", changes: ChangeRow[] }` where each row is either a Change version summary (`id`, `artifacts: { proposal, specs, design, tasks }`, `tasks: { done, total }`, `changeTime: Date`) or a per-change error (`id`, `message`). Sorting happens here, not in the view.
- `src/tasks.ts` holds the pure task-line parser (the regex above, copied verbatim, with a comment pointing at OpenSpec's `utils/task-progress.js`). `detail-panel` will extend it with section grouping.
- `src/ui/` holds Ink components that render a snapshot and own selection state. The view never touches the filesystem or git.
- `src/cli.tsx` parses `argv`, resolves the path (default `process.cwd()`), loads the snapshot, renders `<App>`. It is the `bin` entry with a `#!/usr/bin/env bun` shebang.

Alternative considered: components reading the project themselves via hooks. Rejected: it couples every later Source/refresh change to the UI and makes the reader untestable without rendering.

### Change time with two git calls per Project
Inside a git repo (`git rev-parse --show-prefix` succeeds; its output maps repo-root-relative paths back to the Project), Change time comes from:
1. `git --no-optional-locks status --porcelain=v1 -z --untracked-files=all -- openspec/changes` → the set of change ids with uncommitted edits.
2. `git log -z --no-renames --diff-merges=combined --format=%x01%ct --name-only -- openspec/changes` → walking newest first, the latest commit time seen for each change id. `--diff-merges=combined` makes a merge list the paths it changed against every parent; without it a merge prints no paths and a conflict resolution inside a change would be credited to an older commit.

Changes in set 1, changes with no commit, every change on a branch with no commits yet, and every change outside git use the newest file mtime under the change directory (recursive `stat`). When git cannot be run at all, a Project with no `.git` in it or any parent is treated as outside git; one inside a repository is a Project error. One `git log` for all changes beats one per change, and the later `branch-and-worktree-sources` change can reuse the same walk per ref.

`--no-optional-locks` (equivalent to `GIT_OPTIONAL_LOCKS=0`) is what stops `git status` from refreshing and rewriting `.git/index`; without it the read-only guarantee in ADR 0001 is broken by the very first status call. Every git invocation goes through one helper that sets `GIT_OPTIONAL_LOCKS=0` in the environment, so no call site can forget it.

Alternative considered: `stat`-only Change time. Rejected: a fresh clone or checkout resets mtimes, so every Change would look changed "now".

### Error model
Project-level failures (path missing, no `openspec/`, a failing git command) produce `{ kind: "error" }`. A `tasks.md` that exists but cannot be read (any error other than ENOENT, matching OpenSpec's own handling) produces a per-change error row; error rows have no Change time and sort above Change rows, by id, so problems are not buried. Nothing throws past the reader; the CLI never exits on a read problem.

### Rendering
Rows are fixed columns: change id padded to the longest id, `P S D T` letters (bold when present, dim when missing), a 20-cell bar of `█`/`░`, and `done/total`. The selected row uses inverse video. `useInput` handles `j`/`k`/arrows/`q`; `q` calls Ink's `exit()` so the terminal is restored and the process ends with status 0.

### Dependencies
`ink@^7.1.1`, `react@^19.2`; dev: `typescript`, `@types/react`, `ink-testing-library@^4`, and `@fission-ai/openspec` pinned to `1.13.0` so the contract test runs the same counting rules on every machine instead of whatever `openspec` is on `PATH`. Type checking: `tsc --noEmit`. Tests: `bun test`.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `cli`: quit key, problems do not exit | `<App>` rendered with `ink-testing-library` against a fixture path: assert on `lastFrame()`, write keys to `stdin`, assert the app unmounts on `q`. |
| `cli`: path argument | The CLI's argument function (`argv`, `cwd`) → Project path, tested directly. Ink needs a TTY for raw-mode input, so the spawned `bin` is not driven from `bun test`; it is smoke-run by hand after `bun link` (task 6.2). |
| `change-list`: row contents, order, selection, archived hidden, error rows | `<App>` on fixture Projects, as for the quit key. |
| `project-reading`: Active Changes, Artifact presence, Task progress, Change time | `readProject(path)` on fixture git repos; Change time scenarios assert on the snapshot's `changeTime`. |
| `project-reading`: matches OpenSpec | Contract test: run the pinned `openspec list --json` on the same fixture Projects and compare per-change `completedTasks`/`totalTasks`. |
| `project-reading`: never writes | `readProject` on a fixture with uncommitted edits: record path, size and mtime of every file under the Project (including `.git`) before and after, assert the two listings are equal and no `*.lock` file appeared. |

The target seam is `<App>` on a fixture Project; `readProject` is used directly only where the frame cannot show the fact (exact Change time values, the write check).

Fixtures: a test helper creates a temp directory, runs `git init`, writes files, and commits with `GIT_AUTHOR_DATE`/`GIT_COMMITTER_DATE` set, sets file mtimes with `utimes`, and isolates git from user config (`GIT_CONFIG_GLOBAL=/dev/null`, `GIT_CONFIG_NOSYSTEM=1`, fixed author identity). Each test gets its own directory, removed afterwards.

## Risks / Trade-offs

- [Our task parser drifts from OpenSpec's on upgrade] → contract test against a pinned OpenSpec; bumping the pin is a deliberate act that reruns it.
- [Ink raw-mode input under Bun] → task 1.3 renders a key-driven component under `bun test` before anything else is built on it; if it fails, stop and raise it rather than switching stacks silently (ADR 0002).
- [Permission-based "unreadable `tasks.md`" fixture is meaningless when tests run as root] → that test skips itself when `process.getuid() === 0`.
- [Large repos: `git log -- openspec/changes` walks history] → bounded by commits touching `openspec/changes`; acceptable for a skeleton, revisited if `refresh` polling shows it is slow.
