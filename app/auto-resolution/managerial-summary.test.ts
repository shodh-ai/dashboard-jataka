import { describe, expect, it } from "vitest";
import { buildManagerialSummary } from "./managerial-summary";
import type { AutoResolutionCase } from "./types";

function caseRow(
  overrides: Partial<AutoResolutionCase> = {},
): AutoResolutionCase {
  return {
    id: "case-1",
    issueText: "A save operation fails.",
    status: "PENDING_APPROVAL",
    source: "PORTAL",
    createdAt: "2026-07-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildManagerialSummary", () => {
  it("uses the typed proposal summary before fallback fields", () => {
    const summary = buildManagerialSummary(
      caseRow({
        proposalSnapshot: {
          answer: "Fallback proposal answer.",
          risk: "Fallback risk.",
          managerialSummary: {
            rootCause: "A required permission is absent.",
            fix: "Grant the scoped permission.",
            risk: "Low; access remains least-privilege.",
          },
        },
      }),
    );

    expect(summary).toEqual({
      rootCause: "A required permission is absent.",
      fix: "Grant the scoped permission.",
      risk: "Low; access remains least-privilege.",
      isFallback: { rootCause: false, fix: false, risk: false },
    });
  });

  it("derives safe content from grounded diagnostic and proposal fields", () => {
    const summary = buildManagerialSummary(
      caseRow({
        kamikazeDiagnosticSnapshot: {
          ok: true,
          summary: "Live read-only diagnostics found a missing object grant.",
        },
        proposalSnapshot: {
          answer: "Apply the reviewed metadata permission change.",
          risk: "LOW",
        },
      }),
    );

    expect(summary.rootCause).toContain("Live read-only diagnostics");
    expect(summary.fix).toBe(
      "Apply the reviewed metadata permission change.",
    );
    expect(summary.risk).toBe("LOW");
    expect(summary.isFallback).toEqual({
      rootCause: false,
      fix: false,
      risk: false,
    });
  });

  it("uses a grounded answer as the finding for legacy L1 and L2 proposals", () => {
    const summary = buildManagerialSummary(
      caseRow({
        supportLevel: "L1",
        proposalSnapshot: {
          answer:
            "Draft translations must be submitted from the Draft Translations list view.",
          proposedActionType: "ANSWER_ONLY",
          actionInputSummary:
            "Reply with the grounded answer. No system writes.",
          risk: "none",
        },
      }),
    );

    expect(summary.rootCause).toBe(
      "Draft translations must be submitted from the Draft Translations list view.",
    );
    expect(summary.fix).toBe(
      "Reply with the grounded answer. No system writes.",
    );
    expect(summary.isFallback).toEqual({
      rootCause: false,
      fix: false,
      risk: false,
    });
  });

  it("does not present insufficient-context text or invent missing evidence", () => {
    const summary = buildManagerialSummary(
      caseRow({
        proposalSnapshot: {
          answer:
            "I don't have enough context in the Knowledge Graph to answer.",
        },
      }),
    );

    expect(summary.rootCause).toContain("does not yet establish");
    expect(summary.fix).toContain("No grounded remediation");
    expect(summary.risk).toContain("not yet been assessed");
    expect(summary.isFallback).toEqual({
      rootCause: true,
      fix: true,
      risk: true,
    });
  });
});
