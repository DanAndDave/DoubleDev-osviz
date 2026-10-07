## Context

`parseTasks` in `src/tasks.ts` sets `Task.blocked` as `!done && BLOCKED_SUFFIX.test(text)`, with `BLOCKED_SUFFIX = / — blocked$/` and `text` already trailing-trimmed. Every consumer (`isBlocked` in `src/project/change.ts`, `markerOf` in `src/ui/App.tsx`, `TaskSymbol` in `src/ui/Panel.tsx`) reads that one field, so the definition lives in one regex. See proposal.md for why it has to change.

## Goals / Non-Goals

**Goals:**
- The parser stays the single place that decides "is this task blocked".

**Non-Goals:**
- Parsing other `/triage` status tokens or the note after the token.
- Keeping the plain ` — blocked` suffix as a second accepted form.

## Decisions

### Match the status token, not a suffix
`BLOCKED_SUFFIX` is replaced by ``BLOCKED_STATUS = / — `blocked`(?: |$)/`` (U+2014, case-sensitive), used unanchored on the trailing-trimmed `text`. The `(?: |$)` tail accepts the token at the end or followed by a note (` — …`), and rejects `` `blocked`. `` or a longer token. The backticks are what tell the status apart from prose: `` — `ready-for-agent` — blocked by 04 `` holds no backticked `blocked`, so it stays unblocked without a dependency-note special case.

Alternatives:
- Anchor on the issue link (`](…) — `status``). Rejected: ties the rule to `/triage`'s link shape, and a task with the token but no link would fall through.
- Accept both the backticked token and the plain suffix. Rejected: no project writes the plain form, and two definitions is what the archived change avoided.
- Parse the first backticked token after the link as "the status". Rejected: needs a full status grammar this change does not use.

## Testing seams

| Requirement | Seam |
| --- | --- |
| `project-reading`: Blocked tasks | `<App>` panel on fixture Projects (`⊘` vs `○`, `progress` for counts), in the existing "Blocked tasks" describe. "Issue files not read" keeps its `issues/01-api.md` fixture. |
| `change-list`: Blocked marker | `<App>` rows via `listLines` and `styledLine`; only `BLOCKED_TASKS` changes to write the token. |
| `detail-panel`: Task lines | `<App>` panel via `panelLines` and `styledLine`, the existing "Blocked task" test with a note after the token. |

One seam: `<App>` on a fixture Project, as in the archived change.

## Risks / Trade-offs

- [A task whose prose quotes `` — `blocked` `` mid-sentence] → shown blocked. The em dash plus backticked token is specific to `/triage` output; accepted.
- [`/triage` changes its status format again] → the regex and the project-reading scenarios change together; the fixtures mirror the real lines, so drift shows up as one failing describe.
