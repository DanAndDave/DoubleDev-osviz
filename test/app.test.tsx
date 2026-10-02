import { describe, expect, test } from "bun:test";
import { chmod } from "node:fs/promises";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { render } from "ink-testing-library";
import { useEffect } from "react";
import { readProject } from "../src/project/read.ts";
import { App } from "../src/ui/App.tsx";
import { useFixtures } from "./fixture.ts";

const fixture = useFixtures();

const BOLD = (s: string) => `\u001B[1m${s}\u001B[22m`;
const DIM = (s: string) => `\u001B[2m${s}\u001B[22m`;

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

describe("Change rows", () => {
  test("change in progress: id, artifact letters, bar 70% full, 7/10", async () => {
    const f = await fixture();
    await f.write("openspec/changes/add-auth/proposal.md");
    await f.write("openspec/changes/add-auth/specs/auth/spec.md");
    await f.write("openspec/changes/add-auth/tasks.md", `${"- [x] t\n".repeat(7)}${"- [ ] t\n".repeat(3)}`);
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`add-auth  P S D T  ${"█".repeat(14)}${"░".repeat(6)}  7/10`]);
    const row = styledLine(lastFrame(), "add-auth");
    for (const present of ["P", "S", "T"]) expect(row).toContain(BOLD(present));
    expect(row).toContain(DIM("D"));
  });

  test("change without tasks: empty bar and 0/0", async () => {
    const f = await fixture();
    await f.write("openspec/changes/idea/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([`idea  P S D T  ${"░".repeat(20)}  0/0`]);
  });

  test("ids are padded so the columns line up", async () => {
    const f = await fixture();
    await f.write("openspec/changes/a/proposal.md", "", new Date("2026-09-02T00:00:00Z"));
    await f.write("openspec/changes/longer-id/proposal.md", "", new Date("2026-09-01T00:00:00Z"));
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual([
      `a          P S D T  ${"░".repeat(20)}  0/0`,
      `longer-id  P S D T  ${"░".repeat(20)}  0/0`,
    ]);
  });

  test("archived changes get no row", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    await f.write("openspec/changes/live/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(lastFrame()).not.toContain("old-thing");
    expect(lastFrame()).toContain("live");
  });

  test("no active changes says so", async () => {
    const f = await fixture();
    await f.write("openspec/changes/archive/2026-08-01-old-thing/proposal.md");
    const { lastFrame } = await show(f.root);
    expect(plainLines(lastFrame())).toEqual(["No active changes"]);
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
  const INVERSE = "\u001B[7m";
  const DOWN = "\u001B[B";
  const UP = "\u001B[A";

  /** Ids of the rows drawn in inverse video. */
  function selected(frame: string | undefined): string[] {
    return (frame ?? "")
      .split("\n")
      .filter((line) => line.includes(INVERSE))
      .map((line) => stripVTControlCharacters(line).split(" ")[0]!);
  }

  async function threeRows() {
    const f = await fixture();
    for (const id of ["alpha", "bravo", "charlie"]) await f.write(`openspec/changes/${id}/proposal.md`);
    await f.commit(new Date("2026-09-01T00:00:00Z"));
    return show(f.root);
  }

  async function press(app: { stdin: { write(data: string): void } }, ...keys: string[]): Promise<void> {
    for (const key of keys) {
      app.stdin.write(key);
      await settle();
    }
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
    expect(lines[0]).toStartWith("broken  ✗ EACCES: permission denied");
    expect(lines.at(-1)).toBe(`fine    P S D T  ${"█".repeat(20)}  1/1`);
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
