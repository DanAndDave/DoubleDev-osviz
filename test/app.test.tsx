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
const YELLOW = (s: string) => `\u001B[33m${s}\u001B[39m`;

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
 * Renders the dashboard for the Projects at `paths`, each labelled with its path and read with `base`
 * as `--base`, in a terminal of `size` and lets Ink finish its frame. Every read the dashboard starts
 * is recorded in `reads`; `refreshed()` waits for them and the frame that follows.
 */
async function show(paths: string | string[], size: Size = ROOMY, { base }: { base?: string } = {}) {
  const reads: Promise<ProjectSnapshot>[] = [];
  const projects = await Promise.all(
    [paths].flat().map(async (path) => {
      const read = () => {
        const reading = readProject(path, { base });
        reads.push(reading);
        return reading;
      };
      return { label: path, initial: await readProject(path, { base }), read };
    }),
  );
  const app = render(<App projects={projects} />);
  await settle();
  await resize(app, size);
  const refreshed = async () => {
    await Promise.all(reads);
    await settle();
  };
  return { ...app, reads, refreshed };
}

/** `text` as one line of `width` columns: cut and ending in `…` when longer. */
function cut(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
}

/** The list's narrowest width. */
const LIST_MIN_WIDTH = 40;

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
const TAB = "\t";
const CYAN = "\u001B[36m";

/** The list rows drawn in inverse video, styling removed. */
function selectedLines(frame: string | undefined): string[] {
  const list = split(frame).list;
  return (frame ?? "").split("\n").flatMap((line, i) => (line.includes(INVERSE) ? [list[i]!] : []));
}

/** Ids of the rows drawn in inverse video. */
function selected(frame: string | undefined): string[] {
  return selectedLines(frame).map((line) => line.split(" ")[0]!);
}

/** Ids of the list's rows; headers keep their full text. */
function ids(frame: string | undefined): string[] {
  return listLines(frame).map((line) => line.split(" ")[0]!);
}

