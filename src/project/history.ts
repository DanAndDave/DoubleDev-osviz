/**
 * Parsers for git output shared by the Source readers and Source discovery. git prints paths
 * relative to the repository root; `prefix` is the Project's directory relative to that root
 * (`git rev-parse --show-prefix`, so `""` or ending in `/`).
 */

/** Maps a repository path under `<prefix>openspec/changes/<id>/` to `<id>`; anything else to `undefined`. */
export function changeIdReader(prefix: string): (repoPath: string) => string | undefined {
  const changesPrefix = `${prefix}openspec/changes/`;
  return (repoPath) => {
    if (!repoPath.startsWith(changesPrefix)) return undefined;
    const rest = repoPath.slice(changesPrefix.length);
    const slash = rest.indexOf("/");
    return slash > 0 ? rest.slice(0, slash) : undefined;
  };
}

/**
 * `git log` arguments listing, per commit reachable from `rev` (default `HEAD`), its committer time
 * and the paths it changed under the Project's `openspec/changes`. Run from the Project directory.
 * `--diff-merges=combined` lists, for a merge, only the paths it changed against every parent;
 * without it a merge prints no paths and its edits would be credited to an older commit.
 */
export function logArgs(rev?: string): string[] {
  return [
    "log",
    "-z",
    "--no-renames",
    "--diff-merges=combined",
    "--no-show-signature",
    "--format=%x01%ct",
    "--name-only",
    ...(rev === undefined ? [] : [rev]),
    "--",
    "openspec/changes",
  ];
}

/** The committer time of the latest commit touching each change, from the output of `logArgs`. */
export function parseLog(stdout: string, changeIdOf: (repoPath: string) => string | undefined): Map<string, Date> {
  // Each commit is a `\x01<seconds>` token followed by its paths, each path token starting with `\n` or not.
  const committed = new Map<string, Date>();
  let commitTime = new Date(0);
  for (const raw of stdout.split("\0")) {
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
  return committed;
}

/** Every path in `git status --porcelain=v1 -z` output, including the source path of a rename or copy. */
export function statusPaths(stdout: string): string[] {
  // Entries are `XY path`; a rename or copy is followed by its source path as a separate entry.
  const paths: string[] = [];
  const entries = stdout.split("\0");
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]!;
    if (entry.length < 4) continue;
    paths.push(entry.slice(3));
    if ("RC".includes(entry[0]!) || "RC".includes(entry[1]!)) paths.push(entries[++i] ?? "");
  }
  return paths;
}
