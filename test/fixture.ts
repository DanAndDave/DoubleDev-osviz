import { afterEach } from "bun:test";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { $ } from "bun";

/** Every fixture file gets this mtime unless a test sets another, so no result depends on the wall clock. */
export const DEFAULT_MTIME = new Date("2026-01-01T00:00:00Z");

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
  constructor(readonly root: string) {}

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

  /** Stages everything and commits with the given author and committer date. */
  async commit(date: Date, message = "fixture commit"): Promise<void> {
    const iso = date.toISOString();
    const env = { ...GIT_ENV, GIT_AUTHOR_DATE: iso, GIT_COMMITTER_DATE: iso };
    await $`git add -A`.cwd(this.root).env(env).quiet();
    await $`git commit -q -m ${message}`.cwd(this.root).env(env).quiet();
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
  return async ({ git = true } = {}) => {
    const root = await mkdtemp(join(tmpdir(), "osviz-fixture-"));
    roots.push(root);
    if (git) await $`git init -q -b main`.cwd(root).env(GIT_ENV).quiet();
    return new Fixture(root);
  };
}
