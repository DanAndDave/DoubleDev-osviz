export interface TaskProgress {
  done: number;
  total: number;
}

/**
 * One task checkbox: whether it is ticked, whether it is a Blocked task, its leading whitespace
 * length, and its text after the box.
 */
export interface Task {
  done: boolean;
  blocked: boolean;
  indent: number;
  text: string;
}

/** The tasks under one `##` heading, or before the first one (`heading` undefined). */
export interface TaskSection {
  heading: string | undefined;
  tasks: Task[];
}

/**
 * Copied verbatim from OpenSpec 1.13.0 (`dist/utils/task-progress.js`) so our counts match
 * `openspec list`. Applied to every line, code fences included. Group 1 is the box contents.
 */
const TASK_LINE = /^\s*[-*]\s*\[([\sxX])\]\s*(.*)/;

/** A `##` heading; `###` and deeper do not match, so their tasks stay in the `##` section above. */
const SECTION_HEADING = /^##\s+(.*)/;

/**
 * The status token that makes an unticked task a Blocked task, as `/triage` writes it after the issue
 * link: space, em dash (U+2014), space, `blocked` between backticks, then a space (a note follows) or
 * the end of the text.
 */
const BLOCKED_STATUS = / — `blocked`(?: |$)/;

/**
 * The Task sections of `content`, in file order: tasks before the first `##` heading form a section
 * without a heading, and every task line counted by `TASK_LINE` lands in exactly one section. Sections
 * without tasks are left out.
 */
export function parseTasks(content: string): TaskSection[] {
  const sections: TaskSection[] = [{ heading: undefined, tasks: [] }];
  for (const line of content.split("\n")) {
    const task = TASK_LINE.exec(line);
    if (task) {
      const done = task[1] === "x" || task[1] === "X";
      const text = task[2]!.trimEnd();
      sections.at(-1)!.tasks.push({ done, blocked: !done && BLOCKED_STATUS.test(text), indent: line.search(/\S/), text });
      continue;
    }
    const heading = SECTION_HEADING.exec(line);
    if (heading) sections.push({ heading: heading[1]!.trim(), tasks: [] });
  }
  return sections.filter((section) => section.tasks.length > 0);
}

/** Task progress of a list of tasks. */
export function progressOf(tasks: Task[]): TaskProgress {
  return { done: tasks.filter((task) => task.done).length, total: tasks.length };
}
