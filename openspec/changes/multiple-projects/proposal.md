# Proposal: Multiple projects

Blocked by: walking-skeleton
Triage: needs-triage

## What to build

`osviz <path> <path> ...` shows every Project in one scrollable list, so one dashboard covers all the repositories an agent fleet is working in. One failing Project never takes down the others.

## Acceptance criteria

- [ ] Each Project gets a header row with its Change rows underneath, in command-line order.
- [ ] The list scrolls when it is taller than the terminal, keeping the selection visible; selection moves across Project boundaries.
- [ ] A Project that fails (no `openspec/` folder, a git command that fails, an unreadable `tasks.md`) shows an error row under its own header; the other Projects render normally.
- [ ] The dashboard never exits because one Project fails.
