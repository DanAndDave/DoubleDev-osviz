import { afterEach, beforeEach, describe, expect, jest, test } from "bun:test";
import { chmod, mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { cleanup, render } from "ink-testing-library";
import { useEffect } from "react";
import { type ProjectSnapshot, readProject } from "../src/project/read.ts";
import { App } from "../src/ui/App.tsx";
import { sept, useFixtures } from "./fixture.ts";

const fixture = useFixtures();

const BOLD = (s: string) => `\u001B[1m${s}\u001B[22m`;
const DIM = (s: string) => `\u001B[2m${s}\u001B[22m`;
const GREEN = (s: string) => `\u001B[32m${s}\u001B[39m`;

/** Lets Ink finish its next frame; under fake timers, by advancing them 20ms. */
async function settle(): Promise<void> {
  if (jest.isFakeTimers()) return advance(20);
  const { promise, resolve } = Promise.withResolvers<void>();
  setTimeout(resolve, 20);
  await promise;
}

/** Advances fake timers by `ms`, then lets pending callbacks run. */
async function advance(ms: number): Promise<void> {
  jest.advanceTimersByTime(ms);
  await new Promise((resolve) => setImmediate(resolve));
}

// Every dashboard is unmounted after its test, which stops its refresh interval.
afterEach(cleanup);
afterEach(() => void jest.useRealTimers());

/**
 * Renders the dashboard for the Project at `path` and lets Ink finish its first frame. Every read the
 * dashboard starts is recorded in `reads`; `refreshed()` waits for them and the frame that follows.
 */
async function show(path: string) {
  const reads: Promise<ProjectSnapshot>[] = [];
  const read = () => {
    const reading = readProject(path);
    reads.push(reading);
    return reading;
  };
  const app = render(<App initial={await readProject(path)} read={read} />);
  await settle();
  const refreshed = async () => {
    await Promise.all(reads);
    await settle();
  };
  return { ...app, reads, refreshed };
}

/** Presses `r` and waits for the read and the frame after it. */
async function refresh(app: Awaited<ReturnType<typeof show>>): Promise<void> {
  await press(app, "r");
  await app.refreshed();
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
        <App initial={await readProject(f.root)} read={() => readProject(f.root)} />
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

describe("Refresh on demand", () => {
  test("r re-reads the Project: a ticked task shows at once", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await refresh(app);
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  4/10  main`]);
  });
});

describe("Problems during a refresh", () => {
  test("openspec/ moved away shows the error row; moved back, the Change rows return", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await rename(join(f.root, "openspec"), join(f.root, "moved"));
    await refresh(app);
    expect(plainLines(app.lastFrame())).toEqual([`✗ no openspec/ folder found at ${f.root}`]);
    await rename(join(f.root, "moved"), join(f.root, "openspec"));
    await refresh(app);
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(6)}${"░".repeat(14)}  3/10  main`]);
  });
});

describe("Periodic refresh", () => {
  beforeEach(() => void jest.useFakeTimers());

  test("a ticked task shows within 5 seconds without a key", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await advance(5000);
    await app.refreshed();
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  4/10  main`]);
  });

  test("a new Change appears within 5 seconds, in its place by Change time", async () => {
    const f = await fixture();
    await f.write("openspec/changes/old/proposal.md", "", sept(1));
    await f.write("openspec/changes/newer/proposal.md", "", sept(3));
    const app = await show(f.root);
    await f.write("openspec/changes/fix-login/proposal.md", "", sept(2));
    await advance(5000);
    await app.refreshed();
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["newer", "fix-login", "old"]);
  });

  test("nothing changes before the interval", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await advance(4900);
    await app.refreshed();
    expect(app.reads).toHaveLength(0);
    expect(plainLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(6)}${"░".repeat(14)}  3/10  main`]);
  });

  test("no read starts after the dashboard exits", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    const app = await show(f.root);
    app.unmount();
    await advance(5000);
    expect(app.reads).toHaveLength(0);
  });
});

