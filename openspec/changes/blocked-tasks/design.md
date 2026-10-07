## Context

`parseTasks` in `src/tasks.ts` turns each `TASK_LINE` match into a `Task { done, indent, text }`, with `text` already trailing-trimmed; `ChangeSummary.sections` keeps them, and `tasks` is their `progressOf`. The row's marker column is `markerOf(row)` in `src/ui/App.tsx`, which returns `archived` or `✓ ready to archive`; `changeRowWidth` already adds the marker's length to the list width. The panel draws each task in `Line` (`src/ui/Panel.tsx`) with `✓` or `○`. See proposal.md for why.

## Goals / Non-Goals

**Goals:**
- One place decides "is this task blocked": the parser, so the row and the panel cannot disagree.
- Task progress and `TASK_LINE` stay byte-for-byte the OpenSpec copy.

**Non-Goals:**
- Reading `issues/`, or any new file from either Source reader.
- A blocked count, filtering, or a key to hide blocked Changes.

## Decisions

### Blocked is a field of `Task`
`Task` gains `blocked: boolean`, set in `parseTasks` as `!done && BLOCKED_SUFFIX.test(text)` with `BLOCKED_SUFFIX = / — blocked$/` (U+2014, case-sensitive). `text` is already trailing-trimmed, so trailing whitespace is handled by the existing trim. Alternative: test the text at draw time in both the panel and the row. Rejected: two call sites for one definition.

### `isBlocked(version)` beside the other predicates
`src/project/change.ts` exports `isBlocked(version: ChangeSummary)`: not archived and some task in `sections` is blocked. It takes a version, not a Change, because expanded rows mark each version on its own; the collapsed row passes the Headline version, which is what `markerOf` already receives as `row.version`. No precomputed flag on `ChangeSummary`, for the same reason `isArchived` has none.

### Marker precedence
`markerOf` returns `archived` first, then `✓ ready to archive`, then `blocked`. Ready to archive needs every task done and blocked needs an unticked one, so those two never meet; `archived` wins over `blocked` by the spec. `Marker` gains a yellow branch. Width is already counted through `marker.length`.

### Panel symbol
`Line`'s task case picks `✓` green when done, `⊘` yellow when blocked, else dimmed `○`. Text is dimmed only when done, unchanged. `⊘` (U+2298) is one column wide in `string-width`, which Ink uses for truncation, so the `…` cut stays correct.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `project-reading`: Blocked tasks | `parseTasks` is internal; assert through `<App>`'s panel (`⊘` vs `○`) and the row (`0/1`), on fixture Projects. "Issue files not read" writes `issues/01-api.md` into the fixture. |
| `change-list`: Blocked marker | `<App>` on fixture Projects via `ink-testing-library`: `listLines(lastFrame())` for text, `styledLine` for yellow; `ENTER` to expand; `a` for archived. |
| `detail-panel`: Task lines | `<App>` panel via `panelLines` and `styledLine`, beside the existing "Task lines" tests. |

One seam: `<App>` on a fixture Project, as every existing change-list and detail-panel test. Ticked-task, other-spelling and trailing-space cases are cheapest asserted in the panel, where each task line shows its own symbol.

## Risks / Trade-offs

- [`tasks.md` and `issues/` drift apart in the user's projects] → osviz shows `tasks.md`'s view. Chosen by the user; the proposal records it.
- [A task genuinely about the word "blocked" that ends with ` — blocked`] → shown blocked. The em dash form is specific enough to accept.
- [Hyphen or en dash typed instead of an em dash] → not blocked, by the spec's "other spellings" scenario; widening later is additive.
