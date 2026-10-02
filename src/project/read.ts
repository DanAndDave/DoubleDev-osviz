import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { countTasks, type TaskProgress } from "../tasks.ts";
import { git } from "./git.ts";

export interface Artifacts {
  proposal: boolean;
  specs: boolean;
  design: boolean;
  tasks: boolean;
}

/** One active Change as read from the files on disk. */
export interface ChangeSummary {
  kind: "change";
  id: string;
  artifacts: Artifacts;
  tasks: TaskProgress;
  changeTime: Date;
}

/** A Change that exists but could not be read. */
export interface ChangeError {
  kind: "error";
  id: string;
  message: string;
}

export type ChangeRow = ChangeSummary | ChangeError;

export type ProjectSnapshot = { kind: "error"; message: string } | { kind: "ok"; changes: ChangeRow[] };

/** Reads the Project at `path` (absolute). Never throws and never writes to the Project. */
export async function readProject(path: string): Promise<ProjectSnapshot> {
  if (!(await exists(path))) return { kind: "error", message: `path does not exist: ${path}` };
  const openspecDir = join(path, "openspec");
  const openspecStat = await stat(openspecDir).catch(() => undefined);
  if (!openspecStat?.isDirectory()) return { kind: "error", message: `no openspec/ folder found at ${path}` };
  const changesDir = join(openspecDir, "changes");
  let entries: Dirent[];
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException;
    if (code !== "ENOENT") return { kind: "error", message: `cannot read openspec/changes: ${message}` };
    entries = [];
  }
  const ids = entries.filter((e) => e.isDirectory() && e.name !== "archive").map((e) => e.name);
  const history = await readHistory(path);
  if (history.kind === "error") return history;
  const changes = await Promise.all(
    ids.map((id) =>
      readChange(join(changesDir, id), id, history).catch(
        (error: Error): ChangeError => ({ kind: "error", id, message: error.message }),
      ),
    ),
  );
  changes.sort(byChangeTime);
  return { kind: "ok", changes };
}

/**
 * Most recent Change time first, ties by id. Error rows have no Change time; they come first,
 * by id, so problems are not buried at the bottom of the list.
 */
