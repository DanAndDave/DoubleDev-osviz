import { basename, dirname, join } from "node:path";
import { git } from "./git.ts";
import { changeDirReader, statusPaths } from "./history.ts";
import { exists } from "./fs.ts";

/**
 * Where one Source's Change versions are read from. `changed` holds the change directories (relative
 * to `openspec/changes/`) the Source may contribute; it is absent for the Base, which contributes
 * every Change version it holds.
 */
export type Source =
  | { read: "worktree"; label: string; dir: string; changed?: Set<string> }
  | { read: "commit"; label: string; rev: string; changed?: Set<string> };

/** `none`: the Project is not inside a git repository. `prefix` is the Project's path inside the repository. */
type Sources =
  | { kind: "none" }
  | { kind: "error"; message: string }
  | { kind: "git"; prefix: string; sources: Source[] };

/** A candidate's outcome: a qualifying Source, `undefined` when it does not qualify, or a git failure. */
type Found = Source | undefined | { kind: "error"; message: string };

interface Worktree {
  path: string;
  head: string;
  /** `refs/heads/<name>`, absent when detached. */
  branch?: string;
}

/** The Base as a commit, the branch it names (`refs/heads/<name>`) if any, and its label. */
interface Base {
  rev: string;
  branch?: string;
  label: string;
}

const UNBORN = /^0+$/;

/**
 * The Sources of the Project at `path` (ADR 0001): the Base, every worktree and every local branch
 * that qualifies against it. `base` is the `--base` ref, if given. Never writes.
 */
