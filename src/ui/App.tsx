import { Box, Text, useApp, useInput, useWindowSize } from "ink";
import { useEffect, useReducer, useRef } from "react";
import {
  type Artifacts,
  type Change,
  type ChangeSummary,
  type ChangeVersion,
  isArchived,
  isBlocked,
  isReadyToArchive,
  type ProjectSnapshot,
} from "../project/read.ts";
import { Panel, type PanelSubject } from "./Panel.tsx";

const BAR_WIDTH = 20;
/** The list's narrowest width, and the panel's narrowest beside it, border included. */
const LIST_MIN_WIDTH = 40;
const PANEL_MIN_WIDTH = 40;
const REFRESH_MS = 5000;
const ARTIFACT_LETTERS: [keyof Artifacts, string][] = [
  ["proposal", "P"],
  ["specs", "S"],
  ["design", "D"],
  ["tasks", "T"],
];

/**
 * One visible row of one Project: its header (only with several Projects), its error row when it
 * cannot be read, its `No active changes` row, or a Change row.
 */
type Row = { kind: "header"; project: number } | { kind: "projectError"; project: number; key: RowKey; message: string } | { kind: "empty"; project: number } | ChangeRow;

/** A Change's Headline version with its count of other versions, or one version of an expanded Change. */
interface ChangeRow {
  kind: "change";
  project: number;
  key: RowKey;
  change: Change;
  version: ChangeVersion;
  /** The `+N` count; 0 on expanded version rows and on Changes with one version. */
  others: number;
}

/** The rows the user can select: Change rows and Project error rows. */
type SelectableRow = Extract<Row, { key: RowKey }>;

function isSelectable(row: Row | undefined): row is SelectableRow {
  return row?.kind === "change" || row?.kind === "projectError";
}

/**
 * Which row this is, independent of the snapshot it was read from: in Project `project`, its error row
 * (`id` undefined), a Change's row (`version` undefined) or, when the Change is expanded, one version's
 * row by Source label and change directory.
 */
interface RowKey {
  project: number;
  id: string | undefined;
  version: Pick<ChangeVersion, "source" | "dir"> | undefined;
}

/**
 * What the dashboard shows and the user's place in it: each Project's last snapshot and expanded change
 * ids, by Project index. `selected` indexes a selectable row of `rowsOf(state)`, and is undefined when
 * there is none.
 */
interface State {
  snapshots: readonly ProjectSnapshot[];
  expanded: readonly ReadonlySet<string>[];
  showArchived: boolean;
  selected: number | undefined;
}

/** What can happen to the dashboard: a key press, or a read of a Project finishing. */
type Action =
  | { type: "move"; by: 1 | -1 }
  | { type: "toggleExpanded" }
  | { type: "toggleArchived" }
  | { type: "refreshed"; project: number; snapshot: ProjectSnapshot };

/** A Project the dashboard shows: its path as typed, its first snapshot, and how to read it again. */
export interface ProjectInput {
  label: string;
  initial: ProjectSnapshot;
  read: () => Promise<ProjectSnapshot>;
}

/**
 * The dashboard for `projects`, in command-line order. Renders only: it never reads the filesystem or
 * git itself, but calls each Project's `read` to get a new snapshot of it. `projects` must not change
 * for the dashboard's life.
 */
