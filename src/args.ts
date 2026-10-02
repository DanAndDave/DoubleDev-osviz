import { resolve } from "node:path";

/** The absolute Project path from the command-line arguments (after the program name); defaults to `cwd`. */
export function projectPath(argv: string[], cwd: string): string {
  return resolve(cwd, argv[0] ?? ".");
}
