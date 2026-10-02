import { stat } from "node:fs/promises";

/** Whether anything exists at `path`; any stat failure counts as absent. */
export async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