export function App({ projects }: { projects: readonly ProjectInput[] }) {
  const [state, dispatch] = useReducer(reduce, projects, (projects) => {
    const initial = { snapshots: projects.map((p) => p.initial), expanded: projects.map(() => new Set<string>()), showArchived: false };
    return { ...initial, selected: firstSelectable(rowsOf(initial)) };
  });
  const { snapshots, selected } = state;
  const rows = rowsOf(state);
  const { exit } = useApp();
  const { columns: terminalColumns, rows: terminalRows } = useWindowSize();
  // The list window's first row in the last render; each render moves it only as far as the selection needs.
  const previousTop = useRef(0);
  // Which Projects have a read in progress; a tick or `r` that comes due meanwhile skips them, not queues.
  const reading = useRef(projects.map(() => false));
  const refresh = () => {
    projects.forEach(({ read }, project) => {
      if (reading.current[project]) return;
      reading.current[project] = true;
      void read()
        .then((snapshot) => dispatch({ type: "refreshed", project, snapshot }))
        .finally(() => (reading.current[project] = false));
    });
  };
  // The interval keeps calling the first render's `refresh`, which is why `projects` must not change.
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

  const changeRows = rows.filter((row) => row.kind === "change");
  const summaries = changeRows.flatMap((row) => (row.version.kind === "change" ? [row.version] : []));
  const labelled = changeRows.some((row) => isLabelled(snapshots[row.project]!));
  const widths: Widths = {
    id: Math.max(0, ...changeRows.map((row) => row.change.id.length)),
    progress: Math.max(0, ...summaries.map((v) => progressText(v).length)),
    label: labelled ? Math.max(0, ...changeRows.map((row) => row.version.source?.length ?? 0)) : undefined,
  };
  const listWidth = Math.max(
    LIST_MIN_WIDTH,
    ...changeRows.flatMap((row) => (row.version.kind === "change" ? [changeRowWidth(row.version, row.others, markerOf(row), widths)] : [])),
  );
  const beside = terminalColumns >= listWidth + PANEL_MIN_WIDTH;
  const selectedRow = selected === undefined ? undefined : rows[selected];
  const panelBelow = !beside && isSelectable(selectedRow);
  // Below the list, the panel keeps a separator row and room for its first line and a cut line.
  const listHeight = Math.max(panelBelow ? terminalRows - 3 : terminalRows, 1);
  const top = windowTop(previousTop.current, rows, selected, listHeight);
  previousTop.current = top;
  const shown = rows.slice(top, top + listHeight);
  // Below the list, the panel gets the rows the list and its border leave, but always room for its first line and a cut line.
  const panelHeight = Math.max(beside ? terminalRows : terminalRows - shown.length - 1, 2);
  return (
    <Box width={terminalColumns} flexDirection={beside ? "row" : "column"}>
      <Box flexDirection="column" flexShrink={0} width={listWidth}>
        {shown.map((row, i) => (
          <RowLine key={top + i} row={row} label={projects[row.project]!.label} widths={widths} selected={top + i === selected} />
        ))}
      </Box>
      {isSelectable(selectedRow) && <Panel subject={panelSubject(selectedRow, projects[selectedRow.project]!.label, snapshots)} beside={beside} height={panelHeight} />}
    </Box>
  );
}

/**
 * The first shown row of a window of `height` rows over `rows`: `previousTop`, kept while the `selected`
 * row is shown. Otherwise moved just far enough to show the selected row together with the rows that
 * cannot be selected directly above and below it, such as its Project's header; when those do not all
 * fit, the selected row and as many rows above it as fit. Never leaves rows empty below the last row
 * while earlier rows are hidden.
 */
function windowTop(previousTop: number, rows: readonly Row[], selected: number | undefined, height: number): number {
  if (rows.length <= height) return 0;
  const top = Math.min(Math.max(previousTop, 0), rows.length - height);
  if (selected === undefined || (selected >= top && selected < top + height)) return top;
  let a = selected;
  while (a > 0 && !isSelectable(rows[a - 1])) a--;
  let b = selected;
  while (b < rows.length - 1 && !isSelectable(rows[b + 1])) b++;
  if (b - a + 1 > height) return Math.max(a, selected - height + 1);
  return a < top ? a : b - height + 1;
}

/** What the panel shows for the selected `row`: its Change version, or its Project's error under `label`. */
function panelSubject(row: SelectableRow, label: string, snapshots: readonly ProjectSnapshot[]): PanelSubject {
  if (row.kind === "projectError") return { kind: "project", label, message: row.message };
  return { kind: "version", version: row.version, labelled: isLabelled(snapshots[row.project]!) };
}

/** Whether the Project read in `snapshot` has Source labels. */
function isLabelled(snapshot: ProjectSnapshot): boolean {
  return snapshot.kind === "ok" && snapshot.labelled;
}

