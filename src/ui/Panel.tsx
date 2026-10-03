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
 * What the panel shows: a Change version, with `labelled` saying whether its Project has Source labels,
 * or a Project that cannot be read, by its path as given and its error.
 */
export type PanelSubject = { kind: "version"; version: ChangeVersion; labelled: boolean } | { kind: "project"; label: string; message: string };

/**
 * The Detail panel for `subject`, in `height` rows. `beside` puts the panel's border on its left, for a
 * panel right of the list, rather than on top, for one below it. The border takes no row of `height`.
 */
export function Panel({ subject, beside, height }: { subject: PanelSubject; beside: boolean; height: number }) {
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
      {fitPanel(subject, height).map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </Box>
  );
}

/**
 * The panel's lines for `subject`, at most `height` (at least 2) of them. When every line does not
 * fit, finished Task sections collapse to their heading line from the top, one at a time, until they
 * do; if they still do not, the lines are cut and end with `… N more`, N counting the tasks cut. An
 * error's message, a Change version's or a Project's, is not fitted: it wraps, and there are no tasks
 * to cut.
 */
function fitPanel(subject: PanelSubject, height: number): PanelLine[] {
  if (subject.kind === "project") return errorLines(subject.label, subject.message);
  const { version, labelled } = subject;
  const title = labelled ? `${version.id}  ${version.source ?? ""}` : version.id;
  if (version.kind === "error") return errorLines(title, version.message);
  const first: PanelLine = { kind: "text", text: title, bold: true };

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

/** An error's panel: `title` in bold, then the full message, which wraps. */
function errorLines(title: string, message: string): PanelLine[] {
  return [
    { kind: "text", text: title, bold: true },
    { kind: "error", message },
  ];
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
