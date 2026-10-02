/** `ran: false` means git itself could not be started (for example, not installed). */
type GitFailure = { ok: false; ran: boolean; message: string; stderr: string };
export type GitResult = { ok: true; stdout: string } | GitFailure;
type GitBytesResult = { ok: true; stdout: Uint8Array } | GitFailure;

/**
 * The only way this program runs git. `GIT_OPTIONAL_LOCKS=0` stops `git status` from refreshing
 * `.git/index` and taking `index.lock`, which keeps reads write-free (ADR 0001). `LC_ALL=C` keeps
 * error messages in English so callers can recognise expected failures in `stderr`.
 */
export async function git(cwd: string, args: string[]): Promise<GitResult> {
  const result = await gitBytes(cwd, args);
  return result.ok ? { ok: true, stdout: new TextDecoder().decode(result.stdout) } : result;
}

/** `git`, with `input` written to its stdin and stdout returned undecoded (for `cat-file --batch`). */
export async function gitBytes(cwd: string, args: string[], input?: string): Promise<GitBytesResult> {
  let proc;
  try {
    proc = Bun.spawn(["git", ...args], {
      cwd,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", LC_ALL: "C" },
      stdin: input === undefined ? "ignore" : new TextEncoder().encode(input),
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (error) {
    return { ok: false, ran: false, message: `cannot run git: ${String(error)}`, stderr: "" };
  }
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).bytes(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code === 0) return { ok: true, stdout };
  return { ok: false, ran: true, message: `git ${args[0]} failed: ${stderr.trim() || `exit code ${code}`}`, stderr };
}
