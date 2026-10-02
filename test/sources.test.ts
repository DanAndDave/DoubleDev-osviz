import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { readProject, type ChangeSummary, type ProjectSnapshot } from "../src/project/read.ts";
import { type Fixture, sept, useFixtures } from "./fixture.ts";

const fixture = useFixtures();

const TODO = "- [ ] a\n- [ ] b\n";
const ONE_DONE = "- [x] a\n- [ ] b\n";

/** Per Change id, its versions as `<source> <done>/<total>[ archived]`, Headline first; fails on a Project error. */
function versionsOf(snapshot: ProjectSnapshot): Record<string, string[]> {
  if (snapshot.kind !== "ok") throw new Error(`expected ok snapshot, got: ${snapshot.message}`);
  return Object.fromEntries(
    snapshot.changes.map(({ id, versions }) => [
      id,
      versions.map(
        (v) =>
          `${v.source} ${v.kind === "change" ? `${v.tasks.done}/${v.tasks.total}` : `✗ ${v.message}`}${v.archived ? " archived" : ""}`,
      ),
    ]),
  );
}

/** The version of Change `id` from Source `source`. */
function versionOf(snapshot: ProjectSnapshot, id: string, source: string): ChangeSummary {
  if (snapshot.kind !== "ok") throw new Error(snapshot.message);
  const version = snapshot.changes.find((c) => c.id === id)?.versions.find((v) => v.source === source);
  if (version?.kind !== "change") throw new Error(`no readable ${source} version of ${id}`);
  return version;
}

/** A repository on `main` holding Change `add-auth` with two open tasks, committed on 2026-09-01. */
async function baseRepo(): Promise<Fixture> {
  const f = await fixture();
  await f.write("openspec/changes/add-auth/tasks.md", TODO);
  await f.commit(sept(1));
  return f;
}

/** Creates `branch` at the current commit, commits `files` on it, and returns to `main`. */
async function branchWith(f: Fixture, branch: string, files: Record<string, string>, date: Date): Promise<void> {
  await f.git("checkout", "-q", "-b", branch);
  for (const [rel, content] of Object.entries(files)) await f.write(rel, content);
  await f.commit(date);
  await f.git("checkout", "-q", "main");
}

describe("Base detection", () => {
  test("origin/HEAD names the Base: its local branch, before main", async () => {
    const f = await baseRepo();
    await f.git("branch", "trunk");
    await f.git("update-ref", "refs/remotes/origin/trunk", "trunk");
    await f.git("symbolic-ref", "refs/remotes/origin/HEAD", "refs/remotes/origin/trunk");
    // `trunk` is checked out nowhere, so the Base is read from its commit under its own name.
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["trunk 0/2"] });
  });

  test("main before master", async () => {
    const f = await baseRepo();
    await f.git("checkout", "-q", "-b", "master");
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 0/2"] });
  });

  test("--base overrides, even when main exists", async () => {
    const f = await baseRepo();
    await f.git("branch", "develop");
    expect(versionsOf(await readProject(f.root, { base: "develop" }))).toEqual({ "add-auth": ["develop 0/2"] });
  });

  test("an unknown --base is a Project error naming the ref", async () => {
    const f = await baseRepo();
    expect(await readProject(f.root, { base: "nope" })).toEqual({ kind: "error", message: "unknown --base ref: nope" });
  });

  test("no Base found: the checkout at the given path is the Base", async () => {
    const f = await fixture();
    await f.git("checkout", "-q", "-b", "develop");
    await f.write("openspec/changes/add-auth/tasks.md", TODO);
    await f.commit(sept(1));
    await f.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["develop 1/2"] });
  });

  test("no Base found in a repository without commits", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 1/2"] });
  });
});

describe("Base is always a Source", () => {
  test("Base checked out in the main checkout includes its uncommitted ticks", async () => {
    const f = await baseRepo();
    await f.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 1/2"] });
  });

  test("Base not checked out is read from its latest commit", async () => {
    const f = await baseRepo();
    const feat = await f.worktree("wt-feat", { branch: "feat" });
    await f.git("checkout", "-q", "--detach");
    await feat.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await feat.commit(sept(2));
    expect(versionsOf(await readProject(feat.root))).toEqual({ "add-auth": ["wt:wt-feat 1/2", "main 0/2"] });
  });
});

