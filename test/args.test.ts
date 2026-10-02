import { expect, test } from "bun:test";
import { projectPath } from "../src/args.ts";

test("a given path is the Project, resolved against the working directory", () => {
  expect(projectPath(["/work/app"], "/home/me")).toBe("/work/app");
  expect(projectPath(["app"], "/work")).toBe("/work/app");
});

test("no path means the working directory", () => {
  expect(projectPath([], "/work/app")).toBe("/work/app");
});
