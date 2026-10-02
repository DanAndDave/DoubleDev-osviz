import { describe, expect, test } from "bun:test";
import { chmod, lstat, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { readProject, type ChangeSummary, type ProjectSnapshot } from "../src/project/read.ts";
import { sept, useFixtures } from "./fixture.ts";

const fixture = useFixtures();

/** The Headline version of each Change of an ok snapshot, keyed by id; fails the test on a Project error. */
function changesOf(snapshot: ProjectSnapshot): Map<string, ChangeSummary> {
  if (snapshot.kind !== "ok") throw new Error(`expected ok snapshot, got: ${snapshot.message}`);
  const rows = new Map<string, ChangeSummary>();
  for (const { id, versions } of snapshot.changes) {
    const headline = versions[0]!;
    if (headline.kind !== "change") throw new Error(`unexpected error row for ${id}: ${headline.message}`);
    rows.set(id, headline);
  }
  return rows;
}

describe("Task progress", () => {
  test("mixed checkboxes count bullets of either kind, either case, nested", async () => {
    const f = await fixture();
    await f.write(
      "openspec/changes/add-auth/tasks.md",
      "- [x] 1.1 a\n* [X] 1.2 b\n- [ ] 1.3 c\n  - [ ] 1.3.1 nested\n",
    );
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("add-auth")?.tasks).toEqual({ done: 2, total: 4 });
  });

  test("headings, plain bullets and unbulleted boxes are not tasks", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", "## 1. Setup\n- plain bullet\n[x] no bullet\n");
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("add-auth")?.tasks).toEqual({ done: 0, total: 0 });
  });

  test("a change without tasks.md has 0 of 0", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/proposal.md", "# Idea\n");
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("idea")?.tasks).toEqual({ done: 0, total: 0 });
  });
});

describe("Active Changes", () => {
  test("every directory under openspec/changes except archive is a Change; files are not", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.write("openspec/changes/fix-login/proposal.md");
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    await f.write("openspec/changes/README.md", "# notes\n");
    const rows = changesOf(await readProject(f.root));
    expect([...rows.keys()].sort()).toEqual(["add-auth", "fix-login"]);
  });
});

describe("Artifact presence", () => {
  test("partially planned change: proposal and nested spec present, design and tasks missing", async () => {
    const f = await fixture();
    await f.write("openspec/changes/half/proposal.md");
    await f.write("openspec/changes/half/specs/cli/spec.md");
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("half")?.artifacts).toEqual({ proposal: true, specs: true, design: false, tasks: false });
  });

  test("a specs folder without markdown does not count", async () => {
    const f = await fixture();
    await f.write("openspec/changes/half/design.md");
    await f.write("openspec/changes/half/tasks.md");
    await f.write("openspec/changes/half/specs/cli/notes.txt");
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("half")?.artifacts).toEqual({ proposal: false, specs: false, design: true, tasks: true });
  });
});

describe("Change time", () => {
  test("committed change: latest commit touching the directory, regardless of mtimes", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md", "v1", sept(20));
    await f.commit(sept(1, "08:00"));
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] a\n", sept(21));
    await f.commit(sept(1));
    await f.write("openspec/unrelated.md", "x");
    await f.commit(sept(15));
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("add-auth")?.changeTime).toEqual(sept(1));
  });

  test("uncommitted checkbox tick: newest file mtime", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] a\n");
    await f.commit(sept(1));
    await f.write("openspec/changes/add-auth/tasks.md", "- [x] a\n", sept(2, "08:00"));
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("add-auth")?.changeTime).toEqual(sept(2, "08:00"));
  });

  test("never committed: newest file mtime under the change directory", async () => {
    const f = await fixture();
    await f.write("openspec/changes/other/proposal.md");
    await f.commit(sept(1));
    await f.write("openspec/changes/fresh/proposal.md", "", sept(3, "11:00"));
    await f.write("openspec/changes/fresh/specs/cli/spec.md", "", sept(3, "12:00"));
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("fresh")?.changeTime).toEqual(sept(3, "12:00"));
    expect(rows.get("other")?.changeTime).toEqual(sept(1));
  });

  test("not a git repository: newest file mtime", async () => {
    const f = await fixture({ git: false });
    await f.write("openspec/changes/plain/proposal.md", "", sept(4));
    await f.write("openspec/changes/plain/tasks.md", "", sept(5));
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("plain")?.changeTime).toEqual(sept(5));
  });

  test("git not installed: a Project outside git still uses file mtimes", async () => {
    const f = await fixture({ git: false });
    await f.write("openspec/changes/plain/proposal.md", "", sept(4));
    const path = process.env.PATH;
    process.env.PATH = "/nonexistent";
    try {
      const rows = changesOf(await readProject(f.root));
      expect(rows.get("plain")?.changeTime).toEqual(sept(4));
    } finally {
      process.env.PATH = path;
    }
  });

  test("Project in a subdirectory of its repository uses that subdirectory's commits", async () => {
    const f = await fixture();
    await f.write("app/openspec/changes/add-auth/proposal.md", "", sept(20));
    await f.commit(sept(6));
    await f.write("openspec/changes/add-auth/proposal.md", "root-level decoy");
    await f.commit(sept(7));
    const rows = changesOf(await readProject(`${f.root}/app`));
    expect(rows.get("add-auth")?.changeTime).toEqual(sept(6));
  });

  test("a merge commit that edits a change directory is its latest commit", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.commit(sept(1));
    await f.git("checkout", "-q", "-b", "feat");
    await f.write("openspec/changes/other/proposal.md");
    await f.commit(sept(2));
    await f.git("checkout", "-q", "main");
    await f.write("openspec/changes/third/proposal.md");
    await f.commit(sept(3));
    await f.git("merge", "-q", "--no-ff", "--no-commit", "feat");
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] a\n");
    await f.commit(sept(10));
    const rows = changesOf(await readProject(f.root));
    expect(rows.get("add-auth")?.changeTime).toEqual(sept(10));
    expect(rows.get("other")?.changeTime).toEqual(sept(2));
  });
});

