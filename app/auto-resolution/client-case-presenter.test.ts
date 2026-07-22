import { describe, expect, it } from "vitest";
import { clientCaseAnswer } from "./client-case-presenter";
import type { CaseDetail } from "./types";

function detail(overrides: Partial<CaseDetail["case"]>): CaseDetail {
  return {
    case: {
      id: "case-1",
      issueText: "Publish fails",
      status: "IN_PROGRESS",
      source: "PORTAL",
      createdAt: "2026-07-22T00:00:00.000Z",
      ...overrides,
    },
    approvals: [],
    auditEvents: [],
    steps: [],
  };
}

describe("clientCaseAnswer", () => {
  it("describes the verified outcome after a repository mutation", () => {
    const answer = clientCaseAnswer(
      detail({
        status: "RESOLVED",
        proposalSnapshot: { answer: "A fix is proposed." },
        executionSnapshot: {
          externalMutated: true,
          externalProof: { commitSha: "0d96bb8fc1b74cfa" },
        },
      }),
    );

    expect(answer).toContain("Resolved.");
    expect(answer).toContain("recorded safety validation");
    expect(answer).toContain("0d96bb8");
    expect(answer).not.toContain("Scratch Org checks");
    expect(answer).not.toContain("is proposed");
  });

  it("replaces stale insufficient-context copy after live evidence succeeds", () => {
    const answer = clientCaseAnswer(
      detail({
        proposalSnapshot: { answer: "I don't have enough grounded context." },
        kamikazeDiagnosticSnapshot: {
          ok: true,
          summary: "Live Salesforce check found object edit permission disabled.",
        },
      }),
    );

    expect(answer).toContain("Live Salesforce check found");
    expect(answer).not.toContain("enough grounded context");
  });
});
