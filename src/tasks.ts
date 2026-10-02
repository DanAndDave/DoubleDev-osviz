export interface TaskProgress {
  done: number;
  total: number;
}

/**
 * Copied verbatim from OpenSpec 1.13.0 (`dist/utils/task-progress.js`) so our counts match
 * `openspec list`. Applied to every line, code fences included. Group 1 is the box contents.
 */
const TASK_LINE = /^\s*[-*]\s*\[([\sxX])\]\s*(.*)/;

export function countTasks(content: string): TaskProgress {
  let done = 0;
  let total = 0;
  for (const line of content.split("\n")) {
    const match = TASK_LINE.exec(line);
    if (!match) continue;
    total++;
    if (match[1] === "x" || match[1] === "X") done++;
  }
  return { done, total };
}
