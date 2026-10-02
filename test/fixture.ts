import { afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { $ } from "bun";

/** Every fixture file gets this mtime unless a test sets another, so no result depends on the wall clock. */
export const DEFAULT_MTIME = new Date("2026-01-01T00:00:00Z");

/** A September 2026 date at `time` UTC, for commit and mtime dates. */
export const sept = (day: number, time = "10:00") => new Date(`2026-09-${String(day).padStart(2, "0")}T${time}:00Z`);

const GIT_ENV = {
  ...process.env,
  GIT_CONFIG_GLOBAL: "/dev/null",
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_AUTHOR_NAME: "Fixture",
  GIT_AUTHOR_EMAIL: "fixture@example.com",
  GIT_COMMITTER_NAME: "Fixture",
  GIT_COMMITTER_EMAIL: "fixture@example.com",
};

export class Fixture {
  /** `track` registers a directory for removal after the test. */
  constructor(
    readonly root: string,
    private readonly track: (dir: string) => void,
  ) {}

  /** Writes `content` to `rel` (relative to the fixture root), creating parent directories. */
  async write(rel: string, content = "", mtime = DEFAULT_MTIME): Promise<void> {
    const file = join(this.root, rel);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content);
    await utimes(file, mtime, mtime);
  }

  /** Runs `git` in the fixture with isolated config, e.g. to branch, check out or merge. */
  async git(...args: string[]): Promise<void> {
    await $`git ${args}`.cwd(this.root).env(GIT_ENV).quiet();
  }

  /**
   * Stages everything and commits with the given author and committer date. Fixture files share one
   * mtime, so an edit that keeps a file's size looks unchanged to git's stat check: after `add -A`
   * stages new and deleted files, `--renormalize` re-reads every tracked file's contents.
   */
  async commit(date: Date, message = "fixture commit"): Promise<void> {
    const iso = date.toISOString();
    const env = { ...GIT_ENV, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
    await $`git add -A`.cwd(this.root).env(env).quiet();
    await $`git add -A --renormalize`.cwd(this.root).env(env).quiet();
    await $`git commit -q -m ${message}`.cwd(this.root).env(env).quiet();
  }

  /**
   * Adds a linked worktree in its own temp directory as `<tmp>/<folder>`, on a new branch created at
   * the current commit or detached there, and returns a Fixture rooted in it.
   */
  async worktree(folder: string, at: { branch: string } | { detach: true }): Promise<Fixture> {
    const parent = await mkdtemp(join(tmpdir(), "osviz-worktree-"));
    this.track(parent);
    const dir = join(parent, folder);
    await this.git("worktree", "add", "-q", ...("branch" in at ? ["-b", at.branch] : ["--detach"]), dir);
    return new Fixture(dir, this.track);
  }
}

/**
 * Registers cleanup for the calling test file and returns a factory for fresh fixture directories.
 * With `git: true` (the default) the directory is an initialised repository isolated from user config.
 */
export function useFixtures(): (options?: { git?: boolean }) => Promise<Fixture> {
  const roots: string[] = [];
  afterEach(async () => {
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });
  const track = (dir: string) => void roots.push(dir);
  return async ({ git = true } = {}) => {
    const root = await mkdtemp(join(tmpdir(), "osviz-fixture-"));
    track(root);
    if (git) await $`git init -q -b main`.cwd(root).env(GIT_ENV).quiet();
    return new Fixture(root, track);
  };
}
