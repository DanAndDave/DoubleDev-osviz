import { resolve } from "node:path";
import { parseArgs } from "node:util";

export const USAGE = "usage: osviz [path] [--base <ref>]";

/**
 * The command-line arguments (after the program name): the absolute Project path, defaulting to
 * `cwd`, and the `--base` ref if given. A missing value or an unknown option is an error.
 */
export function parseCommandLine(argv: string[], cwd: string): { path: string; base: string | undefined } | { error: string } {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, strict: true, allowPositionals: true, options: { base: { type: "string" } } });
  } catch (error) {
    return { error: (error as Error).message };
  }
  return { path: resolve(cwd, parsed.positionals[0] ?? "."), base: parsed.values.base };
}
