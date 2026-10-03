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

/** A terminal size; `show` pins one so no result depends on the terminal running the tests. */
interface Size {
  columns: number;
  rows: number;
}

/** Wide and tall enough that the panel sits beside the list and nothing is fitted. */
const ROOMY: Size = { columns: 200, rows: 50 };

/**
 * Renders the dashboard for the Project at `path` in a terminal of `size` and lets Ink finish its
 * frame. Every read the dashboard starts is recorded in `reads`; `refreshed()` waits for them and the
 * frame that follows.
 */
async function show(path: string, size: Size = ROOMY) {
  const reads: Promise<ProjectSnapshot>[] = [];
  const read = () => {
    const reading = readProject(path);
    reads.push(reading);
    return reading;
  };
  const app = render(<App initial={await readProject(path)} read={read} />);
  await settle();
  await resize(app, size);
  const refreshed = async () => {
    await Promise.all(reads);
    await settle();
  };
  return { ...app, reads, refreshed };
}

/** Gives the test terminal `size`, as a terminal window resize does, and lets Ink redraw. */
async function resize(app: { stdout: NodeJS.EventEmitter }, { columns, rows }: Size): Promise<void> {
  Object.defineProperties(app.stdout, { columns: { value: columns, configurable: true }, rows: { value: rows, configurable: true } });
  app.stdout.emit("resize");
  await settle();
}

/** Presses `r` and waits for the read and the frame after it. */
async function refresh(app: Awaited<ReturnType<typeof show>>): Promise<void> {
  await press(app, "r");
  await app.refreshed();
}

const BESIDE = "│";
const BELOW = /^─+$/;

/**
 * The frame's lines with styling removed, split into the list's and the panel's. Beside the list, each
 * line is cut at the panel's border; below it, the frame is cut at the border line. The space the panel
 * leaves after its border is removed, and so are the empty lines either side leaves below its last line.
 */
function split(frame: string | undefined): { list: string[]; panel: string[] } {
  const lines = stripVTControlCharacters(frame ?? "").split("\n");
  const border = lines.findIndex((line) => BELOW.test(line));
  if (border >= 0) return { list: lines.slice(0, border), panel: withoutTrailingEmpty(lines.slice(border + 1).map((line) => line.slice(1).trimEnd())) };
  const at = lines.find((line) => line.includes(BESIDE))?.indexOf(BESIDE);
  if (at === undefined) return { list: lines, panel: [] };
  return {
    list: withoutTrailingEmpty(lines.map((line) => line.slice(0, at).trimEnd())),
    panel: withoutTrailingEmpty(lines.map((line) => line.slice(at + 2))),
  };
}

/** `lines` without the empty lines after its last nonempty one. */
function withoutTrailingEmpty(lines: string[]): string[] {
  const end = lines.findLastIndex((line) => line !== "");
  return lines.slice(0, end + 1);
}

/** The list's lines, styling removed. */
function listLines(frame: string | undefined): string[] {
  return split(frame).list;
}

/** The panel's lines, styling removed; none when there is no panel. */
function panelLines(frame: string | undefined): string[] {
  return split(frame).panel;
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

/** The list rows drawn in inverse video, styling removed. */
function selectedLines(frame: string | undefined): string[] {
  const list = split(frame).list;
  return (frame ?? "").split("\n").flatMap((line, i) => (line.includes(INVERSE) ? [list[i]!] : []));
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
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(14)}${"░".repeat(6)}  7/10  main`]);
    const row = styledLine(lastFrame(), "add-auth");
    for (const present of ["P", "S", "T"]) expect(row).toContain(BOLD(present));
    expect(row).toContain(DIM("D"));
  });

  test("change without tasks: empty bar and 0/0", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("ids, progress and labels are padded so the columns line up", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "", new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/a/tasks.md", `${"- [x] t\n".repeat(10)}`, new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/longer-id/proposal.md", "", new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([
      `a          P S D T  ${"█".repeat(20)}  10/10  main  ✓ ready to archive`,
      `longer-id  P S D T  ${"░".repeat(20)}  0/0    main`,
    ]);
  });

  test("a Project outside git has no label column", async () => {
    const f = await fixture({ git: false });
    await f.write("openspec/changes/idea/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0`]);
  });
});

