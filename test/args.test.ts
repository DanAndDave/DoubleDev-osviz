import { expect, test } from "bun:test";
import { parseCommandLine } from "../src/args.ts";

test("a given path is the Project, labelled as typed and resolved against the working directory", () => {
  expect(parseCommandLine(["/work/app"], "/home/me")).toEqual({ projects: [{ label: "/work/app", path: "/work/app" }], base: undefined });
  expect(parseCommandLine(["app"], "/work")).toEqual({ projects: [{ label: "app", path: "/work/app" }], base: undefined });
});

test("several paths are Projects in the order given, a repeated path twice", () => {
  expect(parseCommandLine(["../web", "/work/api", "../web"], "/work/app")).toEqual({
    projects: [
      { label: "../web", path: "/work/web" },
      { label: "/work/api", path: "/work/api" },
      { label: "../web", path: "/work/web" },
    ],
    base: undefined,
  });
});

test("no path means the working directory, labelled with its absolute path", () => {
  expect(parseCommandLine([], "/work/app")).toEqual({ projects: [{ label: "/work/app", path: "/work/app" }], base: undefined });
});

test("--base names the Base for every Project, before, between or after the paths, with or without =", () => {
  const projects = [
    { label: "web", path: "/work/web" },
    { label: "api", path: "/work/api" },
  ];
  for (const argv of [
    ["--base", "develop", "web", "api"],
    ["web", "--base", "develop", "api"],
    ["web", "api", "--base", "develop"],
    ["web", "api", "--base=develop"],
  ]) {
    expect(parseCommandLine(argv, "/work")).toEqual({ projects, base: "develop" });
  }
});

test("--base without a value is an error", () => {
  expect(parseCommandLine(["--base"], "/work")).toEqual({ error: expect.stringContaining("--base") });
});

test("an unknown option is an error naming it", () => {
  expect(parseCommandLine(["--frobnicate"], "/work")).toEqual({ error: expect.stringContaining("--frobnicate") });
});
