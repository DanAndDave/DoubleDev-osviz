import { describe, expect, test } from "bun:test";
import { chmod, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { render } from "ink-testing-library";
import { useEffect } from "react";
import { readProject } from "../src/project/read.ts";
import { App } from "../src/ui/App.tsx";
import { sept, useFixtures } from "./fixture.ts";

const fixture = useFixtures();

const BOLD = (s: string) => `\u001B[1m${s}\u001B[22m`;
const DIM = (s: string) => `\u001B[2m${s}\u001B[22m`;
const GREEN = (s: string) => `\u001B[32m${s}\u001B[39m`;

async function settle(): Promise<void> {
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 20);
  await promise;
}

/** Renders the dashboard for the Project at `path` and lets Ink finish its first frame. */
async function show(path: string) {
  const app = render(<App snapshot={await readProject(path)} />);
  await settle();
  return app;
}

/** The frame's lines with styling removed. */
function plainLines(frame: string | undefined): string[] {
  return stripVTControlCharacters(frame ?? "").split("\n");
}

/** The styled frame line that mentions `text`. */
function styledLine(frame: string | undefined, text: string): string {
  const line = (frame ?? "").split("\n").find((l) => stripVTControlCharacters(l).includes(text));
  if (line === undefined) throw new Error(`no line mentions ${text} in:\n${frame}`);
  return line;
}

const INVERSE = "\u001B[7m";
const DOWN = "\u001B[B";
const UP = "\u001B[A";
const ENTER = "\r";

/** The rows drawn in inverse video, styling removed. */
function selectedLines(frame: string | undefined): string[] {
  return (frame ?? "")
    .split("\n")
    .filter((line) => line.includes(INVERSE))
    .map((line) => stripVTControlCharacters(line));
}

/** Ids of the rows drawn in inverse video. */
function selected(frame: string | undefined): string[] {
  return selectedLines(frame).map((line) => line.split(" ")[0]!);
}

async function press(app: { stdin: { write(data: string): void } }, ...keys: string[]): Promise<void> {
  for (const key of keys) {
    app.stdin.write(key);
    await settle();
  }
}

describe("Change rows", () => {
  test("change in progress: id, artifact letters, bar 70% full, 7/10", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.write("openspec/changes/add-auth/specs/auth/spec.md");
    await f.write("openspec/changes/add-auth/tasks.md", `${"- [x] t\n".repeat(7)}${"- [ ] t\n".repeat(3)}`);
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(14)}${"░".repeat(6)}  7/10  main`]);
    const row = styledLine(lastFrame(), "add-auth");
    for (const present of ["P", "S", "T"]) expect(row).toContain(BOLD(present));
    expect(row).toContain(DIM("D"));
  });

  test("change without tasks: empty bar and 0/0", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("ids, progress and labels are padded so the columns line up", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "", new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/a/tasks.md", `${"- [x] t\n".repeat(10)}`, new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/longer-id/proposal.md", "", new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([
      `a          P S D T  ${"█".repeat(20)}  10/10  main  ✓ ready to archive`,
      `longer-id  P S D T  ${"░".repeat(20)}  0/0    main`,
    ]);
  });

  test("a Project outside git has no label column", async () => {
    const f = await fixture({ git: false });
    await f.write("openspec/changes/idea/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0`]);
  });
});

describe("Archived Changes", () => {
  test("an archived Change gets no row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    await f.write("openspec/changes/live/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`live  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("archived on the Base hides a stale active version in a worktree", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 2));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await mkdir(join(f.root, "openspec/changes/archive"));
    await f.git("mv", "openspec/changes/add-auth", "openspec/changes/archive/2026-09-02-add-auth");
    await f.commit(sept(2));
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(2, 2), sept(5));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual(["No active changes"]);
  });

  test("a Project whose Changes are all archived says there are no active changes until a is pressed", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    const app = await show(f.root);
    expect(plainLines(app.lastFrame())).toEqual(["No active changes"]);
    await press(app, "a");
    expect(plainLines(app.lastFrame())).toEqual([`old-thing  P S D T  ${"░".repeat(20)}  0/0  main  archived`]);
  });

  /** Active `fresh` (2026-09-05), archived `old-thing` (2026-09-03) and active `live` (2026-09-01), all on `main`. */
  async function archivedBetween() {
    const f = await fixture();
    await f.write("openspec/changes/live/proposal.md");
    await f.commit(sept(1));
    await f.write("openspec/changes/archive/2026-09-03-old-thing/proposal.md");
    await f.commit(sept(3));
    await f.write("openspec/changes/fresh/proposal.md");
    await f.commit(sept(5));
    return show(f.root);
  }

  test("a shows archived Changes in Change time order with a dim archived marker; a again hides them", async () => {
    const app = await archivedBetween();
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["fresh", "live"]);
    await press(app, "a");
    expect(plainLines(app.lastFrame())).toEqual([
      `fresh      P S D T  ${"░".repeat(20)}  0/0  main`,
      `old-thing  P S D T  ${"░".repeat(20)}  0/0  main  archived`,
      `live       P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    expect(styledLine(app.lastFrame(), "old-thing")).toContain(DIM("archived"));
    await press(app, "a");
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["fresh", "live"]);
  });

  test("a keeps the selected row selected when it is still shown", async () => {
    const app = await archivedBetween();
    await press(app, "a", "j", "j");
    expect(selected(app.lastFrame())).toEqual(["live"]);
    await press(app, "a");
    expect(selected(app.lastFrame())).toEqual(["live"]);
    await press(app, "a");
    expect(selected(app.lastFrame())).toEqual(["live"]);
  });

  test("a selects the first row when it hides the selected archived Change", async () => {
    const app = await archivedBetween();
    await press(app, "a", "j");
    expect(selected(app.lastFrame())).toEqual(["old-thing"]);
    await press(app, "a");
    expect(selected(app.lastFrame())).toEqual(["fresh"]);
  });

  test("an archived Headline is shown over a newer active version, with its label and +1", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 2));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await mkdir(join(f.root, "openspec/changes/archive"));
    await f.git("mv", "openspec/changes/add-auth", "openspec/changes/archive/2026-09-02-add-auth");
    await f.commit(sept(2));
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(5, 10), sept(5));
    const app = await show(f.root);
    await press(app, "a");
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  1/2  main  +1  archived`]);
    await press(app, ENTER);
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  1/2   main  archived`,
      `add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  5/10  wt:wt-auth`,
    ]);
  });
});

