# Proposal: Detail panel

Blocked by: walking-skeleton
Triage: needs-triage

## What to build

A panel to the right of the list shows the selected Change version in detail: which tasks are done and which remain, and, in repositories that use them, the change's blocking and triage lines.

## Acceptance criteria

- [ ] The panel shows the selected row's Change version; a collapsed Change row shows its Headline version.
- [ ] Tasks are grouped by the `##` sections of `tasks.md`, each section with its own `done/total`.
- [ ] Each task shows its checkbox state and text.
- [ ] `Blocked by:` and `Triage:` lines from `proposal.md` are shown when present and omitted when absent.
- [ ] A Change version without `tasks.md` shows that it has no tasks instead of an empty panel.