function byChangeTime(a: ChangeRow, b: ChangeRow): number {
  if (a.kind !== b.kind) return a.kind === "error" ? -1 : 1;
  const newerFirst = a.kind === "change" && b.kind === "change" ? b.changeTime.getTime() - a.changeTime.getTime() : 0;
  if (newerFirst !== 0) return newerFirst;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * What git knows about the Project's changes: which have uncommitted edits, and the committer time
 * of the latest commit touching each. `none` when the Project is not inside a git repository.
 */
type KnownHistory =
  | { kind: "none" }
  | { kind: "git"; uncommitted: Set<string>; committed: Map<string, Date> };

type History = KnownHistory | { kind: "error"; message: string };

async function readHistory(path: string): Promise<History> {
  const prefix = await git(path, ["rev-parse", "--show-prefix"]);
  if (!prefix.ok) {
    if (prefix.stderr.includes("not a git repository")) return { kind: "none" };
    // Without git we cannot ask, so look for a `.git` ourselves: only a Project that is in a
    // repository needs git; anywhere else Change time comes from file mtimes.
    if (!prefix.ran && !(await insideRepository(path))) return { kind: "none" };
    return { kind: "error", message: prefix.message };
  }
  // git prints paths relative to the repository root; this maps them back to change ids.
  const changesPrefix = `${prefix.stdout.replace(/\n$/, "")}openspec/changes/`;
  const changeIdOf = (repoPath: string): string | undefined => {
    if (!repoPath.startsWith(changesPrefix)) return undefined;
    const rest = repoPath.slice(changesPrefix.length);
    const slash = rest.indexOf("/");
    return slash > 0 ? rest.slice(0, slash) : undefined;
  };

  const [status, log] = await Promise.all([
    git(path, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "openspec/changes"]),
    // `--diff-merges=combined` lists, for a merge, only the paths it changed against every parent;
    // without it a merge prints no paths and its edits would be credited to an older commit.
    git(path, ["log", "-z", "--no-renames", "--diff-merges=combined", "--no-show-signature", "--format=%x01%ct", "--name-only", "--", "openspec/changes"]),
  ]);
  if (!status.ok) return { kind: "error", message: status.message };
  // A repository whose branch has no commits yet has no history to read.
  const unborn = !log.ok && log.stderr.includes("does not have any commits yet");
  if (!log.ok && !unborn) return { kind: "error", message: log.message };

  // Entries are `XY path`; a rename or copy is followed by its source path as a separate entry.
  const uncommitted = new Set<string>();
  const statusEntries = status.stdout.split("\0");
  for (let i = 0; i < statusEntries.length; i++) {
    const entry = statusEntries[i]!;
    if (entry.length < 4) continue;
    const paths = [entry.slice(3)];
    if ("RC".includes(entry[0]!) || "RC".includes(entry[1]!)) paths.push(statusEntries[++i] ?? "");
    for (const p of paths) {
      const id = changeIdOf(p);
      if (id !== undefined) uncommitted.add(id);
    }
  }

  // Each commit is a `\x01<seconds>` token followed by its paths, each path token starting with `\n` or not.
  const committed = new Map<string, Date>();
  let commitTime = new Date(0);
  for (const raw of (log.ok ? log.stdout : "").split("\0")) {
    const token = raw.replace(/^\n/, "");
    if (token.startsWith("\x01")) {
      commitTime = new Date(Number(token.slice(1)) * 1000);
      continue;
    }
    const id = changeIdOf(token);
    if (id === undefined) continue;
    const seen = committed.get(id);
    if (seen === undefined || seen < commitTime) committed.set(id, commitTime);
  }
  return { kind: "git", uncommitted, committed };
}

async function readChange(dir: string, id: string, history: KnownHistory): Promise<ChangeRow> {
  const commitTime = history.kind === "git" && !history.uncommitted.has(id) ? history.committed.get(id) : undefined;
  const [proposal, specs, design, tasksContent, changeTime] = await Promise.all([
    exists(join(dir, "proposal.md")),
    hasMarkdown(join(dir, "specs")),
    exists(join(dir, "design.md")),
    readOptional(join(dir, "tasks.md")),
    commitTime ?? newestMtime(dir),
  ]);
  return {
    kind: "change",
    id,
    artifacts: { proposal, specs, design, tasks: tasksContent !== undefined },
    tasks: tasksContent === undefined ? { done: 0, total: 0 } : countTasks(tasksContent),
    changeTime,
  };
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file);
    return true;
  } catch {
    return false;
  }
}

/** Whether `dir` or any parent holds a `.git` entry (a directory, or a file in a worktree or submodule). */
async function insideRepository(dir: string): Promise<boolean> {
  for (let current = dir; ; current = dirname(current)) {
    if (await exists(join(current, ".git"))) return true;
    if (dirname(current) === current) return false;
  }
}

async function hasMarkdown(dir: string): Promise<boolean> {
  try {
    const entries = await readdir(dir, { withFileTypes: true, recursive: true });
    return entries.some((e) => e.isFile() && e.name.endsWith(".md"));
  } catch {
    return false;
  }
}

/** File contents, or `undefined` when the file does not exist. */
async function readOptional(file: string): Promise<string | undefined> {
  try {
    return await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

/** Latest modification time of any file under `dir`; the directory's own mtime when it holds no files. */
async function newestMtime(dir: string): Promise<Date> {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  const files = entries.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name));
  const stats = await Promise.all((files.length > 0 ? files : [dir]).map((f) => stat(f)));
  return new Date(Math.max(...stats.map((s) => s.mtimeMs)));
}