/** The `done/total` progress of each Change row in the list. */
function progress(frame: string | undefined): string[] {
  return listLines(frame).flatMap((line) => /\d+\/\d+/.exec(line) ?? []);
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

/** A git fixture with one Change `id` on `main`, committed at `date`. */
async function oneChange(id: string, date = sept(1)) {
  const f = await fixture();
  await f.write(`openspec/changes/${id}/proposal.md`);
  await f.commit(date);
  return f;
}

/** A git fixture whose only Change is archived, so it has no active Changes. */
async function noActiveChanges() {
  const f = await fixture();
  await f.write("openspec/changes/archive/2026-08-01-old/proposal.md");
  return f;
}

describe("Project header rows", () => {
  test("two Projects: each header in bold, then its rows, in command-line order", async () => {
    const web = await oneChange("login");
    const api = await oneChange("rate-limit");
    const { lastFrame } = await show([web.root, api.root]);
    expect(listLines(lastFrame())).toEqual([
      web.root,
      `login       P S D T  ${"░".repeat(20)}  0/0  main`,
      api.root,
      `rate-limit  P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    expect(styledLine(lastFrame(), web.root)).toContain(BOLD(web.root));
  });

  test("Projects are not interleaved by Change time", async () => {
    const web = await oneChange("older", sept(1));
    const api = await oneChange("newer", sept(5));
    const { lastFrame } = await show([web.root, api.root]);
    expect(ids(lastFrame())).toEqual([web.root, "older", api.root, "newer"]);
  });

  test("one Project has no header", async () => {
    const web = await oneChange("login");
    const { lastFrame } = await show(web.root);
    expect(listLines(lastFrame())).toEqual([`login  P S D T  ${"░".repeat(20)}  0/0  main`]);
  });

  test("a Project without active changes: its header, then No active changes", async () => {
    const web = await oneChange("login");
    const api = await noActiveChanges();
    const { lastFrame } = await show([web.root, api.root]);
    expect(listLines(lastFrame())).toEqual([web.root, `login  P S D T  ${"░".repeat(20)}  0/0  main`, api.root, "No active changes"]);
  });

  test("columns line up across Projects", async () => {
    const web = await fixture();
    await web.write("openspec/changes/a/tasks.md", TASKS(10, 12));
    const api = await fixture();
    await api.write("openspec/changes/rate-limit/tasks.md", TASKS(1, 2));
    const { lastFrame } = await show([web.root, api.root]);
    expect(listLines(lastFrame())).toEqual([
      web.root,
      `a           P S D T  ${"█".repeat(16)}${"░".repeat(4)}  10/12  main`,
      api.root,
      `rate-limit  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  1/2    main`,
    ]);
  });

  test("a header wider than the list is cut to it, ending in …", async () => {
    const web = await oneChange("a");
    const label = `${web.root}/${"x".repeat(80)}/..`;
    const api = await oneChange("b");
    const projects = await Promise.all(
      [
        { label, path: web.root },
        { label: api.root, path: api.root },
      ].map(async ({ label, path }) => ({ label, initial: await readProject(path), read: () => readProject(path) })),
    );
    const app = render(<App projects={projects} />);
    await resize(app, ROOMY);
    const [header, row] = listLines(app.lastFrame());
    expect(row).toBe(`a  P S D T  ${"░".repeat(20)}  0/0  main`);
    expect(header).toHaveLength(row!.length);
    expect(header).toStartWith(web.root);
    expect(header).toEndWith("x…");
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
    expect(ids(app.lastFrame())).toEqual(["fresh", "live"]);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([
      `fresh      P S D T  ${"░".repeat(20)}  0/0  main`,
      `old-thing  P S D T  ${"░".repeat(20)}  0/0  main  archived`,
      `live       P S D T  ${"░".repeat(20)}  0/0  main`,
    ]);
    expect(styledLine(app.lastFrame(), "old-thing")).toContain(DIM("archived"));
    await press(app, "a");
    expect(ids(app.lastFrame())).toEqual(["fresh", "live"]);
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

  test("a shows archived Changes in every Project, each under its own header", async () => {
    const web = await fixture();
    await web.write("openspec/changes/archive/2026-08-01-old-web/proposal.md");
    const api = await fixture();
    await api.write("openspec/changes/archive/2026-08-01-old-api/proposal.md");
    const app = await show([web.root, api.root]);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([
      web.root,
      `old-web  P S D T  ${"░".repeat(20)}  0/0  main  archived`,
      api.root,
      `old-api  P S D T  ${"░".repeat(20)}  0/0  main  archived`,
    ]);
  });

  test("hiding a selected archived Change in a later Project selects the first selectable row", async () => {
    const web = await oneChange("login");
    const api = await fixture();
    await api.write("openspec/changes/archive/2026-08-01-old-api/proposal.md");
    await api.write("openspec/changes/rate-limit/proposal.md");
    await api.commit(sept(1));
    const app = await show([web.root, api.root]);
    await press(app, "a", "j");
    expect(selected(app.lastFrame())).toEqual(["old-api"]);
    await press(app, "a");
    expect(selected(app.lastFrame())).toEqual(["login"]);
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

/** `done` ticked tasks, then `total - done` unticked ones of which the last is a Blocked task. */
const BLOCKED_TASKS = (done: number, total: number) => `${TASKS(done, total - 1)}- [ ] t — \`blocked\`\n`;

describe("Blocked marker", () => {
  test("a Blocked task in the Headline version: the row ends with a yellow blocked marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", BLOCKED_TASKS(2, 5));
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  2/5  main  blocked`]);
    expect(styledLine(lastFrame(), "add-auth")).toContain(YELLOW("blocked"));
  });

  test("no Blocked task: no blocked marker", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(2, 5));
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(8)}${"░".repeat(12)}  2/5  main`]);
  });

  test("Blocked only in an older version: collapsed row unmarked, expanded only that version's row marked", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", BLOCKED_TASKS(1, 4));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(2, 4), sept(5));
    const app = await show(f.root);
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  2/4  wt:wt-auth  +1`]);
    await press(app, ENTER);
    expect(listLines(app.lastFrame())).toEqual([
      `add-auth  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  2/4  wt:wt-auth`,
      `add-auth  P S D T  ${"█".repeat(5)}${"░".repeat(15)}  1/4  main  blocked`,
    ]);
  });

  test("archived with a Blocked task: archived marker only", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/tasks.md", BLOCKED_TASKS(1, 2));
    const app = await show(f.root);
    await press(app, "a");
    expect(listLines(app.lastFrame())).toEqual([`old-thing  P S D T  ${"█".repeat(10)}${"░".repeat(10)}  1/2  main  archived`]);
  });

  test("a blocked Change keeps its place by Change time", async () => {
    const f = await fixture();
    await f.write("openspec/changes/free/tasks.md", TASKS(0, 1));
    await f.commit(sept(1));
    await f.write("openspec/changes/blocked-one/tasks.md", BLOCKED_TASKS(0, 1));
    await f.commit(sept(5));
    const { lastFrame } = await show(f.root);
    expect(ids(lastFrame())).toEqual(["blocked-one", "free"]);
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
    expect(ids(lastFrame())).toEqual(["new-change", "old-change"]);
  });

  test("equal Change times are ordered by id", async () => {
    const f = await fixture();
    for (const id of ["charlie", "alpha", "bravo"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(ids(lastFrame())).toEqual(["alpha", "bravo", "charlie"]);
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

  test("starts on the first Change, below the first header", async () => {
    const app = await show([(await oneChange("login")).root, (await oneChange("rate-limit")).root]);
    expect(selected(app.lastFrame())).toEqual(["login"]);
  });

  test("j crosses a Project boundary to the next Project's first Change", async () => {
    const app = await show([(await oneChange("login")).root, (await oneChange("rate-limit")).root]);
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
    await press(app, "k");
    expect(selected(app.lastFrame())).toEqual(["login"]);
  });

  test("j skips a Project without rows to select", async () => {
    const app = await show([(await oneChange("login")).root, (await noActiveChanges()).root, (await oneChange("rate-limit")).root]);
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
  });

  test("a Project error row can be selected", async () => {
    const gone = await fixture({ git: false });
    const app = await show([(await oneChange("login")).root, gone.root]);
    await press(app, "j");
    expect(selectedLines(app.lastFrame())).toEqual([listLines(app.lastFrame())[3]!]);
    expect(selected(app.lastFrame())).toEqual(["✗"]);
  });

  test("nothing to select: no row highlighted", async () => {
    const app = await show([(await noActiveChanges()).root, (await noActiveChanges()).root]);
    await press(app, "j");
    expect(listLines(app.lastFrame()).filter((line) => line === "No active changes")).toHaveLength(2);
    expect(selectedLines(app.lastFrame())).toEqual([]);
  });
});

describe("List scrolling", () => {
  /** One Project without git whose Changes `ids` are newest first. */
  async function newestFirst(ids: string[]) {
    const f = await fixture({ git: false });
    for (const [i, id] of ids.entries()) await f.write(`openspec/changes/${id}/proposal.md`, "", sept(28 - i));
    return f;
  }

  /** `c01` … `c<n>`. */
  const cs = (n: number) => Array.from({ length: n }, (_, i) => `c${String(i + 1).padStart(2, "0")}`);

  /** Four list rows, the panel beside the list. */
  const FOUR_ROWS: Size = { columns: 200, rows: 4 };

  test("the window moves just far enough to show a selection below it, and stays while the selection is shown", async () => {
    const app = await show((await newestFirst(cs(10))).root, FOUR_ROWS);
    expect(ids(app.lastFrame())).toEqual(["c01", "c02", "c03", "c04"]);
    await press(app, "j", "j", "j", "j", "j");
    expect(selected(app.lastFrame())).toEqual(["c06"]);
    expect(ids(app.lastFrame())).toEqual(["c03", "c04", "c05", "c06"]);
    await press(app, "k", "k", "k");
    expect(selected(app.lastFrame())).toEqual(["c03"]);
    expect(ids(app.lastFrame())).toEqual(["c03", "c04", "c05", "c06"]);
  });

  test("the window moves just far enough to show a selection above it", async () => {
    const app = await show((await newestFirst(cs(10))).root, FOUR_ROWS);
    await press(app, "j", "j", "j", "j", "j", "k", "k", "k", "k");
    expect(selected(app.lastFrame())).toEqual(["c02"]);
    expect(ids(app.lastFrame())).toEqual(["c02", "c03", "c04", "c05"]);
  });

  test("a short list does not scroll", async () => {
    const app = await show((await newestFirst(cs(3))).root, FOUR_ROWS);
    await press(app, "j", "j");
    expect(ids(app.lastFrame())).toEqual(["c01", "c02", "c03"]);
  });

  test("crossing into the next Project shows its header; going back shows the first Project's header", async () => {
    const web = await newestFirst(["w1", "w2", "w3"]);
    const api = await newestFirst(["a1", "a2", "a3"]);
    const app = await show([web.root, api.root], FOUR_ROWS);
    await press(app, "j", "j", "j");
    expect(selected(app.lastFrame())).toEqual(["a1"]);
    expect(ids(app.lastFrame())).toEqual(["w2", "w3", api.root, "a1"]);
    await press(app, "j", "j");
    expect(selected(app.lastFrame())).toEqual(["a3"]);
    await press(app, "k", "k", "k", "k", "k");
    expect(selected(app.lastFrame())).toEqual(["w1"]);
    expect(ids(app.lastFrame())).toEqual([web.root, "w1", "w2", "w3"]);
  });

  test("the window stays while the selection is shown, even with the selected Project's header above it", async () => {
    const web = await newestFirst(["w1"]);
    const api = await newestFirst(["a1", "a2", "a3", "a4", "a5"]);
    const app = await show([web.root, api.root], FOUR_ROWS);
    await press(app, "j", "j", "j", "j");
    expect(ids(app.lastFrame())).toEqual(["a1", "a2", "a3", "a4"]);
    await press(app, "k", "k", "k");
    expect(selected(app.lastFrame())).toEqual(["a1"]);
    expect(ids(app.lastFrame())).toEqual(["a1", "a2", "a3", "a4"]);
  });

  test("a taller terminal shows more rows without a key, keeping the selection", async () => {
    const app = await show((await newestFirst(cs(10))).root, FOUR_ROWS);
    await press(app, "j", "j", "j", "j", "j");
    expect(ids(app.lastFrame())).toEqual(["c03", "c04", "c05", "c06"]);
    await resize(app, { columns: 200, rows: 12 });
    expect(ids(app.lastFrame())).toEqual(cs(10));
    expect(selected(app.lastFrame())).toEqual(["c06"]);
  });
});

describe("Error rows", () => {
  test("a path without openspec/ shows a single error row", async () => {
    const f = await fixture({ git: false });
    const { lastFrame } = await show(f.root);
    expect(listLines(lastFrame())).toEqual([cut(`✗ no openspec/ folder found at ${f.root}`, LIST_MIN_WIDTH)]);
  });

  test("a path that does not exist shows a single error row", async () => {
    const f = await fixture({ git: false });
    const missing = join(f.root, "nope");
    const { lastFrame } = await show(missing);
    expect(listLines(lastFrame())).toEqual([cut(`✗ path does not exist: ${missing}`, LIST_MIN_WIDTH)]);
  });

  test("one Project unreadable: its header, then one error row cut to the list; the others shown normally", async () => {
    const web = await fixture();
    await web.write("openspec/changes/login/proposal.md");
    const empty = await fixture({ git: false });
    const { lastFrame } = await show([web.root, empty.root]);
    const login = `login  P S D T  ${"░".repeat(20)}  0/0  main`;
    expect(listLines(lastFrame())).toEqual([web.root, login, empty.root, cut(`✗ no openspec/ folder found at ${empty.root}`, login.length)]);
    expect(styledLine(lastFrame(), "✗ no openspec/")).toContain("\u001B[31m");
  });

  test("--base missing in one Project: that Project's error row names the ref, the other uses it as its Base", async () => {
    const web = await fixture();
    await web.write("openspec/changes/login/proposal.md");
    await web.commit(sept(1));
    await web.git("checkout", "-q", "-b", "develop");
    const api = await fixture();
    await api.write("openspec/changes/rate-limit/proposal.md");
    await api.commit(sept(1));
    const { lastFrame } = await show([web.root, api.root], ROOMY, { base: "develop" });
    const login = `login  P S D T  ${"░".repeat(20)}  0/0  develop`;
    expect(listLines(lastFrame())).toEqual([web.root, login, api.root, "✗ unknown --base ref: develop"]);
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
    const app = render(<App projects={[{ label: f.root, initial: snapshot, read: async () => snapshot }]} />);
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

  test("the same change id in two Projects expands separately", async () => {
    /** A Project whose `add-auth` has a version on `main` (1/2) and a newer one on `feat` (2/2). */
    async function twoVersions() {
      const f = await fixture();
      await f.write("openspec/changes/add-auth/tasks.md", TASKS(1, 2));
      await f.commit(sept(1));
      await f.git("checkout", "-q", "-b", "feat");
      await f.write("openspec/changes/add-auth/tasks.md", TASKS(2, 2));
      await f.commit(sept(3));
      await f.git("checkout", "-q", "main");
      return f;
    }
    const web = await twoVersions();
    const api = await twoVersions();
    const app = await show([web.root, api.root]);
    await press(app, ENTER);
    expect(listLines(app.lastFrame()).map((line) => line.replace(/ +/g, " "))).toEqual([
      web.root,
      `add-auth P S D T ${"█".repeat(20)} 2/2 feat ✓ ready to archive`,
      `add-auth P S D T ${"█".repeat(10)}${"░".repeat(10)} 1/2 main`,
      api.root,
      `add-auth P S D T ${"█".repeat(20)} 2/2 feat +1 ✓ ready to archive`,
    ]);
  });

  test("Enter on a Project error row changes nothing", async () => {
    const app = await show([(await oneChange("login")).root, (await fixture({ git: false })).root]);
    await press(app, "j");
    const before = app.lastFrame();
    await press(app, ENTER);
    expect(app.lastFrame()).toBe(before);
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
        <App projects={[{ label: f.root, initial: await readProject(f.root), read: () => readProject(f.root) }]} />
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
    expect(listLines(app.lastFrame())).toEqual([cut(`✗ no openspec/ folder found at ${f.root}`, LIST_MIN_WIDTH)]);
    await rename(join(f.root, "moved"), join(f.root, "openspec"));
    await refresh(app);
    expect(listLines(app.lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(6)}${"░".repeat(14)}  3/10  main`]);
  });

  test("one Project breaking shows its error row; the other Project's rows are unchanged", async () => {
    const web = await oneChange("login");
    const api = await oneChange("rate-limit");
    const app = await show([web.root, api.root]);
    await rename(join(api.root, "openspec"), join(api.root, "moved"));
    await refresh(app);
    const login = `login  P S D T  ${"░".repeat(20)}  0/0  main`;
    expect(listLines(app.lastFrame())).toEqual([web.root, login, api.root, cut(`✗ no openspec/ folder found at ${api.root}`, login.length)]);
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
    expect(ids(app.lastFrame())).toEqual(["newer", "fix-login", "old"]);
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

  test("every Project is re-read", async () => {
    const web = await fixture();
    await web.write("openspec/changes/login/tasks.md", TASKS(1, 4));
    const api = await fixture();
    await api.write("openspec/changes/rate-limit/tasks.md", TASKS(1, 4));
    const app = await show([web.root, api.root]);
    await web.write("openspec/changes/login/tasks.md", TASKS(2, 4));
    await api.write("openspec/changes/rate-limit/tasks.md", TASKS(3, 4));
    await advance(5000);
    await app.refreshed();
    expect(progress(app.lastFrame())).toEqual(["2/4", "3/4"]);
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
    const app = render(<App projects={[{ label: f.root, initial: await readProject(f.root), read }]} />);
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

  /** Two Projects, `login` in `web` (1/4) and `rate-limit` in `api` (1/4): reads of `web` wait until the test resolves them from `pending`; reads of `api` are real. */
  async function slowWeb() {
    const web = await fixture();
    await web.write("openspec/changes/login/tasks.md", TASKS(1, 4));
    const api = await fixture();
    await api.write("openspec/changes/rate-limit/tasks.md", TASKS(1, 4));
    const pending: ((snapshot: ProjectSnapshot) => void)[] = [];
    const slow = () => {
      const { promise, resolve } = Promise.withResolvers<ProjectSnapshot>();
      pending.push(resolve);
      return promise;
    };
    const apiReads: Promise<ProjectSnapshot>[] = [];
    const fast = () => {
      const reading = readProject(api.root);
      apiReads.push(reading);
      return reading;
    };
    const app = render(
      <App
        projects={[
          { label: web.root, initial: await readProject(web.root), read: slow },
          { label: api.root, initial: await readProject(api.root), read: fast },
        ]}
      />,
    );
    await resize(app, ROOMY);
    const apiRead = async () => {
      await Promise.all(apiReads);
      await settle();
    };
    return { web, api, app, pending, apiReads, apiRead };
  }

  test("a slow Project does not hold up another: its rows show the previous read meanwhile", async () => {
    const { web, api, app, pending, apiRead } = await slowWeb();
    await web.write("openspec/changes/login/tasks.md", TASKS(2, 4));
    await api.write("openspec/changes/rate-limit/tasks.md", TASKS(3, 4));
    await press(app, "r");
    await apiRead();
    expect(pending).toHaveLength(1);
    expect(progress(app.lastFrame())).toEqual(["1/4", "3/4"]);
    pending[0]!(await readProject(web.root));
    // The read's dispatch runs on the next turn; its frame then waits out Ink's 30fps throttle.
    await settle();
    await advance(50);
    expect(progress(app.lastFrame())).toEqual(["2/4", "3/4"]);
  });

  test("a tick during a slow Project's read skips it and still reads the others", async () => {
    const { pending, apiReads, apiRead } = await slowWeb();
    await advance(5000);
    await apiRead();
    await advance(5000);
    await apiRead();
    expect(pending).toHaveLength(1);
    expect(apiReads).toHaveLength(2);
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
    expect(ids(app.lastFrame())).toEqual(["bravo", "alpha"]);
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
    expect(ids(app.lastFrame())).toEqual(["add-auth", "zeta"]);
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
    expect(ids(app.lastFrame())).toEqual(["alpha", "charlie"]);
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
    expect(ids(app.lastFrame())).toEqual(["newer", "older"]);
    expect(selected(app.lastFrame())).toEqual(["older"]);
  });

  test("rows added in a Project above keep the selected row selected", async () => {
    const web = await oneChange("login", sept(1));
    const api = await oneChange("rate-limit");
    const app = await show([web.root, api.root]);
    await press(app, "j");
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
    await web.write("openspec/changes/fix-nav/proposal.md");
    await web.commit(sept(5));
    await refresh(app);
    expect(ids(app.lastFrame())).toEqual([web.root, "fix-nav", "login", api.root, "rate-limit"]);
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
  });

  test("the selected Project's error row, once the Project is readable, gives way to its first Change", async () => {
    const web = await oneChange("login");
    const api = await oneChange("rate-limit");
    await rename(join(web.root, "openspec"), join(web.root, "moved"));
    const app = await show([web.root, api.root]);
    expect(selected(app.lastFrame())).toEqual(["✗"]);
    await rename(join(web.root, "moved"), join(web.root, "openspec"));
    await refresh(app);
    expect(selected(app.lastFrame())).toEqual(["login"]);
  });

  test("the selected Project's last Change gone: No active changes, and the next Project's first Change is selected", async () => {
    const web = await oneChange("login");
    const api = await oneChange("rate-limit");
    const app = await show([web.root, api.root]);
    await rm(join(web.root, "openspec/changes/login"), { recursive: true });
    await refresh(app);
    expect(listLines(app.lastFrame()).slice(0, 2)).toEqual([web.root, "No active changes"]);
    expect(selected(app.lastFrame())).toEqual(["rate-limit"]);
  });

  test("the selected last Change of a Project gone: the Project's new last Change, not the next Project's", async () => {
    const web = await fixture({ git: false });
    for (const [id, date] of [["alpha", sept(5)], ["bravo", sept(3)], ["charlie", sept(1)]] as const) await web.write(`openspec/changes/${id}/proposal.md`, "", date);
    const api = await oneChange("rate-limit");
    const app = await show([web.root, api.root]);
    await press(app, "j", "j");
    expect(selected(app.lastFrame())).toEqual(["charlie"]);
    await rm(join(web.root, "openspec/changes/charlie"), { recursive: true });
    await refresh(app);
    expect(selected(app.lastFrame())).toEqual(["bravo"]);
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
    const f = await noActiveChanges();
    const { lastFrame } = await show(f.root);
    expect(stripVTControlCharacters(lastFrame() ?? "")).toBe("No active changes");
  });

  test("Project error: its row is selected and the panel shows the Project's path and error", async () => {
    const f = await fixture({ git: false });
    const { lastFrame } = await show(f.root);
    expect(selected(lastFrame())).toEqual(["✗"]);
    expect(panelLines(lastFrame())).toEqual([f.root, `no openspec/ folder found at ${f.root}`]);
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

  test("a Blocked task: yellow ⊘ and its text undimmed, as written", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "## 1. Read\n- [ ] 1.3 Wire the API — `blocked` — waits on 57\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "1. Read  0/1", "  ⊘ 1.3 Wire the API — `blocked` — waits on 57"]);
    expect(styledLine(lastFrame(), "1.3 Wire")).toContain(`${YELLOW("⊘")} 1.3 Wire the API — \`blocked\` — waits on 57`);
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

describe("Blocked tasks", () => {
  test("a status token at the end makes an unticked task blocked; it counts as open", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] [01 Confine the sandbox](issues/01-confine.md) — `blocked`\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ⊘ [01 Confine the sandbox](issues/01-confine.md) — `blocked`"]);
    expect(progress(lastFrame())).toEqual(["0/1"]);
  });

  test("a note after the status token keeps the task blocked", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] [03 Admit a worker tier](issues/03-admit.md) — `blocked` — the writing tier\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ⊘ [03 Admit a worker tier](issues/03-admit.md) — `blocked` — the writing tier"]);
  });

  test("trailing whitespace after the status token is ignored", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 2.1 Wire the API — `blocked`  \n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ⊘ 2.1 Wire the API — `blocked`"]);
  });

  test("a ticked task is not blocked and counts as done", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [x] 2.1 Wire the API — `blocked`\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ✓ 2.1 Wire the API — `blocked`"]);
    expect(progress(lastFrame())).toEqual(["1/1"]);
  });

  test("blocked as a dependency note after another status is not blocked", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] [05 Correct the seams](issues/05-correct.md) — `ready-for-agent` — blocked by 04\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ○ [05 Correct the seams](issues/05-correct.md) — `ready-for-agent` — blocked by 04"]);
  });

  test("plain word, hyphen, capital B and a glued period are not blocked", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 2.1 a — blocked\n- [ ] 2.2 b - `blocked`\n- [ ] 2.3 c — `Blocked`\n- [ ] 2.4 d — `blocked`.\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ○ 2.1 a — blocked", "  ○ 2.2 b - `blocked`", "  ○ 2.3 c — `Blocked`", "  ○ 2.4 d — `blocked`."]);
  });

  test("issues/ with status: blocked does not make a task blocked", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/issues/01-api.md", "---\nstatus: blocked\n---\n# Wire the API\n");
    await f.write("openspec/changes/a/tasks.md", "- [ ] 2.1 Wire the API\n");
    const { lastFrame } = await show(f.root);
    expect(panelLines(lastFrame())).toEqual(["a  main", "  ○ 2.1 Wire the API"]);
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

  test("a Project error row selected: the path as given, then the full message, wrapped", async () => {
    const web = await oneChange("login");
    const empty = join((await fixture({ git: false })).root, "x".repeat(80));
    await mkdir(empty);
    // 70 columns puts the panel below the 43-column list, narrower than the message.
    const app = await show([web.root, empty], { columns: 70, rows: 30 });
    await press(app, "j");
    const [first, ...message] = panelLines(app.lastFrame());
    expect(first).toBe(cut(empty, 69));
    expect(message.length).toBeGreaterThan(1);
    expect(message.join("").replace(/\s/g, "")).toBe(`no openspec/ folder found at ${empty}`.replace(/\s/g, ""));
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

/** Whether the panel's border is drawn in cyan, beside or below the list. */
function panelFocused(frame: string | undefined): boolean {
  return [`${CYAN}│`, `${CYAN}─`].some((border) => (frame ?? "").includes(border));
}

describe("Panel focus", () => {
  /** Changes `a` (newest, with one open task) and `b`. */
  async function twoChanges() {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1.1\n", sept(2));
    await f.write("openspec/changes/b/tasks.md", "- [ ] 1.1\n", sept(1));
    return show(f.root);
  }

  test("starts on the list: the panel's border is not cyan", async () => {
    const app = await twoChanges();
    expect(placement(app.lastFrame())).toBe("beside");
    expect(panelFocused(app.lastFrame())).toBe(false);
  });

  test("Tab moves Focus to the panel, drawing its border cyan, and back", async () => {
    const app = await twoChanges();
    await press(app, TAB);
    expect(panelFocused(app.lastFrame())).toBe(true);
    await press(app, TAB);
    expect(panelFocused(app.lastFrame())).toBe(false);
  });

  test("a panel below the list is drawn cyan too", async () => {
    const app = await twoChanges();
    await resize(app, { columns: 60, rows: 20 });
    await press(app, TAB);
    expect(placement(app.lastFrame())).toBe("below");
    expect(panelFocused(app.lastFrame())).toBe(true);
  });

  test("no panel: Tab changes nothing", async () => {
    const app = await show((await noActiveChanges()).root);
    const before = app.lastFrame();
    await press(app, TAB);
    expect(app.lastFrame()).toBe(before);
    expect(placement(app.lastFrame())).toBe("none");
  });

  test("j and k leave the selection alone while the panel has Focus", async () => {
    const app = await twoChanges();
    await press(app, TAB, "j", DOWN);
    expect(selected(app.lastFrame())).toEqual(["a"]);
    await press(app, TAB, "j");
    expect(selected(app.lastFrame())).toEqual(["b"]);
    await press(app, TAB, "k", UP);
    expect(selected(app.lastFrame())).toEqual(["b"]);
  });

  test("a and r act as before while the panel has Focus", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1.1\n", sept(2));
    await f.write("openspec/changes/archive/2026-09-01-old/proposal.md", "", sept(1));
    const app = await show(f.root);
    await press(app, TAB, "a");
    expect(ids(app.lastFrame())).toEqual(["a", "old"]);
    await f.write("openspec/changes/a/tasks.md", "- [x] 1.1\n", sept(3));
    await refresh(app);
    expect(progress(app.lastFrame())).toEqual(["1/1", "0/0"]);
    expect(panelFocused(app.lastFrame())).toBe(true);
  });

  test("Enter expands the selected Change while the panel has Focus", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/tasks.md", TASKS(3, 8));
    await f.commit(sept(1));
    const wt = await f.worktree("wt-auth", { branch: "add-auth" });
    await wt.write("openspec/changes/add-auth/tasks.md", TASKS(8, 8), sept(5));
    const app = await show(f.root);
    await press(app, TAB, ENTER);
    expect(ids(app.lastFrame())).toEqual(["add-auth", "add-auth"]);
    expect(panelFocused(app.lastFrame())).toBe(true);
  });

  test("Focus returns to the list when the panel goes away", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1.1\n", sept(2));
    const app = await show(f.root);
    await press(app, TAB);
    await rm(join(f.root, "openspec/changes/a"), { recursive: true });
    await refresh(app);
    expect(placement(app.lastFrame())).toBe("none");
    await f.write("openspec/changes/b/tasks.md", "- [ ] 1.1\n", sept(3));
    await refresh(app);
    expect(panelFocused(app.lastFrame())).toBe(false);
  });
});

/** `## <heading>` with `done` ticked tasks of `total`, numbered `<n>.1` onwards. */
function section(heading: string, done: number, total: number): string {
  const n = heading.split(".")[0];
  const tasks = Array.from({ length: total }, (_, i) => `- [${i < done ? "x" : " "}] ${n}.${i + 1}\n`);
  return `## ${heading}\n${tasks.join("")}`;
}

/** Change `a` on `main` with `tasks` as its `tasks.md`, shown in a terminal of `size`. */
async function showTasks(tasks: string, size: Size) {
  const f = await fixture();
  await f.write("openspec/changes/a/tasks.md", tasks);
  return { ...(await show(f.root, size)), f };
}

describe("Fitting the panel's height", () => {
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

  test("below a list that fills the terminal: the list scrolls and the panel keeps the last two rows", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1\n- [ ] 2\n- [ ] 3\n", sept(9));
    for (const id of ["b", "c", "d", "e", "f", "g", "h", "i", "j"]) await f.write(`openspec/changes/${id}/proposal.md`, "", sept(1));
    const app = await show(f.root, { columns: 60, rows: 7 });
    expect(placement(app.lastFrame())).toBe("below");
    expect(ids(app.lastFrame())).toEqual(["a", "b", "c", "d"]);
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 3 more"]);
    expect(stripVTControlCharacters(app.lastFrame()!).split("\n")).toHaveLength(7);
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

describe("Scrolling the panel", () => {
  const READ_AND_DRAW = section("1. Read", 3, 3) + section("2. Draw", 0, 8);
  const AT_TOP = ["a  main", "1. Read  ✓ 3/3", "2. Draw  0/8", "  ○ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "… 4 more"];
  const AT_END = ["a  main", "… 5 above", "  ○ 2.3", "  ○ 2.4", "  ○ 2.5", "  ○ 2.6", "  ○ 2.7", "  ○ 2.8"];

  test("j with the panel focused scrolls one line down, keeping the first line", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 3 above", "  ○ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "  ○ 2.5", "… 3 more"]);
    expect(styledLine(app.lastFrame(), "… 3 above")).toContain(DIM("… 3 above"));
  });

  test("the down arrow scrolls until the last line is shown, then stops", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, DOWN, DOWN, DOWN);
    expect(panelLines(app.lastFrame())).toEqual(AT_END);
    await press(app, "j");
    expect(panelLines(app.lastFrame())).toEqual(AT_END);
  });

  test("k and the up arrow scroll back to the top, then stop", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, "j", "j", "j", "k", UP, "k");
    expect(panelLines(app.lastFrame())).toEqual(AT_TOP);
    await press(app, "k");
    expect(panelLines(app.lastFrame())).toEqual(AT_TOP);
  });

  test("… N above counts the tasks it hides", async () => {
    const app = await showTasks(section("1. Draw", 0, 8), { columns: 200, rows: 6 });
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 1 above", "  ○ 1.2", "  ○ 1.3", "  ○ 1.4", "… 4 more"]);
  });

  test("lines above holding no task: … alone", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "Blocked by: b\nTriage: ready-for-human\n");
    await f.write("openspec/changes/a/tasks.md", "- [ ] 1\n- [ ] 2\n- [ ] 3\n- [ ] 4\n");
    const app = await show(f.root, { columns: 200, rows: 5 });
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "…", "  ○ 1", "  ○ 2", "… 2 more"]);
  });

  test("a panel whose lines fit does not scroll", async () => {
    const app = await showTasks(section("1. Read", 3, 3) + section("2. Draw", 0, 3), { columns: 200, rows: 20 });
    const before = panelLines(app.lastFrame());
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(before);
  });

  test("a panel with fewer than three rows below its first line does not scroll", async () => {
    const app = await showTasks(section("1. Draw", 0, 8), { columns: 200, rows: 3 });
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "1. Draw  0/8", "… 8 more"]);
  });

  test("selecting another row returns the panel to its top", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/tasks.md", READ_AND_DRAW, sept(2));
    await f.write("openspec/changes/b/tasks.md", "- [ ] 1\n", sept(1));
    const app = await show(f.root, { columns: 200, rows: 8 });
    await press(app, TAB, "j", "j", TAB, "j", "k", TAB);
    expect(selected(app.lastFrame())).toEqual(["a"]);
    expect(panelLines(app.lastFrame())).toEqual(AT_TOP);
  });

  test("a refresh keeps the scroll position", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, "j");
    await app.f.write("openspec/changes/a/tasks.md", READ_AND_DRAW.replace("- [ ] 2.1", "- [x] 2.1"));
    await refresh(app);
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 3 above", "  ✓ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "  ○ 2.5", "… 3 more"]);
  });

  test("fewer lines after a refresh: the panel shows its last lines, and k scrolls up from there", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, "j", "j", "j");
    await app.f.write("openspec/changes/a/tasks.md", section("1. Read", 3, 3) + section("2. Draw", 0, 7));
    await refresh(app);
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 4 above", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "  ○ 2.5", "  ○ 2.6", "  ○ 2.7"]);
    await press(app, "k");
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "… 3 above", "  ○ 2.1", "  ○ 2.2", "  ○ 2.3", "  ○ 2.4", "  ○ 2.5", "… 2 more"]);
  });

  test("a terminal made tall enough shows every line without a key", async () => {
    const app = await showTasks(READ_AND_DRAW, { columns: 200, rows: 8 });
    await press(app, TAB, "j", "j", "j");
    await resize(app, { columns: 200, rows: 20 });
    expect(panelLines(app.lastFrame())).toEqual(["a  main", "1. Read  ✓ 3/3", ...Array.from({ length: 3 }, (_, i) => `  ✓ 1.${i + 1}`), "2. Draw  0/8", ...Array.from({ length: 8 }, (_, i) => `  ○ 2.${i + 1}`)]);
  });

  test("an error panel does not scroll", async () => {
    const gone = await fixture({ git: false });
    const app = await show(gone.root, { columns: 70, rows: 4 });
    const before = panelLines(app.lastFrame());
    await press(app, TAB, "j");
    expect(panelLines(app.lastFrame())).toEqual(before);
  });
});