/** One list row, on one line. `label` is the row's Project's, shown by its header. */
function RowLine({ row, label, widths, selected }: { row: Row; label: string; widths: Widths; selected: boolean }) {
  switch (row.kind) {
    case "header":
      return (
        <Text bold wrap="truncate-end">
          {label}
        </Text>
      );
    case "empty":
      return <Text>No active changes</Text>;
    case "projectError":
      return (
        <Text inverse={selected} color="red" wrap="truncate-end">
          ✗ {row.message}
        </Text>
      );
    case "change":
      return (
        <Text inverse={selected} wrap="truncate-end">
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
      );
  }
}

/**
 * Applies `action` and picks the selected row in the same step, by the selected row's key, so the
 * rows and the selection they imply never render separately.
 */
function reduce(state: State, action: Action): State {
  const rows = rowsOf(state);
  const row = state.selected === undefined ? undefined : rows[state.selected];
  const key = isSelectable(row) ? row.key : undefined;
  switch (action.type) {
    case "move":
      if (state.selected === undefined) return state;
      return { ...state, selected: step(rows, state.selected, action.by) ?? state.selected };
    case "toggleExpanded": {
      if (row?.kind !== "change") return state;
      const { project, id } = row.key;
      const ids = new Set(state.expanded[project]);
      if (!ids.delete(row.change.id)) ids.add(row.change.id);
      const next = { ...state, expanded: state.expanded.with(project, ids) };
      return { ...next, selected: rowsOf(next).findIndex((r) => r.kind === "change" && r.key.project === project && r.key.id === id) };
    }
    case "toggleArchived": {
      const next = { ...state, showArchived: !state.showArchived };
      const nextRows = rowsOf(next);
      return { ...next, selected: indexOf(nextRows, key) ?? firstSelectable(nextRows) };
    }
    case "refreshed": {
      const next = { ...state, snapshots: state.snapshots.with(action.project, action.snapshot) };
      const nextRows = rowsOf(next);
      return { ...next, selected: indexOf(nextRows, key) ?? fallback(rows, nextRows, key, action.project) };
    }
  }
}

/**
 * The row to select after a refresh of Project `project` changed `rows` into `nextRows` and the selected
 * row, named by `key`, is gone. A Project error row that has become readable gives way to the Project's
 * first selectable row; a gone version to its Change's first row; otherwise the old position among the
 * Project's selectable rows, clamped to its new ones. A Project left with no selectable row gives way to
 * the nearest selectable row from its header down, then up. With nothing selected, the first selectable row.
 */
function fallback(rows: readonly Row[], nextRows: readonly Row[], key: RowKey | undefined, project: number): number | undefined {
  if (key === undefined) return firstSelectable(nextRows);
  const changeFirst = nextRows.findIndex((r) => r.kind === "change" && r.key.project === key.project && r.key.id === key.id);
  if (key.id !== undefined && changeFirst >= 0) return changeFirst;
  const ofProject = (all: readonly Row[]) => all.flatMap((r, i) => (isSelectable(r) && r.project === project ? [i] : []));
  const before = ofProject(rows);
  const after = ofProject(nextRows);
  if (after.length > 0) return after[Math.min(Math.max(before.indexOf(indexOf(rows, key) ?? -1), 0), after.length - 1)];
  const header = nextRows.findIndex((r) => r.project === project);
  return step(nextRows, header - 1, 1) ?? step(nextRows, header, -1);
}

/** The index of the first selectable row of `rows`; undefined when there is none. */
function firstSelectable(rows: readonly Row[]): number | undefined {
  return step(rows, -1, 1);
}

/** The index of the nearest selectable row after `from` in direction `by`; undefined when there is none. */
function step(rows: readonly Row[], from: number, by: 1 | -1): number | undefined {
  for (let i = from + by; i >= 0 && i < rows.length; i += by) if (isSelectable(rows[i])) return i;
  return undefined;
}

/** The index of the row named by `key` in `rows`; undefined when it is not there. */
function indexOf(rows: readonly Row[], key: RowKey | undefined): number | undefined {
  const i = rows.findIndex((r) => isSelectable(r) && sameKey(r.key, key));
  return i < 0 ? undefined : i;
}

