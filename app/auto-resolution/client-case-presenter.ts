import type { CaseDetail } from "./types";

const INSUFFICIENT_CONTEXT = /(?:not enough|(?:do not|don't) have enough|insufficient) grounded context/i;

export function clientCaseAnswer(detail: CaseDetail) {
  const caseRow = detail.case;
  const proposal = caseRow.proposalSnapshot?.answer?.trim();
  const diagnostic = caseRow.kamikazeDiagnosticSnapshot;

  if (caseRow.status === "RESOLVED") {
    if (caseRow.executionSnapshot?.externalMutated) {
      const commitSha = stringValue(caseRow.executionSnapshot.externalProof?.commitSha);
      return [
        "Resolved. Live Salesforce diagnostics identified the permission blocking Publish.",
        "The deterministic metadata fix passed the recorded safety validation before it was applied to the source repository.",
        commitSha ? `Verified repository commit: ${commitSha.slice(0, 7)}.` : "The repository readback was verified after execution.",
      ].join(" ");
    }
    return proposal || "Resolved. The approved solution was applied and its outcome was verified.";
  }

  if (caseRow.status === "FAILED") {
    return "We could not complete the automated investigation. Your support team has the captured evidence and will follow up.";
  }

  if (caseRow.status === "ESCALATED") {
    return "The automated checks could not safely complete this request, so it has been passed to your support team with the collected evidence.";
  }

  if (proposal && !INSUFFICIENT_CONTEXT.test(proposal)) return proposal;

  if (diagnostic?.ok && diagnostic.summary) {
    return `${diagnostic.summary} A deterministic fix is being prepared for review.`;
  }

  return proposal || "We're still working on this. Follow the live progress below.";
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}
