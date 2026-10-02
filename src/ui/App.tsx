import { Box, Text, useApp, useInput } from "ink";
import { useState } from "react";
import type { Artifacts, ChangeSummary, ProjectSnapshot } from "../project/read.ts";

const BAR_WIDTH = 20;
const ARTIFACT_LETTERS: [keyof Artifacts, string][] = [
  ["proposal", "P"],
  ["specs", "S"],
  ["design", "D"],
  ["tasks", "T"],
];

/** The dashboard for one Project snapshot. Renders only; never reads the filesystem or git. */
export function App({ snapshot }: { snapshot: ProjectSnapshot }) {
  const rows = snapshot.kind === "ok" ? snapshot.changes : [];
  const [selected, setSelected] = useState(0);
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === "q") exit();
    if (input === "j" || key.downArrow) setSelected((i) => Math.max(Math.min(i + 1, rows.length - 1), 0));
    if (input === "k" || key.upArrow) setSelected((i) => Math.max(i - 1, 0));
  });

  if (snapshot.kind !== "ok") return <Text color="red">✗ {snapshot.message}</Text>;
  if (rows.length === 0) return <Text>No active changes</Text>;
  const idWidth = Math.max(...rows.map((row) => row.id.length));
  return (
    <Box flexDirection="column">
      {rows.map((row, i) => (
        <Text key={row.id} inverse={i === selected}>
          {row.kind === "change" ? (
            <ChangeLine change={row} idWidth={idWidth} />
          ) : (
            <Text>
              {row.id.padEnd(idWidth)}
              {"  "}
              <Text color="red">✗ {row.message}</Text>
            </Text>
          )}
        </Text>
      ))}
    </Box>
  );
}

function ChangeLine({ change, idWidth }: { change: ChangeSummary; idWidth: number }) {
  const { done, total } = change.tasks;
  // Floor, so the bar is only full when every task is done.
  const filled = total === 0 ? 0 : Math.floor((done / total) * BAR_WIDTH);
  return (
    <Text>
      {change.id.padEnd(idWidth)}
      {"  "}
      {ARTIFACT_LETTERS.map(([artifact, letter], i) => (
        <Text key={letter}>
          {i > 0 ? " " : ""}
          <Text bold={change.artifacts[artifact]} dimColor={!change.artifacts[artifact]}>
            {letter}
          </Text>
        </Text>
      ))}
      {"  "}
      {"█".repeat(filled)}
      {"░".repeat(BAR_WIDTH - filled)}
      {"  "}
      {done}/{total}
    </Text>
  );
}