describe("Errors", () => {
  test("a missing path is a Project error", async () => {
    const f = await fixture({ git: false });
    const missing = join(f.root, "no-such-dir");
    expect(await readProject(missing)).toEqual({ kind: "error", message: `path does not exist: ${missing}` });
  });

  test("a path without openspec/ is a Project error", async () => {
    const f = await fixture({ git: false });
    expect(await readProject(f.root)).toEqual({ kind: "error", message: `no openspec/ folder found at ${f.root}` });
  });

  test("openspec/ without a changes folder has no Changes", async () => {
    const f = await fixture({ git: false });
    await f.write("openspec/config.yaml", "schema: spec-driven\n");
    expect(await readProject(f.root)).toEqual({ kind: "ok", changes: [], labelled: false });
  });

  test("a failing git command is a Project error", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    await writeFile(join(f.root, ".git", "index"), "corrupt");
    const snapshot = await readProject(f.root);
    expect(snapshot.kind).toBe("error");
    expect(snapshot.kind === "error" && snapshot.message).toContain("git status failed");
  });

  test.skipIf(process.getuid?.() === 0)("an unreadable tasks.md is an error row for that Change only", async () => {
    const f = await fixture();
    await f.write("openspec/changes/broken/tasks.md", "- [x] a\n");
    await f.write("openspec/changes/fine/tasks.md", "- [x] a\n");
    await chmod(join(f.root, "openspec/changes/broken/tasks.md"), 0o000);
    const snapshot = await readProject(f.root);
    if (snapshot.kind !== "ok") throw new Error(snapshot.message);
    const broken = snapshot.changes.find((change) => change.id === "broken")?.versions[0];
    expect(broken?.kind).toBe("error");
    expect(broken?.kind === "error" && broken.message).toContain("permission denied");
    expect(snapshot.changes.find((change) => change.id === "fine")?.versions[0]).toMatchObject({ kind: "change", tasks: { done: 1, total: 1 } });
  });
});

describe("Reading never writes", () => {
  /** Path, size and mtime of every entry under `root`, `.git` included. */
  async function listing(root: string): Promise<string[]> {
    const names = await readdir(root, { recursive: true });
    const rows = await Promise.all(
      names.map(async (name) => {
        const s = await lstat(join(root, name));
        return `${name} ${s.size} ${s.mtimeMs}`;
      }),
    );
    return rows.sort();
  }

  test("the Project and its git directory are untouched, even when git would refresh the index", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] a\n");
    await f.write("openspec/changes/add-auth/proposal.md", "same\n");
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    // Same content, new mtime: a plain `git status` would rewrite .git/index to record the new stat data.
    await f.write("openspec/changes/add-auth/proposal.md", "same\n", new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/add-auth/tasks.md", "- [x] a\n", new Date("2026-09-03T00:00:00Z"));
    await f.write("openspec/changes/fresh/proposal.md", "untracked\n");
    const before = await listing(f.root);
    await readProject(f.root);
    expect(await listing(f.root)).toEqual(before);
  });

  test("other worktrees, their index files and the shared git directory are untouched", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] a\n");
    await f.write("openspec/changes/add-auth/proposal.md", "same\n");
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    await f.git("branch", "nowhere");
    await f.git("checkout", "-q", "nowhere");
    await f.write("openspec/changes/add-auth/design.md", "on a branch checked out nowhere\n");
    await f.commit(new Date("2026-09-02T00:00:00Z"));
    await f.git("checkout", "-q", "main");
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    // Same content, new mtime: a plain `git status` there would rewrite that worktree's index.
    await wt.write("openspec/changes/add-auth/proposal.md", "same\n", new Date("2026-09-03T00:00:00Z"));
    await wt.write("openspec/changes/add-auth/tasks.md", "- [x] a\n", new Date("2026-09-04T00:00:00Z"));
    await wt.write("openspec/changes/fresh/proposal.md", "untracked\n");
    const before = [await listing(f.root), await listing(wt.root)];
    const snapshot = await readProject(f.root);
    expect(snapshot.kind === "ok" && snapshot.changes.flatMap((c) => c.versions.map((v) => v.source)).sort()).toEqual(
      ["main", "nowhere", "wt:wt-auth", "wt:wt-auth"],
    );
    expect([await listing(f.root), await listing(wt.root)]).toEqual(before);
  });
});
