import { resolve } from "node:path";
import { parseArgs } from "node:util";

export const USAGE = "usage: osviz [path ...] [--base <ref>]";

/** A Project named on the command line: `label` is the path as typed, `path` its absolute form. */
export interface ProjectArg {
  label: string;
  path: string;
}

/**
 * The command-line arguments (after the program name): the Projects in the order given, defaulting to
 * `cwd` (labelled with `cwd` itself), and the `--base` ref for every Project if given. A missing value or
 * an unknown option is an error.
 */
export function parseCommandLine(argv: string[], cwd: string): { projects: ProjectArg[]; base: string | undefined } | { error: string } {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { base: { type: "string" } } });
  } catch (error) {
    return { error: (error as Error).message };
  }
  const labels = parsed.positionals.length > 0 ? parsed.positionals : [cwd];
  return { projects: labels.map((label) => ({ label, path: resolve(cwd, label) })), base: parsed.values.base };
}
