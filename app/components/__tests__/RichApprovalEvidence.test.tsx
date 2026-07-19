import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RichApprovalEvidence as RichApprovalEvidenceType } from "../../auto-resolution/types";
import { normalizeRichApprovalEvidence } from "../../auto-resolution/evidence-normalizer";

vi.mock("../GraphVisualizer", () => ({
  BlastRadiusVisualizer: () => <div data-testid="blast-radius-graph">Graph</div>,
}));

import RichApprovalEvidence, { evaluateApprovalEvidence } from "../RichApprovalEvidence";

const backendEvidence: RichApprovalEvidenceType = {
  astDiff: {
    kind: "ast_transformation",
    before: "return false;",
    after: "return true;",
    sourceHash: "before",
    resultHash: "after",
    operations: [{ operation: "replace", path: "classes/AccountService.cls" }],
  },
  blastRadiusGraph: {
    entityName: "Account",
    nodes: [{ id: "Account", label: "Account", type: "Object", risk: "High" }],
    edges: [],
  },
  causalProof: {
    diagnosis: "The validation rule causes the failure.",
    causes: [
      {
        id: "cause-1",
        label: "Validation rule",
        confidence: 0.97,
        evidenceRefs: ["rule-1"],
      },
    ],
    proof: { path: ["Account", "ValidationRule"] },
    generatedAt: "2026-07-16T10:00:00.000Z",
  },
  sandboxVideoUrl: null,
  sandboxVideoReason: "pending_deltabox",
};

