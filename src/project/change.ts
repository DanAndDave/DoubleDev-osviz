import { countTasks, type TaskProgress } from "../tasks.ts";

export interface Artifacts {
  proposal: boolean;
  specs: boolean;
  design: boolean;
  tasks: boolean;
}

/**
 * Where a Change version lives in its Source: `dir` is relative to `openspec/changes/`, either `<id>`
 * for an active Change version or `archive/<YYYY-MM-DD>-<id>` for an archived one.
 */
export interface ChangeDir {
  dir: string;
  id: string;
  archived: boolean;
}

/**
 * One Change version as read from one Source. `source` is the Source label; `undefined` only for a
 * Project outside git, which has a single unlabelled Source.
 */
export interface ChangeSummary extends ChangeDir {
  kind: "change";
  source: string | undefined;
  artifacts: Artifacts;
  tasks: TaskProgress;
  changeTime: Date;
}

/** A Change version that exists but could not be read. */
interface ChangeError extends ChangeDir {
  kind: "error";
  source: string | undefined;
  message: string;
}

export type ChangeVersion = ChangeSummary | ChangeError;

/** A Change across Sources: its versions, Headline version first. */
export interface Change {
  id: string;
  versions: ChangeVersion[];
}

/** An archived Change: its Headline version is readable and archived. */
export function isArchived(change: Change): boolean {
  const headline = change.versions[0];
  return headline?.kind === "change" && headline.archived;
}

/** Ready to archive: the Headline version is readable, not archived, and has at least one task, all done. */
export function isReadyToArchive(change: Change): boolean {
  const headline = change.versions[0];
  return headline?.kind === "change" && !headline.archived && headline.tasks.total > 0 && headline.tasks.done === headline.tasks.total;
}

/** A readable Change version; `tasksContent` is `undefined` when the Change has no `tasks.md`. */
export function changeSummary(
  { dir, id, archived }: ChangeDir,
  source: string | undefined,
  { proposal, specs, design }: Omit<Artifacts, "tasks">,
  tasksContent: string | undefined,
  changeTime: Date,
): ChangeSummary {
  return {
    kind: "change",
    dir,
    id,
    archived,
    source,
    artifacts: { proposal, specs, design, tasks: tasksContent !== undefined },
    tasks: tasksContent === undefined ? { done: 0, total: 0 } : countTasks(tasksContent),
    changeTime,
  };
}

/** Everything one Source holds, or why it could not be read at all. */
export type SourceRead = { kind: "ok"; versions: ChangeVersion[] } | { kind: "error"; message: string };
