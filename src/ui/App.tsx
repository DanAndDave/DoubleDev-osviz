import { Box, Text, useApp, useInput } from "ink";
import { useEffect, useReducer, useRef } from "react";
import {
  type Artifacts,
  type Change,
  type ChangeSummary,
  type ChangeVersion,
  isArchived,
  isReadyToArchive,
  type ProjectSnapshot,
} from "../project/read.ts";

const BAR_WIDTH = 20;
const REFRESH_MS = 5000;
const ARTIFACT_LETTERS: [keyof Artifacts, string][] = [
  ["proposal", "P"],
  ["specs", "S"],
  ["design", "D"],
  ["tasks", "T"],
];

/** One visible row: a Change's Headline version with its count of other versions, or one version of an expanded Change. */
interface Row {
  key: RowKey;
  change: Change;
  version: ChangeVersion;
  /** The `+N` count; 0 on expanded version rows and on Changes with one version. */
  others: number;
}

/**
 * Which row this is, independent of the snapshot it was read from: a Change's row (`version`
 * undefined) or, when the Change is expanded, one version's row by Source label and change directory.
 */
interface RowKey {
  id: string;
  version: Pick<ChangeVersion, "source" | "dir"> | undefined;
}

/** What the dashboard shows and the user's place in it. `selected` indexes `rowsOf(state)`. */
interface State {
  snapshot: ProjectSnapshot;
  expanded: ReadonlySet<string>;
  showArchived: boolean;
  selected: number;
}

/** What can happen to the dashboard: a key press, or a read of the Project finishing. */
type Action =
  | { type: "move"; by: 1 | -1 }
  | { type: "toggleExpanded" }
  | { type: "toggleArchived" }
  | { type: "refreshed"; snapshot: ProjectSnapshot };

/**
 * The dashboard for one Project. Renders only: it never reads the filesystem or git itself, but calls
 * `read` to get a new snapshot of the Project. `initial` is the snapshot shown first.
 */
export function App({ initial, read }: { initial: ProjectSnapshot; read: () => Promise<ProjectSnapshot> }) {
  const [state, dispatch] = useReducer(reduce, { snapshot: initial, expanded: new Set<string>(), showArchived: false, selected: 0 });
  const { snapshot, selected } = state;
  const rows = rowsOf(state);
  const { exit } = useApp();
  // Set while a read is in progress; a tick or `r` that comes due meanwhile is skipped, not queued.
  const reading = useRef(false);
  const refresh = () => {
    if (reading.current) return;
    reading.current = true;
    void read()
      .then((snapshot) => dispatch({ type: "refreshed", snapshot }))
      .finally(() => (reading.current = false));
  };
  // `read` must not change for the dashboard's life: the interval keeps calling the first render's `refresh`.
  useEffect(() => {
    const interval = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(interval);
  }, []);
  useInput((input, key) => {
    if (input === "q") exit();
    if (input === "j" || key.downArrow) dispatch({ type: "move", by: 1 });
    if (input === "k" || key.upArrow) dispatch({ type: "move", by: -1 });
    if (key.return) dispatch({ type: "toggleExpanded" });
    if (input === "a") dispatch({ type: "toggleArchived" });
    if (input === "r") refresh();
  });

  if (snapshot.kind !== "ok") return <Text color="red">✗ {snapshot.message}</Text>;
  if (rows.length === 0) return <Text>No active changes</Text>;
  const summaries = rows.flatMap((row) => (row.version.kind === "change" ? [row.version] : []));
  const widths = {
    id: Math.max(...rows.map((row) => row.change.id.length)),
    progress: Math.max(0, ...summaries.map((v) => progressText(v).length)),
    label: snapshot.labelled ? Math.max(...rows.map((row) => row.version.source?.length ?? 0)) : undefined,
  };
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Text key={i} inverse={i === selected}>
          {row.version.kind === "change" ? (
            <ChangeLine version={row.version} others={row.others} widths={widths} />
          ) : (
            <Text>
              {row.version.id.padEnd(widths.id)}
              {widths.label === undefined ? "" : `  ${row.version.source ?? ""}`}
              {"  "}
              <Text color="red">✗ {row.version.message}</Text>
            </Text>
          )}
          <Marker row={row} />
        </Text>
      ))}
    </Box>
  );
}

