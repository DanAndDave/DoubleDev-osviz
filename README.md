# osviz

A terminal dashboard showing how far the [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in one or more projects have progressed. It reads each change from wherever its newest state lives: the base branch, other local branches, or worktrees, including uncommitted edits.

osviz only reads. It never checks out, fetches, adds worktrees, or writes lock files ([ADR 0001](docs/adr/0001-read-state-from-git-objects.md)).

## Requirements

- [Bun](https://bun.sh) 1.4 or later
- `git` on `PATH` (a project outside git is read from its files alone)

## Install

```sh
git clone git@github.com:DanAndDave/DoubleDev-osviz.git
cd DoubleDev-osviz
bun install
bun add -g "$PWD"
```

`bun add -g` puts `osviz` in Bun's global bin folder (`bun pm bin -g`), which must be on your `PATH`. To run it without installing, use `bun src/cli.tsx` in place of `osviz`.

## Usage

```sh
osviz [path ...] [--base <ref>]
```

- With no path, osviz shows the project in the current directory. A project is a directory containing an `openspec/` folder.
- Several paths show several projects, in the order given, each under its own header.
- `--base <ref>` sets the base branch for every project. Without it, the base is the local branch named by `origin/HEAD`, then `main`, then `master`, and otherwise whatever is checked out at the path.

A project that cannot be read (missing path, no `openspec/` folder, unknown `--base` ref) shows an error row, and the dashboard keeps running. A bad command line prints usage and exits with status 2.

### What a row shows

Each row is one change: its id, which planning documents exist (`P` proposal, `S` specs, `D` design, `T` tasks), a progress bar, and ticked over total task checkboxes, counted the way `openspec list` counts them. When a change exists in more than one place, the row shows the most recently changed copy, labelled with its branch or `wt:<worktree>`, and `+N` for the others. A change with every task ticked but not yet archived is marked `✓ ready to archive`.

Beside or below the list, the detail panel shows the selected change's tasks grouped by `##` section in `tasks.md`, plus the `Blocked by:` and `Triage:` lines from its `proposal.md`.

Every project is re-read every 5 seconds.

### Keys

| Key | Action |
| --- | --- |
| `j` / `↓`, `k` / `↑` | Move the selection |
| `Enter` | Expand a change into one row per branch or worktree, or collapse it |
| `a` | Show or hide archived changes |
| `r` | Re-read every project now |
| `q` | Quit |

## Development

```sh
bun test           # test suite, including a contract test against the real `openspec list --json`
bun run typecheck  # tsc --noEmit
```

- `src/project/` reads projects: base detection, sources, git history, and change summaries.
- `src/ui/` renders the dashboard with [Ink](https://github.com/vadimdemedes/ink).
- `CONTEXT.md` defines the domain vocabulary (Project, Base, Source, Change version, Headline version, and so on).
- `openspec/specs/` is the behaviour specification; `docs/adr/` records the architectural decisions.
- `docs/agents/workflow.md` describes how changes are planned and built.