describe("rich approval evidence gate", () => {
  it("normalizes and allows the real backend evidence payload without invented verification", () => {
    const normalized = normalizeRichApprovalEvidence(backendEvidence);

    expect(normalized?.astTransformation?.kind).toBe("ast_transformation");
    expect(normalized?.astTransformation?.beforeHash).toBe("before");
    expect(normalized?.blastRadius?.nodes[0]).toMatchObject({
      id: "Account",
      type: "Object",
    });
    expect(normalized?.causalProof?.status).toBe("PARTIAL");
    expect(
      evaluateApprovalEvidence({
        supportLevel: "L3",
        actionType: "PREPARE_PATCH",
        approvalProposalHash: "proposal-123",
        caseProposalHash: "proposal-123",
        evidence: normalized,
      }),
    ).toEqual({ required: true, allowed: true, reasons: [] });
  });

  it("maps identifiable Neo4j causal proofs to PROVEN and non-identifiable to NOT_PROVEN", () => {
    const proven = normalizeRichApprovalEvidence({
      ...backendEvidence,
      causalProof: {
        diagnosis: "Identified intervention.",
        causes: backendEvidence.causalProof && "causes" in backendEvidence.causalProof
          ? backendEvidence.causalProof.causes
          : [],
        proof: {
          status: "supported",
          result: "identifiable",
          structural_reachability: { supported: true },
          statistical_identification: { identifiable: true, method: "do_calculus" },
          assumptions: ["No unmeasured confounding"],
        },
        generatedAt: "2026-07-16T10:00:00.000Z",
      },
    });
    const notProven = normalizeRichApprovalEvidence({
      ...backendEvidence,
      causalProof: {
        diagnosis: "No path.",
        causes: [],
        proof: {
          status: "non_identifiable",
          result: "non_identifiable",
          structural_reachability: { supported: false },
          statistical_identification: { identifiable: false, method: "do_calculus" },
          assumptions: [],
        },
        generatedAt: "2026-07-16T10:00:00.000Z",
      },
    });

    expect(proven?.causalProof?.status).toBe("PROVEN");
    expect(proven?.causalProof?.assumptions).toEqual(["No unmeasured confounding"]);
    expect(notProven?.causalProof?.status).toBe("NOT_PROVEN");
  });

  it("blocks an unverified text diff and missing causal proof", () => {
    const normalized = normalizeRichApprovalEvidence({
      ...backendEvidence,
      astDiff: {
        kind: "unverified_text_diff",
        after: "return true;",
      },
      causalProof: undefined,
    });
    const gate = evaluateApprovalEvidence({
      supportLevel: "L3",
      approvalProposalHash: "proposal-123",
      caseProposalHash: "proposal-123",
      evidence: normalized,
    });

    render(<RichApprovalEvidence evidence={normalized} gate={gate} />);

    expect(gate.allowed).toBe(false);
    expect(screen.getByRole("alert")).toHaveTextContent("hash-bound AST transformation");
    expect(screen.getByRole("alert")).toHaveTextContent("not causally proven");
    expect(screen.getByText(/no causal proof supplied/i)).toBeInTheDocument();
  });

  it("requires TEE and DeltaBox only when the payload enables enforcement", () => {
    const normalized = normalizeRichApprovalEvidence({
      ...backendEvidence,
      evidenceRequirements: { tee: true, deltaBox: true },
    });
    const gate = evaluateApprovalEvidence({
      supportLevel: "L3",
      approvalProposalHash: "proposal-123",
      caseProposalHash: "proposal-123",
      evidence: normalized,
    });

    expect(gate.reasons).toContain("Required TEE attestation is not verified.");
    expect(gate.reasons).toContain(
      "Required DeltaBox sandbox or video evidence is missing.",
    );
  });

  it("normalizes backend TEE attestation and DeltaBox video evidence", () => {
    const normalized = normalizeRichApprovalEvidence({
      ...backendEvidence,
      sandboxVideoUrl: "https://evidence.example/run.mp4",
      teeAttestation: {
        provider: "gcp_confidential_space",
        nonce: "nonce",
        issuedAt: "2026-07-16T10:00:00.000Z",
        expiresAt: "2099-07-16T10:00:00.000Z",
        measurement: "measurement",
        inputHash: "input",
        outputHash: "output",
        tokenHash: "token",
        verified: true,
      },
      requirements: { tee: true, deltaBox: true },
    });

    expect(normalized?.teeAttestation).toMatchObject({
      status: "VERIFIED",
      quoteHash: "token",
      auditLogHash: "output",
    });
    expect(normalized?.sandbox?.video?.url).toBe(
      "https://evidence.example/run.mp4",
    );
  });

  it("renders a secure sandbox recording in the embedded video player", () => {
    const normalized = normalizeRichApprovalEvidence({
      ...backendEvidence,
      sandboxVideoUrl: "https://evidence.example/sandbox-run.mp4",
    });
    const gate = evaluateApprovalEvidence({
      supportLevel: "L3",
      actionType: "PREPARE_PATCH",
      approvalProposalHash: "proposal-123",
      caseProposalHash: "proposal-123",
      evidence: normalized,
    });

    const { container } = render(
      <RichApprovalEvidence evidence={normalized} gate={gate} />,
    );

    expect(container.querySelector("video")).toBeInTheDocument();
    expect(container.querySelector("video source")).toHaveAttribute(
      "src",
      "https://evidence.example/sandbox-run.mp4",
    );
  });

  it("shows terminal evidence as hash-bound without a stale approval warning", () => {
    const normalized = normalizeRichApprovalEvidence({
      ...backendEvidence,
      verification: {
        status: "PENDING",
        verified: false,
      },
      evidenceRequirements: { hashBinding: true },
    });
    const gate = evaluateApprovalEvidence({
      supportLevel: "L3",
      actionType: "PREPARE_PATCH",
      caseProposalHash: "proposal-123",
      evidence: normalized,
    });

    render(<RichApprovalEvidence evidence={normalized} gate={gate} finalized />);

    expect(screen.getByText("Evidence hash-bound")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Evidence pending")).not.toBeInTheDocument();
  });

  it("does not require the rich gate for a non-L3 answer", () => {
    expect(
      evaluateApprovalEvidence({
        supportLevel: "L1",
        actionType: "ANSWER",
      }),
    ).toEqual({ required: false, allowed: true, reasons: [] });
  });
});
