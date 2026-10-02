import { type ChangeDir, type ChangeVersion, changeSummary, type SourceRead } from "./change.ts";
import { git, gitBytes } from "./git.ts";
import { changeDirReader, logArgs, parseLog } from "./history.ts";

/**
 * Reads the Change versions in commit `rev` from git objects, without checking anything out.
 * `cwd` is any directory inside the repository at the Project's position, so that `openspec/changes`
 * names the Project's folder; `prefix` is the Project's path inside the repository.
 */
export async function readCommitSource(cwd: string, rev: string, label: string, prefix: string): Promise<SourceRead> {
  const changeDirOf = changeDirReader(prefix);
  const [tree, log] = await Promise.all([
    git(cwd, ["ls-tree", "-r", "-z", "--full-name", "--name-only", rev, "--", "openspec/changes"]),
    git(cwd, logArgs(rev)),
  ]);
  if (!tree.ok) return { kind: "error", message: tree.message };
  if (!log.ok) return { kind: "error", message: log.message };

  // Every file below each change directory in the tree, as a path relative to that directory.
  const files = new Map<string, { changeDir: ChangeDir; paths: string[] }>();
  const changesPrefix = `${prefix}openspec/changes/`;
  for (const path of tree.stdout.split("\0")) {
    const changeDir = changeDirOf(path);
    if (changeDir === undefined) continue;
    const rest = path.slice(changesPrefix.length + changeDir.dir.length + 1);
    const entry = files.get(changeDir.dir) ?? { changeDir, paths: [] };
    entry.paths.push(rest);
    files.set(changeDir.dir, entry);
  }

  const withTasks = [...files.keys()].filter((dir) => files.get(dir)!.paths.includes("tasks.md"));
  const contents = await readBlobs(cwd, withTasks.map((dir) => `${rev}:${changesPrefix}${dir}/tasks.md`));
  if (contents.kind === "error") return contents;
  const tasksOf = new Map(withTasks.map((dir, i) => [dir, contents.blobs[i]!]));

  const committed = parseLog(log.stdout, changeDirOf);
  const versions: ChangeVersion[] = [];
  for (const [dir, { changeDir, paths }] of files) {
    const changeTime = committed.get(dir);
    // A path in a commit's tree was added by a commit reachable from it, so this means a damaged repository.
    if (changeTime === undefined) return { kind: "error", message: `no commit touches ${dir} in ${label}` };
    const artifacts = {
      proposal: paths.includes("proposal.md"),
      specs: paths.some((p) => p.startsWith("specs/") && p.endsWith(".md")),
      design: paths.includes("design.md"),
    };
    versions.push(changeSummary(changeDir, label, artifacts, tasksOf.get(dir), changeTime));
  }
  return { kind: "ok", versions };
}

/**
 * The contents of each `<rev>:<path>` object, in order, from one `git cat-file --batch`. Its output
 * is `<sha> <type> <size>\n<bytes>\n` per object, or `<name> missing\n`.
 */
async function readBlobs(cwd: string, names: string[]): Promise<{ kind: "ok"; blobs: string[] } | { kind: "error"; message: string }> {
  if (names.length === 0) return { kind: "ok", blobs: [] };
  const result = await gitBytes(cwd, ["cat-file", "--batch"], names.map((n) => `${n}\n`).join(""));
  if (!result.ok) return { kind: "error", message: result.message };
  const out = result.stdout;
  const decoder = new TextDecoder();
  const blobs: string[] = [];
  let at = 0;
  for (const name of names) {
    const eol = out.indexOf(0x0a, at);
    const header = decoder.decode(out.subarray(at, eol));
    const size = Number(header.split(" ")[2]);
    if (eol < 0 || header.endsWith(" missing") || !Number.isInteger(size)) {
      return { kind: "error", message: `git cat-file failed for ${name}: ${header}` };
    }
    blobs.push(decoder.decode(out.subarray(eol + 1, eol + 1 + size)));
    at = eol + 1 + size + 1;
  }
  return { kind: "ok", blobs };
}
