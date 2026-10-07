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
 * The Detail panel for `subject`, in `height` rows, scrolled down `scroll` lines (clamped to
 * `scrollLimit`). `beside` puts the panel's border on its left, for a panel right of the list, rather
 * than on top, for one below it. The border takes no row of `height`, and is cyan while the panel is
 * `focused`.
 */
export function Panel({ subject, beside, height, scroll, focused }: { subject: PanelSubject; beside: boolean; height: number; scroll: number; focused: boolean }) {
  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      height={beside ? height : height + 1}
      borderStyle="single"
      borderColor={focused ? "cyan" : undefined}
      borderTop={!beside}
      borderLeft={beside}
      borderRight={false}
      borderBottom={false}
      paddingLeft={1}
    >
      {windowOf(collapse(subject, height), height, scroll).map((line, i) => (
        <Line key={i} line={line} />
      ))}
    </Box>
  );
}

/**
 * How far the panel for `subject` in `height` rows can scroll: the lines left after collapsing beyond
 * `height`. 0 when they fit, for an error panel, and with fewer than three rows below the first line,
 * which leaves no room between `… N above` and `… N more`.
 */
export function scrollLimit(subject: PanelSubject, height: number): number {
  return limitOf(collapse(subject, height), height);
}

/** `scrollLimit` of the collapsed `lines`. */
function limitOf(lines: readonly PanelLine[], height: number): number {
  if (height - 1 < 3 || lines.some((line) => line.kind === "error")) return 0;
  return Math.max(lines.length - height, 0);
}

/**
 * The collapsed `lines` that show in `height` (at least 2) rows, scrolled down `scroll` lines. The
 * first line always shows; scrolled down, the line after it reads `… N above`, N counting the tasks of
 * the lines it hides. While lines remain below, the last line reads `… N more`, N counting the tasks
 * cut. An error's message is not fitted: it wraps, and there are no tasks to cut.
 */
function windowOf(lines: readonly PanelLine[], height: number, scroll: number): readonly PanelLine[] {
  const [first, ...body] = lines;
  const rows = height - 1;
  if (body.length <= rows) return lines;
  const s = Math.min(Math.max(scroll, 0), limitOf(lines, height));
  const above: PanelLine[] = s === 0 ? [] : [elided(body.slice(0, s + 1), "above")];
  const rest = body.slice(s === 0 ? 0 : s + 1);
  const room = rows - above.length;
  if (rest.length <= room) return [first!, ...above, ...rest];
  return [first!, ...above, ...rest.slice(0, room - 1), elided(rest.slice(room - 1), "more")];
}

/** The dim line standing in for the `hidden` lines: `… N <where>`, or `…` alone when they hold no task. */
function elided(hidden: readonly PanelLine[], where: "above" | "more"): PanelLine {
  const n = hidden.reduce((sum, line) => sum + tasksIn(line), 0);
  return { kind: "text", text: n === 0 ? "…" : `… ${n} ${where}`, dim: true };
}

/**
 * The panel's lines for `subject`, uncut. When they do not all fit `height`, finished Task sections
 * collapse to their heading line from the top, one at a time, until they do or none is left.
 */
function collapse(subject: PanelSubject, height: number): PanelLine[] {
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
  return lines;
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
          <TaskSymbol task={line.task} />{" "}
          <Text dimColor={line.task.done}>{line.task.text}</Text>
        </Text>
      );
  }
}

/** Green `✓` when done, yellow `⊘` when blocked, else dimmed `○`. */
function TaskSymbol({ task }: { task: Task }) {
  if (task.done) return <Text color="green">✓</Text>;
  if (task.blocked) return <Text color="yellow">⊘</Text>;
  return <Text dimColor>○</Text>;
}
