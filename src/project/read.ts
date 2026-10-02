import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { Change, ChangeVersion, SourceRead } from "./change.ts";
import { readCommitSource } from "./commit.ts";
import { exists } from "./fs.ts";
import { findSources } from "./sources.ts";
import { readWorktreeSource } from "./worktree.ts";

export type { Artifacts, Change, ChangeSummary, ChangeVersion } from "./change.ts";
export { isArchived, isReadyToArchive } from "./change.ts";

/** `labelled` is false only for a Project outside git, whose single Source has no label. */
export type ProjectSnapshot = { kind: "error"; message: string } | { kind: "ok"; changes: Change[]; labelled: boolean };

/**
 * Reads the Project at `path` (absolute) from every Source: the Base and each qualifying branch and
 * worktree. `base` is the `--base` ref. Never throws and never writes to the Project.
 */
export async function readProject(path: string, { base }: { base?: string } = {}): Promise<ProjectSnapshot> {
  if (!(await exists(path))) return { kind: "error", message: `path does not exist: ${path}` };
  const openspecStat = await stat(join(path, "openspec")).catch(() => undefined);
  if (!openspecStat?.isDirectory()) return { kind: "error", message: `no openspec/ folder found at ${path}` };

  const found = await findSources(path, base);
  if (found.kind === "error") return found;
  if (found.kind === "none") {
    const read = await readWorktreeSource(path, undefined, undefined);
    return read.kind === "error" ? read : { kind: "ok", changes: group(read.versions), labelled: false };
  }

  const reads = await Promise.all(
    found.sources.map(async (source): Promise<SourceRead> => {
      const read =
        source.read === "worktree"
          ? await readWorktreeSource(source.dir, source.label, found.prefix)
          : await readCommitSource(path, source.rev, source.label, found.prefix);
      // Only the Base contributes every Change; other Sources only the ones they changed.
      if (read.kind === "error" || source.changed === undefined) return read;
      const changed = source.changed;
      return { kind: "ok", versions: read.versions.filter((v) => changed.has(v.dir)) };
    }),
  );
  const versions: ChangeVersion[] = [];
  for (const read of reads) {
    if (read.kind === "error") return read;
    versions.push(...read.versions);
  }
  return { kind: "ok", changes: group(versions), labelled: true };
}

/** Groups versions into Changes, each with its Headline version first, ordered by Headline Change time. */
function group(versions: ChangeVersion[]): Change[] {
  const byId = new Map<string, ChangeVersion[]>();
  for (const version of versions) byId.set(version.id, [...(byId.get(version.id) ?? []), version]);
  const changes = [...byId].map(([id, versionsOfId]): Change => ({ id, versions: headlineFirst(versionsOfId.sort(byChangeTime)) }));
  return changes.sort(byHeadlineTime);
}

/** Readable versions first, the most recent Change time first, ties by Source label; error versions have no Change time and come last. */
function byChangeTime(a: ChangeVersion, b: ChangeVersion): number {
  if (a.kind !== b.kind) return a.kind === "error" ? 1 : -1;
  return newer(a, b) || compare(a.source ?? "", b.source ?? "");
}

/**
 * Moves the Headline version to the front of versions sorted `byChangeTime`: the latest archived
 * readable version when there is one, otherwise the first. The rest keep their order.
 */
function headlineFirst(sorted: ChangeVersion[]): ChangeVersion[] {
  const archived = sorted.findIndex((v) => v.kind === "change" && v.archived);
  return archived <= 0 ? sorted : [sorted[archived]!, ...sorted.toSpliced(archived, 1)];
}

/**
 * Most recent Headline Change time first, ties by id. A Change with no readable version has no
 * Change time; such Changes come first, by id, so problems are not buried at the bottom of the list.
 */
function byHeadlineTime(a: Change, b: Change): number {
  const [x, y] = [a.versions[0]!, b.versions[0]!];
  if (x.kind !== y.kind) return x.kind === "error" ? -1 : 1;
  return newer(x, y) || compare(a.id, b.id);
}

/** Positive when `b` has the later Change time; 0 for two error versions. */
function newer(a: ChangeVersion, b: ChangeVersion): number {
  return a.kind === "change" && b.kind === "change" ? b.changeTime.getTime() - a.changeTime.getTime() : 0;
}

function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
