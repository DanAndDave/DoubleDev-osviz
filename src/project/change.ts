import { countTasks, type TaskProgress } from "../tasks.ts";

export interface Artifacts {
  proposal: boolean;
  specs: boolean;
  design: boolean;
  tasks: boolean;
}

/**
 * One Change version as read from one Source. `source` is the Source label; `undefined` only for a
 * Project outside git, which has a single unlabelled Source.
 */
export interface ChangeSummary {
  kind: "change";
  id: string;
  source: string | undefined;
  artifacts: Artifacts;
  tasks: TaskProgress;
  changeTime: Date;
}

/** A Change version that exists but could not be read. */
interface ChangeError {
  kind: "error";
  id: string;
  source: string | undefined;
  message: string;
}

export type ChangeVersion = ChangeSummary | ChangeError;

/** A Change across Sources: its versions, Headline version first. */
export interface Change {
  id: string;
  versions: ChangeVersion[];
}

/** A readable Change version; `tasksContent` is `undefined` when the Change has no `tasks.md`. */
export function changeSummary(
  id: string,
  source: string | undefined,
  { proposal, specs, design }: Omit<Artifacts, "tasks">,
  tasksContent: string | undefined,
  changeTime: Date,
): ChangeSummary {
  return {
    kind: "change",
    id,
    source,
    artifacts: { proposal, specs, design, tasks: tasksContent !== undefined },
    tasks: tasksContent === undefined ? { done: 0, total: 0 } : countTasks(tasksContent),
    changeTime,
  };
}

/** Everything one Source holds, or why it could not be read at all. */
export type SourceRead = { kind: "ok"; versions: ChangeVersion[] } | { kind: "error"; message: string };