/** Whether `a` and `b` name the same row. */
function sameKey(a: RowKey, b: RowKey | undefined): boolean {
  return a.project === b?.project && a.id === b.id && a.version?.source === b.version?.source && a.version?.dir === b.version?.dir;
}

/**
 * The visible rows of every Project in order: a header per Project when there are several, then its
 * error row, its `No active changes` row, or its Change rows. Archived Changes only when shown; one row
 * per Change, or one per version when expanded.
 */
function rowsOf({ snapshots, expanded, showArchived }: Omit<State, "selected">): Row[] {
  return snapshots.flatMap((snapshot, project): Row[] => {
    const header: Row[] = snapshots.length > 1 ? [{ kind: "header", project }] : [];
    if (snapshot.kind !== "ok") {
      return [...header, { kind: "projectError", project, key: { project, id: undefined, version: undefined }, message: snapshot.message }];
    }
    const changes = snapshot.changes
      .filter((change) => showArchived || !isArchived(change))
      .flatMap((change): ChangeRow[] => {
        const { id } = change;
        if (!expanded[project]!.has(id)) {
          return [{ kind: "change", project, key: { project, id, version: undefined }, change, version: change.versions[0]!, others: change.versions.length - 1 }];
        }
        return change.versions.map((version) => ({
          kind: "change",
          project,
          key: { project, id, version: { source: version.source, dir: version.dir } },
          change,
          version,
          others: 0,
        }));
      });
    return [...header, ...(changes.length > 0 ? changes : [{ kind: "empty", project } as const])];
  });
}

/**
 * The marker ending a row, if any: `archived` on any archived version's row, `✓ ready to archive` on a
 * Ready to archive Change's Headline row, `blocked` on any row whose version has a Blocked task.
 */
function markerOf(row: ChangeRow): "archived" | "✓ ready to archive" | "blocked" | undefined {
  if (row.version.archived) return "archived";
  if (row.version === row.change.versions[0] && isReadyToArchive(row.change)) return "✓ ready to archive";
  if (isBlocked(row.version)) return "blocked";
  return undefined;
}

const MARKER_COLOR = { "✓ ready to archive": "green", blocked: "yellow" } as const;

function Marker({ row }: { row: ChangeRow }) {
  const marker = markerOf(row);
  if (marker === undefined) return null;
  return <Text>{"  "}{marker === "archived" ? <Text dimColor>{marker}</Text> : <Text color={MARKER_COLOR[marker]}>{marker}</Text>}</Text>;
}

interface Widths {
  id: number;
  progress: number;
  label: number | undefined;
}

/** The columns after the bar: progress, then Source label and `+N` when any Project has Source labels. */
function columnsText(version: ChangeSummary, others: number, widths: Widths): string {
  if (widths.label === undefined) return progressText(version);
  return [progressText(version).padEnd(widths.progress), (version.source ?? "").padEnd(widths.label), others > 0 ? `+${others}` : ""]
    .join("  ")
    .trimEnd();
}

/**
 * The width of a Change row in terminal columns. String length is display width here: ids and labels
 * are ASCII, and `█░✓` are single-width.
 */
function changeRowWidth(version: ChangeSummary, others: number, marker: string | undefined, widths: Widths): number {
  const artifacts = ARTIFACT_LETTERS.length * 2 - 1;
  return widths.id + 2 + artifacts + 2 + BAR_WIDTH + 2 + columnsText(version, others, widths).length + (marker === undefined ? 0 : 2 + marker.length);
}

/** `widths.label` is undefined when no Project has Source labels, which drops the label and `+N` columns. */
function ChangeLine({ version, others, widths }: { version: ChangeSummary; others: number; widths: Widths }) {
  const { done, total } = version.tasks;
  // Floor, so the bar is only full when every task is done.
  const filled = total === 0 ? 0 : Math.floor((done / total) * BAR_WIDTH);
  const columns = columnsText(version, others, widths);
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
