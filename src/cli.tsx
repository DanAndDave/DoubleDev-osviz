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
const snapshot = await readProject(args.path, { base: args.base });
await render(<App snapshot={snapshot} />).waitUntilExit();