describe("Ready to archive marker", () => {
  test("every task ticked: the row ends with a green ready marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(7, 7));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(20)}  7/7  main  ✓ ready to archive`]);
    expect(styledLine(lastFrame(), "add-auth")).toContain(GREEN("✓ ready to archive"));
  });

  test("tasks remaining: no marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(6, 7));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(17)}${"░".repeat(3)}  6/7  main`]);
  });

  test("no tasks: no marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/tasks.md", "## nothing yet\n");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("already archived with every task ticked: archived marker only", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-add-auth/tasks.md", TASKS(7, 7));
    const app = await show(f.root);
    await press(app, "a");
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(20)}  7/7  main  archived`]);
  });

  test("ready on an older version only: no marker on the Headline or the older version's row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(7, 7));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(7, 8), sept(5));
    const app = await show(f.root);
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(17)}${"░".repeat(3)}  7/8  wt:wt-auth  +1`]);
    await press(app, ENTER);
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(17)}${"░".repeat(3)}  7/8  wt:wt-auth`,
      `add-auth  P S D T  ${"█".repeat(20)}  7/7  main`,
    ]);
  });

  test("expanded: only the Headline version's row carries the ready marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 8));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(8, 8), sept(5));
    const app = await show(f.root);
    await press(app, ENTER);
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(20)}  8/8  wt:wt-auth  ✓ ready to archive`,
      `add-auth  P S D T  ${"█".repeat(7)}${"░".repeat(13)}  3/8  main`,
    ]);
  });
});

describe("Row order", () => {
  test("most recent Change time first", async () => {
    const f = await fixture();
    await f.write("openspec/changes/old-change/proposal.md");
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    await f.write("openspec/changes/new-change/proposal.md");
    await f.commit(new Date("2026-09-05T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame()).map((line) => line.split(" ")[0])).toEqual(["new-change", "old-change"]);
  });

  test("equal Change times are ordered by id", async () => {
    const f = await fixture();
    for (const id of ["charlie", "alpha", "bravo"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame()).map((line) => line.split(" ")[0])).toEqual(["alpha", "bravo", "charlie"]);
  });
});

describe("Selection", () => {
  async function threeRows() {
    const f = await fixture();
    for (const id of ["alpha", "bravo", "charlie"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    return show(f.root);
  }

  test("starts on the first row", async () => {
    const app = await threeRows();
    expect(selected(app.lastFrame())).toEqual(["alpha"]);
  });

  test("j and the down arrow move down one row", async () => {
    const app = await threeRows();
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["bravo"]);
    await press(app, DOWN);
    expect(selected(app.lastFrame())).toEqual(["charlie"]);
  });

  test("k and the up arrow move up one row", async () => {
    const app = await threeRows();
    await press(app, "j", "j", "k");
    expect(selected(app.lastFrame())).toEqual(["bravo"]);
    await press(app, UP);
    expect(selected(app.lastFrame())).toEqual(["alpha"]);
  });

  test("stops at the last and the first row", async () => {
    const app = await threeRows();
    await press(app, "j", "j", DOWN);
    expect(selected(app.lastFrame())).toEqual(["charlie"]);
    await press(app, "k", "k", "k", UP);
    expect(selected(app.lastFrame())).toEqual(["alpha"]);
  });
});

describe("Error rows", () => {
  test("a path without openspec/ shows a single error row", async () => {
    const f = await fixture({ git: false });
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`✗ no openspec/ folder found at ${f.root}`]);
  });

  test("a path that does not exist shows a single error row", async () => {
    const f = await fixture({ git: false });
    const missing = join(f.root, "nope");
    const { lastFrame } = await show(missing);
    expect(plainLines(lastFrame())).toEqual([`✗ path does not exist: ${missing}`]);
  });

  test.skipIf(process.getuid?.() === 0)("an unreadable tasks.md replaces only that Change's row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/broken/tasks.md", "- [x] a\n");
    await f.write("openspec/changes/fine/tasks.md", "- [x] a\n");
    await chmod(join(f.root, "openspec/changes/broken/tasks.md"), 0o000);
    const { lastFrame } = await show(f.root);
    const lines = plainLines(lastFrame());
    expect(lines[0]).toStartWith("broken  main  ✗ EACCES: permission denied");
    expect(lines.at(-1)).toBe(`fine    P S D T  ${"█".repeat(20)}  1/1  main  ✓ ready to archive`);
  });

  test.skipIf(process.getuid?.() === 0)("an unreadable version in another worktree is an error row with its label", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [x] a\n");
    await f.commit(sept(1));
    const wt = await f.worktree("wt-a", { branch: "wt-a" });
    await wt.write("openspec/changes/a/tasks.md", "- [x] a\n- [ ] b\n", sept(5));
    await chmod(join(wt.root, "openspec/changes/a/tasks.md"), 0o000);
    const app = await show(f.root);
    expect(plainLines(app.lastFrame())).toEqual([`a  P S D T  ${"█".repeat(20)}  1/1  main  +1  ✓ ready to archive`]);
    await press(app, ENTER);
    const lines = plainLines(app.lastFrame());
    expect(lines[0]).toBe(`a  P S D T  ${"█".repeat(20)}  1/1  main  ✓ ready to archive`);
    expect(lines[1]).toStartWith("a  wt:wt-a  ✗ EACCES: permission denied");
  });
});