describe("Branch qualification", () => {
  test("a branch changing only files outside openspec/ is not a Source", async () => {
    const f = await baseRepo();
    await branchWith(f, "feat-ui", { "src/ui.ts": "ui" }, sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 0/2"] });
  });

  test("a branch with no commits beyond the Base is not a Source", async () => {
    const f = await baseRepo();
    await f.git("branch", "old");
    await f.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await f.commit(sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 1/2"] });
  });

  test("a branch with OpenSpec edits is a Source", async () => {
    const f = await baseRepo();
    await branchWith(f, "add-auth", { "openspec/changes/add-auth/tasks.md": ONE_DONE }, sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["add-auth 1/2", "main 0/2"] });
  });

  test("a branch with no commit in common with the Base is not a Source", async () => {
    const f = await baseRepo();
    await f.git("checkout", "-q", "--orphan", "pages");
    await f.git("rm", "-rqf", ".");
    await f.write("openspec/changes/site/tasks.md", TODO);
    await f.commit(sept(2));
    await f.git("checkout", "-q", "main");
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 0/2"] });
  });

  test("remote-tracking branches are ignored", async () => {
    const f = await baseRepo();
    await branchWith(f, "add-auth", { "openspec/changes/add-auth/tasks.md": ONE_DONE }, sept(2));
    await f.git("update-ref", "refs/remotes/origin/add-auth", "add-auth");
    await f.git("branch", "-q", "-D", "add-auth");
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 0/2"] });
  });
});

describe("Worktree qualification", () => {
  test("a worktree with only uncommitted checkbox ticks is a Source", async () => {
    const f = await baseRepo();
    const work = await f.worktree("wt-work", { branch: "work" });
    await work.write("openspec/changes/add-auth/tasks.md", ONE_DONE, sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["wt:wt-work 1/2", "main 0/2"] });
  });

  test("a worktree with no OpenSpec edits is not a Source", async () => {
    const f = await baseRepo();
    const work = await f.worktree("wt-work", { branch: "work" });
    await work.write("README.md", "edited");
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["main 0/2"] });
  });

  test("a detached worktree with a commit editing openspec/changes is a Source", async () => {
    const f = await baseRepo();
    const detached = await f.worktree("wt-detached", { detach: true });
    await detached.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await detached.commit(sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["wt:wt-detached 1/2", "main 0/2"] });
  });

  test("a qualifying branch checked out in a worktree is read once, from its files", async () => {
    const f = await baseRepo();
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await wt.commit(sept(2));
    await wt.write("openspec/changes/add-auth/tasks.md", "- [x] a\n- [x] b\n", sept(3));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["wt:wt-auth 2/2", "main 0/2"] });
  });

  test("a worktree whose folder is gone is ignored; its branch is then read from its commit", async () => {
    const f = await baseRepo();
    const gone = await f.worktree("wt-gone", { branch: "gone" });
    await gone.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await gone.commit(sept(2));
    await rm(gone.root, { recursive: true });
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["gone 1/2", "main 0/2"] });
  });
});

describe("Source labels", () => {
  test("Base worktree by branch name, other worktrees wt:<folder>, branches by name", async () => {
    const f = await baseRepo();
    await branchWith(f, "fix", { "openspec/changes/add-auth/tasks.md": ONE_DONE }, sept(2));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", ONE_DONE, sept(3));
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["wt:wt-auth 1/2", "fix 1/2", "main 0/2"] });
  });

  test("a detached checkout with no Base found is labelled wt:<folder>", async () => {
    const f = await fixture();
    await f.git("checkout", "-q", "-b", "develop");
    await f.write("openspec/changes/add-auth/tasks.md", TODO);
    await f.commit(sept(1));
    await f.git("checkout", "-q", "--detach");
    const snapshot = await readProject(f.root);
    expect(versionsOf(snapshot)).toEqual({ "add-auth": [`wt:${f.root.split("/").at(-1)} 0/2`] });
  });
});

