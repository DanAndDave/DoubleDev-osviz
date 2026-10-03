import { Box, Text } from "ink";
import type { ChangeVersion } from "../project/read.ts";
import { progressOf, type Task, type TaskProgress, type TaskSection } from "../tasks.ts";

/** One line of the Detail panel, before it is drawn. Every kind but `error` takes exactly one terminal row. */
type PanelLine =
  | { kind: "text"; text: string; bold?: boolean; dim?: boolean }
  | { kind: "error"; message: string }
  | { kind: "section"; heading: string; progress: TaskProgress; collapsed: boolean }
  | { kind: "task"; task: Task };

/**
 * The Detail panel for `version`, in `height` rows. `labelled` says whether the Project has Source
 * labels; `beside` puts the panel's border on its left, for a panel right of the list, rather than on
 * top, for one below it. The border takes no row of `height`.
 */
export function Panel({
  version,
  labelled,
  beside,
  height,
}: {
  version: ChangeVersion;
  labelled: boolean;
  beside: boolean;
  height: number;
}) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      height={beside ? height : height + 1}
      borderStyle="single"
      borderTop={!beside}
      borderLeft={beside}
      borderRight={false}
      borderBottom={false}
      paddingLeft={1}
    >
      {fitPanel(version, labelled, height).map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </Box>
  );
}

/**
 * The panel's lines for `version`, at most `height` (at least 2) of them. When every line does not
 * fit, finished Task sections collapse to their heading line from the top, one at a time, until they
 * do; if they still do not, the lines are cut and end with `… N more`, N counting the tasks cut. An
 * error's message is not fitted: it wraps, and there are no tasks to cut.
 */
function fitPanel(version: ChangeVersion, labelled: boolean, height: number): PanelLine[] {
  const first: PanelLine = { kind: "text", text: labelled ? `${version.id}  ${version.source ?? ""}` : version.id, bold: true };
  if (version.kind === "error") return [first, { kind: "error", message: version.message }];

  const head: PanelLine[] = [first];
  for (const text of [version.blockedBy, version.triage]) if (text !== undefined) head.push({ kind: "text", text });
  if (!version.artifacts.tasks) head.push({ kind: "text", text: "No tasks.md" });
  else if (version.sections.length === 0) head.push({ kind: "text", text: "No tasks" });

  const collapsed = new Set<TaskSection>();
  const build = () => [...head, ...version.sections.flatMap((section) => sectionLines(section, collapsed.has(section)))];
  let lines = build();
  for (const section of version.sections) {
    if (lines.length <= height) return lines;
    if (section.heading === undefined || !section.tasks.every((task) => task.done)) continue;
    collapsed.add(section);
    lines = build();
  }
  if (lines.length <= height) return lines;

  const kept = lines.slice(0, height - 1);
  const cut = lines.slice(height - 1).reduce((n, line) => n + tasksIn(line), 0);
  return [...kept, { kind: "text", text: cut === 0 ? "…" : `… ${cut} more`, dim: true }];
}

/** A Task section's heading line, if it has a heading, and its task lines unless `collapsed`. */
function sectionLines({ heading, tasks }: TaskSection, collapsed: boolean): PanelLine[] {
  const taskLines = collapsed ? [] : tasks.map((task): PanelLine => ({ kind: "task", task }));
  return heading === undefined ? taskLines : [{ kind: "section", heading, progress: progressOf(tasks), collapsed }, ...taskLines];
}

/** How many tasks are hidden when `line` is cut: one per task line, a collapsed section's total for its heading. */
function tasksIn(line: PanelLine): number {
  if (line.kind === "task") return 1;
  if (line.kind === "section" && line.collapsed) return line.progress.total;
  return 0;
}

/** One panel line; `truncate-end` keeps every line but an error's to one row, cut with `…`. */
function Line({ line }: { line: PanelLine }) {
  switch (line.kind) {
    case "text":
      return (
        <Text wrap="truncate-end" bold={line.bold} dimColor={line.dim}>
          {line.text}
        </Text>
      );
    case "error":
      return <Text color="red">{line.message}</Text>;
    case "section": {
      const { done, total } = line.progress;
      return (
        <Text wrap="truncate-end">
          {line.heading}
          {"  "}
          {done === total ? (
            <Text>
              <Text color="green">✓</Text>{" "}
            </Text>
          ) : (
            ""
          )}
          {`${done}/${total}`}
        </Text>
      );
    }
    case "task":
      return (
        <Text wrap="truncate-end">
          {"  "}
          {" ".repeat(line.task.indent)}
          {line.task.done ? <Text color="green">✓</Text> : <Text dimColor>○</Text>}{" "}
          <Text dimColor={line.task.done}>{line.task.text}</Text>
        </Text>
      );
  }
}
