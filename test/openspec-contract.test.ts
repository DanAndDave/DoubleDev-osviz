import { expect, test } from "bun:test";
import { join } from "node:path";
import { $ } from "bun";
import { readProject } from "../src/project/read.ts";
import { useFixtures } from "./fixture.ts";

const fixture = useFixtures();

/** The pinned devDependency, not whatever `openspec` is on PATH, so every machine runs the same counting rules. */
const OPENSPEC = join(import.meta.dir, "..", "node_modules", ".bin", "openspec");

const TASK_FILES: Record<string, string | undefined> = {
  nested: "## 1. Group\n- [x] 1.1 top\n  - [x] 1.1.1 nested\n    - [ ] 1.1.2 deeper\n\t- [X] tab-indented\n",
  fenced: "- [x] real\n```md\n- [x] inside fence\n- [ ] also inside\n```\n",
  starred: "* [x] star done\n* [ ] star open\n*[x] no space after star\n-[ ] no space after dash\n",
  uppercase: "- [X] upper\n- [x] lower\n- [ ] open\n- [\t] tab in box\n",
  "not-tasks": "- plain bullet\n[x] no bullet\n- [y] wrong mark\n- [] empty box\n1. [x] numbered\n",
  "no-tasks-file": undefined,
};

test("Task progress equals `openspec list --json` for every change", async () => {
  const f = await fixture({ git: false });
  await f.write("openspec/config.yaml", "schema: spec-driven\n");
  for (const [id, tasks] of Object.entries(TASK_FILES)) {
    await f.write(`openspec/changes/${id}/proposal.md`, `# ${id}\n`);
    if (tasks !== undefined) await f.write(`openspec/changes/${id}/tasks.md`, tasks);
  }

  const listed = (await $`${OPENSPEC} list --json`
    .cwd(f.root)
    .env({ ...process.env, OPENSPEC_TELEMETRY: "0", DO_NOT_TRACK: "1" })
    .json()) as { changes: { name: string; completedTasks: number; totalTasks: number }[] };
  const theirs = Object.fromEntries(listed.changes.map((c) => [c.name, { done: c.completedTasks, total: c.totalTasks }]));

  const snapshot = await readProject(f.root);
  if (snapshot.kind !== "ok") throw new Error(snapshot.message);
  const ours = Object.fromEntries(snapshot.changes.map((row) => [row.id, row.kind === "change" ? row.tasks : row.message]));

  expect(Object.keys(theirs).sort()).toEqual(Object.keys(TASK_FILES).sort());
  expect(ours).toEqual(theirs);
});
