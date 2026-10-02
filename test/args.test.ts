import { expect, test } from "bun:test";
import { parseCommandLine } from "../src/args.ts";

test("a given path is the Project, resolved against the working directory", () => {
  expect(parseCommandLine(["/work/app"], "/home/me")).toEqual({ path: "/work/app", base: undefined });
  expect(parseCommandLine(["app"], "/work")).toEqual({ path: "/work/app", base: undefined });
});

test("no path means the working directory", () => {
  expect(parseCommandLine([], "/work/app")).toEqual({ path: "/work/app", base: undefined });
});

test("--base names the Base, before or after the path, with or without =", () => {
  for (const argv of [["/work/app", "--base", "develop"], ["--base", "develop", "/work/app"], ["/work/app", "--base=develop"]]) {
    expect(parseCommandLine(argv, "/home/me")).toEqual({ path: "/work/app", base: "develop" });
  }
});

test("--base without a value is an error", () => {
  expect(parseCommandLine(["--base"], "/work")).toEqual({ error: expect.stringContaining("--base") });
});

test("an unknown option is an error naming it", () => {
  expect(parseCommandLine(["--frobnicate"], "/work")).toEqual({ error: expect.stringContaining("--frobnicate") });
});
