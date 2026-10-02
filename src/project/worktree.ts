import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { type ChangeVersion, changeSummary, type SourceRead } from "./change.ts";
import { exists } from "./fs.ts";
import { git } from "./git.ts";
import { changeIdReader, logArgs, parseLog, statusPaths } from "./history.ts";

/**
 * What git knows about one worktree's changes: which have uncommitted edits, and the committer time
 * of the latest commit touching each. `none` when the Project is not inside a git repository.
 */
type History = { kind: "none" } | { kind: "git"; uncommitted: Set<string>; committed: Map<string, Date> };

/**
 * Reads the Change versions in the files on disk under `dir`, the Project directory inside one
 * worktree. `prefix` is the Project's path inside the repository, `undefined` outside git.
 */
export async function readWorktreeSource(
  dir: string,
  label: string | undefined,
  prefix: string | undefined,
): Promise<SourceRead> {
  const changesDir = join(dir, "openspec", "changes");
  let entries: Dirent[];
  try {
    entries = await readdir(changesDir, { withFileTypes: true });
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException;
    if (code !== "ENOENT") return { kind: "error", message: `cannot read openspec/changes: ${message}` };
    entries = [];
  }
  const ids = entries.filter((e) => e.isDirectory() && e.name !== "archive").map((e) => e.name);
  // Nothing to date; also skips git when the Project folder is missing from this worktree's checkout.
  if (ids.length === 0) return { kind: "ok", versions: [] };
  const history = prefix === undefined ? ({ kind: "none" } as const) : await readHistory(dir, prefix);
  if (history.kind === "error") return history;
  const versions = await Promise.all(
    ids.map((id) =>
      readChange(join(changesDir, id), id, label, history).catch(
        (error: Error): ChangeVersion => ({ kind: "error", id, source: label, message: error.message }),
      ),
    ),
  );
  return { kind: "ok", versions };
}

async function readHistory(dir: string, prefix: string): Promise<History | { kind: "error"; message: string }> {
  const changeIdOf = changeIdReader(prefix);
  const [status, log] = await Promise.all([
    git(dir, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", "openspec/changes"]),
    git(dir, logArgs()),
  ]);
  if (!status.ok) return { kind: "error", message: status.message };
  // A branch with no commits yet has no history to read.
  const unborn = !log.ok && log.stderr.includes("does not have any commits yet");
  if (!log.ok && !unborn) return { kind: "error", message: log.message };

  const uncommitted = new Set<string>();
  for (const path of statusPaths(status.stdout)) {
    const id = changeIdOf(path);
    if (id !== undefined) uncommitted.add(id);
  }
  return { kind: "git", uncommitted, committed: parseLog(log.ok ? log.stdout : "", changeIdOf) };
}

async function readChange(dir: string, id: string, source: string | undefined, history: History): Promise<ChangeVersion> {
  const commitTime = history.kind === "git" && !history.uncommitted.has(id) ? history.committed.get(id) : undefined;
  const [proposal, specs, design, tasksContent, changeTime] = await Promise.all([
    exists(join(dir, "proposal.md")),
    hasMarkdown(join(dir, "specs")),
    exists(join(dir, "design.md")),
    readOptional(join(dir, "tasks.md")),
    commitTime ?? newestMtime(dir),
  ]);
  return changeSummary(id, source, { proposal, specs, design }, tasksContent, changeTime);
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