export async function findSources(path: string, base?: string): Promise<Sources> {
  const where = await git(path, ["rev-parse", "--show-prefix", "--show-toplevel"]);
  if (!where.ok) {
    if (where.stderr.includes("not a git repository")) return { kind: "none" };
    // Without git we cannot ask, so look for a `.git` ourselves: only a Project that is in a
    // repository needs git; anywhere else Change time comes from file mtimes.
    if (!where.ran && !(await insideRepository(path))) return { kind: "none" };
    return { kind: "error", message: where.message };
  }
  const [prefix = "", toplevel = ""] = where.stdout.split("\n");

  const [list, chosen] = await Promise.all([git(path, ["worktree", "list", "--porcelain", "-z"]), findBase(path, base)]);
  if (!list.ok) return { kind: "error", message: list.message };
  if (chosen.kind === "error") return chosen;
  const worktrees = parseWorktrees(list.stdout);
  const givenWorktree = worktrees.find((w) => w.path === toplevel) ?? { path: toplevel, head: "" };
  /** The Project directory inside worktree `w`; the given path itself for the worktree it is in. */
  const projectDir = (w: Worktree) => (w === givenWorktree ? path : join(w.path, prefix));

  if (chosen.kind === "none") {
    // No Base to compare against, so nothing else can qualify: the given worktree is the only Source.
    const label = givenWorktree.branch === undefined ? `wt:${basename(givenWorktree.path)}` : shortBranch(givenWorktree.branch);
    return { kind: "git", prefix, sources: [{ read: "worktree", label, dir: path }] };
  }

  const baseRef = chosen.base;
  const baseTree = worktrees.find((w) => baseRef.branch !== undefined && w.branch === baseRef.branch);
  const baseSource: Source =
    baseTree === undefined
      ? { read: "commit", label: baseRef.label, rev: baseRef.rev }
      : { read: "worktree", label: baseRef.label, dir: projectDir(baseTree) };

  // A branch checked out in a worktree is read only from that worktree.
  const checkedOut = new Set(worktrees.flatMap((w) => (w.branch === undefined ? [] : [w.branch])));
  const ahead = await git(path, ["for-each-ref", `--format=%(refname)%00%(ahead-behind:${baseRef.rev})`, "refs/heads"]);
  if (!ahead.ok) return { kind: "error", message: ahead.message };
  const branchCandidates = ahead.stdout
    .split("\n")
    .map((line) => line.split("\0"))
    .filter(([ref, counts]) => ref !== undefined && counts !== undefined && !checkedOut.has(ref) && ref !== baseRef.branch)
    .filter(([, counts]) => Number(counts!.split(" ")[0]) > 0)
    .map(([ref]) => ref!);

  const changeDirOf = changeDirReader(prefix);
  const pathspec = `:(top,literal)${prefix}openspec`;
  const changedDirs = (paths: string[]) => new Set(paths.flatMap((p) => changeDirOf(p)?.dir ?? []));

  const worktreeSources = worktrees
    .filter((w) => w !== baseTree)
    .map(async (w): Promise<Found> => {
      const [committed, uncommitted] = await Promise.all([
        diffSinceSplit(w.path, baseRef.rev, w.head, pathspec),
        git(w.path, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--", pathspec]),
      ]);
      if (!committed.ok) return { kind: "error", message: committed.message };
      if (!uncommitted.ok) return { kind: "error", message: uncommitted.message };
      const paths = [...committed.paths, ...statusPaths(uncommitted.stdout)];
      if (paths.length === 0) return undefined;
      return { read: "worktree", label: `wt:${basename(w.path)}`, dir: projectDir(w), changed: changedDirs(paths) };
    });
  const branchSources = branchCandidates.map(async (ref): Promise<Found> => {
    const committed = await diffSinceSplit(path, baseRef.rev, ref, pathspec);
    if (!committed.ok) return { kind: "error", message: committed.message };
    if (committed.paths.length === 0) return undefined;
    return { read: "commit", label: shortBranch(ref), rev: ref, changed: changedDirs(committed.paths) };
  });

  const sources: Source[] = [baseSource];
  for (const found of await Promise.all([...worktreeSources, ...branchSources])) {
    if (found === undefined) continue;
    if ("kind" in found) return found;
    sources.push(found);
  }
  return { kind: "git", prefix, sources };
}

/**
 * The Base: `--base` if given (unknown is an error), else the local branch named by `origin/HEAD`,
 * then `main`, then `master`. `none` when none of them exists.
 */
async function findBase(
  path: string,
  ref: string | undefined,
): Promise<{ kind: "found"; base: Base } | { kind: "none" } | { kind: "error"; message: string }> {
  if (ref !== undefined) {
    const [rev, full] = await Promise.all([
      git(path, ["rev-parse", "--verify", "-q", "--end-of-options", `${ref}^{commit}`]),
      git(path, ["rev-parse", "--verify", "-q", "--symbolic-full-name", "--end-of-options", ref]),
    ]);
    if (!rev.ok) return { kind: "error", message: `unknown --base ref: ${ref}` };
    const name = full.ok ? full.stdout.trim() : "";
    const branch = name.startsWith("refs/heads/") ? name : undefined;
    return { kind: "found", base: { rev: rev.stdout.trim(), branch, label: branch === undefined ? ref : shortBranch(branch) } };
  }
  const originHead = await git(path, ["symbolic-ref", "-q", "refs/remotes/origin/HEAD"]);
  const originHeadBranch = originHead.ok ? originHead.stdout.trim().replace(/^refs\/remotes\/origin\//, "") : undefined;
  for (const name of [originHeadBranch, "main", "master"]) {
    if (name === undefined) continue;
    const branch = `refs/heads/${name}`;
    const rev = await git(path, ["rev-parse", "--verify", "-q", `${branch}^{commit}`]);
    if (rev.ok) return { kind: "found", base: { rev: rev.stdout.trim(), branch, label: name } };
  }
  return { kind: "none" };
}

/**
 * Paths under `pathspec` that differ between `tip` and the commit where it split from `base`.
 * Histories with no commit in common have no split point, and an unborn `tip` (all-zero, from a
 * worktree with no commits yet) has no commits, so nothing differs in either case.
 */
async function diffSinceSplit(
  cwd: string,
  base: string,
  tip: string,
  pathspec: string,
): Promise<{ ok: true; paths: string[] } | { ok: false; message: string }> {
  if (UNBORN.test(tip)) return { ok: true, paths: [] };
  const diff = await git(cwd, ["diff", "--name-only", "-z", "--no-renames", `${base}...${tip}`, "--", pathspec]);
  if (diff.ok) return { ok: true, paths: diff.stdout.split("\0").filter((p) => p !== "") };
  if (diff.stderr.includes("no merge base")) return { ok: true, paths: [] };
  return diff;
}

/** Entries of `git worktree list --porcelain -z`, without bare repositories and worktrees whose folder is gone. */
function parseWorktrees(stdout: string): Worktree[] {
  const worktrees: Worktree[] = [];
  // Each entry is a run of `key value` or `key` fields ended by an empty field.
  let fields = new Map<string, string>();
  for (const field of stdout.split("\0")) {
    if (field !== "") {
      const space = field.indexOf(" ");
      fields.set(space < 0 ? field : field.slice(0, space), space < 0 ? "" : field.slice(space + 1));
      continue;
    }
    const path = fields.get("worktree");
    if (path !== undefined && !fields.has("bare") && !fields.has("prunable")) {
      worktrees.push({ path, head: fields.get("HEAD") ?? "", branch: fields.get("branch") });
    }
    fields = new Map();
  }
  return worktrees;
}

function shortBranch(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

/** Whether `dir` or any parent holds a `.git` entry (a directory, or a file in a worktree or submodule). */
async function insideRepository(dir: string): Promise<boolean> {
  for (let current = dir; ; current = dirname(current)) {
    if (await exists(join(current, ".git"))) return true;
    if (dirname(current) === current) return false;
  }
}
