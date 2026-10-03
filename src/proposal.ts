/** The `Blocked by:` and `Triage:` lines of a `proposal.md`, each whole and as written; absent when missing. */
export interface ProposalLines {
  blockedBy: string | undefined;
  triage: string | undefined;
}

/**
 * The first line starting with exactly `Blocked by:` and the first starting with exactly `Triage:`,
 * looking only above the first `## ` heading, so lines quoted further down are not mistaken for them.
 */
export function parseProposal(content: string): ProposalLines {
  const lines: ProposalLines = { blockedBy: undefined, triage: undefined };
  for (const raw of content.split("\n")) {
    const line = raw.trimEnd();
    if (line.startsWith("## ")) break;
    if (line.startsWith("Blocked by:")) lines.blockedBy ??= line;
    if (line.startsWith("Triage:")) lines.triage ??= line;
  }
  return lines;
}