const TASKS = (done: number, total: number) => `${"- [x] t\n".repeat(done)}${"- [ ] t\n".repeat(total - done)}`;

describe("Sources in rows", () => {
  test("Headline from a worktree: its progress, label and +1", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(7, 10), sept(5));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(14)}${"░".repeat(6)}  7/10  wt:wt-auth  +1`]);
  });

  test("ordered by Headline version: a branch's newer version lifts its Change", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", TASKS(0, 1));
    await f.commit(sept(1));
    await f.write("openspec/changes/b/tasks.md", TASKS(0, 1));
    await f.commit(sept(5));
    await f.git("checkout", "-q", "-b", "feat");
    await f.write("openspec/changes/a/tasks.md", TASKS(1, 1));
    await f.commit(sept(9));
    await f.git("checkout", "-q", "main");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([
      `a  P S D T  ${"█".repeat(20)}  1/1  feat  +1  ✓ ready to archive`,
      `b  P S D T  ${"░".repeat(20)}  0/1  main`,
    ]);
  });
});

describe("Expanding a Change", () => {
  /** `add-auth` with versions in `wt:wt-auth` (newest, 3/4), `fix` (2/4) and `main` (oldest, 1/4), plus `zeta` on `main`. */
  async function threeVersions() {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 4));
    await f.write("openspec/changes/zeta/proposal.md");
    await f.commit(sept(1));
    await f.git("checkout", "-q", "-b", "fix");
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(2, 4));
    await f.commit(sept(3));
    await f.git("checkout", "-q", "main");
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(3, 4), sept(5));
    return show(f.root);
  }

  test("Enter expands the selected Change into one row per version, newest first", async () => {
    const app = await threeVersions();
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth  +2`,
      `zeta      P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    await press(app, ENTER);
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth`,
      `add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  2/4  fix`,
      `add-auth  P S D T  ${"█".repeat(5)}${"░".repeat(15)}  1/4  main`,
      `zeta      P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
  });

  test("j moves into an expanded Change's version rows", async () => {
    const app = await threeVersions();
    await press(app, ENTER, "j");
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  2/4  fix`]);
  });

  test("Enter on any version row collapses the Change and selects its row", async () => {
    const app = await threeVersions();
    await press(app, ENTER, "j", "j", ENTER);
    expect(plainLines(app.lastFrame())).toHaveLength(2);
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth  +2`]);
  });

  test("expanding a Change below keeps the selection on that Change", async () => {
    const app = await threeVersions();
    await press(app, ENTER, "j", "j", "j", ENTER, "k", ENTER);
    expect(plainLines(app.lastFrame())).toHaveLength(2);
    expect(selected(app.lastFrame())).toEqual(["add-auth"]);
  });
});

describe("Quit", () => {
  test("q unmounts the dashboard", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    let mounted = true;
    // Ink unmounts the whole tree on exit, so a sibling's effect cleanup observes it.
    function Sentinel() {
      useEffect(() => () => void (mounted = false), []);
      return null;
    }
    const app = render(
      <>
        <App snapshot={await readProject(f.root)} />
        <Sentinel />
      </>,
    );
    await settle();
    app.stdin.write("j");
    await settle();
    expect(mounted).toBe(true);
    app.stdin.write("q");
    await settle();
    expect(mounted).toBe(false);
  });
});