describe("Archived Changes", () => {
  test("an archived Change gets no row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    await f.write("openspec/changes/live/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`live  P S D T  ${"░".repeat(20)}  0/0  main`]);
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
    expect(listLines(lastFrame())).toEqual(["No active changes"]);
  });

  test("a Project whose Changes are all archived says there are no active changes until a is pressed", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    const app = await show(f.root);
    expect(listLines(app.lastFrame())).toEqual(["No active changes"]);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([`old-thing  P S D T  ${"░".repeat(20)}  0/0  main  archived`]);
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
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["fresh", "live"]);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([
      `fresh      P S D T  ${"░".repeat(20)}  0/0  main`,
      `old-thing  P S D T  ${"░".repeat(20)}  0/0  main  archived`,
      `live       P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    expect(styledLine(app.lastFrame(), "old-thing")).toContain(DIM("archived"));
    await press(app, "a");
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["fresh", "live"]);
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
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  1/2  main  +1  archived`]);
    await press(app, ENTER);
    expect(listLines(app.lastFrame())).toEqual([
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
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(20)}  7/7  main  ✓ ready to archive`]);
    expect(styledLine(lastFrame(), "add-auth")).toContain(GREEN("✓ ready to archive"));
  });

  test("tasks remaining: no marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(6, 7));
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(17)}${"░".repeat(3)}  6/7  main`]);
  });

  test("no tasks: no marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/tasks.md", "## nothing yet\n");
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("already archived with every task ticked: archived marker only", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-add-auth/tasks.md", TASKS(7, 7));
    const app = await show(f.root);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(20)}  7/7  main  archived`]);
  });

  test("ready on an older version only: no marker on the Headline or the older version's row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(7, 7));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(7, 8), sept(5));
    const app = await show(f.root);
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(17)}${"░".repeat(3)}  7/8  wt:wt-auth  +1`]);
    await press(app, ENTER);
    expect(listLines(app.lastFrame())).toEqual([
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
    expect(listLines(app.lastFrame())).toEqual([
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
    expect(listLines(lastFrame()).map((line) => line.split(" ")[0])).toEqual(["new-change", "old-change"]);
  });

  test("equal Change times are ordered by id", async () => {
    const f = await fixture();
    for (const id of ["charlie", "alpha", "bravo"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame()).map((line) => line.split(" ")[0])).toEqual(["alpha", "bravo", "charlie"]);
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
    expect(listLines(lastFrame())).toEqual([`✗ no openspec/ folder found at ${f.root}`]);
  });

  test("a path that does not exist shows a single error row", async () => {
    const f = await fixture({ git: false });
    const missing = join(f.root, "nope");
    const { lastFrame } = await show(missing);
    expect(listLines(lastFrame())).toEqual([`✗ path does not exist: ${missing}`]);
  });

  for (const file of ["tasks.md", "proposal.md"]) {
    test.skipIf(process.getuid?.() === 0)(`an unreadable ${file} replaces only that Change's row, cut to one line`, async () => {
      const f = await fixture();
      await f.write(`openspec/changes/broken/${file}`, "- [x] a\n");
      await f.write("openspec/changes/fine/tasks.md", "- [x] a\n");
      await chmod(join(f.root, `openspec/changes/broken/${file}`), 0o000);
      const { lastFrame } = await show(f.root);
      const fine = `fine    P S D T  ${"█".repeat(20)}  1/1  main  ✓ ready to archive`;
      const [broken, ...rest] = listLines(lastFrame());
      expect(broken).toStartWith("broken  main  ✗ EACCES: permission denied");
      expect(broken).toEndWith("…");
      expect(broken).toHaveLength(fine.length);
      expect(rest).toEqual([fine]);
    });
  }

  test("a 300-character error is cut to one line as wide as the widest Change row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/broken/tasks.md", "- [x] a\n");
    await f.write(`openspec/changes/${"x".repeat(18)}/tasks.md`, "- [ ] a\n");
    const read = await readProject(f.root);
    if (read.kind !== "ok") throw new Error(read.message);
    // No file read fails with a message this long, so the read snapshot's Change version is made one.
    const snapshot: ProjectSnapshot = {
      ...read,
      changes: read.changes.map((change) =>
        change.id !== "broken" ? change : { ...change, versions: [{ ...change.versions[0]!, kind: "error", message: "m".repeat(300) }] },
      ),
    };
    const app = render(<App initial={snapshot} read={async () => snapshot} />);
    await resize(app, { columns: 200, rows: 20 });
    const lines = listLines(app.lastFrame());
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(`${"x".repeat(18)}  P S D T  ${"░".repeat(20)}  0/1  main`);
    expect(lines[0]).toHaveLength(60);
    expect(lines[0]).toStartWith("broken              main  ✗ mmm");
    expect(lines[0]).toEndWith("m…");
  });

  test.skipIf(process.getuid?.() === 0)("an unreadable version in another worktree is an error row with its label", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [x] a\n");
    await f.commit(sept(1));
    const wt = await f.worktree("wt-a", { branch: "wt-a" });
    await wt.write("openspec/changes/a/tasks.md", "- [x] a\n- [ ] b\n", sept(5));
    await chmod(join(wt.root, "openspec/changes/a/tasks.md"), 0o000);
    const app = await show(f.root);
    expect(listLines(app.lastFrame())).toEqual([`a  P S D T  ${"█".repeat(20)}  1/1  main  +1  ✓ ready to archive`]);
    await press(app, ENTER);
    const lines = listLines(app.lastFrame());
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
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(14)}${"░".repeat(6)}  7/10  wt:wt-auth  +1`]);
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
    expect(listLines(lastFrame())).toEqual([
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
    expect(listLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth  +2`,
      `zeta      P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    await press(app, ENTER);
    expect(listLines(app.lastFrame())).toEqual([
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
    expect(listLines(app.lastFrame())).toHaveLength(2);
    expect(selectedLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(15)}${"░".repeat(5)}  3/4  wt:wt-auth  +2`]);
  });

  test("expanding a Change below keeps the selection on that Change", async () => {
    const app = await threeVersions();
    await press(app, ENTER, "j", "j", "j", ENTER, "k", ENTER);
    expect(listLines(app.lastFrame())).toHaveLength(2);
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
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  4/10  main`]);
  });
});

describe("Problems during a refresh", () => {
  test("openspec/ moved away shows the error row; moved back, the Change rows return", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await rename(join(f.root, "openspec"), join(f.root, "moved"));
    await refresh(app);
    expect(listLines(app.lastFrame())).toEqual([`✗ no openspec/ folder found at ${f.root}`]);
    await rename(join(f.root, "moved"), join(f.root, "openspec"));
    await refresh(app);
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(6)}${"░".repeat(14)}  3/10  main`]);
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
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  4/10  main`]);
  });

  test("a new Change appears within 5 seconds, in its place by Change time", async () => {
    const f = await fixture();
    await f.write("openspec/changes/old/proposal.md", "", sept(1));
    await f.write("openspec/changes/newer/proposal.md", "", sept(3));
    const app = await show(f.root);
    await f.write("openspec/changes/fix-login/proposal.md", "", sept(2));
    await advance(5000);
    await app.refreshed();
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["newer", "fix-login", "old"]);
  });

  test("nothing changes before the interval", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 10));
    const app = await show(f.root);
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await advance(4900);
    await app.refreshed();
    expect(app.reads).toHaveLength(0);
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(6)}${"░".repeat(14)}  3/10  main`]);
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
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["bravo", "alpha"]);
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
    expect(listLines(app.lastFrame())).toEqual([
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
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["add-auth", "zeta"]);
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
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["alpha", "charlie"]);
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
    expect(listLines(app.lastFrame()).map((line) => line.split(" ")[0])).toEqual(["newer", "older"]);
    expect(selected(app.lastFrame())).toEqual(["older"]);
  });
});

