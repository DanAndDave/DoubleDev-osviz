# osviz

A terminal dashboard showing how far the [OpenSpec](https://github.com/Fission-AI/OpenSpec) changes in one or more projects have progressed. It reads each change from wherever its newest state lives: the base branch, other local branches, or worktrees, including uncommitted edits.

osviz only reads. It never checks out, fetches, adds worktrees, or writes lock files ([ADR 0001](docs/adr/0001-read-state-from-git-objects.md)).

## Requirements

- [Bun](https://bun.sh) 1.4 or later
- `git` on `PATH` (a project outside git is read from its files alone)

## Install

```sh
git clone https://github.com/DanAndDave/DoubleDev-osviz.git
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
- To watch several projects in one dashboard, pass each project's path. They appear in the order given, each under a header showing the path as typed:

  ```sh
  osviz                                  # the project in the current directory
  osviz ~/dev/app ~/dev/api ../tooling   # three projects in one dashboard
  ```

  osviz keeps no list of projects; name them on every run, or wrap the command in a shell alias.

- `--base <ref>` sets the base branch for every project. Without it, the base is the local branch named by `origin/HEAD`, then `main`, then `master`, and otherwise whatever is checked out at the path.

A project that cannot be read (missing path, no `openspec/` folder, unknown `--base` ref) shows an error row, and the dashboard keeps running. A bad command line prints usage and exits with status 2.

### What a row shows

Each row is one change: its id, which planning documents exist (`P` proposal, `S` specs, `D` design, `T` tasks), a progress bar, and ticked over total task checkboxes, counted the way `openspec list` counts them. When a change exists in more than one place, the row shows the most recently changed copy, labelled with its branch or `wt:<worktree>`, and `+N` for the others. A change with every task ticked but not yet archived is marked `✓ ready to archive`. The selected row starts with `>`.

Beside or below the list, the detail panel shows the selected change's tasks grouped by `##` section in `tasks.md`, plus the `Blocked by:` and `Triage:` lines from its `proposal.md`. When the tasks do not fit, press `Tab` to focus the panel and scroll it with `j`/`k`: its border turns heavy and cyan, and the list's `>` dims. The panel goes beside the list when the terminal has room and below it otherwise; press `v` to force it beside (squeezed, with long lines cut), then below, then back to choosing by width.

Every project is re-read every 5 seconds.

### Keys

| Key | Action |
| --- | --- |
| `j` / `↓`, `k` / `↑` | Move the selection; with the panel focused, scroll the panel |
| `Tab` | Move focus between the list and the detail panel |
| `Enter` | Expand a change into one row per branch or worktree, or collapse it |
| `v` | Place the detail panel: by terminal width, beside the list, or below it |
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

## License

[MIT](LICENSE)
