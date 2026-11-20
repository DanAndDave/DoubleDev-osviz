#!/usr/bin/env bun
import { render } from "ink";
import { parseCommandLine, USAGE } from "./args.ts";
import { readProject } from "./project/read.ts";
import { App } from "./ui/App.tsx";

const args = parseCommandLine(process.argv.slice(2), process.cwd());
if ("error" in args) {
  console.error(`osviz: ${args.error}\n${USAGE}`);
  process.exit(2);
}
const projects = await Promise.all(
  args.projects.map(async ({ label, path }) => {
    const read = () => readProject(path, { base: args.base });
    return { label, initial: await read(), read };
  }),
);
// xterm button-event tracking (1002) reports presses, releases and motion while a button is held; 1006 reports them in SGR form.
const MOUSE_ON = "\u001B[?1002h\u001B[?1006h";
const MOUSE_OFF = "\u001B[?1002l\u001B[?1006l";
const onMouseCapture = (on: boolean) => {
  if (process.stdout.isTTY) process.stdout.write(on ? MOUSE_ON : MOUSE_OFF);
};
try {
  await render(<App projects={projects} onMouseCapture={onMouseCapture} />).waitUntilExit();
} finally {
  onMouseCapture(false);
}