/** `n` lines of `line`. */
const times = (n: number, line: string) => Array<string>(n).fill(line);

describe("Panel shows the selected Change version", () => {
  /** `add-auth` at 4/10 on `main` and, newer, at 7/10 in worktree `wt-auth`; `zeta` on `main`. */
  async function twoVersions() {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(4, 10));
    await f.write("openspec/changes/zeta/tasks.md", "- [ ] z\n");
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(7, 10), sept(5));
    return show(f.root);
  }

  test("a collapsed row shows its Headline version", async () => {
    const app = await twoVersions();
    expect(panelLines(app.lastFrame())).toEqual(["add-auth  wt:wt-auth", ...times(7, "  ✓ t"), ...times(3, "  ○ t")]);
  });

  test("an expanded version row shows its own version", async () => {
    const app = await twoVersions();
    await press(app, ENTER, "j");
    expect(panelLines(app.lastFrame())).toEqual(["add-auth  main", ...times(4, "  ✓ t"), ...times(6, "  ○ t")]);
  });

  test("moving the selection moves the panel", async () => {
    const app = await twoVersions();
    await press(app, "j");
    expect(panelLines(app.lastFrame())).toEqual(["zeta  main", "  ○ z"]);
  });

  test("a refresh shows a ticked task as done", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [x] 1.1 read\n- [ ] 1.2 draw\n");
    const app = await show(f.root);
    expect(panelLines(app.lastFrame())).toContain("  ○ 1.2 draw");
    await f.write("openspec/changes/a/tasks.md", "- [x] 1.1 read\n- [x] 1.2 draw\n");
    await refresh(app);
    expect(panelLines(app.lastFrame())).toContain("  ✓ 1.2 draw");
  });

  test("no rows: no panel", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(stripVTControlCharacters(lastFrame() ?? "")).toBe("No active changes");
  });

  test("Project error: no panel", async () => {
    const f = await fixture({ git: false });
    const { lastFrame } = await show(f.root);
    expect(stripVTControlCharacters(lastFrame() ?? "")).toBe(`✗ no openspec/ folder found at ${f.root}`);
  });
});