describe("Change versions per Source", () => {
  test("a Change the branch did not touch is not repeated", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", TODO);
    await f.write("openspec/changes/b/tasks.md", TODO);
    await f.commit(sept(1));
    await branchWith(f, "edit-b", { "openspec/changes/b/tasks.md": ONE_DONE }, sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ b: ["edit-b 1/2", "main 0/2"], a: ["main 0/2"] });
  });

  test("a Change only on a branch has one version, from that branch", async () => {
    const f = await baseRepo();
    await branchWith(f, "new-idea", { "openspec/changes/new-idea/proposal.md": "# idea\n" }, sept(2));
    expect(versionsOf(await readProject(f.root))).toEqual({ "new-idea": ["new-idea 0/0"], "add-auth": ["main 0/2"] });
  });

  test("a Change the branch deleted gets no version from it", async () => {
    const f = await baseRepo();
    await f.git("checkout", "-q", "-b", "drop");
    await rm(join(f.root, "openspec/changes/add-auth"), { recursive: true });
    await f.write("openspec/changes/other/proposal.md");
    await f.commit(sept(2));
    await f.git("checkout", "-q", "main");
    expect(versionsOf(await readProject(f.root))).toEqual({ other: ["drop 0/0"], "add-auth": ["main 0/2"] });
  });

  test("archived on a branch: the Base's active version and the branch's archived one", async () => {
    const f = await baseRepo();
    await f.git("checkout", "-q", "-b", "wrap-up");
    // `openspec archive` moves the change directory into `archive/`, creating it when needed.
    await mkdir(join(f.root, "openspec/changes/archive"), { recursive: true });
    await f.git("mv", "openspec/changes/add-auth", "openspec/changes/archive/2026-09-10-add-auth");
    await f.commit(sept(10));
    await f.git("checkout", "-q", "main");
    expect(versionsOf(await readProject(f.root))).toEqual({ "add-auth": ["wrap-up 0/2 archived", "main 0/2"] });
  });

  test("an archive inherited from the Base is not repeated by a worktree that did not change it", async () => {
    const f = await baseRepo();
    await f.write("openspec/changes/archive/2026-08-01-old/tasks.md", ONE_DONE);
    await f.commit(sept(2));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", ONE_DONE, sept(3));
    expect(versionsOf(await readProject(f.root))).toEqual({
      "add-auth": ["wt:wt-auth 1/2", "main 0/2"],
      old: ["main 1/2 archived"],
    });
  });
});

describe("Reading a branch commit", () => {
  test("Artifacts come from the branch's commit", async () => {
    const f = await baseRepo();
    await branchWith(f, "add-auth", { "openspec/changes/add-auth/design.md": "# d\n", "openspec/changes/add-auth/specs/x/spec.md": "" }, sept(2));
    const snapshot = await readProject(f.root);
    expect(versionOf(snapshot, "add-auth", "add-auth").artifacts).toEqual({ proposal: false, specs: true, design: true, tasks: true });
    expect(versionOf(snapshot, "add-auth", "main").artifacts).toEqual({ proposal: false, specs: false, design: false, tasks: true });
  });

  test("Change time is the branch's latest commit touching the change directory", async () => {
    const f = await baseRepo();
    await f.git("checkout", "-q", "-b", "add-auth");
    await f.write("openspec/changes/add-auth/tasks.md", ONE_DONE);
    await f.commit(sept(7, "09:00"));
    await f.write("src/later.ts", "x");
    await f.commit(sept(9));
    await f.git("checkout", "-q", "main");
    expect(versionOf(await readProject(f.root), "add-auth", "add-auth").changeTime).toEqual(sept(7, "09:00"));
  });

  test("a Project in a subdirectory reads its own folder of the branch", async () => {
    const f = await fixture();
    await f.write("app/openspec/changes/add-auth/tasks.md", TODO);
    await f.commit(sept(1));
    await branchWith(f, "add-auth", { "app/openspec/changes/add-auth/tasks.md": ONE_DONE, "openspec/changes/decoy/tasks.md": TODO }, sept(2));
    expect(versionsOf(await readProject(join(f.root, "app")))).toEqual({ "add-auth": ["add-auth 1/2", "main 0/2"] });
  });
});

describe("Change time in another worktree", () => {
  test("an uncommitted edit dates the worktree's version by file mtime", async () => {
    const f = await baseRepo();
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", ONE_DONE, sept(8, "15:00"));
    expect(versionOf(await readProject(f.root), "add-auth", "wt:wt-auth").changeTime).toEqual(sept(8, "15:00"));
  });

  test("the worktree on a Project subdirectory reads that subdirectory", async () => {
    const f = await fixture();
    await f.write("app/openspec/changes/add-auth/tasks.md", TODO);
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("app/openspec/changes/add-auth/tasks.md", ONE_DONE, sept(2));
    expect(versionsOf(await readProject(join(f.root, "app")))).toEqual({ "add-auth": ["wt:wt-auth 1/2", "main 0/2"] });
  });
});