/**
 * Applies `action` and picks the selected row in the same step, by the selected row's key, so the
 * rows and the selection they imply never render separately.
 */
function reduce(state: State, action: Action): State {
  const rows = rowsOf(state);
  const row = rows[state.selected];
  switch (action.type) {
    case "move":
      return { ...state, selected: clamp(state.selected + action.by, rows.length) };
    case "toggleExpanded": {
      if (row === undefined) return state;
      const expanded = new Set(state.expanded);
      if (!expanded.delete(row.key.id)) expanded.add(row.key.id);
      const next = { ...state, expanded };
      return { ...next, selected: rowsOf(next).findIndex((r) => r.key.id === row.key.id) };
    }
    case "toggleArchived": {
      const next = { ...state, showArchived: !state.showArchived };
      return { ...next, selected: Math.max(rowsOf(next).findIndex((r) => sameKey(r.key, row?.key)), 0) };
    }
    case "refreshed": {
      const next = { ...state, snapshot: action.snapshot };
      const nextRows = rowsOf(next);
      const same = nextRows.findIndex((r) => sameKey(r.key, row?.key));
      if (same >= 0) return { ...next, selected: same };
      // A gone version falls back to its Change's first row; a gone Change to the row now at its position.
      const changeFirst = nextRows.findIndex((r) => r.key.id === row?.key.id);
      return { ...next, selected: changeFirst >= 0 ? changeFirst : clamp(state.selected, nextRows.length) };
    }
  }
}

/** Whether `a` and `b` name the same row. */
function sameKey(a: RowKey, b: RowKey | undefined): boolean {
  return a.id === b?.id && a.version?.source === b.version?.source && a.version?.dir === b.version?.dir;
}

/** `i` limited to the indexes of `length` rows; 0 when there are none. */
function clamp(i: number, length: number): number {
  return Math.max(Math.min(i, length - 1), 0);
}

/** The visible rows: archived Changes only when shown, one row per Change, or one per version when expanded. */
function rowsOf({ snapshot, expanded, showArchived }: Omit<State, "selected">): Row[] {
  if (snapshot.kind !== "ok") return [];
  return snapshot.changes
    .filter((change) => showArchived || !isArchived(change))
    .flatMap((change): Row[] => {
      const { id } = change;
      if (!expanded.has(id)) {
        return [{ key: { id, version: undefined }, change, version: change.versions[0]!, others: change.versions.length - 1 }];
      }
      return change.versions.map((version) => ({ key: { id, version: { source: version.source, dir: version.dir } }, change, version, others: 0 }));
    });
}

/** `archived` on any archived version's row; `✓ ready to archive` on a Ready to archive Change's Headline row. */
function Marker({ row }: { row: Row }) {
  if (row.version.archived) return <Text>{"  "}<Text dimColor>archived</Text></Text>;
  if (row.version !== row.change.versions[0] || !isReadyToArchive(row.change)) return null;
  return <Text>{"  "}<Text color="green">✓ ready to archive</Text></Text>;
}

/** `widths.label` is undefined when the Project has no Source labels, which drops the label and `+N` columns. */
function ChangeLine({
  version,
  others,
  widths,
}: {
  version: ChangeSummary;
  others: number;
  widths: { id: number; progress: number; label: number | undefined };
}) {
  const { done, total } = version.tasks;
  // Floor, so the bar is only full when every task is done.
  const filled = total === 0 ? 0 : Math.floor((done / total) * BAR_WIDTH);
  const columns =
    widths.label === undefined
      ? progressText(version)
      : [progressText(version).padEnd(widths.progress), (version.source ?? "").padEnd(widths.label), others > 0 ? `+${others}` : ""]
          .join("  ")
          .trimEnd();
  return (
    <Text>
      {version.id.padEnd(widths.id)}
      {"  "}
      {ARTIFACT_LETTERS.map(([artifact, letter], i) => (
        <Text key={letter}>
          {i > 0 ? " " : ""}
          <Text bold={version.artifacts[artifact]} dimColor={!version.artifacts[artifact]}>
            {letter}
          </Text>
        </Text>
      ))}
      {"  "}
      {"█".repeat(filled)}
      {"░".repeat(BAR_WIDTH - filled)}
      {"  "}
      {columns}
    </Text>
  );
}

function progressText(version: ChangeSummary): string {
  return `${version.tasks.done}/${version.tasks.total}`;
}