describe("Panel heading", () => {
  /** The panel of a Change `add-auth` on `main` with `proposal` as its `proposal.md` and one open task. */
  async function panelFor(proposal: string | undefined, options?: { git?: boolean }) {
    const f = await fixture(options);
    if (proposal !== undefined) await f.write("openspec/changes/add-auth/proposal.md", proposal);
    await f.write("openspec/changes/add-auth/tasks.md", "- [ ] 1.1 a\n");
    return panelLines((await show(f.root)).lastFrame());
  }

  test("both lines present: id and Source label, then Blocked by:, then Triage:", async () => {
    const proposal = "# Proposal: Add auth\nBlocked by: walking-skeleton\nTriage: ready-for-agent\n\n## Why\n";
    expect(await panelFor(proposal)).toEqual(["add-auth  main", "Blocked by: walking-skeleton", "Triage: ready-for-agent", "  ○ 1.1 a"]);
  });

  test("lines absent: neither is shown", async () => {
    expect(await panelFor("# Proposal: Add auth\n\n## Why\n")).toEqual(["add-auth  main", "  ○ 1.1 a"]);
  });

  test("lines after the first ## heading are ignored", async () => {
    expect(await panelFor("# Add auth\n## Why\n```\nTriage: needs-info\n```\n")).toEqual(["add-auth  main", "  ○ 1.1 a"]);
  });

  test("only the first occurrence counts", async () => {
    expect(await panelFor("Blocked by: a\nBlocked by: b\n")).toEqual(["add-auth  main", "Blocked by: a", "  ○ 1.1 a"]);
  });

  test("a line must start with exactly the key", async () => {
    expect(await panelFor("blocked by: a\n Triage: x\n")).toEqual(["add-auth  main", "  ○ 1.1 a"]);
  });

  test("no proposal: id line and tasks only", async () => {
    expect(await panelFor(undefined)).toEqual(["add-auth  main", "  ○ 1.1 a"]);
  });

  test("a Project without Source labels shows the change id only", async () => {
    expect(await panelFor("Triage: ready-for-human\n", { git: false })).toEqual(["add-auth", "Triage: ready-for-human", "  ○ 1.1 a"]);
  });
});

