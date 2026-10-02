#!/usr/bin/env bun
import { render } from "ink";
import { projectPath } from "./args.ts";
import { readProject } from "./project/read.ts";
import { App } from "./ui/App.tsx";

const snapshot = await readProject(projectPath(process.argv.slice(2), process.cwd()));
await render(<App snapshot={snapshot} />).waitUntilExit();
