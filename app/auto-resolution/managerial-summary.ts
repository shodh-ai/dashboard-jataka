import type {
  AutoResolutionCase,
  ManagerialSummary,
} from "./types";

export type ManagerialSummaryView = {
  rootCause: string;
  fix: string;
  risk: string;
  isFallback: {
    rootCause: boolean;
    fix: boolean;
    risk: boolean;
  };
};

const INSUFFICIENT_CONTEXT =
  /(?:not enough|(?:do not|don't) have enough|insufficient)\s+(?:grounded\s+)?(?:context|information)|cannot answer|couldn't find|not covered/i;

function usableText(...values: unknown[]) {
  return values.find(
    (value): value is string =>
      typeof value === "string" &&
      value.trim().length > 0 &&
      !INSUFFICIENT_CONTEXT.test(value),
  )?.trim();
}

function explicitSummary(caseRow: AutoResolutionCase): ManagerialSummary {
  return caseRow.proposalSnapshot?.managerialSummary || {};
}

function causalDiagnosis(caseRow: AutoResolutionCase) {
  const evidence =
    caseRow.richEvidence || caseRow.proposalSnapshot?.richEvidence;
  const proof = evidence?.causalProof;
  if (!proof) return undefined;
  if ("diagnosis" in proof) return proof.diagnosis;
  return proof.claim;
}

export function buildManagerialSummary(
  caseRow: AutoResolutionCase,
): ManagerialSummaryView {
  const proposal = caseRow.proposalSnapshot;
  const evidence = caseRow.richEvidence || proposal?.richEvidence;
  const summary = explicitSummary(caseRow);

  const rootCause = usableText(
    summary.rootCause,
    causalDiagnosis(caseRow),
    evidence?.liveDiagnostic?.summary,
    caseRow.kamikazeDiagnosticSnapshot?.ok
      ? caseRow.kamikazeDiagnosticSnapshot.summary
      : undefined,
    proposal?.answer,
  );

  const fix = usableText(
    summary.fix,
    proposal?.actionInputSummary,
    proposal?.answer,
    evidence?.astDiff?.notes,
  );

  const risk = usableText(summary.risk, summary.riskLevel, proposal?.risk);

  return {
    rootCause:
      rootCause ||
      "The available grounded evidence does not yet establish a root cause.",
    fix:
      fix ||
      "No grounded remediation has been prepared for managerial review yet.",
    risk:
      risk ||
      "Risk has not yet been assessed from the available proposal evidence.",
    isFallback: {
      rootCause: !rootCause,
      fix: !fix,
      risk: !risk,
    },
  };
}