describe("Task sections", () => {
  /** The frame of a Change `a` whose `tasks.md` is `tasks`. */
  async function frameFor(tasks: string) {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", tasks);
    return (await show(f.root)).lastFrame();
  }

  test("each ## heading is a section with its own progress above its tasks", async () => {
    const frame = await frameFor("# Tasks\n## 1. Read\n- [x] 1.1 a\n- [x] 1.2 b\n- [ ] 1.3 c\n\n## 2. Draw\n- [ ] 2.1 d\n- [ ] 2.2 e\n");
    expect(panelLines(frame)).toEqual([
      "a  main",
      "1. Read  2/3",
      "  ✓ 1.1 a",
      "  ✓ 1.2 b",
      "  ○ 1.3 c",
      "2. Draw  0/2",
      "  ○ 2.1 d",
      "  ○ 2.2 e",
    ]);
  });

  test("a ### heading stays in the ## section above it", async () => {
    const frame = await frameFor("## 1. Read\n- [x] 1.1 a\n### Edge cases\n- [ ] 1.2 b\n- [ ] 1.3 c\n");
    expect(panelLines(frame)).toEqual(["a  main", "1. Read  1/3", "  ✓ 1.1 a", "  ○ 1.2 b", "  ○ 1.3 c"]);
  });

  test("tasks before the first heading come first, without a heading line", async () => {
    const frame = await frameFor("- [ ] x\n- [ ] y\n## 1. Read\n- [ ] 1.1 a\n");
    expect(panelLines(frame)).toEqual(["a  main", "  ○ x", "  ○ y", "1. Read  0/1", "  ○ 1.1 a"]);
  });

  test("a heading without tasks is not shown", async () => {
    const frame = await frameFor("## 1. Read\n- [ ] 1.1 a\n## Notes\nSome prose.\n");
    expect(panelLines(frame)).toEqual(["a  main", "1. Read  0/1", "  ○ 1.1 a"]);
  });

  test("the sections' counts add up to the row's", async () => {
    const frame = await frameFor("- [x] x\n## 1. Read\n- [x] 1.1\n- [ ] 1.2\n## 2. Draw\n```md\n- [x] fenced\n```\n- [x] 2.1\n- [ ] 2.2\n  - [x] 2.2.1\n- [ ] 2.3\n### Edge\n* [ ] 2.4\n");
    expect(listLines(frame)[0]).toContain("5/9");
    const counts = panelLines(frame).flatMap((line) => /(\d+)\/(\d+)$/.exec(line)?.slice(1).map(Number) ?? []);
    expect(counts).toEqual([1, 2, 3, 6]);
    expect(panelLines(frame).filter((line) => line.startsWith("  ")).length).toBe(9);
  });

  test("a finished section's line shows a green ✓ before its progress", async () => {
    const frame = await frameFor("## 1. Read\n- [x] 1.1 a\n- [x] 1.2 b\n- [x] 1.3 c\n## 2. Draw\n- [ ] 2.1 d\n");
    expect(panelLines(frame)).toContain("1. Read  ✓ 3/3");
    expect(panelLines(frame)).toContain("2. Draw  0/1");
    expect(styledLine(frame, "1. Read")).toContain(GREEN("✓"));
  });
});