describe("No overlapping reads", () => {
  beforeEach(() => void jest.useFakeTimers());

  test("a tick and r during a slow read start no second read; the first tick or r after it does", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    const pending: ((snapshot: ProjectSnapshot) => void)[] = [];
    const read = () => {
      const { promise, resolve } = Promise.withResolvers<ProjectSnapshot>();
      pending.push(resolve);
      return promise;
    };
    const app = render(<App initial={await readProject(f.root)} read={read} />);
    await press(app, "r");
    await advance(5000);
    await press(app, "r");
    expect(pending).toHaveLength(1);
    pending[0]!(await readProject(f.root));
    await settle();
    await advance(5000);
    expect(pending).toHaveLength(2);
    pending[1]!(await readProject(f.root));
    await settle();
    await press(app, "r");
    expect(pending).toHaveLength(3);
  });
});

describe("Place kept across a refresh", () => {
  test("the selected Change stays selected when a ticked task moves it to the top", async () => {
    const f = await fixture();
    await f.write("openspec/changes/alpha/tasks.md", TASKS(0, 2), sept(5));
    await f.write("openspec/changes/bravo/tasks.md", TASKS(0, 2), sept(1));
    const app = await show(f.root);
    await press(app, "j");
    await f.write("openspec/changes/bravo/tasks.md", TASKS(1, 2), sept(9));
    await refresh(app);
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["bravo", "alpha"]);
    expect(selected(app.lastFrame())).toEqual(["bravo"]);
  });

  test("an expanded Change stays expanded and its selected version row stays selected when the versions reorder", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 4));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(2, 4), sept(3));
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 5));
    await f.commit(sept(4));
    const app = await show(f.root);
    await press(app, ENTER);
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(4)}${"░".repeat(16)}  1/5  main`]);
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(3, 4), sept(6));
    await refresh(app);
    expect(plainLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth`,
      `add-auth  P S D T  ${"█".repeat(4)}${"░".repeat(16)}  1/5  main`,
    ]);
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(4)}${"░".repeat(16)}  1/5  main`]);
  });

  test("when the selected version is gone, its Change's first row is selected", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 4));
    await f.write("openspec/changes/zeta/proposal.md");
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(2, 4), sept(3));
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 5));
    await f.commit(sept(4));
    const app = await show(f.root);
    await press(app, ENTER, "j");
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  2/4  wt:wt-auth`]);
    await f.git("worktree", "remove", "--force", wt.root);
    await refresh(app);
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["add-auth", "zeta"]);
    expect(selected(app.lastFrame())).toEqual(["add-auth"]);
  });

  /** `alpha`, `bravo` and `charlie` on `main`, in that order. */
  async function threeChanges() {
    const f = await fixture();
    for (const id of ["alpha", "bravo", "charlie"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(sept(1));
    return { f, app: await show(f.root) };
  }

  test("when the selected Change is gone, the Change now in its position is selected", async () => {
    const { f, app } = await threeChanges();
    await press(app, "j");
    await rm(join(f.root, "openspec/changes/bravo"), { recursive: true });
    await refresh(app);
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["alpha", "charlie"]);
    expect(selected(app.lastFrame())).toEqual(["charlie"]);
  });

  test("when the selected last Change is gone, the new last row is selected", async () => {
    const { f, app } = await threeChanges();
    await press(app, "j", "j");
    await rm(join(f.root, "openspec/changes/charlie"), { recursive: true });
    await refresh(app);
    expect(selected(app.lastFrame())).toEqual(["bravo"]);
  });

  test("when the selected Change is archived on the Base and archived Changes are hidden, the row at its position is selected", async () => {
    const f = await fixture();
    await f.write("openspec/changes/older/proposal.md");
    await f.commit(sept(1));
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.commit(sept(3));
    await f.write("openspec/changes/newer/proposal.md");
    await f.commit(sept(5));
    const app = await show(f.root);
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["add-auth"]);
    await mkdir(join(f.root, "openspec/changes/archive"));
    await f.git("mv", "openspec/changes/add-auth", "openspec/changes/archive/2026-09-06-add-auth");
    await f.commit(sept(6));
    await refresh(app);
    expect(plainLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["newer", "older"]);
    expect(selected(app.lastFrame())).toEqual(["older"]);
  });
});
