import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { type ChangeDir, type ChangeVersion, changeSummary, type SourceRead } from "./change.ts";
import { exists } from "./fs.ts";
import { git } from "./git.ts";
import { activeDir, archivedDir, changeDirReader, logArgs, parseLog, statusPaths } from "./history.ts";

/**
 * What git knows about one worktree's change directories: which have uncommitted edits, and the
 * committer time of the latest commit touching each. `none` when the Project is not inside a git repository.
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
  const [active, archive] = await Promise.all([listDirectories(changesDir), listDirectories(join(changesDir, "archive"))]);
  if (active.kind === "error") return { kind: "error", message: `cannot read openspec/changes: ${active.message}` };
  if (archive.kind === "error") return { kind: "error", message: `cannot read openspec/changes/archive: ${archive.message}` };
  const dirs = [
    ...active.names.filter((name) => name !== "archive").map(activeDir),
    ...archive.names.flatMap((name) => archivedDir(name) ?? []),
  ];
  // Nothing to date; also skips git when the Project folder is missing from this worktree's checkout.
  if (dirs.length === 0) return { kind: "ok", versions: [] };
  const history = prefix === undefined ? ({ kind: "none" } as const) : await readHistory(dir, prefix);
  if (history.kind === "error") return history;
  const versions = await Promise.all(
    dirs.map((changeDir) =>
      readChange(join(changesDir, changeDir.dir), changeDir, label, history).catch(
        (error: Error): ChangeVersion => ({ kind: "error", ...changeDir, source: label, message: error.message }),
      ),
    ),
  );
  return { kind: "ok", versions };
}

/** Names of the directories directly in `dir`; none when `dir` does not exist. */
async function listDirectories(dir: string): Promise<{ kind: "ok"; names: string[] } | { kind: "error"; message: string }> {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    return { kind: "ok", names: entries.filter((e) => e.isDirectory()).map((e) => e.name) };
  } catch (error) {
    const { code, message } = error as NodeJS.ErrnoException;
    return code === "ENOENT" ? { kind: "ok", names: [] } : { kind: "error", message };
  }
}

async function readHistory(dir: string, prefix: string): Promise<History | { kind: "error"; message: string }> {
  const changeDirOf = changeDirReader(prefix);
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
    const changeDir = changeDirOf(path);
    if (changeDir !== undefined) uncommitted.add(changeDir.dir);
  }
  return { kind: "git", uncommitted, committed: parseLog(log.ok ? log.stdout : "", changeDirOf) };
}

async function readChange(path: string, changeDir: ChangeDir, source: string | undefined, history: History): Promise<ChangeVersion> {
  const commitTime =
    history.kind === "git" && !history.uncommitted.has(changeDir.dir) ? history.committed.get(changeDir.dir) : undefined;
  const [proposalContent, specs, design, tasksContent, changeTime] = await Promise.all([
    readOptional(join(path, "proposal.md")),
    hasMarkdown(join(path, "specs")),
    exists(join(path, "design.md")),
    readOptional(join(path, "tasks.md")),
    commitTime ?? newestMtime(path),
  ]);
  return changeSummary(changeDir, source, { specs, design }, proposalContent, tasksContent, changeTime);
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
