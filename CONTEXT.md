# openspec-visualizer

A terminal dashboard that shows how far the OpenSpec changes in one or more projects have progressed, reading the most current state wherever it lives: the base branch, other local branches, or worktrees.

## Language

### Where state lives

**Project**:
A directory containing an `openspec/` folder, usually inside a git repository; the unit the user passes on the command line.
_Avoid_: repo, workspace

**Base**:
The branch a project treats as its mainline, against which every other Source is judged current or not.
_Avoid_: main, trunk, default branch

**Source**:
One place a project's OpenSpec state can be read from: the Base, or a worktree (its files on disk, committed or not, including the main checkout and detached worktrees) or a local branch no worktree has checked out, when it holds OpenSpec edits the Base lacks.
_Avoid_: branch (when a worktree is meant), checkout, origin

### What is shown

**Change**:
An OpenSpec change, identified by its change id, independent of where it is read from.
_Avoid_: proposal, ticket

**Change version**:
A Change as it exists in one Source.
_Avoid_: copy, variant, snapshot

**Change time**:
When a Change version last changed: the latest commit touching the change's folder in its Source, or the latest file modification time if the folder has uncommitted edits.
_Avoid_: last updated, branch time

**Headline version**:
The Change version shown in a Change's collapsed row: the one with the latest Change time, unless some version is archived, in which case the archived one.
_Avoid_: primary, winner

**Artifact**:
One of a change's planning documents (proposal, specs, design, tasks), each either present or missing in a Change version.
_Avoid_: file, doc

**Task progress**:
The count of checked task checkboxes over all task checkboxes in a Change version's `tasks.md`.
_Avoid_: completion, percent done

**Task section**:
One `##` heading of a Change version's `tasks.md` and the task checkboxes under it, with its own Task progress.
_Avoid_: group, phase

**Ready to archive**:
A Change whose Headline version is not archived and has at least one task checkbox, all ticked. A Change with no task checkboxes is not Ready to archive, as `openspec list` reports it as "No tasks".
_Avoid_: done, complete

**Detail panel**:
What is shown about the selected row's Change version: its Task sections and its blocking and triage lines.
_Avoid_: sidebar, inspector, preview