describe("Task lines", () => {
  test("a done task: green ✓ and dimmed text; an open task: dimmed ○", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "## 1. Read\n- [x] 1.1 Parse sections\n- [ ] 1.2 Draw panel\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "1. Read  1/2", "  ✓ 1.1 Parse sections", "  ○ 1.2 Draw panel"]);
    expect(styledLine(lastFrame(), "1.1 Parse")).toContain(`${GREEN("✓")} ${DIM("1.1 Parse sections")}`);
    expect(styledLine(lastFrame(), "1.2 Draw")).toContain(`${DIM("○")} 1.2 Draw panel`);
  });

  test("a nested task is indented as much more as in tasks.md", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1.2 top\n  - [ ] 1.2.1 nested\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame()).slice(1)).toEqual(["  ○ 1.2 top", "    ○ 1.2.1 nested"]);
  });

  test("a task wider than the panel takes one line ending in …", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", `- [ ] ${"x".repeat(200)}\n`);
    // `a  P S D T  <bar>  0/1  main` is 43 columns, so at 83 the panel beside it is 40, border and padding included.
    const { lastFrame } = await show(f.root, { columns: 83, rows: 20 });
    const panel = panelLines(lastFrame());
    expect(panel).toHaveLength(2);
    expect(panel[1]).toEndWith("x…");
    expect(panel[1]!.length).toBe(40 - 2);
  });

  test("lines under a task that are not tasks are not shown", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1.1 a\n  More about 1.1.\n- [ ] 1.2 b\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ○ 1.1 a", "  ○ 1.2 b"]);
  });
});

describe("Panel empty and error cases", () => {
  test("no tasks.md: No tasks.md", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "Triage: needs-triage\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "Triage: needs-triage", "No tasks.md"]);
  });

  test("a tasks.md without tasks: No tasks", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "## 1. Later\nNothing planned yet.\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "No tasks"]);
  });

  test.skipIf(process.getuid?.() === 0)("an error row selected: id, label and the full message, wrapped", async () => {
    const f = await fixture();
    await f.write("openspec/changes/broken/tasks.md", "- [x] a\n");
    await f.commit(sept(1));
    const wt = await f.worktree("wt-a", { branch: "wt-a" });
    await wt.write("openspec/changes/broken/tasks.md", "- [ ] b\n", sept(5));
    await chmod(join(wt.root, "openspec/changes/broken/tasks.md"), 0o000);
    const snapshot = await readProject(f.root);
    if (snapshot.kind !== "ok") throw new Error(snapshot.message);
    const error = snapshot.changes[0]!.versions.find((v) => v.kind === "error");
    if (error?.kind !== "error") throw new Error("expected an error version");
    // 70 columns puts the panel below the 68-column list, narrower than the message.
    const app = await show(f.root, { columns: 70, rows: 30 });
    await press(app, ENTER, "j");
    const [first, ...message] = panelLines(app.lastFrame());
    expect(first).toBe("broken  wt:wt-a");
    expect(message.length).toBeGreaterThan(1);
    expect(message.join("").replace(/\s/g, "")).toBe(error.message.replace(/\s/g, ""));
    expect(styledLine(app.lastFrame(), message[0]!)).toContain("\u001B[31m");
  });
});

/** Where the frame draws the panel: beside the list, below it, or nowhere. */
function placement(frame: string | undefined): "beside" | "below" | "none" {
  const lines = stripVTControlCharacters(frame ?? "").split("\n");
  if (lines.some((line) => BELOW.test(line))) return "below";
  return lines.some((line) => line.includes(BESIDE)) ? "beside" : "none";
}

describe("Panel placement", () => {
  /** A Change whose row, `<id>  P S D T  <bar>  0/1  main`, is 60 columns wide. */
  async function sixtyColumnList(size: Size) {
    const f = await fixture();
    await f.write(`openspec/changes/${"x".repeat(18)}/tasks.md`, "- [ ] 1.1 a\n");
    const app = await show(f.root, size);
    expect(listLines(app.lastFrame())[0]).toHaveLength(60);
    return app;
  }

  test("terminal at least list + 40 wide: beside the list", async () => {
    const app = await sixtyColumnList({ columns: 100, rows: 20 });
    expect(placement(app.lastFrame())).toBe("beside");
    expect(stripVTControlCharacters(app.lastFrame()!).split("\n")[0]!.indexOf(BESIDE)).toBe(60);
  });

  test("narrower: below the list, under a separating line", async () => {
    const app = await sixtyColumnList({ columns: 99, rows: 20 });
    expect(placement(app.lastFrame())).toBe("below");
    expect(panelLines(app.lastFrame())).toEqual([`${"x".repeat(18)}  main`, "  ○ 1.1 a"]);
  });

  test("follows a resize without a key", async () => {
    const app = await sixtyColumnList({ columns: 100, rows: 20 });
    await resize(app, { columns: 90, rows: 20 });
    expect(placement(app.lastFrame())).toBe("below");
    await resize(app, { columns: 100, rows: 20 });
    expect(placement(app.lastFrame())).toBe("beside");
  });
});

