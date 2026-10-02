import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
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
const ARTIFACT_LETTERS: [keyof Artifacts, string][] = [
  ["proposal", "P"],
  ["specs", "S"],
  ["design", "D"],
  ["tasks", "T"],
];

/** One visible row: a Change's Headline version with its count of other versions, or one version of an expanded Change. */
interface Row {
  change: Change;
  version: ChangeVersion;
  /** The `+N` count; 0 on expanded version rows and on Changes with one version. */
  others: number;
}

/** The dashboard for one Project snapshot. Renders only; never reads the filesystem or git. */
export function App({ snapshot }: { snapshot: ProjectSnapshot }) {
  const [selected, setSelected] = useState(0);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [showArchived, setShowArchived] = useState(false);
  const rows = rowsOf(snapshot, expanded, showArchived);
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "q") exit();
    if (input === "j" || key.downArrow) setSelected((i) => Math.max(Math.min(i + 1, rows.length - 1), 0));
    if (input === "k" || key.upArrow) setSelected((i) => Math.max(i - 1, 0));
    const row = rows[selected];
    if (key.return && row !== undefined) {
      const { id } = row.change;
      const next = new Set(expanded);
      if (!next.delete(id)) next.add(id);
      setExpanded(next);
      setSelected(rows.findIndex((r) => r.change.id === id));
    }
    if (input === "a") {
      setShowArchived(!showArchived);
      // The snapshot is unchanged, so the selected row's Change and version objects identify it among the new rows.
      const next = rowsOf(snapshot, expanded, !showArchived).findIndex((r) => r.change === row?.change && r.version === row.version);
      setSelected(Math.max(next, 0));
    }
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

/** The visible rows: archived Changes only when shown, one row per Change, or one per version when expanded. */
function rowsOf(snapshot: ProjectSnapshot, expanded: ReadonlySet<string>, showArchived: boolean): Row[] {
  if (snapshot.kind !== "ok") return [];
  return snapshot.changes
    .filter((change) => showArchived || !isArchived(change))
    .flatMap((change): Row[] =>
      expanded.has(change.id)
        ? change.versions.map((version) => ({ change, version, others: 0 }))
        : [{ change, version: change.versions[0]!, others: change.versions.length - 1 }],
    );
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
