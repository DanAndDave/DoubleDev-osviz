# Proposal: Detail panel

Blocked by: walking-skeleton
Triage: ready-for-agent

## Why

A row says how far a Change has got (`7/10`) but not what is left: to see which tasks remain, or what a change is waiting on, the user has to open `tasks.md` and `proposal.md` by hand, in the right Source. The dashboard already reads those files; showing them for the selected row makes it answer "what's next" as well as "how far".

## What Changes

- A Detail panel shows the selected row's Change version: the Headline version for a collapsed Change row, the row's own version for an expanded version row. It follows the selection and every refresh.
- Placement: beside the list when the terminal has at least the list's width plus 40 columns, otherwise below the list. The placement, collapsing and cutting follow terminal resizes as they happen.
- Top line: the change id and, when the Project has Source labels, the Source label. The row already shows Artifacts and Task progress, so the panel does not repeat them.
- `Blocked by:` and `Triage:` from `proposal.md` are shown as written, each only when present: the first line starting with exactly that prefix, before the first `##` heading. A missing `proposal.md` simply omits them. Blocker status (whether the named Change is archived) is out of scope.
- Tasks are grouped into Task sections by the `##` headings of `tasks.md`, each with its own `done/total`. The `#` title is ignored; a `###` heading does not start a section; tasks before the first `##` form a section without a heading, shown first; a `##` with no task checkboxes is not shown. Tasks are the same lines that count toward Task progress, so section totals add up to the row's `done/total`.
- Each task is one line: a green `✓` for done (text dimmed) or a dimmed `○` for open, then its text, indented as in the file, cut short with `…` when too long. Lines under a task that are not checkboxes are not shown.
- When the panel is taller than its space, fully done Task sections collapse to their heading line, top first, until it fits; if it still does not fit, the end is cut and replaced by `… N more`, N counting hidden tasks outside collapsed sections. A panel that fits is shown in full. Beside the list the panel has the terminal's full height; below it, the rows the list leaves free, but never less than its top line and `… N more`.
- Empty cases: a Change version without `tasks.md` shows `No tasks.md`; one whose `tasks.md` has no task checkboxes shows `No tasks`. A selected error row shows its Source label and the full error message. A Project that cannot be read, or has no rows, shows no panel.
- `proposal.md` is now read, not just checked for existence: an existing `proposal.md` that cannot be read makes its Change version an error row, as an unreadable `tasks.md` does. The list is as wide as its widest Change row, and at least 40 columns; an error row's message is cut with `…` to that width so it never pushes the panel aside. The panel shows the message in full.

Out of scope: scrolling the panel or the list (`multiple-projects` brings list scrolling); blocker status; showing other Artifacts' contents.

## Capabilities

### New Capabilities
- `detail-panel`: the panel showing the selected row's Change version: where it is placed, what it reads and shows, and how it fits its space.

### Modified Capabilities
- `change-list`: an unreadable `proposal.md` makes an error row, and an error row's message is cut so the row is no wider than the list.

## Impact

- `src/tasks.ts`: parses `tasks.md` into Task sections; Task progress becomes their sum.
- New `src/proposal.ts`: parses the `Blocked by:` and `Triage:` lines.
- `src/project/change.ts`: `ChangeSummary` gains Task sections and the two lines; `changeSummary` takes the `proposal.md` contents instead of a presence flag.
- `src/project/commit.ts`: one `git cat-file --batch` reads `proposal.md` blobs with the `tasks.md` blobs.
- `src/project/worktree.ts`: reads `proposal.md` instead of checking it exists.
- `src/ui/App.tsx`: the panel, its layout from the terminal size, fitting, and error rows cut to width.
- `test/app.test.tsx`: the `show` helper pins the terminal size; list assertions read the list part of the frame.
- No new dependencies.