describe("Fitting the panel's height", () => {
  /** `## <heading>` with `done` ticked tasks of `total`, numbered `<n>.1` onwards. */
  const section = (heading: string, done: number, total: number) => {
    const n = heading.split(".")[0];
    const tasks = Array.from({ length: total }, (_, i) => `- [${i < done ? "x" : " "}] ${n}.${i + 1}\n`);
    return `## ${heading}\n${tasks.join("")}`;
  };

  /** Change `a` on `main` with `tasks` as its `tasks.md`, shown in a terminal of `size`. */
  async function showTasks(tasks: string, size: Size) {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", tasks);
    return show(f.root, size);
  }

  test("a short tasks file is shown in full", async () => {
    const app = await showTasks(section("1. Read", 3, 3) + section("2. Draw", 0, 3), { columns: 200, rows: 20 });
    expect(panelLines(app.lastFrame())).toEqual([
      "a  main",
      "1. Read  ✓ 3/3",
      "  ✓ 1.1",
      "  ✓ 1.2",
      "  ✓ 1.3",
      "2. Draw  0/3",
      "  ○ 2.1",
      "  ○ 2.2",
      "  ○ 2.3",
    ]);
  });

  test("finished sections collapse one at a time from the top until the lines fit", async () => {
    const app = await showTasks(section("1. Read", 3, 3) + section("2. Draw", 3, 3) + section("3. Close", 0, 3), { columns: 200, rows: 10 });
    expect(panelLines(app.lastFrame())).toEqual([
      "a  main",
      "1. Read  ✓ 3/3",
      "2. Draw  ✓ 3/3",
      "  ✓ 2.1",
      "  ✓ 2.2",
      "  ✓ 2.3",
      "3. Close  0/3",
      "  ○ 3.1",
      "  ○ 3.2",
      "  ○ 3.3",
    ]);
  });

  test("still too long after collapsing: cut with … N more", async () => {
    const app = await showTasks(section("1. Read", 3, 3) + section("2. Draw", 0, 8), { columns: 200, rows: 8 });
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "1. Read  ✓ 3/3", "2. Draw  0/8", "  ○ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "… 4 more"]);
  });

  test("a collapsed section below the cut counts its total", async () => {
    const app = await showTasks(section("1. Draw", 0, 8) + section("2. Read", 3, 3), { columns: 200, rows: 6 });
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "1. Draw  0/8", "  ○ 1.1", "  ○ 1.2", "  ○ 1.3", "… 8 more"]);
  });

  test("below a list that fills the terminal: the first line and … N more", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1\n- [ ] 2\n- [ ] 3\n", sept(9));
    for (const id of ["b", "c", "d"]) await f.write(`openspec/changes/${id}/proposal.md`, "", sept(1));
    const app = await show(f.root, { columns: 60, rows: 4 });
    expect(placement(app.lastFrame())).toBe("below");
    expect(listLines(app.lastFrame())).toHaveLength(4);
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 3 more"]);
  });

  test("no task below the cut: … alone", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "Blocked by: b\nTriage: ready-for-human\n");
    const app = await show(f.root, { columns: 60, rows: 1 });
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "…"]);
  });

  test("a terminal made shorter collapses and cuts without a key", async () => {
    const app = await showTasks(section("1. Read", 3, 3) + section("2. Draw", 0, 8), { columns: 200, rows: 20 });
    expect(panelLines(app.lastFrame())).toHaveLength(14);
    await resize(app, { columns: 200, rows: 8 });
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "1. Read  ✓ 3/3", "2. Draw  0/8", "  ○ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "… 4 more"]);
  });
});
